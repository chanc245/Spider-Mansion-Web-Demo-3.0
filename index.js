// ---------- AI SERVER ----------

// ENV variables: OPENAI_MODEL, OPENAI_API_KEY, ELEVEN_LABS_API_KEY

import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
import OpenAI from "openai";
import { convertTextToSpeech } from "./elevenlab.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// serve static files from /public
app.use(express.static(join(__dirname, "public")));

// /dev overlay (localhost:3001/dev/): the static line above already serves
// any override that exists in public/dev/. This fallback serves everything
// NOT overridden from the shared public/ files, so /dev is a variant that
// only stores its changed/new files and shares the rest with the root version.
app.use("/dev", express.static(join(__dirname, "public")));

const port = process.env.PORT || 3001;

// -------- AI CLIENTS (ChatGPT vs local Ollama) --------
// Both use the same OpenAI SDK; Ollama exposes an OpenAI-compatible endpoint,
// so switching provider is just a different baseURL + model.
// Note on fetch: use Node's native fetch (undici). The SDK's default
// keep-alive HTTP agent throws ERR_STREAM_PREMATURE_CLOSE on Node 22.x
// ("Premature close"), which made every /submit return 500.
const PROVIDERS = {
  openai: {
    label: "ChatGPT (API credit)",
    client: new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      fetch: (...args) => fetch(...args),
    }),
    model: () => process.env.OPENAI_MODEL || "gpt-4.1",
  },
  local: {
    label: "Local (Ollama)",
    client: new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
      apiKey: "ollama", // Ollama ignores the key, but the SDK requires one
      fetch: (...args) => fetch(...args),
    }),
    // qwen3:8b judges the puzzles reliably (6/6 on the EvaAI test set) at
    // ~10s/answer. On low-spec machines set OLLAMA_MODEL=llama3.2 (~2GB) —
    // fast but judges noticeably worse.
    model: () => process.env.OLLAMA_MODEL || "qwen3:8b",
  },
  hf: {
    label: "Hugging Face (free tier)",
    // HF's Inference Providers router speaks the OpenAI chat-completions API;
    // players bring their own (free) HF token via the AI gate. HF_API_KEY is
    // an optional server-side fallback token for dev/testing.
    baseURL: "https://router.huggingface.co/v1",
    client: new OpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: process.env.HF_API_KEY || "none",
      fetch: (...args) => fetch(...args),
    }),
    model: () => process.env.HF_MODEL || "Qwen/Qwen3-8B",
  },
};
let aiProvider = (process.env.AI_PROVIDER || "openai").toLowerCase();
if (!PROVIDERS[aiProvider]) aiProvider = "openai";

// Players can bring their own OpenAI key (AI gate screen at game start): the
// key lives only in their browser and rides along on each /submit request.
// Clients are cached per key so we don't rebuild one every request. The key
// itself is never logged or persisted server-side.
const playerClients = new Map(); // "<provider>:<apiKey>" -> OpenAI client
const MAX_PLAYER_CLIENTS = 50;
function clientForKey(providerKey, apiKey) {
  const cacheKey = `${providerKey}:${apiKey}`;
  if (!playerClients.has(cacheKey)) {
    if (playerClients.size >= MAX_PLAYER_CLIENTS) {
      playerClients.delete(playerClients.keys().next().value); // drop oldest
    }
    playerClients.set(
      cacheKey,
      new OpenAI({
        apiKey,
        baseURL: PROVIDERS[providerKey].baseURL, // undefined = OpenAI default
        fetch: (...args) => fetch(...args),
      }),
    );
  }
  return playerClients.get(cacheKey);
}

// Small open-weight models (local llama3.2/qwen3 via Ollama, HF-hosted Qwen)
// tend to answer "no." to off-topic questions instead of "doesn't relate.",
// even with few-shot examples in the prompt. They follow a short, ordered
// checklist far better than prose rules, so for every provider EXCEPT OpenAI
// we append one and lower the temperature.
const OPEN_MODEL_DECISION_STEPS = `
DECISION PROCEDURE — before answering, silently follow these steps IN ORDER:
STEP 1 — TOPIC CHECK: Is the player's CURRENT input a question or guess about the
  puzzle STORY itself (its characters, objects, events, causes)?
  If it is instead about YOU the host (your name, who you are), the game or its
  rules, a greeting, chit-chat, an insult, a request for the answer or a hint,
  or anything else outside the puzzle story -> first line MUST be
  "doesn't relate." — NOT "no.". ("no." is reserved for on-topic guesses that
  are false.)
STEP 2 — Only if STEP 1 says the input IS about the puzzle story: compare it to
  the secret solution and answer "yes." (true) or "no." (false).
STEP 3 — Answer "that's correct!" ONLY when the player states the HIDDEN
  explanation (the secret solution's core idea, e.g. who/what "I" really am).
  NEVER award "that's correct!" for a question that merely restates or asks
  about facts already given in the puzzle text — those get "yes." or "no.".
  If WIN CRITERIA are listed, they must be fully met.
`.trim();

async function getGptResultAsString(input, providerOverride, playerApiKey) {
  const providerKey = PROVIDERS[providerOverride] ? providerOverride : aiProvider;
  // Open-weight models (local Ollama, HF-hosted Qwen) need the checklist +
  // low temperature; only OpenAI's models follow the prose rules reliably.
  const isOpenModel = providerKey !== "openai";
  const isLocal = providerKey === "local";
  const model = PROVIDERS[providerKey].model();
  // A player-supplied key applies to keyed providers (OpenAI / HF); local
  // Ollama ignores it.
  const client =
    !isLocal && playerApiKey
      ? clientForKey(providerKey, playerApiKey)
      : PROVIDERS[providerKey].client;

  const resp = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are the AI host of a lateral-thinking puzzle. Follow the persona, tone, " +
          "nudge policy, win criteria, rules, and examples defined in the user's message exactly — do NOT " +
          "override the persona with one of your own. Reply in exactly two lines: " +
          'first line strictly one of: "yes." | "no." | "doesn\'t relate." | "that\'s correct!" ' +
          "(lowercase, keep the period). Second line: one very short (≤15 words) in-character " +
          "nudge in the persona's voice. EXCEPTION: when the first line is \"that's correct!\", the " +
          "second line may instead be a brief 1–2 sentence recap of what actually happened, in the " +
          "persona's voice. Only say \"that's correct!\" when the message's WIN CRITERIA (if any) are " +
          "fully met. No emojis or decorative symbols. Never restate the " +
          "puzzle or reveal the answer unless the guess is correct." +
          (isOpenModel ? "\n\n" + OPEN_MODEL_DECISION_STEPS : ""),
      },
      { role: "user", content: input },
    ],
    // Small open models need a low temperature to follow the strict two-line
    // format and the decision procedure; GPT keeps the original settings.
    temperature: isOpenModel ? 0.3 : 0.7,
    top_p: 0.9,
  });

  // Reasoning models (e.g. deepseek-r1 on Ollama) wrap their chain-of-thought
  // in <think>…</think>; strip it so only the two-line reply reaches the game.
  // Also strip emoji — the prompt forbids them, but open models occasionally
  // slip one into the win wrap-up (seen: 🕷️ from HF Qwen3-8B).
  const raw = resp?.choices?.[0]?.message?.content ?? "";
  const text = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
  return text || "(No response text from model.)";
}

// Debug password — gates the ?debug panel (public/debug.js) and the
// server-wide provider switch below, so a stray visitor adding ?debug to the
// URL can't flip the AI for everyone. Deliberately has NO default in code:
// set DEBUG_PASSWORD in .env (git-ignored). Unset = debug features disabled.
const DEBUG_PASSWORD = process.env.DEBUG_PASSWORD || null;

// ---- API: POST /debug-auth -> { ok }
// The debug panel verifies the password here before it builds itself.
app.post("/debug-auth", (req, res) => {
  if (!DEBUG_PASSWORD) return res.json({ ok: false, disabled: true });
  res.json({ ok: (req.body?.password ?? "") === DEBUG_PASSWORD });
});

// ---- API: GET/POST /ai-provider -> { provider, model, providers }
// Runtime toggle between ChatGPT and local Ollama (used by the debug panel).
// Per-tab choices come from the AI gate (sessionStorage), sent with /submit.
// POST switches the provider for the WHOLE server (every player), so it
// requires the debug password; GET is harmless and stays open.
const providerInfo = () => ({
  provider: aiProvider,
  model: PROVIDERS[aiProvider].model(),
  providers: Object.fromEntries(
    Object.entries(PROVIDERS).map(([k, p]) => [k, { label: p.label, model: p.model() }]),
  ),
});
app.get("/ai-provider", (req, res) => res.json(providerInfo()));
app.post("/ai-provider", (req, res) => {
  const { provider, password } = req.body || {};
  if (!DEBUG_PASSWORD || (password ?? "") !== DEBUG_PASSWORD) {
    return res.status(403).json({ error: "Wrong debug password." });
  }
  if (!PROVIDERS[provider]) {
    return res.status(400).json({
      error: `Unknown provider. Use one of: ${Object.keys(PROVIDERS).join(", ")}`,
    });
  }
  aiProvider = provider;
  console.log(`AI provider switched to: ${provider} (${PROVIDERS[provider].model()})`);
  res.json(providerInfo());
});

// ---- API: POST /ai-check -> { ok, model?, error? }
// Used by the AI gate screen to validate the player's choice before starting:
//   { provider: "openai", apiKey? }  -> cheap models.list() with that key
//                                       (or the server's key when apiKey empty)
//   { provider: "local" }            -> pings Ollama and checks the model exists
// The key is used once for the check and never logged or stored.
app.post("/ai-check", async (req, res) => {
  const { provider, apiKey, debugServerKey } = req.body || {};
  try {
    // Players must bring their own key/token — the server's env keys are never
    // offered through the gate (they'd spend the game owner's credit).
    // Exception: debugServerKey (sent by the gate only when ?debug=1 is on —
    // the developer testing with their own server) validates the env key.
    if (provider === "openai") {
      if (!apiKey && debugServerKey && process.env.OPENAI_API_KEY) {
        await PROVIDERS.openai.client.models.list();
        return res.json({ ok: true, model: PROVIDERS.openai.model() + " (server key)" });
      }
      if (!apiKey) {
        return res.json({ ok: false, error: "Please enter your OpenAI API key." });
      }
      const client = clientForKey("openai", apiKey);
      await client.models.list(); // fails fast on a bad key; costs no tokens
      return res.json({ ok: true, model: PROVIDERS.openai.model() });
    }
    if (provider === "hf") {
      const token =
        apiKey || (debugServerKey ? process.env.HF_API_KEY : undefined);
      if (!token) {
        return res.json({ ok: false, error: "Please enter your Hugging Face access token (free account works — huggingface.co/settings/tokens)." });
      }
      // The router's /models endpoint doesn't require auth, so it can't
      // validate a token — whoami does, and costs no inference credit.
      const r = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        return res.json({ ok: false, error: "That token was rejected by Hugging Face — double-check it at huggingface.co/settings/tokens." });
      }
      return res.json({
        ok: true,
        model: PROVIDERS.hf.model() + (apiKey ? "" : " (server key)"),
      });
    }
    if (provider === "local") {
      const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
      const model = PROVIDERS.local.model();
      const r = await fetch(`${base}/models`).catch(() => null);
      if (!r?.ok) {
        return res.json({ ok: false, error: "Ollama isn't running on this computer. Install it from ollama.com, then: ollama pull " + model });
      }
      const list = await r.json();
      const found = (list?.data ?? []).some(
        (m) => m.id === model || m.id.startsWith(model + ":"),
      );
      if (!found) {
        return res.json({ ok: false, error: `Model "${model}" isn't downloaded yet — run: ollama pull ${model}` });
      }
      return res.json({ ok: true, model });
    }
    return res.status(400).json({ ok: false, error: "Unknown provider." });
  } catch (err) {
    const msg =
      err?.status === 401
        ? "That key/token was rejected — double-check it and try again."
        : err?.message || String(err);
    return res.json({ ok: false, error: msg });
  }
});

// ---- API: POST /submit  -> { ai: "..." }
// Body: { input, provider?, apiKey? }. provider/apiKey come from the AI gate
// (dev overlay). When absent — the root game, or a direct request — the call
// falls through to the server default provider WITH THE SERVER'S ENV KEY.
// The gate's "players bring their own key" rule is a UI convention, not a
// server-side boundary: don't put an OPENAI_API_KEY you aren't willing to
// spend into the .env of a publicly hosted deployment.
app.post("/submit", async (req, res) => {
  try {
    const { input, provider, apiKey } = req.body || {};
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Missing 'input' string." });
    }
    const aiResponse = await getGptResultAsString(input, provider, apiKey);
    res.json({ ai: aiResponse });
  } catch (err) {
    // Log full error to the server terminal, and surface the key fields
    // (status/code/message) so the cause is visible client-side too.
    console.error("/submit error:", err?.status, err?.code, err?.message, err);
    res.status(500).json({
      error: "Failed to generate output. Please try again.",
      detail: {
        status: err?.status ?? null,
        code: err?.code ?? null,
        message: err?.message ?? String(err),
      },
    });
  }
});

// ---- API: POST /tts  -> audio/mpeg stream
// Body: { text: "..." }
// Streams the ElevenLabs mp3 directly back to the browser.
// Kept separate from /submit so TTS failures never break the game logic.
app.post("/tts", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing 'text' string." });
    }
    const audioStream = await convertTextToSpeech(text);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");

    // ElevenLabs SDK returns a Web ReadableStream, not a Node stream.
    // Convert it so we can pipe it into the Express response.
    const { Readable } = await import("stream");
    const nodeStream = Readable.fromWeb(audioStream);
    nodeStream.pipe(res);
    nodeStream.on("error", (err) => {
      console.error("TTS stream error:", err);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    console.error("TTS error:", err);
    if (!res.headersSent)
      res.status(500).json({ error: "TTS failed. Please try again." });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
