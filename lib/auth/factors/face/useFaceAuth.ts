"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { AuthFactorState } from "../types";
import { faceAuthConfig, isFaceAuthConfigured } from "./faceAuthConfig";

// Dynamically imported at call-site to avoid SSR issues
type FaceId = import("@face-auth/face-auth").FaceId;
type FaceVideo = import("@face-auth/face-auth").FaceVideo;
type FaceGuidelines = import("@face-auth/face-auth").FaceGuidelines;

export type FaceAuthMode = "idle" | "capturing" | "registering";

export interface UseFaceAuthReturn {
  factorState: AuthFactorState;
  mode: FaceAuthMode;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startCapture: () => void;
  stopCapture: () => void;
  identify: () => Promise<void>;
  register: (userId: string) => Promise<void>;
}

export function useFaceAuth(): UseFaceAuthReturn {
  const [factorState, setFactorState] = useState<AuthFactorState>({ status: "idle" });
  const [mode, setMode] = useState<FaceAuthMode>("idle");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceIdRef = useRef<FaceId | null>(null);
  const faceVideoRef = useRef<FaceVideo | null>(null);
  const faceGuidelinesRef = useRef<FaceGuidelines | null>(null);

  // Initialize FaceId client once on mount
  useEffect(() => {
    if (!isFaceAuthConfigured()) {
      setFactorState({ status: "error", errorMessage: "Face Auth is not configured. Check environment variables." });
      return;
    }

    const initFaceId = async () => {
      const { FaceId } = await import("@face-auth/face-auth");
      faceIdRef.current = new FaceId(faceAuthConfig.domain, faceAuthConfig.clientToken);
    };
    initFaceId();
  }, []);

  const startCapture = useCallback(async () => {
    if (!videoRef.current) return;
    setMode("capturing");
    setFactorState({ status: "pending" });

    try {
      const { FaceVideo, FaceGuidelines } = await import("@face-auth/face-auth");
      const faceVideo = new FaceVideo(videoRef.current);
      faceVideoRef.current = faceVideo;

      faceVideo.onCameraStarted(() => {
        if (!videoRef.current) return;
        const guidelines = new FaceGuidelines(videoRef.current);
        faceGuidelinesRef.current = guidelines;
        guidelines.start();
      });

      await faceVideo.start();
    } catch {
      setFactorState({ status: "error", errorMessage: "Camera access denied or unavailable." });
      setMode("idle");
    }
  }, []);

  const stopCapture = useCallback(() => {
    faceGuidelinesRef.current?.stop?.();
    faceGuidelinesRef.current = null;
    faceVideoRef.current?.stop?.();
    faceVideoRef.current = null;
    setMode("idle");
    if (factorState.status !== "authenticated") {
      setFactorState({ status: "idle" });
    }
  }, [factorState.status]);

  const identify = useCallback(async () => {
    if (!faceVideoRef.current || !faceIdRef.current) return;

    setFactorState({ status: "pending" });
    try {
      const captureResult = await faceVideoRef.current.capture({
        ovalDimensions: faceGuidelinesRef.current?.getOvalDimensions(),
      });

      if (!captureResult) {
        setFactorState({ status: "error", errorMessage: "No face detected. Please position your face in the oval." });
        return;
      }

      const result = await faceIdRef.current.identify(captureResult.blob, captureResult.imageType);

      if (result.success && result.data?.found) {
        stopCapture();
        setFactorState({ status: "authenticated" });
      } else {
        // Face not registered — switch to register mode
        setMode("registering");
        setFactorState({ status: "idle", errorMessage: "Face not recognized. Register your face to continue." });
      }
    } catch {
      setFactorState({ status: "error", errorMessage: "Identification failed. Please try again." });
    }
  }, [stopCapture]);

  const register = useCallback(async (userId: string) => {
    if (!faceVideoRef.current || !faceIdRef.current || !userId.trim()) return;

    setFactorState({ status: "pending" });
    try {
      const captureResult = await faceVideoRef.current.capture({
        ovalDimensions: { ...(faceGuidelinesRef.current?.getOvalDimensions() as import("@face-auth/face-auth").OvalDimensions) },
      });

      if (!captureResult) {
        setFactorState({ status: "error", errorMessage: "No face detected. Please position your face in the oval." });
        return;
      }

      const result = await faceIdRef.current.register(userId.trim(), captureResult.blob, captureResult.imageType);

      if (result.success && result.data?.faceId) {
        stopCapture();
        setFactorState({ status: "authenticated" });
      } else {
        setFactorState({ status: "error", errorMessage: "Registration failed. Please try again." });
      }
    } catch {
      setFactorState({ status: "error", errorMessage: "Registration failed. Please try again." });
    }
  }, [stopCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      faceGuidelinesRef.current?.stop?.();
      faceVideoRef.current?.stop?.();
    };
  }, []);

  return { factorState, mode, videoRef, startCapture, stopCapture, identify, register };
}
