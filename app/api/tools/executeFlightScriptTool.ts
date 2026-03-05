import { tool } from "ai";
import { z } from "zod";

const flightScriptSchema = z.object({
  procedure: z
    .literal("test-flight-script-1")
    .describe("The flight procedure to execute (only test-flight-script-1 is available)"),
  parameters: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional parameters to pass to the flight script (e.g., altitude, speed, waypoints, etc.)"),
});

export const executeFlightScriptTool = tool({
  description: `Execute the test flight procedure on the connected drone via WebSocket.
IMPORTANT: This tool can ONLY be used when WebSocket is connected.
Available procedure: "test-flight-script-1"
The command will be sent to the drone with the script name, private key, and any parameters.
The drone will handle all execution details internally.`,
  inputSchema: flightScriptSchema,
  // @ts-ignore - AI SDK type inference issue
  execute: async (args: {
    procedure: "test-flight-script-1";
    parameters?: Record<string, unknown>;
  }) => {
    const { procedure, parameters } = args;

    return {
      success: true,
      message: `Flight procedure "${procedure}" queued for execution`,
      procedure,
      parameters: parameters || {},
      requiresWebSocket: true,
    };
  },
});
