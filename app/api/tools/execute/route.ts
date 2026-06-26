import { NextRequest, NextResponse } from "next/server";
import { plotManagementTool } from "../../tools/plotManagementTool";
import { executeFlightScriptTool } from "../../tools/executeFlightScriptTool";
import { missionManagementTool } from "../../tools/missionManagementTool";
import { cameraSensorsTool } from "../../tools/cameraSensorsTool";

/**
 * API Route for executing Firebase tools
 * Used by Python experiments to execute tools without OpenAI logic
 */
export async function POST(request: NextRequest) {
  try {
    const { toolName, arguments: args } = await request.json();

    if (!toolName || typeof toolName !== "string") {
      return NextResponse.json(
        { error: "toolName is required" },
        { status: 400 }
      );
    }

    if (!args || typeof args !== "object") {
      return NextResponse.json(
        { error: "arguments object is required" },
        { status: 400 }
      );
    }

    // Map tool name to tool implementation
    const tools: Record<string, any> = {
      plotManagement: plotManagementTool,
      missionManagement: missionManagementTool,
      cameraSensors: cameraSensorsTool,
      executeFlightScript: executeFlightScriptTool,
    };

    const tool = tools[toolName];

    if (!tool) {
      return NextResponse.json(
        { error: `Unknown tool: ${toolName}` },
        { status: 400 }
      );
    }

    // Execute the tool
    // @ts-ignore - Dynamic tool execution
    const result = await tool.execute(args);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Tool execution error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
