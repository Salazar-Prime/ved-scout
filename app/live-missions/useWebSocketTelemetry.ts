"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [droneModel, setDroneModel] = useState<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [sequenceNumber, setSequenceNumber] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const idRef = useRef(0);

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

  /* ---- Connect ---- */
  const connect = useCallback(
    (url: string) => {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setStatus("connecting");
      addEntry("info", `Connecting to ${url}...`);

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        addEntry("success", `Connected to telemetry feed at ${url}`);
        addEntry("info", "Awaiting telemetry data...");
      };

      ws.onmessage = (event) => {
        try {
          const msg: TelemetryMessage = JSON.parse(event.data);

          if (msg.type === "telemetry" && msg.data) {
            setTelemetry(msg.data);
            setSequenceNumber(msg.sequenceNumber);

            if (msg.droneModel) {
              setDroneModel(msg.droneModel);
            }

            // Log a summary every 10th sequence number
            if (msg.sequenceNumber % 10 === 0) {
              addEntry(
                "info",
                `Seq #${msg.sequenceNumber} | Battery: ${msg.data.battery.toFixed(1)}% | Alt: ${msg.data.altitude.toFixed(1)}m | Speed: ${msg.data.speed.toFixed(2)} m/s | Pos: ${msg.data.latitude.toFixed(6)}, ${msg.data.longitude.toFixed(6)} | Flight: ${formatFlightTime(msg.data.flightTime)}`
              );
            }

            // Warnings
            if (msg.data.battery < 20) {
              addEntry("warn", `Low battery warning: ${msg.data.battery.toFixed(1)}%`);
            }
            if (msg.data.signal < 50) {
              addEntry("warn", `Weak signal: ${msg.data.signal.toFixed(1)} dBm`);
            }
          } else {
            addEntry("info", `Received: ${event.data}`);
          }
        } catch {
          // Non-JSON message
          addEntry("info", `Received: ${event.data}`);
        }
      };

      ws.onerror = () => {
        setStatus("error");
        addEntry("error", "WebSocket connection error");
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        addEntry(
          "warn",
          `Connection closed (code ${event.code}${event.reason ? `: ${event.reason}` : ""})`
        );
        wsRef.current = null;
      };
    },
    [addEntry]
  );

  /* ---- Disconnect ---- */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /* ---- Cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

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
