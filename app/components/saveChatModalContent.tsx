"use client";

import { useState, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useModal } from "./modal/modalContext";
import {
  appendSavedFlightScriptChat,
  isFlightScriptChatNameTaken,
} from "../../lib/flightScriptSavedChatsStorage";
import { downloadFlightScriptChatExcel } from "../../lib/exportFlightScriptChatToXlsx";
import {
  buildNewSavedChatRecord,
  type SourceChatMessageForSave,
} from "../../lib/chatSave/savedChatRecord";
import type { ToolCallLogEntry } from "../../lib/chatSave/toolCallLogExcel";

export type SaveChatModalOptions = {
  title: string;
  content: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

function SaveChatModalContent({
  messages,
  toolCallLog,
}: {
  messages: SourceChatMessageForSave[];
  toolCallLog?: ToolCallLogEntry[];
}) {
  const { closeModal } = useModal();
  const [chatName, setChatName] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
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
      const record = buildNewSavedChatRecord(name, noteMessage.trim(), messages);
      appendSavedFlightScriptChat(record);
      await downloadFlightScriptChatExcel({
        fileBaseName: name,
        chatName: record.chatName,
        noteMessage: record.noteMessage,
        savedAtIso: record.savedAt,
        messages: record.messages,
        toolCallLog,
      });
      closeModal();
    } catch (e) {
      console.error("Save chat failed:", e);
      setError(
        e instanceof Error
          ? e.message
          : "Could not save or download. Check the console and try again.",
      );
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
          onClick={() => void handleSave()}
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

/**
 * Pass to `openModal(...)` from Flight Script or Dev WS Chat so both use the same UI and pipeline.
 */
export function buildSaveChatModalOptions(
  messages: SourceChatMessageForSave[],
  toolCallLog?: ToolCallLogEntry[],
): SaveChatModalOptions {
  return {
    title: "Save chat to Excel",
    size: "md",
    content: (
      <SaveChatModalContent messages={messages} toolCallLog={toolCallLog} />
    ),
  };
}

export default SaveChatModalContent;
