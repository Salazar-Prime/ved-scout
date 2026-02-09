"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

const BAR_COUNT = 60; // bars per side

interface VoiceRecorderProps {
  autoStart?: boolean;
}

export default function VoiceRecorder({ autoStart = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const hasAutoStarted = useRef(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0)
  );
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Transcribe audio blob via our API route
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Transcription failed");
      }

      const data = await response.json();
      setTranscription(data.text || "(no speech detected)");
    } catch (err) {
      console.error("Transcription error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to transcribe audio"
      );
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  // Start/stop mic and drive bars from real frequency data
  useEffect(() => {
    if (isRecording) {
      let cancelled = false;

      const startMic = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          mediaStreamRef.current = stream;

          // Set up MediaRecorder for capturing audio
          audioChunksRef.current = [];
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
              ? "audio/webm;codecs=opus"
              : "audio/webm",
          });
          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, {
              type: "audio/webm",
            });
            if (audioBlob.size > 0) {
              transcribeAudio(audioBlob);
            }
          };

          mediaRecorder.start(250); // collect data every 250ms

          // Set up AudioContext for visualisation
          const ctx = new AudioContext();
          audioContextRef.current = ctx;

          const source = ctx.createMediaStreamSource(stream);
          sourceRef.current = source;

          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0;
          analyser.minDecibels = -90;
          analyser.maxDecibels = -10;
          analyserRef.current = analyser;

          source.connect(analyser);

          const freqData = new Uint8Array(analyser.frequencyBinCount);
          const sampleRate = ctx.sampleRate;
          const hzPerBin = sampleRate / analyser.fftSize;
          // Human speech range: ~85 Hz to ~4000 Hz
          const minBin = Math.max(1, Math.floor(85 / hzPerBin));
          const maxBin = Math.min(
            analyser.frequencyBinCount - 1,
            Math.ceil(4000 / hzPerBin)
          );
          const speechBinCount = maxBin - minBin + 1;

          const animate = () => {
            if (cancelled) return;
            analyser.getByteFrequencyData(freqData);

            // Directly map frequency bins to bars — no lerp, instant response
            const newBars = Array.from({ length: BAR_COUNT }, (_, i) => {
              const binIndex =
                minBin + Math.floor((i / BAR_COUNT) * speechBinCount);
              return Math.min(1, (freqData[binIndex] / 255) * 1.8);
            });
            setBarHeights(newBars);
            setAudioLevel(
              newBars.reduce((sum, v) => sum + v, 0) / newBars.length
            );

            animationRef.current = requestAnimationFrame(animate);
          };
          animationRef.current = requestAnimationFrame(animate);
        } catch {
          // Mic permission denied or not available — fall back silently
          console.warn("Microphone access denied or unavailable");
        }
      };

      startMic();

      return () => {
        cancelled = true;
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }

        // Stop the MediaRecorder (triggers onstop → transcription)
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;

        sourceRef.current?.disconnect();
        sourceRef.current = null;
        analyserRef.current = null;
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
      };
    } else {
      // Immediately zero out bars
      setBarHeights(Array.from({ length: BAR_COUNT }, () => 0));
      setAudioLevel(0);
    }
  }, [isRecording, transcribeAudio]);

  // Auto-start recording when autoStart prop is true (e.g. from sidebar voice command button)
  useEffect(() => {
    if (autoStart && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      setIsRecording(true);
      setIsPulsing(true);
    }
  }, [autoStart]);

  const handleToggle = useCallback(() => {
    if (!isRecording) {
      setIsPulsing(true);
      setIsRecording(true);
      setTranscription(null);
      setError(null);
    } else {
      setIsRecording(false);
      setIsPulsing(false);
    }
  }, [isRecording]);

  // Generate ring scales based on audio level
  const ringCount = 3;
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const baseScale = 1.3 + i * 0.35;
    const dynamicScale = baseScale + audioLevel * (0.15 + i * 0.1);
    const opacity =
      Math.max(0.08, 0.25 - i * 0.07) * (isRecording ? audioLevel : 0);
    return { scale: dynamicScale, opacity };
  });

  // Reversed bars for left side (mirror)
  const leftBars = [...barHeights].reverse();
  const rightBars = barHeights;

  return (
    <div className="relative z-20 w-full flex flex-col items-center justify-center py-2 pb-6 mb-2">
      {/* Top text */}
      <span className="text-3xl font-bold text-[#cfb991]/70 tracking-wide select-none mb-0">
        VED-SCOUT
      </span>

      {/* Waveform + Mic row */}
      <div className="w-full flex items-center justify-center my-2">
        {/* Left frequency bars */}
        <div className="flex-1 flex items-center justify-end gap-[2px] h-20 overflow-hidden">
          {leftBars.map((h, i) => (
            <div
              key={`l-${i}`}
              className="flex-shrink-0 rounded-full"
              style={{
                width: 2,
                height: `${Math.max(3, h * 80)}px`,
                backgroundColor: `rgba(207, 185, 145, ${0.35 + h * 0.55})`,
                transition: "height 60ms ease-out",
              }}
            />
          ))}
        </div>

        {/* Mic button container */}
        <div className="relative w-16 h-16 flex-shrink-0 mx-3">
          {/* Animated ripple rings */}
          {rings.map((ring, i) => (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div
                className="rounded-full border border-[#cfb991]/30 transition-all"
                style={{
                  width: 64,
                  height: 64,
                  transform: `scale(${isRecording ? ring.scale : 1})`,
                  opacity: ring.opacity,
                  backgroundColor: `rgba(207, 185, 145, ${ring.opacity * 0.3})`,
                  transitionDuration: isRecording ? "150ms" : "400ms",
                  transitionTimingFunction: "ease-out",
                }}
              />
            </div>
          ))}

          {/* Pulsing glow behind button when recording */}
          {isRecording && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="rounded-full animate-ping"
                style={{
                  width: 64,
                  height: 64,
                  backgroundColor: "rgba(207, 185, 145, 0.15)",
                  animationDuration: "1.5s",
                }}
              />
            </div>
          )}

          {/* Main mic button */}
          <button
            onClick={handleToggle}
            disabled={isTranscribing}
            className={`
              absolute inset-0
              z-10 flex items-center justify-center
              rounded-full
              transition-all duration-300 ease-out
              cursor-pointer select-none
              ${
                isTranscribing
                  ? "bg-[#cfb991]/10 cursor-wait"
                  : isRecording
                    ? "bg-red-500/90 hover:bg-red-400/90 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                    : "bg-[#cfb991]/20 hover:bg-[#cfb991]/30 shadow-[0_0_20px_rgba(207,185,145,0.15)]"
              }
              border border-[#cfb991]/40 hover:border-[#cfb991]/60
            `}
            title={
              isTranscribing
                ? "Transcribing..."
                : isRecording
                  ? "Stop recording"
                  : "Start recording"
            }
          >
            {isTranscribing ? (
              <Loader2 className="w-6 h-6 text-[#cfb991] animate-spin" />
            ) : isRecording ? (
              <Square className="w-6 h-6 text-white" fill="white" />
            ) : (
              <Mic
                className={`w-7 h-7 text-[#cfb991] transition-transform duration-200 ${
                  isPulsing ? "" : "hover:scale-110"
                }`}
              />
            )}
          </button>
        </div>

        {/* Right frequency bars */}
        <div className="flex-1 flex items-center justify-start gap-[2px] h-20 overflow-hidden">
          {rightBars.map((h, i) => (
            <div
              key={`r-${i}`}
              className="flex-shrink-0 rounded-full"
              style={{
                width: 2,
                height: `${Math.max(3, h * 80)}px`,
                backgroundColor: `rgba(207, 185, 145, ${0.35 + h * 0.55})`,
                transition: "height 60ms ease-out",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom text */}
      <span className="text-md font-bold text-[#cfb991]/70 tracking-wide select-none -mt-1">
        UAS Voice Command
      </span>

      {/* Recording duration indicator — sits below */}
      {isRecording && (
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <RecordingTimer />
        </div>
      )}

      {/* Transcribing indicator */}
      {isTranscribing && (
        <div className="flex items-center gap-1.5 mt-2">
          <Loader2 className="w-3 h-3 text-[#cfb991]/60 animate-spin" />
          <span className="text-xs text-[#cfb991]/60 font-mono">
            Transcribing...
          </span>
        </div>
      )}

      {/* Transcription result */}
      {transcription && !isRecording && !isTranscribing && (
        <div className="mt-2 mx-4 max-w-md">
          <p className="text-sm text-[#cfb991]/80 text-center leading-relaxed">
            {transcription}
          </p>
        </div>
      )}

      {/* Error message */}
      {error && !isRecording && !isTranscribing && (
        <div className="mt-2 mx-4 max-w-md">
          <p className="text-xs text-red-400/80 text-center">{error}</p>
        </div>
      )}
    </div>
  );
}

function RecordingTimer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <span className="text-xs text-zinc-400 font-mono tabular-nums">
      {formatted}
    </span>
  );
}
