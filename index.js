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

// -------- OPENAI CLIENT --------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Use Node's native fetch (undici). The SDK's default keep-alive HTTP agent
  // throws ERR_STREAM_PREMATURE_CLOSE on Node 22.x ("Premature close"), which
  // made every /submit return 500; native fetch resolves it.
  fetch: (...args) => fetch(...args),
});

async function getGptResultAsString(input) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1";

  const resp = await openai.chat.completions.create({
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
          "puzzle or reveal the answer unless the guess is correct.",
      },
      { role: "user", content: input },
    ],
    temperature: 0.7,
    top_p: 0.9,
  });

  const text =
    resp?.choices?.[0]?.message?.content?.trim() ??
    "(No response text from model.)";
  return text;
}

// ---- API: POST /submit  -> { ai: "..." }
app.post("/submit", async (req, res) => {
  try {
    const { input } = req.body || {};
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Missing 'input' string." });
    }
    const aiResponse = await getGptResultAsString(input);
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
