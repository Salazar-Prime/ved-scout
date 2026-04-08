import { tool } from "ai";
import { z } from "zod";

/** Wire names sent as WebSocket scriptName; must match webscoket.py scriptMapping keys. */
export const flightScriptProcedures = [
  "test-flight-script-1",
  "orthomosaic-field-mission",
] as const;

export type FlightScriptProcedureId = (typeof flightScriptProcedures)[number];

const flightScriptSchema = z.object({
  procedure: z
    .enum(flightScriptProcedures)
    .describe(
      'Flight procedure: "test-flight-script-1" (SDK test flight) or "orthomosaic-field-mission" (field orthomosaic mapping mission)'
    ),
  parameters: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Optional parameters for the drone script (e.g., configPath, altitude, speed, field or mission identifiers)"
    ),
});

export const executeFlightScriptTool = tool({
  description: `Execute a registered flight script on the connected drone via WebSocket.
IMPORTANT: This tool can ONLY be used when WebSocket is connected.
Procedures:
- "test-flight-script-1" — test / sample flight control binary
- "orthomosaic-field-mission" — orthomosaic mission for a field (mapping coverage); pass any mission-specific parameters the onboard script expects
The command is sent with script name, private key, and parameters; the drone runs the mapped executable.`,
  inputSchema: flightScriptSchema,
  // @ts-ignore - AI SDK type inference issue
  execute: async (args: {
    procedure: FlightScriptProcedureId;
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
