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
   - When updating, pass only fields that change. Do not pass an empty name or invalid/empty corners for unchanged fields
   - When modifying or deleting, you need the plot's ID (list plots first to find it)

2. **missionManagement** - Manage mission types (add, update, delete, list)
   - Use this when users ask about mission types or flight mission configurations
   - Mission types: mapping, dsm, imagePoint, recordVideo
   - When adding, provide name and type; optional: cameraId, cameraName, frontOverlap, sideOverlap, flightHeight, flightSpeed
   - When updating, pass only fields that change (e.g. flightHeight alone). Do not pass empty strings for unchanged fields
   - When modifying or deleting, you need the mission type's ID (list first to find it)

3. **cameraSensors** - Manage camera sensors (add, update, delete, list)
   - Use this when users ask about cameras or camera sensor configurations
   - When adding, provide name; optional: imageWidth, imageHeight, focalLength, sensorWidth (all in px/mm)
   - When updating, pass only fields that change. Do not pass an empty name for unchanged fields
   - When modifying or deleting, you need the camera's ID (list first to find it)

4. **executeFlightScript** - Send a flight mission intent to the drone (WebSocket)
   - **CRITICAL**: This tool can ONLY be used when WebSocket is connected
   - **CRITICAL**: Before calling this tool, you MUST have ALL of the following — do not call it with placeholders or empty values:
     a. **Plot** — the full plot details (id, name, corners). Call plotManagement with action "list" to find it. If the user hasn't specified a plot, ask them which plot to fly.
     b. **Mission type** — the full mission configuration (id, name, type, frontOverlap, sideOverlap, flightHeight, flightSpeed, cameraId, cameraName). Call missionManagement with action "list" to find it. If unclear, ask the user.
     c. **Camera sensor** — the full camera details (id, name, imageWidth, imageHeight, focalLength, sensorWidth). The camera is embedded in the mission (cameraId/cameraName fields). Call cameraSensors with action "list" to fetch full details by matching the cameraId from the mission. If the mission has no camera linked, ask the user which camera to use.
   - Only after gathering all three should you call executeFlightScript with the complete plot, mission, and camera objects.
   - Procedures:
     - "test-flight-script-1" — test / sample flight control
     - "orthomosaic-field-mission" — orthomosaic mapping mission for a field (use when the user wants to fly the field orthomosaic mission)
   - Prefer "orthomosaic-field-mission" when the user asks to run, start, or execute the orthomosaic / field mapping mission

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
        const u = usage as unknown as Record<string, number | undefined>;
        const promptTokens = (u.promptTokens ?? u.inputTokens ?? 0) as number;
        const completionTokens = (u.completionTokens ?? u.outputTokens ?? 0) as number;
        const totalTokens = (u.totalTokens ?? promptTokens + completionTokens) as number;
        capturedUsage = { promptTokens, completionTokens, totalTokens };
        console.log('onFinish - Prompt tokens:', promptTokens);
        console.log('onFinish - Completion tokens:', completionTokens);
        console.log('onFinish - Total tokens:', totalTokens);
      },
    });

    const toolResults = result.steps
      .flatMap((step) => step.toolResults ?? [])
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
