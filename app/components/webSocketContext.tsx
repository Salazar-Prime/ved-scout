"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface WebSocketContextValue {
  isConnected: boolean;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: Record<string, unknown>) => void;
  sendCommandAndWait: (
    command: Record<string, unknown>,
    timeoutMs?: number
  ) => Promise<Record<string, unknown>>;
  lastMessage: Record<string, unknown> | null;
  connectionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useWebSocketConnection() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error(
      "useWebSocketConnection must be used within a WebSocketProvider"
    );
  }
  return ctx;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [wsUrl, setWsUrl] = useState("ws://localhost:8080");
  const [lastMessage, setLastMessage] = useState<Record<string, unknown> | null>(
    null
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommandsRef = useRef<
    Map<
      string,
      {
        resolve: (value: Record<string, unknown>) => void;
        reject: (reason?: unknown) => void;
        timeout: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectionError(null);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      disconnect();
    }

    setConnectionError(null);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        console.log("WebSocket connected to:", wsUrl);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        console.log("WebSocket disconnected");
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionError("Failed to connect to WebSocket");
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Check if this is a response to a pending command
          if (data.commandId && pendingCommandsRef.current.has(data.commandId)) {
            const pending = pendingCommandsRef.current.get(data.commandId);
            if (pending) {
              clearTimeout(pending.timeout);
              pending.resolve(data);
              pendingCommandsRef.current.delete(data.commandId);
            }
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };
    } catch (err) {
      setConnectionError(
        err instanceof Error ? err.message : "Connection failed"
      );
      setIsConnected(false);
    }
  }, [wsUrl, disconnect]);

  const sendMessage = useCallback(
    (message: Record<string, unknown>) => {
      if (wsRef.current && isConnected) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn("WebSocket not connected, cannot send message");
      }
    },
    [isConnected]
  );

  const sendCommandAndWait = useCallback(
    (
      command: Record<string, unknown>,
      timeoutMs: number = 30000
    ): Promise<Record<string, unknown>> => {
      return new Promise((resolve, reject) => {
        if (!wsRef.current || !isConnected) {
          reject(new Error("WebSocket not connected"));
          return;
        }

        // Generate unique command ID
        const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const messageWithId = { ...command, commandId };

        // Set up timeout
        const timeout = setTimeout(() => {
          pendingCommandsRef.current.delete(commandId);
          reject(new Error("Command timeout - no response received"));
        }, timeoutMs);

        // Store pending command
        pendingCommandsRef.current.set(commandId, { resolve, reject, timeout });

        // Send command
        try {
          wsRef.current.send(JSON.stringify(messageWithId));
        } catch (err) {
          clearTimeout(timeout);
          pendingCommandsRef.current.delete(commandId);
          reject(err);
        }
      });
    },
    [isConnected]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Clear all pending commands
      pendingCommandsRef.current.forEach((pending) => {
        clearTimeout(pending.timeout);
        pending.reject(new Error("WebSocket connection closed"));
      });
      pendingCommandsRef.current.clear();
      
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        wsUrl,
        setWsUrl,
        connect,
        disconnect,
        sendMessage,
        sendCommandAndWait,
        lastMessage,
        connectionError,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
