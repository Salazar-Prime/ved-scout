"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plug,
  Unplug,
  Send,
  Trash2,
  Circle,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface WsMessage {
  id: number;
  direction: "sent" | "received";
  timestamp: string;
  data: string;
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

function statusColor(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "text-emerald-400";
    case "connecting":
      return "text-amber-400 animate-pulse";
    case "error":
      return "text-red-400";
    default:
      return "text-zinc-500";
  }
}

function statusLabel(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting…";
    case "error":
      return "Error";
    default:
      return "Disconnected";
  }
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function WebSocketConnectPage() {
  const [wsUrl, setWsUrl] = useState("ws://0.0.0.0:8765");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getNow = () =>
    new Date().toLocaleTimeString("en-US", {
      hour12: false,
      fractionalSecondDigits: 1,
    } as Intl.DateTimeFormatOptions);

  /* Auto-scroll to bottom on new messages */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  /* ---- Connect ---- */
  const handleConnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("connecting");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          direction: "received",
          timestamp: getNow(),
          data: `✓ Connected to ${wsUrl}`,
        },
      ]);
    };

    ws.onmessage = (event) => {
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          direction: "received",
          timestamp: getNow(),
          data: typeof event.data === "string" ? event.data : "[binary data]",
        },
      ]);
    };

    ws.onerror = () => {
      setStatus("error");
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          direction: "received",
          timestamp: getNow(),
          data: "✗ Connection error",
        },
      ]);
    };

    ws.onclose = (event) => {
      setStatus("disconnected");
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          direction: "received",
          timestamp: getNow(),
          data: `Connection closed (code ${event.code})`,
        },
      ]);
      wsRef.current = null;
    };
  }, [wsUrl]);

  /* ---- Disconnect ---- */
  const handleDisconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  /* ---- Send message ---- */
  const handleSend = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!inputMessage.trim()) return;

    wsRef.current.send(inputMessage);
    setMessages((prev) => [
      ...prev,
      {
        id: idRef.current++,
        direction: "sent",
        timestamp: getNow(),
        data: inputMessage,
      },
    ]);
    setInputMessage("");
  }, [inputMessage]);

  /* ---- Clear log ---- */
  const handleClear = () => setMessages([]);

  const isConnected = status === "connected";

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-200">
      {/* ---- Header ---- */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <Plug size={22} className="text-[#cfb991]" />
        <h1 className="text-lg font-semibold text-white tracking-wide">
          WebSocket Connection
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Circle size={10} className={`fill-current ${statusColor(status)}`} />
          <span className={`text-xs font-medium ${statusColor(status)}`}>
            {statusLabel(status)}
          </span>
        </div>
      </div>

      {/* ---- Connection bar ---- */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800/60 bg-zinc-900/50">
        <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium shrink-0">
          URL
        </label>
        <input
          type="text"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          disabled={isConnected}
          placeholder="ws://0.0.0.0:8765"
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#cfb991]/40 focus:border-[#cfb991]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={status === "connecting" || !wsUrl.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#cfb991]/15 text-[#cfb991] border border-[#cfb991]/40 hover:bg-[#cfb991]/25 hover:border-[#cfb991]/60 hover:shadow-[0_0_20px_rgba(207,185,145,0.15)] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Plug size={16} />
            Connect
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Unplug size={16} />
            Disconnect
          </button>
        )}
      </div>

      {/* ---- Messages area ---- */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Messages toolbar */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-zinc-800/40">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Messages
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            ({messages.length})
          </span>
          <button
            onClick={handleClear}
            className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title="Clear messages"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>

        {/* Messages log */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed scrollbar-thin bg-zinc-950/50"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
              <Plug size={32} className="opacity-30" />
              <span className="text-sm">
                No messages yet — connect to start
              </span>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex gap-2 hover:bg-zinc-800/30 px-2 py-1 rounded group"
            >
              <span className="text-zinc-600 shrink-0">{msg.timestamp}</span>
              {msg.direction === "sent" ? (
                <ArrowUpCircle
                  size={14}
                  className="text-[#cfb991] shrink-0 mt-0.5"
                />
              ) : (
                <ArrowDownCircle
                  size={14}
                  className="text-emerald-400 shrink-0 mt-0.5"
                />
              )}
              <span
                className={`${
                  msg.direction === "sent" ? "text-[#cfb991]" : "text-zinc-300"
                } break-all`}
              >
                {msg.data}
              </span>
            </div>
          ))}

          {/* Blinking cursor */}
          {messages.length > 0 && (
            <div className="flex items-center gap-1 mt-1 text-zinc-600">
              <span className="text-[#cfb991]">▸</span>
              <span className="animate-pulse">_</span>
            </div>
          )}
        </div>
      </div>

      {/* ---- Send bar ---- */}
      <div className="flex items-center gap-3 px-6 py-3 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <Clock size={14} className="text-zinc-600 shrink-0" />
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          disabled={!isConnected}
          placeholder={
            isConnected
              ? "Type a message and press Enter…"
              : "Connect to send messages"
          }
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#cfb991]/40 focus:border-[#cfb991]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !inputMessage.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#cfb991]/15 text-[#cfb991] border border-[#cfb991]/40 hover:bg-[#cfb991]/25 hover:border-[#cfb991]/60 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <Send size={16} />
          Send
        </button>
      </div>
    </div>
  );
}
