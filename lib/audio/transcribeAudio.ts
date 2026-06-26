import { experimental_transcribe as transcribe } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function transcribeAudioBuffer(audioBuffer: ArrayBuffer): Promise<string> {
  const result = await transcribe({
    model: openai.transcription("whisper-1"),
    audio: new Uint8Array(audioBuffer),
    providerOptions: {
      openai: { language: "en" },
    },
  });
  return result.text;
}
