"use client";

import { Loader2, Mic, Square } from "lucide-react";
import type { UseVoiceAuthReturn } from "@/lib/auth/factors/voice/useVoiceAuth";

interface VoiceAuthCaptureProps {
  hook: UseVoiceAuthReturn;
}

export default function VoiceAuthCapture({ hook }: VoiceAuthCaptureProps) {
  const { factorState, isRecording, startCapture, stopCapture } = hook;
  const isPending = factorState.status === "pending";
  const isError = factorState.status === "error";

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto mt-6">
      <p className="text-xs text-zinc-500 text-center">
        Speak your voice passphrase
      </p>

      {/* Record / Stop button */}
      <button
        onClick={isRecording ? stopCapture : startCapture}
        disabled={isPending}
        className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300 focus:outline-none disabled:cursor-not-allowed
          ${isRecording
            ? "bg-red-900/30 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse"
            : isPending
              ? "bg-zinc-800 border-zinc-600"
              : "bg-zinc-900 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800"
          }`}
        title={isRecording ? "Stop recording" : "Start recording"}
      >
        {isPending ? (
          <Loader2 size={28} className="text-[#cfb991] animate-spin" />
        ) : isRecording ? (
          <Square size={24} className="text-red-400" fill="currentColor" />
        ) : (
          <Mic size={28} className="text-zinc-400" />
        )}
      </button>

      <p className="text-xs text-zinc-600 text-center">
        {isPending
          ? "Verifying…"
          : isRecording
            ? "Recording… tap to stop"
            : "Tap to record"}
      </p>

      {/* Error / retry */}
      {isError && (
        <div className="flex flex-col items-center gap-2 w-full">
          {factorState.errorMessage && (
            <p className="text-sm text-center text-zinc-400">{factorState.errorMessage}</p>
          )}
          <button
            onClick={startCapture}
            className="px-5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm
              hover:bg-zinc-700 hover:border-zinc-600 transition-all"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
