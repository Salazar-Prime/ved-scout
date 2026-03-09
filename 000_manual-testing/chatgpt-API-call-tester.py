#!/usr/bin/env python3
"""
Standalone CLI chat with ChatGPT (Responses API).
Requires: pip install openai
With --name: pip install openai openpyxl (logs each input/output to a local Excel file).
With --code-interpreter: enables the Code Interpreter (python) tool.
API key: loaded from ../.env.local (NEXT_PUBLIC_OPENAI_API_KEY) or --api-key.
"""
import argparse
import os
import sys

# Import core (same directory)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chatgpt_api_core import (
    createClient,
    sendMessage,
    getLogPath,
    appendRowToExcel,
    DEFAULT_MODEL,
    API_KEY_ENV_VAR,
)

USE_CHAT_HISTORY = True


def main():
    parser = argparse.ArgumentParser(description="Chat with ChatGPT from the command line (Responses API).")
    parser.add_argument("--api-key", default=None, help="OpenAI API key (default: from ../.env.local or env)")
    parser.add_argument("--no-history", action="store_true", help="Disable chat history (each turn is independent)")
    parser.add_argument("--name", type=str, default=None, metavar="NAME", help="Log each input/output; NAME is written in the Name column for each row")
    parser.add_argument("--code-interpreter", action="store_true", help="Enable Code Interpreter tool (python sandbox)")
    parser.add_argument("--code-interpreter-memory", type=str, default="1g", choices=("1g", "4g", "16g", "64g"), metavar="SIZE", help="Container memory for Code Interpreter (default: 1g)")
    args = parser.parse_args()

    try:
        client = createClient(apiKey=args.api_key)
    except ValueError as e:
        print(e, file=sys.stderr)
        sys.exit(1)

    useHistory = USE_CHAT_HISTORY and not args.no_history
    logPath = getLogPath() if args.name else None
    sessionName = (args.name or "").strip()
    conversationId = None

    print("Chat with ChatGPT (Responses API). Commands: quit, exit, clear")
    print(f"Chat history: {'ON' if useHistory else 'OFF'}")
    print(f"Code Interpreter: {'ON' if args.code_interpreter else 'OFF'}" + (f" (memory: {args.code_interpreter_memory})" if args.code_interpreter else ""))
    if logPath:
        print(f"Logging to: {logPath}")
    print("Enter your message (multiple lines OK). End with a blank line to send.")
    print()

    while True:
        try:
            lines = []
            first = input("You: ").strip()
            if first.lower() in ("quit", "exit"):
                print("Bye.")
                break
            if first.lower() == "clear":
                conversationId = None
                print("[Conversation cleared]")
                continue
            if first:
                lines.append(first)
            while True:
                try:
                    line = input()
                except EOFError:
                    break
                if line.strip().lower() == "send":
                    break
                if line.strip() == "":
                    break
                lines.append(line)
            userInput = "\n".join(lines).strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if not userInput:
            continue

        print("Processing input...")
        if useHistory and conversationId is None:
            conv = client.conversations.create()
            conversationId = conv.id

        try:
            result = sendMessage(
                client,
                userInput,
                model=DEFAULT_MODEL,
                reasoning="none",
                temperature=0.3,
                codeInterpreter=args.code_interpreter,
                codeInterpreterMemory=args.code_interpreter_memory,
                conversationId=conversationId if useHistory else None,
            )
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            continue

        print(f"Assistant: {result['outputText'] or '[no text in response]'}")
        print(f"[Time: {result['elapsedSec']:.2f}s]")
        print(f"[Tokens — input: {result['inputTokens'] or 0}, output: {result['outputTokens'] or 0}]")
        if result["cost"] is not None:
            print(f"[Est. cost: ${result['cost']:.6f}]")
        else:
            print("[Est. cost: unknown (model not in pricing table)]")

        if logPath:
            from datetime import datetime
            appendRowToExcel(logPath, (
                sessionName,
                datetime.now().isoformat(),
                userInput,
                result["outputText"],
                result["inputTokens"] or "",
                result["outputTokens"] or "",
                f"{result['cost']:.6f}" if result["cost"] is not None else "",
                round(result["elapsedSec"], 2),
            ))


if __name__ == "__main__":
    main()
