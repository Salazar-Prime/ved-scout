"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Plug, Unplug, Circle } from "lucide-react";
import { useWebSocketConnection } from "../components/webSocketContext";
import TelemetryConsole from "./telemetryConsole";
import { useWebSocketTelemetry } from "./useWebSocketTelemetry";

const LiveMissionMap = dynamic(() => import("./liveMissionMap"), { ssr: false });

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

function statusColor(status: string) {
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

function statusLabel(status: string) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "error":
      return "Error";
    default:
      return "Disconnected";
  }
}

/* ------------------------------------------------------------------ */
/*  Max trail length to prevent memory growth                          */
/* ------------------------------------------------------------------ */

const MAX_TRAIL_LENGTH = 500;

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LiveMissionsPage() {
  const { wsUrl, setWsUrl } = useWebSocketConnection();
  const {
    status,
    telemetry,
    droneModel,
    consoleEntries,
    sequenceNumber,
    connect,
    disconnect,
  } = useWebSocketTelemetry();

  /* Track drone trail positions */
  const [droneTrail, setDroneTrail] = useState<[number, number][]>([]);
  const lastTrailRef = useRef<string>("");

  // Accumulate trail positions when telemetry changes
  const prevTelRef = useRef(telemetry);
  if (telemetry && telemetry !== prevTelRef.current) {
    prevTelRef.current = telemetry;
    const key = `${telemetry.latitude},${telemetry.longitude}`;
    if (key !== lastTrailRef.current) {
      lastTrailRef.current = key;
      setDroneTrail((prev) => {
        const next = [...prev, [telemetry.latitude, telemetry.longitude] as [number, number]];
        return next.length > MAX_TRAIL_LENGTH ? next.slice(-MAX_TRAIL_LENGTH) : next;
      });
    }
  }

  const isConnected = status === "connected";

  const handleConnect = useCallback(() => {
    setDroneTrail([]);
    lastTrailRef.current = "";
    connect(wsUrl);
  }, [connect, wsUrl]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Connection bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <Circle
            size={8}
            className={`fill-current ${statusColor(status)}`}
          />
          <span className={`text-xs font-medium ${statusColor(status)}`}>
            {statusLabel(status)}
          </span>
        </div>

        <input
          type="text"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          disabled={isConnected}
          placeholder="ws://localhost:8765"
          className="flex-1 max-w-md bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#cfb991]/40 focus:border-[#cfb991]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />

        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={status === "connecting" || !wsUrl.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#cfb991]/15 text-[#cfb991] border border-[#cfb991]/40 hover:bg-[#cfb991]/25 hover:border-[#cfb991]/60 hover:shadow-[0_0_20px_rgba(207,185,145,0.15)] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Plug size={14} />
            Connect
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Unplug size={14} />
            Disconnect
          </button>
        )}

        {droneModel && (
          <span className="text-[10px] text-zinc-500 font-mono ml-auto">
            {droneModel}
          </span>
        )}
      </div>

      {/* Map — takes up the top portion, fills available space */}
      <div className="flex-1 min-h-0 relative">
        <LiveMissionMap telemetry={telemetry} droneTrail={droneTrail} />
      </div>

      {/* Telemetry console — fixed height at the bottom */}
      <div className="h-[280px] shrink-0 border-t border-[#cfb991]/20 bg-zinc-900/95 backdrop-blur-sm">
        <TelemetryConsole
          telemetry={telemetry}
          status={status}
          droneModel={droneModel}
          sequenceNumber={sequenceNumber}
          consoleEntries={consoleEntries}
        />
      </div>
    </div>
  );
}
