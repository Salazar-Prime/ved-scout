import { generateText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextRequest, NextResponse } from "next/server";
import { plotManagementTool } from "../tools/plotManagementTool";
import { executeFlightScriptTool } from "../tools/executeFlightScriptTool";
import { missionManagementTool } from "../tools/missionManagementTool";
import { cameraSensorsTool } from "../tools/cameraSensorsTool";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `You are VED-SCOUT, a voice-enabled autonomous drone weed scouting assistant. You help users manage agricultural drone flight missions.

You have access to four tools:

1. **plotManagement** - Manage agricultural plots (add, update, delete, list)
   - Use this when users ask about plots or field boundaries
   - When adding a plot, you need a name and at least 3 corner coordinates (lat/lng pairs)
   - When modifying or deleting, you need the plot's ID (list plots first to find it)

2. **missionManagement** - Manage mission types (add, update, delete, list)
   - Use this when users ask about mission types or flight mission configurations
   - Mission types: mapping, dsm, imagePoint, recordVideo
   - When adding, provide name and type; optional: cameraId, cameraName, frontOverlap, sideOverlap, flightHeight, flightSpeed
   - When modifying or deleting, you need the mission type's ID (list first to find it)

3. **cameraSensors** - Manage camera sensors (add, update, delete, list)
   - Use this when users ask about cameras or camera sensor configurations
   - When adding, provide name; optional: imageWidth, imageHeight, focalLength, sensorWidth (all in px/mm)
   - When modifying or deleting, you need the camera's ID (list first to find it)

4. **executeFlightScript** - Execute the test flight procedure on the drone
   - **CRITICAL**: This tool can ONLY be used when WebSocket is connected
   - Available procedure: "test-flight-script-1" only
   - Always check if WebSocket is connected before attempting flight script execution
   - If not connected, inform the user they need to connect to WebSocket first
   - You can include optional parameters (e.g., altitude, speed) that will be sent to the drone
   - The drone handles all internal configuration and execution - just send the command with parameters

Be concise but helpful. Confirm actions after performing them.`;

export async function POST(request: NextRequest) {
  try {
    const { message, previousResponseId, isWebSocketConnected, model, reasoning } =
      await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Use provided model or default to gpt-5.2
    const modelToUse = model || "gpt-5.2";
    const reasoningEffort = reasoning || "none";

    // Build system prompt with WebSocket status
    const enhancedSystemPrompt = `${systemPrompt}

**Current Status:**
- WebSocket Connection: ${isWebSocketConnected ? "CONNECTED ✓" : "NOT CONNECTED ✗"}
${!isWebSocketConnected ? "- Flight script execution is DISABLED until WebSocket is connected" : ""}`;

    // Variable to capture usage from onFinish callback
    let capturedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const result = await generateText({
      model: openai.responses(modelToUse),
      system: enhancedSystemPrompt,
      prompt: message,
      tools: {
        plotManagement: plotManagementTool,
        missionManagement: missionManagementTool,
        cameraSensors: cameraSensorsTool,
        executeFlightScript: executeFlightScriptTool,
      },
      stopWhen: stepCountIs(20),
      providerOptions: {
        openai: {
          ...(previousResponseId && { previousResponseId }),
          ...(reasoningEffort !== "none" && { reasoningEffort }),
        },
      },
      onFinish: ({ usage }) => {
        const { promptTokens, completionTokens, totalTokens } = usage;
        capturedUsage = { promptTokens, completionTokens, totalTokens };
        console.log('onFinish - Prompt tokens:', promptTokens);
        console.log('onFinish - Completion tokens:', completionTokens);
        console.log('onFinish - Total tokens:', totalTokens);
      },
    });

    const toolResults = result.steps
      .flatMap((step) => step.toolResults)
      .filter(Boolean);

    // Use captured usage from onFinish callback
    const inputTokens = capturedUsage.promptTokens || 0;
    const outputTokens = capturedUsage.completionTokens || 0;
    const totalTokens = capturedUsage.totalTokens || 0;

    console.log('Final usage to return:', { inputTokens, outputTokens, totalTokens });

    return NextResponse.json({
      text: result.text,
      responseId: result.response?.id,
      toolCalls: toolResults.map((tr) => ({
        toolName: tr.toolName,
        args: tr.input,
        result: tr.output,
      })),
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
      },
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
