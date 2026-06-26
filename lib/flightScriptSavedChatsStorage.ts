export const FLIGHT_SCRIPT_SAVED_CHATS_STORAGE_KEY =
  "ved-scout-flight-script-saved-chats-v1";

export type TimingStep = {
  label: string;
  ms: number;
};

export type SavedSafetyCheckItem = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type SavedFlightConfirmationData = {
  procedure: string;
  plot: Record<string, unknown>;
  mission: Record<string, unknown>;
  camera: Record<string, unknown>;
  safetyChecks: SavedSafetyCheckItem[];
  serverSafetyChecks: SavedSafetyCheckItem[] | null;
  status: "pending" | "confirmed" | "cancelled";
};

export type SavedFlightScriptChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: unknown;
  timestamp: string;
  timings?: TimingStep[];
  ackRoundTripMs?: number;
  flightConfirmation?: SavedFlightConfirmationData;
};

export type SavedFlightScriptChatRecord = {
  id: string;
  chatName: string;
  noteMessage: string;
  savedAt: string;
  messages: SavedFlightScriptChatMessage[];
};

interface SavedChatsSnapshot {
  version: 1;
  chats: SavedFlightScriptChatRecord[];
}

function parseSnapshot(raw: string | null): SavedFlightScriptChatRecord[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Partial<SavedChatsSnapshot>;
    if (data.version !== 1 || !Array.isArray(data.chats)) return [];
    return data.chats.filter(
      (c): c is SavedFlightScriptChatRecord =>
        typeof c?.id === "string" &&
        typeof c?.chatName === "string" &&
        typeof c?.noteMessage === "string" &&
        typeof c?.savedAt === "string" &&
        Array.isArray(c?.messages)
    );
  } catch {
    return [];
  }
}

export function loadSavedFlightScriptChats(): SavedFlightScriptChatRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(FLIGHT_SCRIPT_SAVED_CHATS_STORAGE_KEY);
  return parseSnapshot(raw);
}

function persistChats(chats: SavedFlightScriptChatRecord[]) {
  const snapshot: SavedChatsSnapshot = { version: 1, chats };
  localStorage.setItem(
    FLIGHT_SCRIPT_SAVED_CHATS_STORAGE_KEY,
    JSON.stringify(snapshot)
  );
}

export function appendSavedFlightScriptChat(
  record: SavedFlightScriptChatRecord
): void {
  const list = loadSavedFlightScriptChats();
  list.unshift(record);
  persistChats(list);
}

export function deleteSavedFlightScriptChat(id: string): void {
  const list = loadSavedFlightScriptChats().filter((c) => c.id !== id);
  persistChats(list);
}

export function isFlightScriptChatNameTaken(
  name: string,
  excludeId?: string
): boolean {
  const t = name.trim().toLowerCase();
  if (!t) return false;
  return loadSavedFlightScriptChats().some(
    (c) =>
      c.chatName.trim().toLowerCase() === t &&
      (!excludeId || c.id !== excludeId)
  );
}
