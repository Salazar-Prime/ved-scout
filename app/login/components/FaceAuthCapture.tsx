"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { UseFaceAuthReturn } from "@/lib/auth/factors/face/useFaceAuth";

interface FaceAuthCaptureProps {
  hook: UseFaceAuthReturn;
}

export default function FaceAuthCapture({ hook }: FaceAuthCaptureProps) {
  const { mode, factorState, videoRef, startCapture, identify, register } = hook;
  const [userId, setUserId] = useState("");
  const isPending = factorState.status === "pending";

  // Start camera after the <video> element has mounted
  useEffect(() => {
    startCapture();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-trigger identify once camera is running (brief warm-up)
  useEffect(() => {
    if (mode !== "capturing") return;
    const timer = setTimeout(() => {
      identify();
    }, 1800);
    return () => clearTimeout(timer);
  }, [mode, identify]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto mt-6">
      {/* Live camera feed */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 shadow-lg">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 size={32} className="text-[#cfb991] animate-spin" />
          </div>
        )}
      </div>

      {/* Status / error text */}
      {factorState.errorMessage && (
        <p className="text-sm text-center text-zinc-400">{factorState.errorMessage}</p>
      )}

      {/* Register flow: appears after identify fails */}
      {mode === "registering" && !isPending && (
        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-xs text-zinc-500 text-center">
            First time? Enter a name to register your face.
          </p>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Your name or user ID"
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-[#cfb991]/60"
            onKeyDown={(e) => e.key === "Enter" && userId.trim() && register(userId)}
          />
          <button
            onClick={() => register(userId)}
            disabled={!userId.trim()}
            className="px-6 py-2 rounded-lg bg-[#cfb991]/15 border border-[#cfb991]/40 text-[#cfb991] text-sm font-semibold
              hover:bg-[#cfb991]/25 hover:border-[#cfb991]/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Register & Enter
          </button>
        </div>
      )}

      {/* Retry button for errors */}
      {factorState.status === "error" && (
        <button
          onClick={identify}
          className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
