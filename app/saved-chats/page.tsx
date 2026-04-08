"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  MessageSquare,
  Trash2,
  Download,
  ChevronRight,
  ChevronDown,
  Bot,
  User,
  CloudUpload,
  CloudDownload,
  Loader2,
  Clock,
  Wrench,
} from "lucide-react";
import {
  loadSavedFlightScriptChats,
  deleteSavedFlightScriptChat,
  type SavedFlightScriptChatRecord,
} from "../../lib/flightScriptSavedChatsStorage";
import {
  uploadSavedFlightScriptChatToFirebase,
  fetchSavedFlightScriptChatsFromFirebase,
  deleteSavedFlightScriptChatFromFirebase,
} from "../../lib/flightScriptSavedChatsFirebase";
import { downloadFlightScriptChatExcel } from "../../lib/exportFlightScriptChatToXlsx";

type ChatSource = "local" | "firebase";

type MergedChatItem = {
  id: string;
  record: SavedFlightScriptChatRecord;
  sources: ChatSource[];
};

function mergeSavedChatSources(
  local: SavedFlightScriptChatRecord[],
  remote: SavedFlightScriptChatRecord[],
): MergedChatItem[] {
  const map = new Map<string, MergedChatItem>();
  for (const record of local) {
    map.set(record.id, {
      id: record.id,
      record,
      sources: ["local"],
    });
  }
  for (const record of remote) {
    const existing = map.get(record.id);
    if (existing) {
      if (!existing.sources.includes("firebase")) {
        existing.sources.push("firebase");
      }
    } else {
      map.set(record.id, {
        id: record.id,
        record,
        sources: ["firebase"],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.record.savedAt).getTime();
    const tb = new Date(b.record.savedAt).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

export default function SavedChatsPage() {
  /** Always start empty so server HTML matches the client’s first paint; load after mount. */
  const [localChats, setLocalChats] = useState<SavedFlightScriptChatRecord[]>(
    [],
  );

  useEffect(() => {
    setLocalChats(loadSavedFlightScriptChats());
  }, []);
  const [firebaseChats, setFirebaseChats] = useState<SavedFlightScriptChatRecord[]>(
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadFirebaseStatus, setLoadFirebaseStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [loadFirebaseError, setLoadFirebaseError] = useState<string | null>(
    null,
  );
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const mergedChats = useMemo(
    () => mergeSavedChatSources(localChats, firebaseChats),
    [localChats, firebaseChats],
  );

  const refreshLocal = useCallback(() => {
    setLocalChats(loadSavedFlightScriptChats());
  }, []);

  const selected = useMemo(() => {
    if (mergedChats.length === 0) return null;
    const id =
      selectedId && mergedChats.some((c) => c.id === selectedId)
        ? selectedId
        : mergedChats[0].id;
    return mergedChats.find((c) => c.id === id) ?? null;
  }, [mergedChats, selectedId]);

  const handleLoadFromFirebase = useCallback(async () => {
    setLoadFirebaseStatus("loading");
    setLoadFirebaseError(null);
    try {
      const rows = await fetchSavedFlightScriptChatsFromFirebase();
      setFirebaseChats(rows);
      setLoadFirebaseStatus("idle");
    } catch (e) {
      setLoadFirebaseStatus("error");
      setLoadFirebaseError(
        e instanceof Error ? e.message : "Could not load chats from Firebase.",
      );
    }
  }, []);

  const handleSendToFirebase = useCallback(
    async (item: MergedChatItem) => {
      const { id, record } = item;
      setUploadingIds((prev) => new Set(prev).add(id));
      setUploadErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      try {
        await uploadSavedFlightScriptChatToFirebase(record);
        console.log("[SavedChatsPage] upload succeeded for id:", id);
        setFirebaseChats((prev) => {
          if (prev.some((c) => c.id === id)) return prev;
          return [...prev, record].sort(
            (a, b) =>
              new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
          );
        });
      } catch (e) {
        console.error("[SavedChatsPage] upload failed for id:", id, e);
        setUploadErrors((prev) => ({
          ...prev,
          [id]:
            e instanceof Error ? e.message : "Upload to Firebase failed.",
        }));
      } finally {
        setUploadingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [],
  );

  const handleDelete = useCallback(
    async (item: MergedChatItem) => {
      const parts: string[] = [];
      if (item.sources.includes("local")) parts.push("this browser");
      if (item.sources.includes("firebase")) parts.push("Firebase");
      if (
        !confirm(`Delete this chat from ${parts.join(" and ")}? This cannot be undone.`)
      ) {
        return;
      }
      try {
        if (item.sources.includes("local")) {
          deleteSavedFlightScriptChat(item.id);
          refreshLocal();
        }
        if (item.sources.includes("firebase")) {
          await deleteSavedFlightScriptChatFromFirebase(item.id);
          setFirebaseChats((prev) => prev.filter((c) => c.id !== item.id));
        }
        if (selectedId === item.id) {
          setSelectedId(null);
        }
      } catch (e) {
        alert(
          e instanceof Error
            ? e.message
            : "Could not delete the chat from Firebase.",
        );
      }
    },
    [refreshLocal, selectedId],
  );

  const activeListId = selected?.id ?? null;

  const handleDownload = useCallback((chat: SavedFlightScriptChatRecord) => {
    void downloadFlightScriptChatExcel({
      fileBaseName: chat.chatName,
      chatName: chat.chatName,
      noteMessage: chat.noteMessage,
      savedAtIso: chat.savedAt,
      messages: chat.messages,
    });
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-zinc-800 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="text-[#cfb991]" size={22} />
              <h1 className="text-lg font-semibold text-zinc-100">Saved chats</h1>
            </div>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Flight Script conversations saved in this browser appear here. You
              can also load copies stored in Firebase and upload the current
              transcript to your project.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => void handleLoadFromFirebase()}
              disabled={loadFirebaseStatus === "loading"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {loadFirebaseStatus === "loading" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CloudDownload size={14} />
              )}
              Load from Firebase
            </button>
            {loadFirebaseStatus === "error" && loadFirebaseError && (
              <p className="text-xs text-red-400 max-w-xs text-right">
                {loadFirebaseError}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="w-full max-w-sm shrink-0 border-r border-zinc-800 overflow-y-auto">
          {mergedChats.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500 text-center">
              No saved chats yet. Use Flight Script to save a chat, or load from
              Firebase if configured.
            </div>
          ) : (
            <ul className="p-2 space-y-1">
              {mergedChats.map((chat) => {
                const isActive = chat.id === activeListId;
                const dateLabel = formatSavedAt(chat.record.savedAt);
                return (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(chat.id)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start gap-2 group ${
                        isActive
                          ? "bg-[#cfb991]/10 border border-[#cfb991]/30"
                          : "border border-transparent hover:bg-zinc-800/80"
                      }`}
                    >
                      <ChevronRight
                        size={16}
                        className={`shrink-0 mt-0.5 text-zinc-500 transition-transform ${
                          isActive ? "text-[#cfb991] rotate-90" : ""
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-zinc-200 truncate">
                            {chat.record.chatName}
                          </span>
                          {chat.sources.map((s) => (
                            <span
                              key={s}
                              className="text-[10px] uppercase tracking-wide px-1.5 py-0 rounded border border-zinc-600 text-zinc-500 shrink-0"
                            >
                              {s === "local" ? "Local" : "Firebase"}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {dateLabel} · {chat.record.messages.length} messages
                        </div>
                        {chat.record.noteMessage.trim() && (
                          <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                            {chat.record.noteMessage.trim()}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-zinc-950/40">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm p-8">
              Select a chat to view the transcript.
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-zinc-800 px-4 py-3 flex flex-wrap items-center gap-2 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-zinc-100 truncate">
                      {selected.record.chatName}
                    </h2>
                    {selected.sources.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] uppercase tracking-wide px-1.5 py-0 rounded border border-zinc-600 text-zinc-500"
                      >
                        {s === "local" ? "Local" : "Firebase"}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Saved {formatSavedAt(selected.record.savedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {!selected.sources.includes("firebase") && (
                    <button
                      type="button"
                      onClick={() => void handleSendToFirebase(selected)}
                      disabled={uploadingIds.has(selected.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                      {uploadingIds.has(selected.id) ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CloudUpload size={14} />
                      )}
                      Send to Firebase
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownload(selected.record)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                  >
                    <Download size={14} />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(selected)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
              {uploadErrors[selected.id] && (
                <div className="shrink-0 px-4 py-2 text-xs text-red-400 border-b border-zinc-800 bg-red-500/5">
                  Firebase upload failed: {uploadErrors[selected.id]}
                </div>
              )}
              {selected.record.noteMessage.trim() && (
                <div className="shrink-0 px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/30">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
                    Note
                  </p>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                    {selected.record.noteMessage.trim()}
                  </p>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
                {selected.record.messages.map((msg) => {
                  const toolCalls = msg.toolCalls as { toolName?: string }[] | undefined;
                  const timings = msg.timings as TimingStep[] | undefined;
                  const hasBadges = !!(toolCalls?.length || timings?.length || msg.ackRoundTripMs !== undefined);
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full bg-[#cfb991]/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot size={14} className="text-[#cfb991]" />
                        </div>
                      )}
                      <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-[#cfb991]/15 text-[#cfb991] border border-[#cfb991]/20"
                              : "bg-zinc-800/60 text-zinc-200 border border-zinc-700/50"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <div className="markdownMessage [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1,_h2,_h3]:font-semibold [&_h1,_h2,_h3]:text-zinc-100 [&_code]:text-[#cfb991]/90 [&_code]:bg-zinc-700/50 [&_code]:px-1 [&_code]:rounded [&_pre]:my-2 [&_pre]:p-2 [&_pre]:bg-zinc-900/80 [&_pre]:border [&_pre]:border-zinc-700 [&_pre]:rounded-lg">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                        <p
                          className="text-[10px] text-zinc-600 font-mono px-1"
                          title={msg.timestamp}
                        >
                          {formatSavedAt(msg.timestamp)}
                        </p>

                        {hasBadges && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {toolCalls?.map((tc, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/40 border border-zinc-700/30 text-[11px] text-zinc-400"
                              >
                                <Wrench size={10} className="text-zinc-500" />
                                {tc.toolName ?? "tool"}
                              </span>
                            ))}
                            {timings && timings.length > 0 && (
                              <TimingBadge timings={timings} />
                            )}
                            {msg.ackRoundTripMs !== undefined && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-mono whitespace-nowrap">
                                <Clock size={10} className="shrink-0" />
                                ack {formatMs(msg.ackRoundTripMs)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-7 h-7 rounded-full bg-zinc-700/50 flex items-center justify-center shrink-0 mt-0.5">
                          <User size={14} className="text-zinc-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function formatSavedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface TimingStep {
  label: string;
  ms: number;
}

function TimingBadge({ timings }: { timings: TimingStep[] }) {
  const [open, setOpen] = useState(false);
  const totalStep = timings.find((t) => t.label === "Total");
  const details = timings.filter((t) => t.label !== "Total");
  const totalMs = totalStep?.ms ?? timings[timings.length - 1]?.ms ?? 0;

  return (
    <span className="relative inline-flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/40 border border-zinc-700/30 text-[11px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors cursor-pointer select-none"
      >
        <Clock size={10} className="shrink-0" />
        <span className="font-mono tabular-nums">{formatMs(totalMs)}</span>
        {details.length > 0 && (
          open
            ? <ChevronDown size={10} className="shrink-0 opacity-50" />
            : <ChevronRight size={10} className="shrink-0 opacity-50" />
        )}
      </button>

      {open && details.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] rounded-lg border border-zinc-700/50 bg-zinc-900 shadow-xl shadow-black/40 py-1.5 px-2 space-y-0.5">
          {details.map((step, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-zinc-400 truncate">{step.label}</span>
              <span className="font-mono tabular-nums text-zinc-300 shrink-0">
                {formatMs(step.ms)}
              </span>
            </div>
          ))}
          <div className="border-t border-zinc-700/40 mt-1 pt-1 flex items-center justify-between gap-3 text-[11px] font-medium">
            <span className="text-zinc-300">Total</span>
            <span className="font-mono tabular-nums text-[#cfb991]">
              {formatMs(totalMs)}
            </span>
          </div>
        </div>
      )}
    </span>
  );
}
