import type {
  SavedFlightScriptChatMessage,
  SavedFlightScriptChatRecord,
  SavedFlightConfirmationData,
} from "../flightScriptSavedChatsStorage";
import type { ToolCallLogEntry } from "./toolCallLogExcel";

export type {
  SavedSafetyCheckItem,
  SavedFlightConfirmationData,
} from "../flightScriptSavedChatsStorage";

/**
 * Live chat message shape (Date timestamps) from Flight Script / Dev WS Chat pages.
 */
export type SourceChatMessageForSave = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: unknown;
  timestamp: Date;
  timings?: { label: string; ms: number }[];
  ackRoundTripMs?: number;
  flightConfirmation?: SavedFlightConfirmationData;
};

function toIsoTimestamp(d: Date): string {
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Normalizes messages for localStorage / Excel / Firestore (ISO strings, no undefined).
 */
export function serializeMessagesForSavedChat(
  messages: SourceChatMessageForSave[],
): SavedFlightScriptChatMessage[] {
  return messages.map((m) => {
    const row: SavedFlightScriptChatMessage = {
      id: m.id,
      role: m.role,
      content: typeof m.content === "string" ? m.content : "",
      timestamp: toIsoTimestamp(m.timestamp),
    };
    if (m.toolCalls !== undefined) {
      row.toolCalls = m.toolCalls;
    }
    if (m.timings !== undefined && m.timings.length > 0) {
      row.timings = m.timings.map((t) => ({
        label: String(t.label),
        ms: Number(t.ms) || 0,
      }));
    }
    if (m.ackRoundTripMs !== undefined && typeof m.ackRoundTripMs === "number") {
      row.ackRoundTripMs = m.ackRoundTripMs;
    }
    if (m.flightConfirmation !== undefined) {
      row.flightConfirmation = m.flightConfirmation;
    }
    return row;
  });
}

export function buildNewSavedChatRecord(
  chatName: string,
  noteMessage: string,
  messages: SourceChatMessageForSave[],
): SavedFlightScriptChatRecord {
  return {
    id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    chatName,
    noteMessage,
    savedAt: new Date().toISOString(),
    messages: serializeMessagesForSavedChat(messages),
  };
}

/**
 * Firestore rejects `undefined` anywhere in document data — strip missing optionals.
 */
export function firebaseSafeChatDocument(
  record: SavedFlightScriptChatRecord,
): Record<string, unknown> {
  const messages = record.messages.map((m) => {
    const row: Record<string, unknown> = {
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    };
    if (m.toolCalls !== undefined) {
      row.toolCalls = m.toolCalls;
    }
    if (m.timings !== undefined && m.timings.length > 0) {
      row.timings = m.timings.map((t) => ({ label: t.label, ms: t.ms }));
    }
    if (m.ackRoundTripMs !== undefined) {
      row.ackRoundTripMs = m.ackRoundTripMs;
    }
    if (m.flightConfirmation !== undefined) {
      row.flightConfirmation = m.flightConfirmation;
    }
    return row;
  });

  return {
    chatName: record.chatName,
    noteMessage: record.noteMessage,
    savedAt: record.savedAt,
    messages,
    uploadedAt: new Date().toISOString(),
  };
}

export function excelToolCallLogFromDevEntries(
  log: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result: Record<string, unknown>;
    timestamp: Date;
    turnId: string;
  }>,
): ToolCallLogEntry[] {
  return log.map((tc) => ({
    toolName: tc.toolName,
    args: tc.args,
    result: tc.result,
    timestamp: toIsoTimestamp(tc.timestamp),
    turnId: tc.turnId,
  }));
}
