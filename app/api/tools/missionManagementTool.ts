import { tool } from "ai";
import { z } from "zod";
import {
  addDocument,
  updateDocument,
  deleteDocument,
  fetchCollection,
  collections,
} from "../../../lib/firestore";
import { orderBy } from "firebase/firestore";

const missionTypeEnum = z.enum([
  "mapping",
  "dsm",
  "imagePoint",
  "recordVideo",
]);

const missionManagementSchema = z.object({
  action: z
    .enum(["add", "update", "delete", "list"])
    .describe("The operation to perform on mission types"),
  id: z
    .string()
    .optional()
    .describe("Mission type document ID (required for update and delete)"),
  name: z
    .string()
    .optional()
    .describe("Mission name (required for add, optional for update)"),
  cameraId: z
    .string()
    .optional()
    .describe("ID of the camera sensor to use (optional for add/update)"),
  cameraName: z
    .string()
    .optional()
    .describe("Display name of the camera (optional for add/update)"),
  type: missionTypeEnum
    .optional()
    .describe(
      "Mission type: mapping, dsm, imagePoint, or recordVideo (required for add, optional for update)"
    ),
  frontOverlap: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Front overlap percentage 0-100 (optional for add/update)"),
  sideOverlap: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Side overlap percentage 0-100 (optional for add/update)"),
  flightHeight: z
    .number()
    .min(0)
    .optional()
    .describe("Flight height in meters (optional for add/update)"),
  flightSpeed: z
    .number()
    .min(0)
    .optional()
    .describe("Flight speed in m/s (optional for add/update)"),
});

type MissionType = "mapping" | "dsm" | "imagePoint" | "recordVideo";

export const missionManagementTool = tool({
  description: `Manage mission types — add, update, delete, or list mission type configurations.
Use action "add" to create a new mission type with name, type (mapping, dsm, imagePoint, recordVideo), and optional camera/overlap/flight params.
Use action "update" to modify an existing mission (requires the mission ID).
Use action "delete" to remove a mission type (requires the mission ID).
Use action "list" to retrieve all mission types and their details.
Always list first if you need to find a mission's ID for update/delete.`,
  inputSchema: missionManagementSchema,
  // @ts-ignore - AI SDK type inference issue
  execute: async (args: {
    action: "add" | "update" | "delete" | "list";
    id?: string;
    name?: string;
    cameraId?: string;
    cameraName?: string;
    type?: MissionType;
    frontOverlap?: number;
    sideOverlap?: number;
    flightHeight?: number;
    flightSpeed?: number;
  }) => {
    const {
      action,
      id,
      name,
      cameraId,
      cameraName,
      type,
      frontOverlap,
      sideOverlap,
      flightHeight,
      flightSpeed,
    } = args;

    switch (action) {
      case "add": {
        if (!name?.trim()) return { error: "Mission name is required" };
        if (!type)
          return {
            error:
              "Mission type is required (mapping, dsm, imagePoint, or recordVideo)",
          };
        const payload: Record<string, unknown> = {
          name: name.trim(),
          cameraId: cameraId ?? "",
          cameraName: cameraName ?? "",
          type,
          frontOverlap: frontOverlap ?? 80,
          sideOverlap: sideOverlap ?? 80,
          flightHeight: flightHeight ?? 10,
          flightSpeed: flightSpeed ?? 1,
          createdAt: new Date().toISOString(),
        };
        const newId = await addDocument(collections.missionTypes, payload);
        return {
          success: true,
          message: `Mission type "${name}" created successfully`,
          id: newId,
        };
      }

      case "update": {
        if (!id) return { error: "Mission ID is required for update" };
        const updateData: Record<string, string | number> = {
          updatedAt: new Date().toISOString(),
        };
        if (name !== undefined) updateData.name = name.trim();
        if (cameraId !== undefined) updateData.cameraId = cameraId;
        if (cameraName !== undefined) updateData.cameraName = cameraName;
        if (type !== undefined) updateData.type = type;
        if (frontOverlap !== undefined) updateData.frontOverlap = frontOverlap;
        if (sideOverlap !== undefined) updateData.sideOverlap = sideOverlap;
        if (flightHeight !== undefined) updateData.flightHeight = flightHeight;
        if (flightSpeed !== undefined) updateData.flightSpeed = flightSpeed;
        await updateDocument(collections.missionTypes, id, updateData);
        return {
          success: true,
          message: "Mission type updated successfully",
          id,
        };
      }

      case "delete": {
        if (!id) return { error: "Mission ID is required for delete" };
        await deleteDocument(collections.missionTypes, id);
        return {
          success: true,
          message: "Mission type deleted successfully",
          id,
        };
      }

      case "list": {
        const missions = await fetchCollection(
          collections.missionTypes,
          orderBy("createdAt", "desc")
        );
        return {
          success: true,
          missions: missions.map((m) => {
            const data = m as Record<string, unknown>;
            return {
              id: m.id,
              name: data.name,
              cameraId: data.cameraId,
              cameraName: data.cameraName,
              type: data.type,
              frontOverlap: data.frontOverlap,
              sideOverlap: data.sideOverlap,
              flightHeight: data.flightHeight,
              flightSpeed: data.flightSpeed,
              createdAt: data.createdAt,
            };
          }),
        };
      }

      default:
        return { error: "Invalid action" };
    }
  },
});
