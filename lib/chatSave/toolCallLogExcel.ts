/** Rows for the "Tool Calls" sheet in exported Excel (and optional dev chat log). */
export type ToolCallLogEntry = {
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  timestamp: string;
  turnId: string;
};
