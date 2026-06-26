"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ScanFace, Mic, Shield } from "lucide-react";
import { useFaceAuth } from "@/lib/auth/factors/face/useFaceAuth";
import { useVoiceAuth } from "@/lib/auth/factors/voice/useVoiceAuth";
import FaceAuthCapture from "./components/FaceAuthCapture";
import VoiceAuthCapture from "./components/VoiceAuthCapture";

type VaultState = "locked" | "opening" | "open";

export default function LoginPage() {
  const router = useRouter();
  const faceAuth = useFaceAuth();
  const voiceAuth = useVoiceAuth();

  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [showVoiceCapture, setShowVoiceCapture] = useState(false);
  const [vaultState, setVaultState] = useState<VaultState>("locked");
  const sessionCreated = useRef(false);

  const faceAuthenticated = faceAuth.factorState.status === "authenticated";
  const voiceAuthenticated = voiceAuth.factorState.status === "authenticated";
  const allAuthenticated = faceAuthenticated && voiceAuthenticated;

  const createSessionAndRedirect = useCallback(async () => {
    if (sessionCreated.current) return;
    sessionCreated.current = true;

    try {
      await fetch("/api/auth/session", { method: "POST" });
    } catch {
      // Session creation is best-effort; redirect anyway
    }
    router.push("/overview");
  }, [router]);

  // Trigger vault animation when all factors pass
  useEffect(() => {
    if (allAuthenticated && vaultState === "locked") {
      setVaultState("opening");
    }
  }, [allAuthenticated, vaultState]);

  const handleFaceIconClick = () => {
    if (faceAuthenticated) return;
    if (showFaceCapture) {
      faceAuth.stopCapture();
      setShowFaceCapture(false);
    } else {
      setShowVoiceCapture(false);
      setShowFaceCapture(true);
    }
  };

  const handleVoiceIconClick = () => {
    if (voiceAuthenticated) return;
    if (showVoiceCapture) {
      setShowVoiceCapture(false);
    } else {
      setShowFaceCapture(false);
      faceAuth.stopCapture();
      setShowVoiceCapture(true);
    }
  };

  // Auto-close capture panels when each factor authenticates
  useEffect(() => {
    if (faceAuthenticated && showFaceCapture) {
      setShowFaceCapture(false);
    }
  }, [faceAuthenticated, showFaceCapture]);

  useEffect(() => {
    if (voiceAuthenticated && showVoiceCapture) {
      setShowVoiceCapture(false);
    }
  }, [voiceAuthenticated, showVoiceCapture]);

  return (
    <div className="relative w-full h-screen bg-zinc-950 overflow-hidden flex flex-col items-center justify-center">

      {/* ── Vault doors ── */}
      {vaultState !== "locked" && (
        <>
          <div
            className={`absolute inset-y-0 left-0 w-1/2 bg-zinc-950 z-30 ${vaultState === "opening" ? "vault-door-left" : "hidden"}`}
            onAnimationEnd={() => {
              setVaultState("open");
              createSessionAndRedirect();
            }}
          />
          <div
            className={`absolute inset-y-0 right-0 w-1/2 bg-zinc-950 z-30 ${vaultState === "opening" ? "vault-door-right" : "hidden"}`}
          />
          {/* Subtle gold glow on open */}
          {vaultState === "open" && (
            <div className="absolute inset-0 z-20 bg-[#cfb991]/5 vault-content-reveal pointer-events-none" />
          )}
        </>
      )}

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center gap-10 px-6 w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2.5 mb-1">
            <Shield size={22} className="text-[#cfb991]" />
            <h1 className="text-3xl font-bold tracking-widest text-white uppercase">
              VED-SCOUT
            </h1>
          </div>
          <p className="text-sm text-zinc-500 tracking-wide max-w-xs">
            Voice Enabled autonomous Drone weed Scouting
          </p>
        </div>

        {/* Factor icons */}
        <div className="flex items-center gap-12">

          {/* Face factor */}
          <button
            onClick={handleFaceIconClick}
            disabled={faceAuthenticated || faceAuth.factorState.status === "pending"}
            className="flex flex-col items-center gap-2 group focus:outline-none disabled:cursor-default"
            title={faceAuthenticated ? "Face authenticated" : "Click to authenticate with face"}
          >
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                ${faceAuthenticated
                  ? "bg-[#cfb991]/15 border-2 border-[#cfb991]/60 shadow-[0_0_24px_rgba(207,185,145,0.25)]"
                  : showFaceCapture
                    ? "bg-zinc-800 border-2 border-zinc-600"
                    : "bg-zinc-900 border-2 border-zinc-700 group-hover:border-zinc-500 group-hover:bg-zinc-800"
                }`}
            >
              <ScanFace
                size={32}
                className={`transition-colors duration-300 ${
                  faceAuthenticated ? "text-[#cfb991]" : "text-zinc-500 group-hover:text-zinc-300"
                }`}
                strokeWidth={faceAuthenticated ? 1.5 : 1.25}
              />
            </div>
            <span className={`text-xs font-medium tracking-wide transition-colors ${
              faceAuthenticated ? "text-[#cfb991]" : "text-zinc-500"
            }`}>
              {faceAuthenticated ? "Face ✓" : "Face ID"}
            </span>
          </button>

          {/* Voice factor */}
          <button
            onClick={handleVoiceIconClick}
            disabled={voiceAuthenticated || voiceAuth.factorState.status === "pending"}
            className="flex flex-col items-center gap-2 group focus:outline-none disabled:cursor-default"
            title={voiceAuthenticated ? "Voice authenticated" : "Click to authenticate with voice"}
          >
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                ${voiceAuthenticated
                  ? "bg-[#cfb991]/15 border-2 border-[#cfb991]/60 shadow-[0_0_24px_rgba(207,185,145,0.25)]"
                  : showVoiceCapture
                    ? "bg-zinc-800 border-2 border-zinc-600"
                    : "bg-zinc-900 border-2 border-zinc-700 group-hover:border-zinc-500 group-hover:bg-zinc-800"
                }`}
            >
              <Mic
                size={32}
                className={`transition-colors duration-300 ${
                  voiceAuthenticated ? "text-[#cfb991]" : "text-zinc-500 group-hover:text-zinc-300"
                }`}
                strokeWidth={voiceAuthenticated ? 1.5 : 1.25}
              />
            </div>
            <span className={`text-xs font-medium tracking-wide transition-colors ${
              voiceAuthenticated ? "text-[#cfb991]" : "text-zinc-500"
            }`}>
              {voiceAuthenticated ? "Voice ✓" : "Voice"}
            </span>
          </button>

        </div>

        {/* Face capture panel */}
        {showFaceCapture && !faceAuthenticated && (
          <FaceAuthCapture hook={faceAuth} />
        )}

        {/* Voice capture panel */}
        {showVoiceCapture && !voiceAuthenticated && (
          <VoiceAuthCapture hook={voiceAuth} />
        )}

        {/* Hint text */}
        {!showFaceCapture && !showVoiceCapture && !allAuthenticated && (
          <p className="text-xs text-zinc-600 text-center">
            Click Face ID or Voice to authenticate
          </p>
        )}

      </div>
    </div>
  );
}
