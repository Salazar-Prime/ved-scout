import { NextRequest, NextResponse } from "next/server";
import {
  addDocument,
  updateDocument,
  deleteDocument,
  fetchCollection,
  fetchDoc,
  collections,
} from "../../../lib/firestore";
import { orderBy } from "firebase/firestore";

export interface PlotCorner {
  lat: number;
  lng: number;
}

interface AddPlotBody {
  action: "add";
  name: string;
  corners: PlotCorner[];
}

interface AddBatchPlotBody {
  action: "addBatch";
  plots: { name: string; corners: PlotCorner[] }[];
}

interface UpdatePlotBody {
  action: "update";
  id: string;
  name?: string;
  corners?: PlotCorner[];
}

interface DeletePlotBody {
  action: "delete";
  id: string;
}

interface ListPlotsBody {
  action: "list";
}

interface GetPlotBody {
  action: "get";
  id: string;
}

type PlotRequestBody =
  | AddPlotBody
  | AddBatchPlotBody
  | UpdatePlotBody
  | DeletePlotBody
  | ListPlotsBody
  | GetPlotBody;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlotRequestBody;

    switch (body.action) {
      case "add": {
        if (!body.name?.trim()) {
          return NextResponse.json(
            { error: "Plot name is required" },
            { status: 400 }
          );
        }
        if (!body.corners || body.corners.length < 3) {
          return NextResponse.json(
            { error: "At least 3 corner coordinates are required" },
            { status: 400 }
          );
        }
        const id = await addDocument(collections.plots, {
          name: body.name.trim(),
          corners: body.corners,
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true, id });
      }

      case "addBatch": {
        if (!body.plots || body.plots.length === 0) {
          return NextResponse.json(
            { error: "At least one plot is required" },
            { status: 400 }
          );
        }
        const ids: string[] = [];
        for (const plot of body.plots) {
          const id = await addDocument(collections.plots, {
            name: plot.name?.trim() || "Unnamed Plot",
            corners: plot.corners,
            createdAt: new Date().toISOString(),
          });
          ids.push(id);
        }
        return NextResponse.json({ success: true, ids });
      }

      case "update": {
        if (!body.id) {
          return NextResponse.json(
            { error: "Plot ID is required" },
            { status: 400 }
          );
        }
        const updateData: Record<string, string | PlotCorner[]> = {};
        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.corners !== undefined) updateData.corners = body.corners;
        updateData.updatedAt = new Date().toISOString();

        await updateDocument(collections.plots, body.id, updateData);
        return NextResponse.json({ success: true, id: body.id });
      }

      case "delete": {
        if (!body.id) {
          return NextResponse.json(
            { error: "Plot ID is required" },
            { status: 400 }
          );
        }
        await deleteDocument(collections.plots, body.id);
        return NextResponse.json({ success: true, id: body.id });
      }

      case "list": {
        const plots = await fetchCollection(
          collections.plots,
          orderBy("createdAt", "desc")
        );
        return NextResponse.json({ success: true, plots });
      }

      case "get": {
        if (!body.id) {
          return NextResponse.json(
            { error: "Plot ID is required" },
            { status: 400 }
          );
        }
        const plot = await fetchDoc(collections.plots, body.id);
        if (!plot) {
          return NextResponse.json(
            { error: "Plot not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, plot });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Plots API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
