"use client";

import { useEffect, useRef } from "react";
import {
  Radio,
  Battery,
  Navigation,
  Gauge,
  Thermometer,
  Wifi,
  ArrowUp,
  Clock,
} from "lucide-react";
import {
  type TelemetryData,
  type ConnectionStatus,
  type ConsoleEntry,
  formatFlightTime,
} from "./useWebSocketTelemetry";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TelemetryConsoleProps {
  telemetry: TelemetryData | null;
  status: ConnectionStatus;
  droneModel: string | null;
  sequenceNumber: number;
  consoleEntries: ConsoleEntry[];
}

/* ------------------------------------------------------------------ */
/*  Telemetry stat card                                                */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  warning,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg bg-zinc-800/60 border px-3 py-2 min-w-[140px] transition-colors ${
        warning
          ? "border-amber-500/50 bg-amber-500/5"
          : "border-zinc-700/50"
      }`}
    >
      <Icon
        size={16}
        className={`shrink-0 ${warning ? "text-amber-400" : "text-[#cfb991]"}`}
      />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
          {label}
        </span>
        <span className="text-sm font-mono text-zinc-200">
          {value}
          {unit && <span className="text-zinc-500 ml-0.5 text-xs">{unit}</span>}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Level styling                                                      */
/* ------------------------------------------------------------------ */

function getLevelStyle(level: ConsoleEntry["level"]) {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-amber-400";
    case "success":
      return "text-emerald-400";
    default:
      return "text-zinc-400";
  }
}

function getLevelPrefix(level: ConsoleEntry["level"]) {
  switch (level) {
    case "error":
      return "[ERR]";
    case "warn":
      return "[WRN]";
    case "success":
      return "[OK] ";
    default:
      return "[INF]";
  }
}

/* ------------------------------------------------------------------ */
/*  Status indicator                                                   */
/* ------------------------------------------------------------------ */

function statusDotClass(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "bg-emerald-400 animate-pulse";
    case "connecting":
      return "bg-amber-400 animate-pulse";
    case "error":
      return "bg-red-400";
    default:
      return "bg-zinc-600";
  }
}

/* ------------------------------------------------------------------ */
/*  Main console component                                             */
/* ------------------------------------------------------------------ */

export default function TelemetryConsole({
  telemetry,
  status,
  droneModel,
  sequenceNumber,
  consoleEntries,
}: TelemetryConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleEntries]);

  const t = telemetry;

  return (
    <div className="flex flex-col h-full">
      {/* Telemetry stats bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 overflow-x-auto scrollbar-thin">
        <StatCard
          icon={Battery}
          label="Battery"
          value={t ? t.battery.toFixed(1) : "--"}
          unit="%"
          warning={t ? t.battery < 20 : false}
        />
        <StatCard
          icon={ArrowUp}
          label="Altitude"
          value={t ? t.altitude.toFixed(1) : "--"}
          unit="m"
        />
        <StatCard
          icon={Gauge}
          label="Speed"
          value={t ? t.speed.toFixed(2) : "--"}
          unit="m/s"
        />
        <StatCard
          icon={Navigation}
          label="Heading"
          value={t ? t.heading.toFixed(1) : "--"}
          unit="°"
        />
        <StatCard
          icon={Thermometer}
          label="Temp"
          value={t ? t.temperature.toFixed(1) : "--"}
          unit="°C"
        />
        <StatCard
          icon={Wifi}
          label="Signal"
          value={t ? t.signal.toFixed(1) : "--"}
          unit="dBm"
          warning={t ? t.signal < 50 : false}
        />
        <StatCard
          icon={Clock}
          label="Flight Time"
          value={t ? formatFlightTime(t.flightTime) : "--:--"}
        />
      </div>

      {/* Console header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusDotClass(status)}`} />
          <Radio size={14} className="text-[#cfb991]" />
        </div>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Telemetry Console
          {status === "connected" && (
            <span className="ml-1.5 text-emerald-400">(LIVE)</span>
          )}
        </span>
        {droneModel && (
          <span className="text-[10px] text-zinc-500 font-mono ml-2">
            {droneModel}
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-600 font-mono">
          {status === "connected" && `seq #${sequenceNumber} · `}
          {consoleEntries.length} entries
        </span>
      </div>

      {/* Console output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed scrollbar-thin bg-zinc-950/50"
      >
        {consoleEntries.length === 0 && (
          <div className="flex items-center gap-2 text-zinc-600">
            <span className="animate-pulse">●</span>
            <span>Waiting for WebSocket connection...</span>
          </div>
        )}

        {consoleEntries.map((entry) => (
          <div
            key={entry.id}
            className="flex gap-2 hover:bg-zinc-800/30 px-1 py-0.5 rounded"
          >
            <span className="text-zinc-600 shrink-0">{entry.timestamp}</span>
            <span
              className={`shrink-0 font-bold ${getLevelStyle(entry.level)}`}
            >
              {getLevelPrefix(entry.level)}
            </span>
            <span className="text-zinc-300">{entry.message}</span>
          </div>
        ))}

        {/* Blinking cursor */}
        {consoleEntries.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-zinc-600">
            <span className="text-[#cfb991]">▸</span>
            <span className="animate-pulse">_</span>
          </div>
        )}
      </div>
    </div>
  );
}
