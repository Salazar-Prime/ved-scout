import { tool } from "ai";
import { z } from "zod";
import { runFlightSafetyChecks } from "../../../lib/flightSafetyChecks";

/** Wire names sent as WebSocket scriptName; must match webscoket.py scriptMapping keys. */
export const flightScriptProcedures = [
  "test-flight-script-1",
  "orthomosaic-field-mission",
] as const;

export type FlightScriptProcedureId = (typeof flightScriptProcedures)[number];

const plotDetailsSchema = z.object({
  id: z.string().describe("Firestore document ID of the plot"),
  name: z.string().describe("Human-readable plot name"),
  corners: z
    .array(z.object({ lat: z.number(), lng: z.number() }))
    .describe("Corner coordinates of the plot boundary"),
});

const missionDetailsSchema = z.object({
  id: z.string().describe("Firestore document ID of the mission type"),
  name: z.string().describe("Human-readable mission name"),
  type: z
    .enum(["mapping", "dsm", "imagePoint", "recordVideo"])
    .describe("Mission type"),
  frontOverlap: z.number().optional().describe("Front overlap percentage"),
  sideOverlap: z.number().optional().describe("Side overlap percentage"),
  flightHeight: z.number().optional().describe("Flight height in meters"),
  flightSpeed: z.number().optional().describe("Flight speed in m/s"),
  cameraId: z.string().optional().describe("Camera sensor ID linked to this mission"),
  cameraName: z.string().optional().describe("Camera sensor name linked to this mission"),
});

const cameraDetailsSchema = z.object({
  id: z.string().describe("Firestore document ID of the camera sensor"),
  name: z.string().describe("Camera sensor name"),
  imageWidth: z.number().optional().describe("Image width in pixels"),
  imageHeight: z.number().optional().describe("Image height in pixels"),
  focalLength: z.number().optional().describe("Focal length in mm"),
  sensorWidth: z.number().optional().describe("Sensor width in mm"),
});

const flightScriptSchema = z.object({
  procedure: z
    .enum(flightScriptProcedures)
    .describe(
      'Flight procedure: "test-flight-script-1" (SDK test flight) or "orthomosaic-field-mission" (field orthomosaic mapping mission)'
    ),
  plot: plotDetailsSchema.describe(
    "Full plot details (id, name, corners) — fetch using plotManagement list first"
  ),
  mission: missionDetailsSchema.describe(
    "Full mission type details (id, name, type, overlaps, height, speed, cameraId, cameraName) — fetch using missionManagement list first"
  ),
  camera: cameraDetailsSchema.describe(
    "Full camera sensor details (id, name, dimensions, focalLength, sensorWidth) — fetch using cameraSensors list first. The camera is linked to the mission; use the cameraId/cameraName stored on the mission to find the right camera."
  ),
});

export const executeFlightScriptTool = tool({
  description: `Execute a registered flight script on the connected drone via WebSocket.
IMPORTANT: This tool can ONLY be used when WebSocket is connected.

REQUIRED before calling this tool — you MUST have all three of:
1. Plot details (id, name, corners) — use plotManagement list to fetch; ask the user which plot if unclear
2. Mission type details (id, name, type, overlaps, height, speed, cameraId, cameraName) — use missionManagement list to fetch; ask the user which mission if unclear
3. Camera sensor details (id, name, imageWidth, imageHeight, focalLength, sensorWidth) — the camera is embedded in the mission (cameraId/cameraName fields); use cameraSensors list to get full details. If the mission has no camera set, ask the user to specify one.

Do NOT call this tool with placeholder or empty values. If any information is missing, ask the user first.

Procedures:
- "test-flight-script-1" — test / sample flight control binary
- "orthomosaic-field-mission" — orthomosaic mission for a field (mapping coverage)`,
  inputSchema: flightScriptSchema,
  // @ts-ignore - AI SDK type inference issue
  execute: async (args: {
    procedure: FlightScriptProcedureId;
    plot: {
      id: string;
      name: string;
      corners: Array<{ lat: number; lng: number }>;
    };
    mission: {
      id: string;
      name: string;
      type: "mapping" | "dsm" | "imagePoint" | "recordVideo";
      frontOverlap?: number;
      sideOverlap?: number;
      flightHeight?: number;
      flightSpeed?: number;
      cameraId?: string;
      cameraName?: string;
    };
    camera: {
      id: string;
      name: string;
      imageWidth?: number;
      imageHeight?: number;
      focalLength?: number;
      sensorWidth?: number;
    };
  }) => {
    const { procedure, plot, mission, camera } = args;

    const safety = runFlightSafetyChecks({ plot, mission, camera });
    if (!safety.passed) {
      const failedLabels = safety.checks
        .filter((c) => !c.passed)
        .map((c) => c.label);
      return {
        success: false,
        safetyFailure: true,
        safetyChecks: safety.checks,
        message: `Pre-flight safety checks failed: ${failedLabels.join("; ")}`,
      };
    }

    return {
      success: true,
      message: `Flight procedure "${procedure}" queued for execution`,
      procedure,
      plot,
      mission,
      camera,
      requiresWebSocket: true,
    };
  },
});
