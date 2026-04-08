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

// Define the schema
const plotManagementSchema = z.object({
  action: z
    .enum(["add", "update", "delete", "list"])
    .describe("The operation to perform on plots"),
  name: z
    .string()
    .optional()
    .describe("Name of the plot (required for add, optional for update)"),
  corners: z
    .array(
      z.object({
        lat: z.number().describe("Latitude of the corner"),
        lng: z.number().describe("Longitude of the corner"),
      })
    )
    .optional()
    .describe(
      "Array of corner coordinates defining the plot boundary (required for add, optional for update). Minimum 3 corners."
    ),
  id: z
    .string()
    .optional()
    .describe("Plot document ID (required for update and delete)"),
});

export const plotManagementTool = tool({
  description: `Manage agricultural plots — add, update, delete, or list plots.
Use action "add" to create a new plot with a name and corner coordinates.
Use action "update" to modify an existing plot's name or corners (requires the plot ID). For updates, only pass fields that should change — never pass an empty name or empty corners array for unchanged fields.
Use action "delete" to remove a plot (requires the plot ID).
Use action "list" to retrieve all existing plots and their details.
Always list plots first if you need to find a plot's ID for update/delete.`,
  inputSchema: plotManagementSchema,
  // @ts-ignore - AI SDK type inference issue
  execute: async (args: {
    action: "add" | "update" | "delete" | "list";
    name?: string;
    corners?: Array<{ lat: number; lng: number }>;
    id?: string;
  }) => {
    const { action, name, corners, id } = args;

    switch (action) {
      case "add": {
        if (!name?.trim()) return { error: "Plot name is required" };
        if (!corners || corners.length < 3)
          return { error: "At least 3 corner coordinates are required" };
        const newId = await addDocument(collections.plots, {
          name: name.trim(),
          corners,
          createdAt: new Date().toISOString(),
        });
        return {
          success: true,
          message: `Plot "${name}" created successfully`,
          id: newId,
        };
      }

      case "update": {
        if (!id) return { error: "Plot ID is required for update" };
        const updateData: Record<
          string,
          string | { lat: number; lng: number }[]
        > = {};
        if (name !== undefined && name.trim() !== "")
          updateData.name = name.trim();
        if (corners !== undefined) {
          if (corners.length < 3)
            return {
              error:
                "At least 3 corner coordinates are required when updating corners",
            };
          updateData.corners = corners;
        }
        updateData.updatedAt = new Date().toISOString();
        await updateDocument(collections.plots, id, updateData);
        return {
          success: true,
          message: `Plot updated successfully`,
          id,
        };
      }

      case "delete": {
        if (!id) return { error: "Plot ID is required for delete" };
        await deleteDocument(collections.plots, id);
        return {
          success: true,
          message: `Plot deleted successfully`,
          id,
        };
      }

      case "list": {
        const plots = await fetchCollection(
          collections.plots,
          orderBy("createdAt", "desc")
        );
        return {
          success: true,
          plots: plots.map((p) => {
            const data = p as Record<string, unknown>;
            return {
              id: p.id,
              name: data.name,
              corners: data.corners,
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
