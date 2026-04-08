"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useModal } from "../components/modal/modalContext";
import {
  appendSavedFlightScriptChat,
  isFlightScriptChatNameTaken,
  type SavedFlightScriptChatMessage,
} from "../../lib/flightScriptSavedChatsStorage";
import {
  downloadFlightScriptChatExcel,
  type ToolCallLogEntry,
} from "../../lib/exportFlightScriptChatToXlsx";

interface TimingStep {
  label: string;
  ms: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: unknown;
  timestamp: Date;
  timings?: TimingStep[];
  ackRoundTripMs?: number;
}

export default function SaveFlightScriptChatContent({
  messages,
  toolCallLog,
}: {
  messages: Message[];
  toolCallLog?: ToolCallLogEntry[];
}) {
  const { closeModal } = useModal();
  const [chatName, setChatName] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(() => {
    const name = chatName.trim();
    if (!name) {
      setError("Enter a unique name for this chat.");
      return;
    }
    if (isFlightScriptChatNameTaken(name)) {
      setError("That name is already used. Choose a different name.");
      return;
    }
    if (messages.length === 0) {
      setError("There are no messages to save.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const serialized: SavedFlightScriptChatMessage[] = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        timestamp: m.timestamp.toISOString(),
        timings: m.timings,
        ackRoundTripMs: m.ackRoundTripMs,
      }));

      const id = `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const savedAt = new Date().toISOString();
      const note = noteMessage.trim();

      appendSavedFlightScriptChat({
        id,
        chatName: name,
        noteMessage: note,
        savedAt,
        messages: serialized,
      });

      downloadFlightScriptChatExcel({
        fileBaseName: name,
        chatName: name,
        noteMessage: note,
        savedAtIso: savedAt,
        messages: serialized,
        toolCallLog,
      });

      // Small delay so the browser download trigger completes before the modal unmounts
      setTimeout(() => closeModal(), 150);
    } catch (e) {
      console.error("Save chat failed:", e);
      setError("Could not save. Try again.");
    } finally {
      setIsSaving(false);
    }
  }, [chatName, noteMessage, messages, toolCallLog, closeModal]);

  return (
    <div className="px-5 py-4 space-y-4">
      <p className="text-sm text-zinc-400">
        Downloads an Excel file and stores a copy in this browser so you can
        reopen it on the Saved chats page.
      </p>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={chatName}
          onChange={(e) => {
            setChatName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Ortho mission debug — Apr 7"
          disabled={isSaving}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#cfb991]/50"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Note
        </label>
        <textarea
          value={noteMessage}
          onChange={(e) => setNoteMessage(e.target.value)}
          placeholder="Optional context (what you were testing, etc.)"
          disabled={isSaving}
          rows={3}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#cfb991]/50 resize-y min-h-[72px]"
        />
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={closeModal}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#cfb991] text-zinc-900 hover:bg-[#cfb991]/85 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save and download
        </button>
      </div>
    </div>
  );
}
