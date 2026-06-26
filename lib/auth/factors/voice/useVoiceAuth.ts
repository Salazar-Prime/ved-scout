"use client";

import { useState, useRef, useCallback } from "react";
import { AuthFactorState } from "../types";

export interface UseVoiceAuthReturn {
  factorState: AuthFactorState;
  isRecording: boolean;
  startCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;
}

const MAX_RECORDING_MS = 10_000;

export function useVoiceAuth(): UseVoiceAuthReturn {
  const [factorState, setFactorState] = useState<AuthFactorState>({ status: "idle" });
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const verify = useCallback(async (audioBlob: Blob) => {
    setFactorState({ status: "pending" });

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "voice-auth.webm");

      const response = await fetch("/api/auth/voice/verify", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Verification request failed");
      }

      const { matched } = await response.json();

      if (matched) {
        setFactorState({ status: "authenticated" });
      } else {
        setFactorState({ status: "error", errorMessage: "Passphrase did not match. Try again." });
      }
    } catch (error) {
      setFactorState({
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Voice authentication failed",
      });
    }
  }, []);

  const stopCapture = useCallback(async () => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    await new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);

        if (audioBlob.size > 0) {
          await verify(audioBlob);
        } else {
          setFactorState({ status: "error", errorMessage: "No audio captured. Try again." });
        }
        resolve();
      };
      recorder.stop();
    });
  }, [verify]);

  const startCapture = useCallback(async () => {
    setFactorState({ status: "idle" });
    audioChunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setFactorState({ status: "error", errorMessage: "Microphone access denied." });
      return;
    }

    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    recorder.start(250);
    setIsRecording(true);

    autoStopTimerRef.current = setTimeout(() => {
      stopCapture();
    }, MAX_RECORDING_MS);
  }, [stopCapture]);

  return { factorState, isRecording, startCapture, stopCapture };
}
