"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useWebSocketConnection } from "../components/webSocketContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TelemetryData {
  battery: number;
  altitude: number;
  speed: number;
  heading: number;
  latitude: number;
  longitude: number;
  temperature: number;
  signal: number;
  flightTime: number;
}

export interface TelemetryMessage {
  type: string;
  droneModel: string;
  timestamp: string;
  sequenceNumber: number;
  data: TelemetryData;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ConsoleEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface UseWebSocketTelemetryReturn {
  status: ConnectionStatus;
  telemetry: TelemetryData | null;
  droneModel: string | null;
  consoleEntries: ConsoleEntry[];
  sequenceNumber: number;
  connect: (url: string) => void;
  disconnect: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getNow(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    fractionalSecondDigits: 1,
  } as Intl.DateTimeFormatOptions);
}

function formatFlightTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useWebSocketTelemetry(): UseWebSocketTelemetryReturn {
  const {
    isConnected,
    isConnecting,
    connectionError,
    connect: contextConnect,
    disconnect: contextDisconnect,
    subscribeToMessages,
  } = useWebSocketConnection();

  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [droneModel, setDroneModel] = useState<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [sequenceNumber, setSequenceNumber] = useState(0);
  const idRef = useRef(0);

  const status: ConnectionStatus = useMemo(() => {
    if (isConnecting) return "connecting";
    if (isConnected) return "connected";
    if (connectionError) return "error";
    return "disconnected";
  }, [isConnected, isConnecting, connectionError]);

  const addEntry = useCallback(
    (level: ConsoleEntry["level"], message: string) => {
      setConsoleEntries((prev) => [
        ...prev,
        {
          id: idRef.current++,
          timestamp: getNow(),
          level,
          message,
        },
      ]);
    },
    []
  );

  const connect = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      addEntry("info", `Connecting to ${trimmed}...`);
      contextConnect(trimmed);
    },
    [addEntry, contextConnect]
  );

  const disconnect = useCallback(() => {
    contextDisconnect();
  }, [contextDisconnect]);

  useEffect(() => {
    return subscribeToMessages(({ parsed }) => {
      if (!parsed || typeof parsed !== "object") return;

      const msg = parsed as unknown as TelemetryMessage;
      if (msg.type === "telemetry" && msg.data) {
        setTelemetry(msg.data);
        setSequenceNumber(msg.sequenceNumber);

        if (msg.droneModel) {
          setDroneModel(msg.droneModel);
        }

        if (msg.sequenceNumber % 10 === 0) {
          addEntry(
            "info",
            `Seq #${msg.sequenceNumber} | Battery: ${msg.data.battery.toFixed(1)}% | Alt: ${msg.data.altitude.toFixed(1)}m | Speed: ${msg.data.speed.toFixed(2)} m/s | Pos: ${msg.data.latitude.toFixed(6)}, ${msg.data.longitude.toFixed(6)} | Flight: ${formatFlightTime(msg.data.flightTime)}`
          );
        }

        if (msg.data.battery < 20) {
          addEntry("warn", `Low battery warning: ${msg.data.battery.toFixed(1)}%`);
        }
        if (msg.data.signal < 50) {
          addEntry("warn", `Weak signal: ${msg.data.signal.toFixed(1)} dBm`);
        }
      }
    });
  }, [subscribeToMessages, addEntry]);

  return {
    status,
    telemetry,
    droneModel,
    consoleEntries,
    sequenceNumber,
    connect,
    disconnect,
  };
}

export { formatFlightTime };
