"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Loader2,
  Send,
  MapPin,
  Trash2,
  PenLine,
  List,
  Bot,
  User,
  Wrench,
  Wifi,
  WifiOff,
  Plane,
  Crosshair,
  Camera,
  FileSpreadsheet,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useWebSocketConnection } from "../components/webSocketContext";
import { useModal } from "../components/modal/modalContext";
import { buildSaveChatModalOptions } from "../components/saveChatModalContent";

const BAR_COUNT = 40;

interface ToolCallResult {
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallResult[];
  timestamp: Date;
}

/** localStorage snapshot for reload persistence */
interface FlightScriptChatSnapshot {
  version: 1;
  messages: Array<
    Omit<Message, "timestamp"> & { timestamp: string }
  >;
  responseId: string | null;
}

const FLIGHT_SCRIPT_CHAT_STORAGE_KEY = "ved-scout-flight-script-chat-v1";

export default function FlightScriptPage() {
  const {
    isConnected: wsConnected,
    wsUrl,
    connect: wsConnect,
    disconnect: wsDisconnect,
    sendCommandAndWait,
    connectionError: wsError,
  } = useWebSocketConnection();

  const { openModal } = useModal();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [wsUrlInput, setWsUrlInput] = useState(wsUrl);

  useEffect(() => {
    setWsUrlInput(wsUrl);
  }, [wsUrl]);

  // Restore chat + assistant thread id from localStorage (client-only; avoids clobbering before read)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FLIGHT_SCRIPT_CHAT_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<FlightScriptChatSnapshot>;
      if (data.version !== 1 || !Array.isArray(data.messages)) return;

      const restored: Message[] = data.messages.map((m) => {
        const ts = new Date(
          typeof m.timestamp === "string" ? m.timestamp : Date.now()
        );
        return {
          id: typeof m.id === "string" ? m.id : `msg-${Date.now()}`,
          role: m.role === "user" || m.role === "assistant" ? m.role : "assistant",
          content: typeof m.content === "string" ? m.content : "",
          toolCalls: m.toolCalls,
          timestamp: isNaN(ts.getTime()) ? new Date() : ts,
        };
      });
      setMessages(restored);
      if (data.responseId === null || typeof data.responseId === "string") {
        setResponseId(data.responseId);
      }
    } catch (e) {
      console.error("Failed to restore flight script chat:", e);
    } finally {
      setChatHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!chatHydrated) return;
    try {
      const snapshot: FlightScriptChatSnapshot = {
        version: 1,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          timestamp: m.timestamp.toISOString(),
        })),
        responseId,
      };
      localStorage.setItem(
        FLIGHT_SCRIPT_CHAT_STORAGE_KEY,
        JSON.stringify(snapshot)
      );
    } catch (e) {
      console.error("Failed to persist flight script chat:", e);
    }
  }, [messages, responseId, chatHydrated]);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0)
  );
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendToAssistant = useCallback(
    async (text: string) => {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/flight-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            previousResponseId: responseId,
            isWebSocketConnected: wsConnected,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Request failed");
        }

        const data = await res.json();
        setResponseId(data.responseId || null);

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.text || "(no response)",
          toolCalls: data.toolCalls,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // If there's a flight script execution in tool calls, send to WebSocket and wait for completion
        if (data.toolCalls && wsConnected) {
          const flightScriptCall = data.toolCalls.find(
            (tc: ToolCallResult) => tc.toolName === "executeFlightScript"
          );
          
          if (flightScriptCall) {
            // Show waiting message
            const waitingMessage: Message = {
              id: `waiting-${Date.now()}`,
              role: "assistant",
              content: "Sending command to drone and waiting for completion...",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, waitingMessage]);

            try {
              const privateKey = process.env.NEXT_PUBLIC_DRONE_PRIVATE_KEY || "";
              const procedure = (flightScriptCall.args as Record<string, unknown>)
                .procedure as string;
              const parameters = (flightScriptCall.args as Record<string, unknown>)
                .parameters as Record<string, unknown> | undefined;

              // Send command and wait for completion
              const response = await sendCommandAndWait(
                {
                  type: "flight_script",
                  scriptName: procedure,
                  privateKey,
                  parameters: parameters || {},
                },
                60000 // 60 second timeout
              );

              // Show completion message
              const completionMessage: Message = {
                id: `completion-${Date.now()}`,
                role: "assistant",
                content:
                  response.status === "completed"
                    ? `✓ Flight script completed successfully${response.message ? `: ${response.message}` : ""}`
                    : `✗ Flight script failed${response.error ? `: ${response.error}` : ""}`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, completionMessage]);
            } catch (err) {
              const errorMessage: Message = {
                id: `ws-error-${Date.now()}`,
                role: "assistant",
                content: `✗ WebSocket error: ${err instanceof Error ? err.message : "Command failed"}`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, errorMessage]);
            }
          }
        }
      } catch (err) {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [responseId, wsConnected, sendCommandAndWait]
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = inputText.trim();
      if (!text || isLoading) return;
      setInputText("");
      sendToAssistant(text);
    },
    [inputText, isLoading, sendToAssistant]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setResponseId(null);
  }, []);

  // Transcribe audio then send to assistant
  const transcribeAndSend = useCallback(
    async (audioBlob: Blob) => {
      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Transcription failed");
        const data = await response.json();
        const text = data.text?.trim();
        if (text) {
          sendToAssistant(text);
        }
      } catch (err) {
        console.error("Transcription error:", err);
      } finally {
        setIsTranscribing(false);
      }
    },
    [sendToAssistant]
  );

  // Mic recording effect
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

          audioChunksRef.current = [];
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
              ? "audio/webm;codecs=opus"
              : "audio/webm",
          });
          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, {
              type: "audio/webm",
            });
            if (audioBlob.size > 0) transcribeAndSend(audioBlob);
          };

          mediaRecorder.start(250);

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
          const minBin = Math.max(1, Math.floor(85 / hzPerBin));
          const maxBin = Math.min(
            analyser.frequencyBinCount - 1,
            Math.ceil(4000 / hzPerBin)
          );
          const speechBinCount = maxBin - minBin + 1;

          const animate = () => {
            if (cancelled) return;
            analyser.getByteFrequencyData(freqData);
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
      setBarHeights(Array.from({ length: BAR_COUNT }, () => 0));
      setAudioLevel(0);
    }
  }, [isRecording, transcribeAndSend]);

  const handleToggleRecord = useCallback(() => {
    if (!isRecording) {
      setIsRecording(true);
    } else {
      setIsRecording(false);
    }
  }, [isRecording]);

  const ringCount = 3;
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const baseScale = 1.25 + i * 0.3;
    const dynamicScale = baseScale + audioLevel * (0.12 + i * 0.08);
    const opacity =
      Math.max(0.06, 0.2 - i * 0.06) * (isRecording ? audioLevel : 0);
    return { scale: dynamicScale, opacity };
  });

  const leftBars = [...barHeights].reverse();
  const rightBars = barHeights;

  return (
    <div className="flex flex-col h-full">
      {/* Header with WebSocket connection and mic */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        {/* WebSocket Connection Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/50">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={wsUrlInput}
              onChange={(e) => setWsUrlInput(e.target.value)}
              placeholder="ws://localhost:8765"
              disabled={wsConnected}
              className="flex-1 max-w-xs rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#cfb991]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => {
                if (wsConnected) {
                  wsDisconnect();
                } else {
                  wsConnect(wsUrlInput.trim());
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                wsConnected
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                  : "bg-zinc-700/50 text-zinc-300 border border-zinc-600 hover:bg-zinc-700"
              }`}
            >
              {wsConnected ? (
                <>
                  <Wifi size={14} />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff size={14} />
                  Connect
                </>
              )}
            </button>
          </div>
          {wsError && (
            <span className="text-xs text-red-400">{wsError}</span>
          )}
          {wsConnected && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Plane size={14} className="animate-pulse" />
              <span>Flight script enabled</span>
            </div>
          )}
        </div>

        {/* Voice Input Section */}
        <div className="flex flex-col items-center py-3 px-4">
          <span className="text-lg font-bold text-[#cfb991]/70 tracking-wide select-none mb-1">
            Flight Script Assistant
          </span>

          {/* Waveform + Mic row */}
          <div className="w-full max-w-md flex items-center justify-center">
            {/* Left frequency bars */}
            <div className="flex-1 flex items-center justify-end gap-[2px] h-12 overflow-hidden">
              {leftBars.map((h, i) => (
                <div
                  key={`l-${i}`}
                  className="flex-shrink-0 rounded-full"
                  style={{
                    width: 2,
                    height: `${Math.max(2, h * 48)}px`,
                    backgroundColor: `rgba(207, 185, 145, ${0.3 + h * 0.6})`,
                    transition: "height 60ms ease-out",
                  }}
                />
              ))}
            </div>

            {/* Mic button */}
            <div className="relative w-12 h-12 flex-shrink-0 mx-2">
              {rings.map((ring, i) => (
                <div
                  key={i}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div
                    className="rounded-full border border-[#cfb991]/30 transition-all"
                    style={{
                      width: 48,
                      height: 48,
                      transform: `scale(${isRecording ? ring.scale : 1})`,
                      opacity: ring.opacity,
                      backgroundColor: `rgba(207, 185, 145, ${ring.opacity * 0.3})`,
                      transitionDuration: isRecording ? "150ms" : "400ms",
                      transitionTimingFunction: "ease-out",
                    }}
                  />
                </div>
              ))}

              {isRecording && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="rounded-full animate-ping"
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: "rgba(207, 185, 145, 0.12)",
                      animationDuration: "1.5s",
                    }}
                  />
                </div>
              )}

              <button
                onClick={handleToggleRecord}
                disabled={isTranscribing || isLoading}
                className={`
                  absolute inset-0 z-10 flex items-center justify-center rounded-full
                  transition-all duration-300 ease-out cursor-pointer select-none
                  ${
                    isTranscribing
                      ? "bg-[#cfb991]/10 cursor-wait"
                      : isRecording
                        ? "bg-red-500/90 hover:bg-red-400/90 shadow-[0_0_24px_rgba(239,68,68,0.3)]"
                        : "bg-[#cfb991]/20 hover:bg-[#cfb991]/30 shadow-[0_0_16px_rgba(207,185,145,0.12)]"
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
                  <Loader2 className="w-5 h-5 text-[#cfb991] animate-spin" />
                ) : isRecording ? (
                  <Square className="w-5 h-5 text-white" fill="white" />
                ) : (
                  <Mic className="w-5 h-5 text-[#cfb991]" />
                )}
              </button>
            </div>

            {/* Right frequency bars */}
            <div className="flex-1 flex items-center justify-start gap-[2px] h-12 overflow-hidden">
              {rightBars.map((h, i) => (
                <div
                  key={`r-${i}`}
                  className="flex-shrink-0 rounded-full"
                  style={{
                    width: 2,
                    height: `${Math.max(2, h * 48)}px`,
                    backgroundColor: `rgba(207, 185, 145, ${0.3 + h * 0.6})`,
                    transition: "height 60ms ease-out",
                  }}
                />
              ))}
            </div>
          </div>

          {isRecording && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <RecordingTimer />
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-1.5 mt-1">
              <Loader2 className="w-3 h-3 text-[#cfb991]/60 animate-spin" />
              <span className="text-xs text-[#cfb991]/60 font-mono">
                Transcribing...
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40">
        <button
          type="button"
          disabled={messages.length === 0}
          onClick={clearChat}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-600 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} />
          Clear chat
        </button>
        <button
          type="button"
          disabled={messages.length === 0}
          onClick={() =>
            openModal(buildSaveChatModalOptions(messages))
          }
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:border-[#cfb991]/40 hover:text-[#cfb991] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet size={14} />
          Save chat
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot size={40} className="text-zinc-600 mb-3" />
            <p className="text-zinc-500 text-sm max-w-sm">
              Ask me to manage your plots, or give flight instructions. Use
              the mic or type below.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[#cfb991]/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-[#cfb991]" />
              </div>
            )}

            <div
              className={`max-w-[75%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#cfb991]/15 text-[#cfb991] border border-[#cfb991]/20"
                    : "bg-zinc-800/60 text-zinc-200 border border-zinc-700/50"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="markdownMessage [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1,_h2,_h3]:font-semibold [&_h1,_h2,_h3]:text-zinc-100 [&_h1,_h2,_h3]:mt-2 [&_h1,_h2,_h3]:mb-1 [&_code]:text-[#cfb991]/90 [&_code]:bg-zinc-700/50 [&_code]:px-1 [&_code]:rounded [&_pre]:my-2 [&_pre]:p-2 [&_pre]:bg-zinc-900/80 [&_pre]:border [&_pre]:border-zinc-700 [&_pre]:rounded-lg [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-[#cfb991] [&_a]:underline [&_strong]:font-semibold">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {/* Tool call results */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="space-y-1.5">
                  {msg.toolCalls.map((tc, idx) => (
                    <ToolCallBadge key={idx} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-zinc-700/50 flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-zinc-400" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#cfb991]/15 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-[#cfb991]" />
            </div>
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#cfb991]/40 animate-bounce" />
                <div
                  className="w-2 h-2 rounded-full bg-[#cfb991]/40 animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-[#cfb991]/40 animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm px-4 py-3">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a command or question..."
            disabled={isLoading || isRecording}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#cfb991]/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading || isRecording}
            className="px-4 py-2.5 rounded-xl bg-[#cfb991] text-zinc-900 font-medium text-sm hover:bg-[#cfb991]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function ToolCallBadge({ toolCall }: { toolCall: ToolCallResult }) {
  const action = (toolCall.args as Record<string, unknown>).action as
    | string
    | undefined;
  const result = toolCall.result as Record<string, unknown>;
  const success = result?.success === true;

  // Handle executeFlightScript tool
  if (toolCall.toolName === "executeFlightScript") {
    const procedure = (toolCall.args as Record<string, unknown>).procedure as string | undefined;
    const procedureLabels: Record<string, string> = {
      "test-flight-script-1": "Test Flight Script 1",
      "orthomosaic-field-mission": "Orthomosaic Field Mission",
    };
    const label = procedure ? procedureLabels[procedure] ?? "Flight Script" : "Flight Script";

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-xs">
        <Wrench size={12} className="text-zinc-500 shrink-0" />
        <Plane size={12} className="text-blue-400 shrink-0" />
        <span className="text-blue-400">{label}</span>
        {success ? (
          <span className="text-emerald-400/70 ml-auto">
            {result.message as string}
          </span>
        ) : (
          <span className="text-red-400/70 ml-auto">
            {(result?.error as string) || "Failed"}
          </span>
        )}
      </div>
    );
  }

  // Handle missionManagement tool
  if (toolCall.toolName === "missionManagement") {
    const missionActionConfig: Record<
      string,
      { icon: typeof Crosshair; label: string; color: string }
    > = {
      add: { icon: Crosshair, label: "Mission Type Added", color: "text-emerald-400" },
      update: { icon: PenLine, label: "Mission Type Updated", color: "text-blue-400" },
      delete: { icon: Trash2, label: "Mission Type Deleted", color: "text-red-400" },
      list: { icon: List, label: "Mission Types Listed", color: "text-zinc-400" },
    };
    const missionConfig = missionActionConfig[action || ""] || {
      icon: Wrench,
      label: "Mission",
      color: "text-zinc-400",
    };
    const MissionIcon = missionConfig.icon;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-xs">
        <Wrench size={12} className="text-zinc-500 shrink-0" />
        <MissionIcon size={12} className={`${missionConfig.color} shrink-0`} />
        <span className={missionConfig.color}>{missionConfig.label}</span>
        {success ? (
          <span className="text-emerald-400/70 ml-auto">
            {result.message as string}
          </span>
        ) : (
          <span className="text-red-400/70 ml-auto">
            {(result?.error as string) || "Failed"}
          </span>
        )}
      </div>
    );
  }

  // Handle cameraSensors tool
  if (toolCall.toolName === "cameraSensors") {
    const cameraActionConfig: Record<
      string,
      { icon: typeof Camera; label: string; color: string }
    > = {
      add: { icon: Camera, label: "Camera Added", color: "text-emerald-400" },
      update: { icon: PenLine, label: "Camera Updated", color: "text-blue-400" },
      delete: { icon: Trash2, label: "Camera Deleted", color: "text-red-400" },
      list: { icon: List, label: "Cameras Listed", color: "text-zinc-400" },
    };
    const cameraConfig = cameraActionConfig[action || ""] || {
      icon: Wrench,
      label: "Camera",
      color: "text-zinc-400",
    };
    const CameraIcon = cameraConfig.icon;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-xs">
        <Wrench size={12} className="text-zinc-500 shrink-0" />
        <CameraIcon size={12} className={`${cameraConfig.color} shrink-0`} />
        <span className={cameraConfig.color}>{cameraConfig.label}</span>
        {success ? (
          <span className="text-emerald-400/70 ml-auto">
            {result.message as string}
          </span>
        ) : (
          <span className="text-red-400/70 ml-auto">
            {(result?.error as string) || "Failed"}
          </span>
        )}
      </div>
    );
  }

  // Handle plotManagement tool
  const actionConfig: Record<
    string,
    { icon: typeof MapPin; label: string; color: string }
  > = {
    add: { icon: MapPin, label: "Plot Added", color: "text-emerald-400" },
    update: { icon: PenLine, label: "Plot Updated", color: "text-blue-400" },
    delete: { icon: Trash2, label: "Plot Deleted", color: "text-red-400" },
    list: { icon: List, label: "Plots Listed", color: "text-zinc-400" },
  };

  const config = actionConfig[action || ""] || {
    icon: Wrench,
    label: "Tool Call",
    color: "text-zinc-400",
  };
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-xs">
      <Wrench size={12} className="text-zinc-500 shrink-0" />
      <Icon size={12} className={`${config.color} shrink-0`} />
      <span className={config.color}>{config.label}</span>
      {success ? (
        <span className="text-emerald-400/70 ml-auto">
          {result.message as string}
        </span>
      ) : (
        <span className="text-red-400/70 ml-auto">
          {(result?.error as string) || "Failed"}
        </span>
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
  return (
    <span className="text-xs text-zinc-400 font-mono tabular-nums">
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}
