import { tool } from "ai";
import { z } from "zod";

export const droneCommands = [
  "motors_on",
  "motors_off",
  "takeoff",
  "land",
  "return_to_home",
  "goto_waypoint",
] as const;

export type DroneCommandId = (typeof droneCommands)[number];

const droneCommandSchema = z.object({
  command: z.enum(droneCommands).describe(
    "Individual drone command: motors_on, motors_off, takeoff, land, return_to_home, goto_waypoint"
  ),
  parameters: z
    .object({
      lat: z.number().optional().describe("Latitude for goto_waypoint"),
      lng: z.number().optional().describe("Longitude for goto_waypoint"),
      altitude: z
        .number()
        .optional()
        .describe("Altitude in meters for takeoff or goto_waypoint"),
    })
    .optional()
    .describe("Command-specific parameters (required for goto_waypoint)"),
});

export const droneCommandTool = tool({
  description: `Send a single drone command via WebSocket.
IMPORTANT: This tool can ONLY be used when WebSocket is connected.

Available commands:
- "motors_on" — arm and spin up motors
- "motors_off" — disarm and stop motors
- "takeoff" — initiate autonomous takeoff (optional: altitude in meters via parameters)
- "land" — land in place immediately
- "return_to_home" — fly back to home point and land
- "goto_waypoint" — fly to a specific GPS coordinate (REQUIRED: lat and lng in parameters; optional: altitude)

Do NOT call this tool with placeholder values. For goto_waypoint, always ask the user for the target coordinates first.`,
  inputSchema: droneCommandSchema,
  // @ts-ignore - AI SDK type inference issue
  execute: async (args: {
    command: DroneCommandId;
    parameters?: { lat?: number; lng?: number; altitude?: number };
  }) => {
    const { command, parameters } = args;

    if (command === "goto_waypoint") {
      if (!parameters?.lat || !parameters?.lng) {
        return {
          success: false,
          message: "goto_waypoint requires lat and lng parameters",
        };
      }
    }

    return {
      success: true,
      command,
      parameters: parameters ?? {},
      requiresWebSocket: true,
      message: `Command "${command}" queued for execution`,
    };
  },
});
