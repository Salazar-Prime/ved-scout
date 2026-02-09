"use client";

import { useState, useEffect, useRef } from "react";
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TelemetryEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Mock telemetry data (will be replaced by live UAS feed)            */
/* ------------------------------------------------------------------ */

const mockTelemetryStream: Omit<TelemetryEntry, "id" | "timestamp">[] = [
  { level: "info", message: "System initialized — awaiting UAS connection..." },
  { level: "info", message: "Telemetry link: standby" },
  { level: "warn", message: "No active UAS connected. Displaying placeholder data." },
  { level: "info", message: "GPS fix: waiting..." },
  { level: "info", message: "Battery: --% | Altitude: -- m | Speed: -- m/s" },
  { level: "info", message: "IMU calibration: pending" },
  { level: "info", message: "Compass heading: --°" },
  { level: "success", message: "Console ready — connect UAS to begin live telemetry." },
];

/* ------------------------------------------------------------------ */
/*  Telemetry stat card                                                */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 min-w-[140px]">
      <Icon size={16} className="text-[#cfb991] shrink-0" />
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

function getLevelStyle(level: TelemetryEntry["level"]) {
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

function getLevelPrefix(level: TelemetryEntry["level"]) {
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
/*  Main console component                                             */
/* ------------------------------------------------------------------ */

export default function TelemetryConsole() {
  const [entries, setEntries] = useState<TelemetryEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  // Simulate telemetry feed appearing line-by-line
  useEffect(() => {
    let idx = 0;

    const interval = setInterval(() => {
      if (idx >= mockTelemetryStream.length) {
        clearInterval(interval);
        return;
      }

      const now = new Date();
      const ts = now.toLocaleTimeString("en-US", { hour12: false, fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions);

      setEntries((prev) => [
        ...prev,
        {
          id: idRef.current++,
          timestamp: ts,
          ...mockTelemetryStream[idx],
        },
      ]);

      idx++;
    }, 800);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="flex flex-col h-full">
      {/* Telemetry stats bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 overflow-x-auto scrollbar-thin">
        <StatCard icon={Battery} label="Battery" value="--" unit="%" />
        <StatCard icon={ArrowUp} label="Altitude" value="--" unit="m" />
        <StatCard icon={Gauge} label="Speed" value="--" unit="m/s" />
        <StatCard icon={Navigation} label="Heading" value="--" unit="°" />
        <StatCard icon={Thermometer} label="Temp" value="--" unit="°C" />
        <StatCard icon={Wifi} label="Signal" value="--" unit="dBm" />
        <StatCard icon={Clock} label="Flight Time" value="--:--" />
      </div>

      {/* Console output */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/60">
        <Radio size={14} className="text-[#cfb991] animate-pulse" />
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Telemetry Console (LIVE)
        </span>
        <span className="ml-auto text-[10px] text-zinc-600 font-mono">
          {entries.length} entries
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed scrollbar-thin bg-zinc-950/50"
      >
        {entries.length === 0 && (
          <div className="flex items-center gap-2 text-zinc-600">
            <span className="animate-pulse">●</span>
            <span>Initializing telemetry console...</span>
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-2 hover:bg-zinc-800/30 px-1 py-0.5 rounded">
            <span className="text-zinc-600 shrink-0">{entry.timestamp}</span>
            <span className={`shrink-0 font-bold ${getLevelStyle(entry.level)}`}>
              {getLevelPrefix(entry.level)}
            </span>
            <span className="text-zinc-300">{entry.message}</span>
          </div>
        ))}

        {/* Blinking cursor */}
        {entries.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-zinc-600">
            <span className="text-[#cfb991]">▸</span>
            <span className="animate-pulse">_</span>
          </div>
        )}
      </div>
    </div>
  );
}
