import type { SavedFlightScriptChatMessage } from "./flightScriptSavedChatsStorage";
import type { ToolCallLogEntry } from "./chatSave/toolCallLogExcel";

export type { ToolCallLogEntry };

function sanitizeFileBaseName(name: string): string {
  const trimmed = name.trim() || "flight-script-chat";
  const ascii = trimmed.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return (ascii.length > 0 ? ascii : "chat").slice(0, 80);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Builds the workbook and triggers a browser download. Uses dynamic import so
 * `xlsx` only loads on the client after a user action (avoids SSR / bundler issues).
 */
export async function downloadFlightScriptChatExcel(params: {
  fileBaseName: string;
  chatName: string;
  noteMessage: string;
  savedAtIso?: string;
  messages: SavedFlightScriptChatMessage[];
  toolCallLog?: ToolCallLogEntry[];
}): Promise<void> {
  const XLSX = await import("xlsx");
  const savedAt = params.savedAtIso ?? new Date().toISOString();

  const chatRows: (string | number | undefined)[][] = [
    ["Chat name", params.chatName],
    ["Note", params.noteMessage],
    ["Saved at", savedAt],
    [],
    ["Role", "Content", "Timestamp (ISO)", "Tool calls", "Total time", "Ack round-trip"],
    ...params.messages.map((m) => {
      const content = typeof m.content === "string" ? m.content : "";
      const totalStep = m.timings?.find((t) => t.label === "Total");
      const totalTime = totalStep ? formatMs(totalStep.ms) : "";
      const ackTime =
        m.ackRoundTripMs !== undefined ? formatMs(m.ackRoundTripMs) : "";
      return [
        m.role,
        content,
        m.timestamp,
        m.toolCalls != null ? JSON.stringify(m.toolCalls) : "",
        totalTime,
        ackTime,
      ];
    }),
  ];

  const chatSheet = XLSX.utils.aoa_to_sheet(chatRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, chatSheet, "Chat");

  const timingRows: (string | number | undefined)[][] = [
    [
      "Message ID",
      "Role",
      "Content (truncated)",
      "Step",
      "Value (formatted)",
      "Value (ms)",
    ],
  ];
  params.messages.forEach((m) => {
    if (!m.timings || m.timings.length === 0) return;
    const content = typeof m.content === "string" ? m.content : "";
    const preview = content.slice(0, 60) + (content.length > 60 ? "…" : "");
    m.timings.forEach((step) => {
      timingRows.push([
        m.id,
        m.role,
        preview,
        step.label,
        formatMs(step.ms),
        Math.round(step.ms),
      ]);
    });
    if (m.ackRoundTripMs !== undefined) {
      timingRows.push([
        m.id,
        m.role,
        preview,
        "Ack round-trip",
        formatMs(m.ackRoundTripMs),
        Math.round(m.ackRoundTripMs),
      ]);
    }
  });

  if (timingRows.length > 1) {
    const timingsSheet = XLSX.utils.aoa_to_sheet(timingRows);
    XLSX.utils.book_append_sheet(workbook, timingsSheet, "Timings");
  }

  if (params.toolCallLog && params.toolCallLog.length > 0) {
    const tcRows: (string | number | undefined)[][] = [
      ["Tool name", "Args", "Result", "Timestamp (ISO)", "Turn ID"],
      ...params.toolCallLog.map((tc) => [
        tc.toolName,
        JSON.stringify(tc.args),
        JSON.stringify(tc.result),
        tc.timestamp,
        tc.turnId,
      ]),
    ];
    const tcSheet = XLSX.utils.aoa_to_sheet(tcRows);
    XLSX.utils.book_append_sheet(workbook, tcSheet, "Tool Calls");
  }

  const safe = sanitizeFileBaseName(params.fileBaseName);
  const filename = `${safe}-${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
