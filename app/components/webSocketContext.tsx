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

const wsUrlStorageKey = "vedScout.wsUrl";
const wsAutoConnectStorageKey = "vedScout.wsAutoConnect";

const defaultWsUrl = "ws://localhost:8765";

function readStoredWsUrl(): string {
  if (typeof window === "undefined") return defaultWsUrl;
  try {
    const stored = localStorage.getItem(wsUrlStorageKey);
    return stored?.trim() || defaultWsUrl;
  } catch {
    return defaultWsUrl;
  }
}

export type WebSocketInboundPayload = {
  parsed: Record<string, unknown> | null;
  raw: string;
};

type MessageListener = (payload: WebSocketInboundPayload) => void;

interface WebSocketContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  connect: (overrideUrl?: string) => void;
  disconnect: () => void;
  sendMessage: (message: Record<string, unknown>) => void;
  sendRaw: (data: string) => void;
  sendCommandAndWait: (
    command: Record<string, unknown>,
    timeoutMs?: number
  ) => Promise<Record<string, unknown>>;
  lastMessage: Record<string, unknown> | null;
  connectionError: string | null;
  subscribeToMessages: (listener: MessageListener) => () => void;
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsUrl, setWsUrlState] = useState(defaultWsUrl);
  const [lastMessage, setLastMessage] = useState<Record<string, unknown> | null>(
    null
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const messageListenersRef = useRef<Set<MessageListener>>(new Set());
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

  const setWsUrl = useCallback((url: string) => {
    setWsUrlState(url);
    try {
      localStorage.setItem(wsUrlStorageKey, url);
    } catch {
      /* ignore quota */
    }
  }, []);

  const subscribeToMessages = useCallback((listener: MessageListener) => {
    messageListenersRef.current.add(listener);
    return () => {
      messageListenersRef.current.delete(listener);
    };
  }, []);

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    try {
      localStorage.removeItem(wsAutoConnectStorageKey);
    } catch {
      /* ignore */
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnecting(false);
    setIsConnected(false);
    setConnectionError(null);
  }, []);

  const connect = useCallback((overrideUrl?: string) => {
    intentionalDisconnectRef.current = false;
    const targetUrl = (overrideUrl ?? wsUrl).trim();
    if (overrideUrl !== undefined) {
      setWsUrlState(targetUrl);
      try {
        localStorage.setItem(wsUrlStorageKey, targetUrl);
      } catch {
        /* ignore */
      }
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionError(null);
    setIsConnecting(true);

    try {
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        try {
          localStorage.setItem(wsAutoConnectStorageKey, "1");
        } catch {
          /* ignore */
        }
        console.log("WebSocket connected to:", targetUrl);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        console.log("WebSocket disconnected");
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionError("Failed to connect to WebSocket");
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        const raw = typeof event.data === "string" ? event.data : "[binary data]";
        let data: Record<string, unknown> | null = null;
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          data = null;
        }

        const payload: WebSocketInboundPayload = { parsed: data, raw };
        messageListenersRef.current.forEach((listener) => {
          try {
            listener(payload);
          } catch (e) {
            console.error("WebSocket message listener error:", e);
          }
        });

        if (data) {
          setLastMessage(data);

          // Check if this is a response to a pending command
          if (data.commandId && pendingCommandsRef.current.has(data.commandId as string)) {
            const pending = pendingCommandsRef.current.get(data.commandId as string);
            if (pending) {
              clearTimeout(pending.timeout);
              pending.resolve(data);
              pendingCommandsRef.current.delete(data.commandId as string);
            }
          }
        }
      };
    } catch (err) {
      setConnectionError(
        err instanceof Error ? err.message : "Connection failed"
      );
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [wsUrl]);

  const connectRef = useRef(connect);
  connectRef.current = connect;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStoredWsUrl();
    setWsUrlState(stored);
    if (localStorage.getItem(wsAutoConnectStorageKey) !== "1") return;
    connectRef.current(stored);
  }, []);

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

  const sendRaw = useCallback(
    (data: string) => {
      if (wsRef.current && isConnected) {
        wsRef.current.send(data);
      } else {
        console.warn("WebSocket not connected, cannot send raw message");
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
        isConnecting,
        wsUrl,
        setWsUrl,
        connect,
        disconnect,
        sendMessage,
        sendRaw,
        sendCommandAndWait,
        lastMessage,
        connectionError,
        subscribeToMessages,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
