import { NextRequest, NextResponse } from "next/server";
import { transcribeAudioBuffer } from "@/lib/audio/transcribeAudio";
import { isVoiceAuthConfigured, passphrasesMatch } from "@/lib/auth/factors/voice/voiceAuthConfig";

export async function POST(request: NextRequest) {
  if (!isVoiceAuthConfigured()) {
    return NextResponse.json(
      { error: "Voice auth not configured" },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  try {
    const audioBuffer = await audioFile.arrayBuffer();
    const transcript = await transcribeAudioBuffer(audioBuffer);
    const matched = passphrasesMatch(transcript, process.env.VOICE_AUTH_PASSPHRASE!);
    return NextResponse.json({ matched });
  } catch (error) {
    console.error("Voice verify error:", error);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
