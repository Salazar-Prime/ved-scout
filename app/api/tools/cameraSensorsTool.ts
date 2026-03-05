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

const cameraSensorsSchema = z.object({
  action: z
    .enum(["add", "update", "delete", "list"])
    .describe("The operation to perform on camera sensors"),
  id: z
    .string()
    .optional()
    .describe("Camera sensor document ID (required for update and delete)"),
  name: z
    .string()
    .optional()
    .describe("Camera name (required for add, optional for update)"),
  imageWidth: z
    .number()
    .min(1)
    .optional()
    .describe("Image width in pixels (optional for add/update)"),
  imageHeight: z
    .number()
    .min(1)
    .optional()
    .describe("Image height in pixels (optional for add/update)"),
  focalLength: z
    .number()
    .min(0)
    .optional()
    .describe("Focal length in mm (optional for add/update)"),
  sensorWidth: z
    .number()
    .min(0)
    .optional()
    .describe("Sensor width in mm (optional for add/update)"),
});

export const cameraSensorsTool = tool({
  description: `Manage camera sensors — add, update, delete, or list camera sensor configurations.
Use action "add" to create a new camera with name and optional image dimensions (imageWidth, imageHeight, focalLength, sensorWidth).
Use action "update" to modify an existing camera (requires the camera ID).
Use action "delete" to remove a camera sensor (requires the camera ID).
Use action "list" to retrieve all camera sensors and their details.
Always list first if you need to find a camera's ID for update/delete.`,
  inputSchema: cameraSensorsSchema,
  // @ts-ignore - AI SDK type inference issue
  execute: async (args: {
    action: "add" | "update" | "delete" | "list";
    id?: string;
    name?: string;
    imageWidth?: number;
    imageHeight?: number;
    focalLength?: number;
    sensorWidth?: number;
  }) => {
    const {
      action,
      id,
      name,
      imageWidth,
      imageHeight,
      focalLength,
      sensorWidth,
    } = args;

    switch (action) {
      case "add": {
        if (!name?.trim()) return { error: "Camera name is required" };
        const payload = {
          name: name.trim(),
          imageWidth: imageWidth ?? 0,
          imageHeight: imageHeight ?? 0,
          focalLength: focalLength ?? 0,
          sensorWidth: sensorWidth ?? 0,
          createdAt: new Date().toISOString(),
        };
        const newId = await addDocument(collections.cameraSensors, payload);
        return {
          success: true,
          message: `Camera sensor "${name}" created successfully`,
          id: newId,
        };
      }

      case "update": {
        if (!id) return { error: "Camera ID is required for update" };
        const updateData: Record<string, string | number> = {
          updatedAt: new Date().toISOString(),
        };
        if (name !== undefined) updateData.name = name.trim();
        if (imageWidth !== undefined) updateData.imageWidth = imageWidth;
        if (imageHeight !== undefined) updateData.imageHeight = imageHeight;
        if (focalLength !== undefined) updateData.focalLength = focalLength;
        if (sensorWidth !== undefined) updateData.sensorWidth = sensorWidth;
        await updateDocument(collections.cameraSensors, id, updateData);
        return {
          success: true,
          message: "Camera sensor updated successfully",
          id,
        };
      }

      case "delete": {
        if (!id) return { error: "Camera ID is required for delete" };
        await deleteDocument(collections.cameraSensors, id);
        return {
          success: true,
          message: "Camera sensor deleted successfully",
          id,
        };
      }

      case "list": {
        const cameras = await fetchCollection(
          collections.cameraSensors,
          orderBy("createdAt", "desc")
        );
        return {
          success: true,
          cameras: cameras.map((c) => {
            const data = c as Record<string, unknown>;
            return {
              id: c.id,
              name: data.name,
              imageWidth: data.imageWidth,
              imageHeight: data.imageHeight,
              focalLength: data.focalLength,
              sensorWidth: data.sensorWidth,
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
