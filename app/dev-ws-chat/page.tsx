"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Send,
  Trash2,
  Bot,
  User,
  Wrench,
  ChevronDown,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  Mic,
  Square,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useWebSocketConnection } from "../components/webSocketContext";
import { useModal } from "../components/modal/modalContext";
import { buildSaveChatModalOptions } from "../components/saveChatModalContent";
import { excelToolCallLogFromDevEntries } from "../../lib/chatSave/savedChatRecord";
import {
  runFlightSafetyChecks,
  FAA_MAX_ALTITUDE_METERS,
  type SafetyCheckItem,
} from "../../lib/flightSafetyChecks";

interface ToolCallResult {
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

interface TimingStep {
  label: string;
  ms: number;
}

interface FlightConfirmationData {
  procedure: string;
  plot: Record<string, unknown>;
  mission: Record<string, unknown>;
  camera: Record<string, unknown>;
  safetyChecks: SafetyCheckItem[];
  serverSafetyChecks: SafetyCheckItem[] | null;
  /** "pending" = awaiting operator action, "confirmed" / "cancelled" = resolved */
  status: "pending" | "confirmed" | "cancelled";
}

interface DroneCommandConfirmationData {
  command: string;
  parameters: Record<string, unknown>;
  status: "pending" | "confirmed" | "cancelled";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallResult[];
  timestamp: Date;
  timings?: TimingStep[];
  receivedAt?: string;
  ackRoundTripMs?: number;
  flightConfirmation?: FlightConfirmationData;
  droneCommandConfirmation?: DroneCommandConfirmationData;
}

interface ToolCallEntry {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  timestamp: Date;
  turnId: string;
}

interface DevChatSnapshot {
  version: 1;
  messages: Array<Omit<Message, "timestamp"> & { timestamp: string }>;
  toolCallLog: Array<Omit<ToolCallEntry, "timestamp"> & { timestamp: string }>;
  responseId: string | null;
}

interface PendingFlightConfirmation {
  /** ID of the Message that holds the FlightConfirmationData */
  messageId: string;
  procedure: string;
  plot: Record<string, unknown>;
  mission: Record<string, unknown>;
  camera: Record<string, unknown>;
  timingSteps: TimingStep[];
  t0: number;
  prefixMs: number;
}

interface PendingDroneCommand {
  messageId: string;
  command: string;
  parameters: Record<string, unknown>;
  timingSteps: TimingStep[];
  t0: number;
  prefixMs: number;
}

/** ISO string for display in the chat message itself */

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const DEV_CHAT_STORAGE_KEY = "ved-scout-dev-chat-v1";

export default function DevWsChatPage() {
  const {
    isConnected: wsConnected,
    wsUrl,
    connect: wsConnect,
    disconnect: wsDisconnect,
    sendCommandAndWait,
    connectionError: wsError,
  } = useWebSocketConnection();

  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCallLog, setToolCallLog] = useState<ToolCallEntry[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [wsUrlInput, setWsUrlInput] = useState(wsUrl);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [pendingFlightConfirmation, setPendingFlightConfirmation] =
    useState<PendingFlightConfirmation | null>(null);
  const [pendingDroneCommand, setPendingDroneCommand] =
    useState<PendingDroneCommand | null>(null);

  const { openModal } = useModal();

  // Restore from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEV_CHAT_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<DevChatSnapshot>;
      if (data.version !== 1) return;

      if (Array.isArray(data.messages)) {
        const restored: Message[] = data.messages.map((m) => {
          const ts = new Date(typeof m.timestamp === "string" ? m.timestamp : Date.now());
          const raw = m as Record<string, unknown>;
          const fc = raw.flightConfirmation as FlightConfirmationData | undefined;
          const dc = raw.droneCommandConfirmation as DroneCommandConfirmationData | undefined;
          return {
            id: typeof m.id === "string" ? m.id : `msg-${Date.now()}`,
            role: m.role === "user" || m.role === "assistant" ? m.role : "assistant",
            content: typeof m.content === "string" ? m.content : "",
            toolCalls: m.toolCalls,
            timings: raw.timings as TimingStep[] | undefined,
            receivedAt: typeof raw.receivedAt === "string" ? raw.receivedAt : undefined,
            ackRoundTripMs: typeof raw.ackRoundTripMs === "number" ? raw.ackRoundTripMs : undefined,
            timestamp: isNaN(ts.getTime()) ? new Date() : ts,
            // Restore confirmation cards — any "pending" card becomes "cancelled" on
            // reload since the WS session is gone and the operator can't confirm it.
            ...(fc && {
              flightConfirmation: {
                ...fc,
                status: fc.status === "pending" ? "cancelled" : fc.status,
              } as FlightConfirmationData,
            }),
            ...(dc && {
              droneCommandConfirmation: {
                ...dc,
                status: dc.status === "pending" ? "cancelled" : dc.status,
              } as DroneCommandConfirmationData,
            }),
          };
        });
        setMessages(restored);
      }

      if (Array.isArray(data.toolCallLog)) {
        const restoredTc: ToolCallEntry[] = data.toolCallLog.map((tc) => {
          const ts = new Date(typeof tc.timestamp === "string" ? tc.timestamp : Date.now());
          return {
            id: tc.id,
            toolName: tc.toolName,
            args: tc.args,
            result: tc.result,
            timestamp: isNaN(ts.getTime()) ? new Date() : ts,
            turnId: tc.turnId,
          };
        });
        setToolCallLog(restoredTc);
      }

      if (data.responseId === null || typeof data.responseId === "string") {
        setResponseId(data.responseId);
      }
    } catch (e) {
      console.error("Failed to restore dev chat:", e);
    } finally {
      setChatHydrated(true);
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!chatHydrated) return;
    try {
      const snapshot: DevChatSnapshot = {
        version: 1,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          timings: m.timings,
          receivedAt: m.receivedAt,
          ackRoundTripMs: m.ackRoundTripMs,
          timestamp: m.timestamp.toISOString(),
          ...(m.flightConfirmation && { flightConfirmation: m.flightConfirmation }),
          ...(m.droneCommandConfirmation && { droneCommandConfirmation: m.droneCommandConfirmation }),
        })),
        toolCallLog: toolCallLog.map((tc) => ({
          id: tc.id,
          toolName: tc.toolName,
          args: tc.args,
          result: tc.result,
          timestamp: tc.timestamp.toISOString(),
          turnId: tc.turnId,
        })),
        responseId,
      };
      localStorage.setItem(DEV_CHAT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.error("Failed to persist dev chat:", e);
    }
  }, [messages, toolCallLog, responseId, chatHydrated]);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const BAR_COUNT = 40;
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
  /** performance.now() when MediaRecorder started (voice capture begin). */
  const recordingStartedAtRef = useRef<number | null>(null);
  /** performance.now() when user stops recording (before MediaRecorder.stop). */
  const stopSpeakingAtRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toolScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWsUrlInput(wsUrl);
  }, [wsUrl]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    toolScrollRef.current?.scrollTo({
      top: toolScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [toolCallLog]);

  const sendToAssistant = useCallback(
    async (text: string, prefixTimings?: TimingStep[]) => {
      const prefixMs =
        prefixTimings?.reduce((sum, t) => sum + t.ms, 0) ?? 0;
      const t0 = performance.now();

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

        const tApiResponse = performance.now();

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Request failed");
        }

        const data = await res.json();
        const tParsed = performance.now();
        setResponseId(data.responseId || null);

        const turnId = `turn-${Date.now()}`;

        const timingSteps: TimingStep[] = [
          ...(prefixTimings ?? []),
          { label: "API round-trip", ms: tApiResponse - t0 },
          { label: "Parse response", ms: tParsed - tApiResponse },
        ];

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.text || "(no response)",
          toolCalls: data.toolCalls,
          timestamp: new Date(),
          timings: [...timingSteps, { label: "Total", ms: prefixMs + (tParsed - t0) }],
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (data.toolCalls && data.toolCalls.length > 0) {
          const ts = new Date();
          const entries: ToolCallEntry[] = data.toolCalls.map(
            (tc: ToolCallResult, i: number) => ({
              id: `tc-${ts.getTime()}-${i}`,
              toolName: tc.toolName,
              args: tc.args,
              result: tc.result,
              timestamp: ts,
              turnId,
            })
          );
          setToolCallLog((prev) => [...prev, ...entries]);
        }

        if (data.toolCalls && wsConnected) {
          const flightScriptCall = data.toolCalls.find(
            (tc: ToolCallResult) => tc.toolName === "executeFlightScript"
          );

          if (flightScriptCall) {
            const toolResult = flightScriptCall.result as Record<string, unknown>;
            const args = flightScriptCall.args as Record<string, unknown>;
            const procedure = args.procedure as string;
            const plot = (args.plot as Record<string, unknown> | undefined) ?? {};
            const mission = (args.mission as Record<string, unknown> | undefined) ?? {};
            const camera = (args.camera as Record<string, unknown> | undefined) ?? {};

            // Run client-side safety checks for the confirmation card
            const safety = runFlightSafetyChecks({
              plot: plot as Parameters<typeof runFlightSafetyChecks>[0]["plot"],
              mission: mission as Parameters<typeof runFlightSafetyChecks>[0]["mission"],
              camera: camera as Parameters<typeof runFlightSafetyChecks>[0]["camera"],
            });

            // If the tool itself already rejected with structured checks, use those
            const serverRejected = toolResult?.safetyFailure === true;
            const toolChecks = serverRejected
              ? ((toolResult.safetyChecks as SafetyCheckItem[] | undefined) ?? null)
              : null;

            const confirmMsgId = `flight-confirm-${Date.now()}`;
            const confirmMsg: Message = {
              id: confirmMsgId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              flightConfirmation: {
                procedure,
                plot,
                mission,
                camera,
                safetyChecks: toolChecks ?? safety.checks,
                serverSafetyChecks: null,
                status: "pending",
              },
            };
            setMessages((prev) => [...prev, confirmMsg]);

            setPendingFlightConfirmation({
              messageId: confirmMsgId,
              procedure,
              plot,
              mission,
              camera,
              timingSteps,
              t0,
              prefixMs,
            });
          }

          const droneCommandCall = data.toolCalls.find(
            (tc: ToolCallResult) => tc.toolName === "droneCommand"
          );

          if (droneCommandCall) {
            const args = droneCommandCall.args as Record<string, unknown>;
            const command = args.command as string;
            const parameters = (args.parameters as Record<string, unknown> | undefined) ?? {};

            const cmdMsgId = `drone-cmd-${Date.now()}`;
            const cmdMsg: Message = {
              id: cmdMsgId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              droneCommandConfirmation: {
                command,
                parameters,
                status: "pending",
              },
            };
            setMessages((prev) => [...prev, cmdMsg]);

            setPendingDroneCommand({
              messageId: cmdMsgId,
              command,
              parameters,
              timingSteps,
              t0,
              prefixMs,
            });
          }
        }
      } catch (err) {
        const tErr = performance.now();
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
          timestamp: new Date(),
          timings: [
            ...(prefixTimings ?? []),
            { label: "Request failed", ms: tErr - t0 },
            { label: "Total", ms: prefixMs + (tErr - t0) },
          ],
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [responseId, wsConnected, setPendingFlightConfirmation]
  );

  /** Update the flightConfirmation data on a specific message in-place */
  const updateConfirmMsg = useCallback(
    (msgId: string, patch: Partial<FlightConfirmationData>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.flightConfirmation
            ? { ...m, flightConfirmation: { ...m.flightConfirmation, ...patch } }
            : m
        )
      );
    },
    []
  );

  const handleConfirmFlight = useCallback(async () => {
    if (!pendingFlightConfirmation) return;
    const { messageId, procedure, plot, mission, camera, timingSteps, t0, prefixMs } =
      pendingFlightConfirmation;
    setPendingFlightConfirmation(null);
    updateConfirmMsg(messageId, { status: "confirmed" });

    const tWsSendStart = performance.now();

    setMessages((prev) => [
      ...prev,
      {
        id: `waiting-${Date.now()}`,
        role: "assistant",
        content: "Sending command to drone and waiting for completion...",
        timestamp: new Date(),
      },
    ]);

    try {
      const privateKey = process.env.NEXT_PUBLIC_DRONE_PRIVATE_KEY || "";

      const response = await sendCommandAndWait(
        {
          type: "flight_script",
          scriptName: procedure,
          privateKey,
          plot,
          mission,
          camera,
          parameters: {},
        },
        600000
      );

      const tWsDone = performance.now();
      const roundTripMs = tWsDone - tWsSendStart;

      const receivedAt = response.receivedAt as string | undefined;
      const isAck = response.status === "acknowledged";
      const isCompleted = response.status === "completed";
      const isSafetyFailure = response.status === "safety_failure";

      // Patch server-returned checks back onto the confirmation message in-place
      const serverChecks = (response.safetyChecks as SafetyCheckItem[] | undefined) ?? null;
      if (serverChecks) {
        updateConfirmMsg(messageId, { serverSafetyChecks: serverChecks });
      }

      const wsTimings: TimingStep[] = [
        ...timingSteps,
        { label: "WS round-trip", ms: roundTripMs },
        { label: "Total", ms: prefixMs + (tWsDone - t0) },
      ];

      let completionContent: string;
      if (isSafetyFailure) {
        const failedChecks = serverChecks?.filter((c) => !c.passed) ?? [];
        completionContent =
          `**Pre-flight safety checks failed on server — command rejected.**\n\n` +
          (failedChecks.length
            ? failedChecks.map((c) => `- **${c.label}**: ${c.detail}`).join("\n")
            : "See safety check details above.");
      } else if (isAck) {
        completionContent =
          `Mission details acknowledged by server${receivedAt ? ` at ${receivedAt}` : ""}.` +
          `\n\n**Mission:** ${(mission.name as string) ?? "—"} (${(mission.type as string) ?? "—"})` +
          `\n**Plot:** ${(plot.name as string) ?? "—"}` +
          `\n**Camera:** ${(camera.name as string) ?? "—"}`;
      } else if (isCompleted) {
        completionContent = `Flight script completed successfully${response.message ? `: ${response.message}` : ""}`;
      } else {
        completionContent = `Flight script failed${response.error ? `: ${response.error}` : ""}`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `completion-${Date.now()}`,
          role: "assistant",
          content: completionContent,
          timestamp: new Date(),
          timings: wsTimings,
          receivedAt,
          ackRoundTripMs: isAck ? roundTripMs : undefined,
        },
      ]);
    } catch (err) {
      const tWsErr = performance.now();
      setMessages((prev) => [
        ...prev,
        {
          id: `ws-error-${Date.now()}`,
          role: "assistant",
          content: `WebSocket error: ${err instanceof Error ? err.message : "Command failed"}`,
          timestamp: new Date(),
          timings: [
            ...timingSteps,
            { label: "WS error", ms: tWsErr - tWsSendStart },
            { label: "Total", ms: prefixMs + (tWsErr - t0) },
          ],
        },
      ]);
    }
  }, [pendingFlightConfirmation, sendCommandAndWait, updateConfirmMsg]);

  const handleCancelFlight = useCallback(() => {
    if (!pendingFlightConfirmation) return;
    updateConfirmMsg(pendingFlightConfirmation.messageId, { status: "cancelled" });
    setPendingFlightConfirmation(null);
  }, [pendingFlightConfirmation, updateConfirmMsg]);

  const updateDroneCommandMsg = useCallback(
    (msgId: string, patch: Partial<DroneCommandConfirmationData>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.droneCommandConfirmation
            ? { ...m, droneCommandConfirmation: { ...m.droneCommandConfirmation, ...patch } }
            : m
        )
      );
    },
    []
  );

  const handleConfirmDroneCommand = useCallback(async () => {
    if (!pendingDroneCommand) return;
    const { messageId, command, parameters, timingSteps, t0, prefixMs } = pendingDroneCommand;
    setPendingDroneCommand(null);
    updateDroneCommandMsg(messageId, { status: "confirmed" });

    const tWsSendStart = performance.now();

    setMessages((prev) => [
      ...prev,
      {
        id: `waiting-cmd-${Date.now()}`,
        role: "assistant",
        content: `Sending command "${command}" to drone...`,
        timestamp: new Date(),
      },
    ]);

    try {
      const privateKey = process.env.NEXT_PUBLIC_DRONE_PRIVATE_KEY || "";

      const response = await sendCommandAndWait(
        {
          type: "single_command",
          command,
          parameters,
          privateKey,
        },
        300000
      );

      const tWsDone = performance.now();
      const roundTripMs = tWsDone - tWsSendStart;

      const isCompleted = response.status === "completed";
      const isAck = response.status === "acknowledged";

      const wsTimings: TimingStep[] = [
        ...timingSteps,
        { label: "WS round-trip", ms: roundTripMs },
        { label: "Total", ms: prefixMs + (tWsDone - t0) },
      ];

      const completionContent =
        isCompleted || isAck
          ? `Command "${command}" executed successfully${response.message ? `: ${response.message}` : ""}.`
          : `Command "${command}" failed${response.error ? `: ${response.error}` : ""}.`;

      setMessages((prev) => [
        ...prev,
        {
          id: `cmd-completion-${Date.now()}`,
          role: "assistant",
          content: completionContent,
          timestamp: new Date(),
          timings: wsTimings,
        },
      ]);
    } catch (err) {
      const tWsErr = performance.now();
      setMessages((prev) => [
        ...prev,
        {
          id: `cmd-ws-error-${Date.now()}`,
          role: "assistant",
          content: `WebSocket error: ${err instanceof Error ? err.message : "Command failed"}`,
          timestamp: new Date(),
          timings: [
            ...timingSteps,
            { label: "WS error", ms: tWsErr - tWsSendStart },
            { label: "Total", ms: prefixMs + (tWsErr - t0) },
          ],
        },
      ]);
    }
  }, [pendingDroneCommand, sendCommandAndWait, updateDroneCommandMsg]);

  const handleCancelDroneCommand = useCallback(() => {
    if (!pendingDroneCommand) return;
    updateDroneCommandMsg(pendingDroneCommand.messageId, { status: "cancelled" });
    setPendingDroneCommand(null);
  }, [pendingDroneCommand, updateDroneCommandMsg]);

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

  const transcribeAndSend = useCallback(
    async (audioBlob: Blob, voiceBeforeTranscribe: TimingStep[] = []) => {
      setIsTranscribing(true);
      const tTranscribeStart = performance.now();
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
          const transcribeMs = performance.now() - tTranscribeStart;
          sendToAssistant(text, [
            ...voiceBeforeTranscribe,
            { label: "Transcription", ms: transcribeMs },
          ]);
        }
      } catch (err) {
        console.error("Transcription error:", err);
      } finally {
        setIsTranscribing(false);
      }
    },
    [sendToAssistant]
  );

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
            const blobReadyAt = performance.now();
            const stopAt = stopSpeakingAtRef.current;
            const recStart = recordingStartedAtRef.current;

            const voiceBeforeTranscribe: TimingStep[] = [];
            if (recStart != null && stopAt != null) {
              const recordingMs = stopAt - recStart;
              if (recordingMs > 0) {
                voiceBeforeTranscribe.push({
                  label: "Recording",
                  ms: recordingMs,
                });
              }
            }
            if (stopAt != null) {
              const finalizeMs = blobReadyAt - stopAt;
              if (finalizeMs >= 0) {
                voiceBeforeTranscribe.push({
                  label: "Finalize capture",
                  ms: finalizeMs,
                });
              }
            }

            recordingStartedAtRef.current = null;
            stopSpeakingAtRef.current = null;

            const audioBlob = new Blob(audioChunksRef.current, {
              type: "audio/webm",
            });
            if (audioBlob.size > 0) {
              transcribeAndSend(audioBlob, voiceBeforeTranscribe);
            }
          };
          recordingStartedAtRef.current = performance.now();
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
        stopSpeakingAtRef.current = performance.now();
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
  }, [isRecording, transcribeAndSend, BAR_COUNT]);

  const handleToggleRecord = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

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

  const clearChat = () => {
    setMessages([]);
    setToolCallLog([]);
    setResponseId(null);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-200">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shrink-0">
        <Wrench size={20} className="text-[#cfb991]" />
        <h1 className="text-base font-semibold text-white tracking-wide">
          Dev Chat
        </h1>
        <span className="text-[10px] text-zinc-500 hidden sm:block">
          LLM chat with tool call inspector
        </span>

        {/* WS connection inline */}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={wsUrlInput}
            onChange={(e) => setWsUrlInput(e.target.value)}
            placeholder="ws://localhost:8765"
            disabled={wsConnected}
            className="w-52 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#cfb991]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => {
              if (wsConnected) wsDisconnect();
              else wsConnect(wsUrlInput.trim());
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
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
          {wsError && (
            <span className="text-[10px] text-red-400">{wsError}</span>
          )}
        </div>
      </div>

      {/* Two-pane body */}
      <div className="flex-1 min-h-0 flex">
        {/* Left: chat */}
        <section className="flex-[3] min-w-0 flex flex-col border-r border-zinc-800">
          {/* Chat toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/40 shrink-0">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Chat
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">
              ({messages.length})
            </span>
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                disabled={messages.length === 0}
                onClick={() =>
                  openModal(
                    buildSaveChatModalOptions(
                      messages,
                      excelToolCallLogFromDevEntries(toolCallLog),
                    ),
                  )
                }
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-[#cfb991] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet size={12} />
                Save
              </button>
              <button
                type="button"
                onClick={clearChat}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot size={40} className="text-zinc-600 mb-3" />
                <p className="text-zinc-500 text-sm max-w-sm">
                  Chat with the flight assistant. Tool calls will appear on the
                  right pane.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              // Flight confirmation card — rendered as a persisted message
              if (msg.flightConfirmation) {
                const fc = msg.flightConfirmation;
                const displayChecks = fc.serverSafetyChecks ?? fc.safetyChecks;
                const isServerChecks = !!fc.serverSafetyChecks;
                const allPassed = displayChecks.every((c) => c.passed);
                const isPending = fc.status === "pending";
                const isConfirmed = fc.status === "confirmed";
                const isCancelled = fc.status === "cancelled";
                return (
                  <div key={msg.id} className="flex gap-3 justify-start">
                    <div className="w-7 h-7 rounded-full bg-[#cfb991]/15 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck size={14} className="text-[#cfb991]" />
                    </div>
                    <div className="max-w-[80%] rounded-xl border bg-zinc-900 overflow-hidden border-zinc-700">
                      {/* Card header */}
                      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-zinc-700 ${
                        isCancelled ? "bg-zinc-800/30" : "bg-zinc-800/60"
                      }`}>
                        <ShieldCheck size={14} className={`shrink-0 ${isCancelled ? "text-zinc-500" : "text-[#cfb991]"}`} />
                        <span className={`text-sm font-semibold ${isCancelled ? "text-zinc-500" : "text-zinc-100"}`}>
                          Pre-flight Safety Review
                        </span>
                        <span className="ml-auto flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                          {fc.procedure}
                          {isConfirmed && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">confirmed</span>
                          )}
                          {isCancelled && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-700/50 border border-zinc-600 text-zinc-500">cancelled</span>
                          )}
                        </span>
                      </div>

                      {/* Flight summary */}
                      <div className={`px-4 py-3 border-b border-zinc-700/60 grid grid-cols-3 gap-x-4 gap-y-1 text-xs ${isCancelled ? "opacity-50" : ""}`}>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Plot</span>
                          <p className="text-zinc-200 font-medium truncate">
                            {(fc.plot.name as string) ?? "—"}
                          </p>
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Mission</span>
                          <p className="text-zinc-200 font-medium truncate">
                            {(fc.mission.name as string) ?? "—"}
                            {fc.mission.flightHeight !== undefined && (
                              <span className="ml-1 text-zinc-400">
                                · {fc.mission.flightHeight as number}m
                                {(fc.mission.flightHeight as number) > FAA_MAX_ALTITUDE_METERS && (
                                  <span className="text-red-400"> ⚠</span>
                                )}
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Camera</span>
                          <p className="text-zinc-200 font-medium truncate">
                            {(fc.camera.name as string) ?? "—"}
                          </p>
                        </div>
                      </div>

                      {/* Safety check rows */}
                      <div className={`px-4 py-3 space-y-1.5 ${isCancelled ? "opacity-50" : ""} ${isPending ? "border-b border-zinc-700/60" : ""}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Safety Checks</p>
                          {isServerChecks ? (
                            <span className="text-[10px] text-zinc-500 font-mono">server verified</span>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono">client — battery pending</span>
                          )}
                        </div>
                        {displayChecks.map((check) => (
                          <div key={check.id} className="flex items-start gap-2">
                            {check.passed ? (
                              <CheckCircle2 size={13} className="shrink-0 mt-0.5 text-emerald-400" />
                            ) : (
                              <XCircle size={13} className="shrink-0 mt-0.5 text-red-400" />
                            )}
                            <div className="min-w-0">
                              <span className={`text-xs font-medium ${check.passed ? "text-zinc-300" : "text-red-300"}`}>
                                {check.label}
                              </span>
                              <span className="text-zinc-500 text-xs"> — {check.detail}</span>
                            </div>
                          </div>
                        ))}
                        {!isServerChecks && isPending && (
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 pt-1">
                            <Loader2 size={11} className="animate-spin shrink-0" />
                            Battery check available after server confirmation
                          </div>
                        )}
                        {!isServerChecks && !isPending && (
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 pt-1">
                            Battery check not retrieved
                          </div>
                        )}
                      </div>

                      {/* Action buttons — only shown while pending */}
                      {isPending && (
                        <div className="flex items-center gap-2 px-4 py-3">
                          {!allPassed && (
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mr-auto">
                              <AlertTriangle size={12} className="shrink-0" />
                              Safety checks failed — confirm to override
                            </div>
                          )}
                          <div className="flex gap-2 ml-auto">
                            <button
                              type="button"
                              onClick={handleCancelFlight}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700/50 text-zinc-300 border border-zinc-600 hover:bg-zinc-700 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmFlight}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                allPassed
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                                  : "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30"
                              }`}
                            >
                              {allPassed ? "Confirm & Execute" : "Override & Execute"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Drone command confirmation card
              if (msg.droneCommandConfirmation) {
                const dc = msg.droneCommandConfirmation;
                const isPending = dc.status === "pending";
                const isConfirmed = dc.status === "confirmed";
                const isCancelled = dc.status === "cancelled";
                const hasParams = Object.keys(dc.parameters).length > 0;
                return (
                  <div key={msg.id} className="flex gap-3 justify-start">
                    <div className="w-7 h-7 rounded-full bg-[#cfb991]/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Wrench size={14} className="text-[#cfb991]" />
                    </div>
                    <div className="max-w-[80%] rounded-xl border bg-zinc-900 overflow-hidden border-zinc-700">
                      {/* Card header */}
                      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-zinc-700 ${isCancelled ? "bg-zinc-800/30" : "bg-zinc-800/60"}`}>
                        <Wrench size={14} className={`shrink-0 ${isCancelled ? "text-zinc-500" : "text-[#cfb991]"}`} />
                        <span className={`text-sm font-semibold ${isCancelled ? "text-zinc-500" : "text-zinc-100"}`}>
                          Drone Command
                        </span>
                        <span className="ml-auto flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                          {dc.command}
                          {isConfirmed && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">confirmed</span>
                          )}
                          {isCancelled && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-700/50 border border-zinc-600 text-zinc-500">cancelled</span>
                          )}
                        </span>
                      </div>

                      {/* Parameters (if any) */}
                      {hasParams && (
                        <div className={`px-4 py-3 border-b border-zinc-700/60 text-xs ${isCancelled ? "opacity-50" : ""}`}>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Parameters</p>
                          {Object.entries(dc.parameters).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-zinc-500">{k}:</span>
                              <span className="text-zinc-200 font-mono">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {isPending && (
                        <div className="flex items-center justify-end gap-2 px-4 py-3">
                          <button
                            type="button"
                            onClick={handleCancelDroneCommand}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700/50 text-zinc-300 border border-zinc-600 hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmDroneCommand}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                          >
                            Execute
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Standard message bubble
              return (
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

                    {/* Tool call badges + timing pill + receivedAt */}
                    {!!(msg.toolCalls?.length || msg.timings?.length || msg.receivedAt) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {msg.toolCalls?.map((tc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/40 border border-zinc-700/30 text-[11px] text-zinc-400"
                          >
                            <Wrench size={10} className="text-zinc-500" />
                            {tc.toolName}
                          </span>
                        ))}
                        {msg.timings && msg.timings.length > 0 && (
                          <TimingBadge timings={msg.timings} />
                        )}
                        {msg.ackRoundTripMs !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-mono whitespace-nowrap">
                            <Clock size={10} className="shrink-0" />
                            ack {formatMs(msg.ackRoundTripMs)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-zinc-700/50 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-zinc-400" />
                    </div>
                  )}
                </div>
              );
            })}

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

          {/* Voice waveform + input */}
          <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm px-4 py-3 space-y-2">
            {/* Waveform row (only visible while recording or transcribing) */}
            {(isRecording || isTranscribing) && (
              <div className="flex items-center justify-center gap-0.5 h-10">
                {isRecording && (
                  <>
                    {leftBars.map((h, i) => (
                      <div
                        key={`l-${i}`}
                        className="rounded-full"
                        style={{
                          width: 2,
                          height: `${Math.max(2, h * 40)}px`,
                          backgroundColor: `rgba(207, 185, 145, ${0.3 + h * 0.6})`,
                          transition: "height 60ms ease-out",
                        }}
                      />
                    ))}
                    <div className="w-2" />
                    {rightBars.map((h, i) => (
                      <div
                        key={`r-${i}`}
                        className="rounded-full"
                        style={{
                          width: 2,
                          height: `${Math.max(2, h * 40)}px`,
                          backgroundColor: `rgba(207, 185, 145, ${0.3 + h * 0.6})`,
                          transition: "height 60ms ease-out",
                        }}
                      />
                    ))}
                  </>
                )}
                {isTranscribing && (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 text-[#cfb991]/60 animate-spin" />
                    <span className="text-xs text-[#cfb991]/60 font-mono">
                      Transcribing...
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Text input + mic + send */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              {/* Mic button */}
              <div className="relative w-9 h-9 shrink-0">
                {rings.map((ring, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div
                      className="rounded-full border border-[#cfb991]/30 transition-all"
                      style={{
                        width: 36,
                        height: 36,
                        transform: `scale(${isRecording ? ring.scale : 1})`,
                        opacity: ring.opacity,
                        backgroundColor: `rgba(207, 185, 145, ${ring.opacity * 0.3})`,
                        transitionDuration: isRecording ? "150ms" : "400ms",
                        transitionTimingFunction: "ease-out",
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleToggleRecord}
                  disabled={isTranscribing || isLoading}
                  className={`
                    absolute inset-0 z-10 flex items-center justify-center rounded-full
                    transition-all duration-300 ease-out cursor-pointer select-none
                    ${
                      isTranscribing
                        ? "bg-[#cfb991]/10 cursor-wait"
                        : isRecording
                          ? "bg-red-500/90 hover:bg-red-400/90 shadow-[0_0_16px_rgba(239,68,68,0.3)]"
                          : "bg-[#cfb991]/20 hover:bg-[#cfb991]/30"
                    }
                    border border-[#cfb991]/40 hover:border-[#cfb991]/60
                    disabled:opacity-40 disabled:cursor-not-allowed
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
                    <Loader2 className="w-4 h-4 text-[#cfb991] animate-spin" />
                  ) : isRecording ? (
                    <Square className="w-3.5 h-3.5 text-white" fill="white" />
                  ) : (
                    <Mic className="w-4 h-4 text-[#cfb991]" />
                  )}
                </button>
              </div>

              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isRecording ? "Recording..." : "Type a message..."}
                disabled={isLoading || isRecording}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#cfb991]/50 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading || isRecording}
                className="px-4 py-2.5 rounded-xl bg-[#cfb991] text-zinc-900 font-medium text-sm hover:bg-[#cfb991]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>

            {isRecording && (
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <RecordingTimer />
              </div>
            )}
          </div>
        </section>

        {/* Right: tool calls timeline */}
        <section className="flex-[2] min-w-0 flex flex-col bg-zinc-950">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/40 shrink-0">
            <Wrench size={14} className="text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Tool calls
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">
              ({toolCallLog.length})
            </span>
            <button
              type="button"
              onClick={() => setToolCallLog([])}
              className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>

          <div
            ref={toolScrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin"
          >
            {toolCallLog.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2 text-zinc-600 text-sm text-center px-4">
                <Wrench size={28} className="opacity-30" />
                No tool calls yet. They appear here when the LLM uses tools.
              </div>
            )}

            {toolCallLog.map((entry) => {
              const isOpen = expandedIds.has(entry.id);
              const resultObj = entry.result as Record<string, unknown>;
              const success = resultObj?.success === true;
              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(entry.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    {isOpen ? (
                      <ChevronDown
                        size={16}
                        className="text-zinc-500 shrink-0"
                      />
                    ) : (
                      <ChevronRight
                        size={16}
                        className="text-zinc-500 shrink-0"
                      />
                    )}
                    <Wrench size={12} className="text-zinc-500 shrink-0" />
                    <span className="font-mono text-sm text-[#cfb991] font-medium truncate">
                      {entry.toolName}
                    </span>
                    <span
                      className={`text-[10px] ml-1 shrink-0 ${success ? "text-emerald-400/80" : "text-red-400/80"}`}
                    >
                      {success ? "ok" : "fail"}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono ml-auto shrink-0">
                      {entry.timestamp.toLocaleTimeString("en-US", {
                        hour12: false,
                        fractionalSecondDigits: 1,
                      } as Intl.DateTimeFormatOptions)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-0 space-y-2 border-t border-zinc-800/60">
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                          Args
                        </div>
                        <pre className="text-[11px] font-mono text-zinc-300 bg-zinc-950/80 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto scrollbar-thin">
                          {JSON.stringify(entry.args, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                          Result
                        </div>
                        <pre className="text-[11px] font-mono text-zinc-300 bg-zinc-950/80 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto scrollbar-thin">
                          {JSON.stringify(entry.result, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function TimingBadge({ timings }: { timings: TimingStep[] }) {
  const [open, setOpen] = useState(false);

  const totalStep = timings.find((t) => t.label === "Total");
  const details = timings.filter((t) => t.label !== "Total");
  const totalMs = totalStep?.ms ?? timings[timings.length - 1]?.ms ?? 0;

  return (
    <span className="relative inline-flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/40 border border-zinc-700/30 text-[11px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors cursor-pointer select-none"
      >
        <Clock size={10} className="shrink-0" />
        <span className="font-mono tabular-nums">{formatMs(totalMs)}</span>
        {details.length > 0 && (
          open
            ? <ChevronDown size={10} className="shrink-0 opacity-50" />
            : <ChevronRight size={10} className="shrink-0 opacity-50" />
        )}
      </button>

      {open && details.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] rounded-lg border border-zinc-700/50 bg-zinc-900 shadow-xl shadow-black/40 py-1.5 px-2 space-y-0.5">
          {details.map((step, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-zinc-400 truncate">{step.label}</span>
              <span className="font-mono tabular-nums text-zinc-300 shrink-0">
                {formatMs(step.ms)}
              </span>
            </div>
          ))}
          <div className="border-t border-zinc-700/40 mt-1 pt-1 flex items-center justify-between gap-3 text-[11px] font-medium">
            <span className="text-zinc-300">Total</span>
            <span className="font-mono tabular-nums text-[#cfb991]">
              {formatMs(totalMs)}
            </span>
          </div>
        </div>
      )}
    </span>
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
