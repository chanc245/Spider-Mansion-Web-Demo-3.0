// elevenlab.js
// Text-to-speech via ElevenLabs API.
// Returns a readable stream of audio bytes (mp3).

import { ElevenLabsClient } from "elevenlabs";

const VOICE_ID = "wJqPPQ618aTW29mptyoc";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_LABS_API_KEY,
});

export const convertTextToSpeech = async (text) => {
  console.log("Converting text to speech...");
  const audioStream = await client.textToSpeech.convert(VOICE_ID, {
    text,
    model_id: "eleven_multilingual_v2",
    output_format: "mp3_44100_128",
  });
  console.log("convertTextToSpeech -- stream ready");
  console.log("***");
  return audioStream;
};
