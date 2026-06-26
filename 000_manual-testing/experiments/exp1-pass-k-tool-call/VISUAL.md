# Architecture Visual Diagram

## Old Architecture (main.py)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Python Script                            │
│                          (main.py)                               │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Run Experiment                                           │  │
│   │  - Load questions                                        │  │
│   │  - For each question:                                    │  │
│   │    └─> callFlightAssistant(message, model, reasoning)   │  │
│   │        │                                                 │  │
│   └────────┼─────────────────────────────────────────────────┘  │
│            │                                                     │
└────────────┼─────────────────────────────────────────────────────┘
             │ HTTP POST
             │ {"message": "...", "model": "...", "reasoning": "..."}
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js API Route                              │
│            /api/flight-assistant/route.ts                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Receive message                                        │  │
│  │ 2. Build system prompt                                    │  │
│  │ 3. Call OpenAI API ─────────────────────────┐            │  │
│  │ 4. If tool calls:                            │            │  │
│  │    └─> Execute tools (Firebase)              │            │  │
│  │    └─> Call OpenAI again with results        │            │  │
│  │ 5. Return final response                     │            │  │
│  └──────────────────────┬────────────────────────┼────────────┘  │
│                         │                       │               │
└─────────────────────────┼───────────────────────┼───────────────┘
                          │                       │
                          │                       └─────────────┐
                          │                                      │
                          ▼                                      ▼
              ┌───────────────────┐               ┌──────────────────────┐
              │   Firebase        │               │   OpenAI API         │
              │   (Firestore)     │               │   (Chat Completions) │
              └───────────────────┘               └──────────────────────┘

LIMITATIONS:
- ✗ Can't control OpenAI parameters (temperature, top_p, etc.)
- ✗ Hard to implement custom retry logic
- ✗ Can't add caching/streaming easily
- ✗ Limited visibility into token usage
- ✗ Everything is a black box in Next.js
```

## New Architecture (main_v2.py)

```
┌──────────────────────────────────────────────────────────────────┐
│                         Python Script                                │
│                         (main_v2.py)                                 │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │ AgentRunner                                                 │   │
│   │  - Manages conversation state                               │   │
│   │  - Controls OpenAI loop                                     │   │
│   │  - Executes tools when needed                               │   │
│   │                                                             │   │
│   │  ┌─────────────────┐         ┌─────────────────┐          │   │
│   │  │ openaiClient.py │         │ toolsClient.py  │          │   │
│   │  │                 │         │                 │          │   │
│   │  │ - Direct API    │         │ - Calls Next.js │          │   │
│   │  │ - Full control  │         │ - Only for tools│          │   │
│   │  └────────┬────────┘         └────────┬────────┘          │   │
│   │           │                           │                    │   │
│   └───────────┼───────────────────────────┼────────────────────┘   │
│               │                           │                        │
└───────────────┼───────────────────────────┼────────────────────────┘
                │                           │
                │ HTTP POST                 │ HTTP POST
                │ {messages, tools, ...}    │ {toolName, arguments}
                │ FULL CONTROL              │ SIMPLE CALL
                │                           │
                ▼                           ▼
    ┌────────────────────────┐   ┌──────────────────────────────────┐
    │   OpenAI API           │   │   Next.js API Route              │
    │   (Chat Completions)   │   │   /api/tools/execute/route.ts    │
    │                        │   │                                  │
    │ - Reasoning            │   │  ┌────────────────────────────┐  │
    │ - Tool calling         │   │  │ Execute Firebase Tool      │  │
    │ - Token usage          │   │  │  - plotManagement          │  │
    │ - Full parameters      │   │  │  - missionManagement       │  │
    │                        │   │  │  - cameraSensors           │  │
    │                        │   │  │  - executeFlightScript     │  │
    │                        │   │  └──────────┬─────────────────┘  │
    │                        │   │             │                    │
    └────────────────────────┘   └─────────────┼────────────────────┘
                                               │
                                               ▼
                                   ┌───────────────────┐
                                   │   Firebase        │
                                   │   (Firestore)     │
                                   └───────────────────┘

BENEFITS:
- ✓ Full control over OpenAI parameters
- ✓ Easy to implement retry/caching/streaming
- ✓ Direct access to token usage
- ✓ Python controls conversation flow
- ✓ Next.js only handles Firebase (simple)
- ✓ Clean separation of concerns
```

## Comparison Summary

### Old: Simplicity
- Good for: Production, quick prototypes
- Control: Low
- Complexity: Low
- Flexibility: Low

### New: Power
- Good for: Research, experiments, customization
- Control: High
- Complexity: Medium
- Flexibility: High

### Both Coexist!
- Use old for production
- Use new for experiments
- No conflicts, both work
