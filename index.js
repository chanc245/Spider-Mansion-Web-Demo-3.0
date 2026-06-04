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

const port = process.env.PORT || 3001;

// -------- OPENAI CLIENT --------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getGptResultAsString(input) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1";

  const resp = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are Eva in a lateral-thinking puzzle. ALWAYS reply in exactly two lines: " +
          'first line strictly one of: "yes." | "no." | "doesn\'t relate." | "that\'s correct!", ' +
          "second line a very short (≤15 words) playful, slightly eerie nudge. No emojis. Never restate the puzzle or reveal the answer unless correct.",
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
    console.error("Error:", err);
    res
      .status(500)
      .json({ error: "Failed to generate output. Please try again." });
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
