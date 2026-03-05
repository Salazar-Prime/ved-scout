import { generateText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextRequest, NextResponse } from "next/server";
import { plotManagementTool } from "../tools/plotManagementTool";
import { executeFlightScriptTool } from "../tools/executeFlightScriptTool";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `You are VED-SCOUT, a voice-enabled autonomous drone weed scouting assistant. You help users manage agricultural drone flight missions.

You have access to two tools:

1. **plotManagement** - Manage agricultural plots (add, update, delete, list)
   - Use this when users ask about plots or field boundaries
   - When adding a plot, you need a name and at least 3 corner coordinates (lat/lng pairs)
   - When modifying or deleting, you need the plot's ID (list plots first to find it)

2. **executeFlightScript** - Execute the test flight procedure on the drone
   - **CRITICAL**: This tool can ONLY be used when WebSocket is connected
   - Available procedure: "test-flight-script-1" only
   - Always check if WebSocket is connected before attempting flight script execution
   - If not connected, inform the user they need to connect to WebSocket first
   - You can include optional parameters (e.g., altitude, speed) that will be sent to the drone
   - The drone handles all internal configuration and execution - just send the command with parameters

Be concise but helpful. Confirm actions after performing them.`;

export async function POST(request: NextRequest) {
  try {
    const { message, previousResponseId, isWebSocketConnected } =
      await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Build system prompt with WebSocket status
    const enhancedSystemPrompt = `${systemPrompt}

**Current Status:**
- WebSocket Connection: ${isWebSocketConnected ? "CONNECTED ✓" : "NOT CONNECTED ✗"}
${!isWebSocketConnected ? "- Flight script execution is DISABLED until WebSocket is connected" : ""}`;

    const result = await generateText({
      model: openai.responses("gpt-4o"),
      system: enhancedSystemPrompt,
      prompt: message,
      tools: {
        plotManagement: plotManagementTool,
        executeFlightScript: executeFlightScriptTool,
      },
      stopWhen: stepCountIs(5),
      providerOptions: {
        openai: {
          ...(previousResponseId && { previousResponseId }),
        },
      },
    });

    const toolResults = result.steps
      .flatMap((step) => step.toolResults)
      .filter(Boolean);

    return NextResponse.json({
      text: result.text,
      responseId: result.response?.id,
      toolCalls: toolResults.map((tr) => ({
        toolName: tr.toolName,
        args: tr.input,
        result: tr.output,
      })),
    });
  } catch (error) {
    console.error("Flight assistant error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
