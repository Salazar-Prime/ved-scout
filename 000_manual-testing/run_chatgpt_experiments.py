#!/usr/bin/env python3
"""
Experiment runner for ChatGPT conditions: naive vs smart prompts, 3 runs per condition.
Uses chatgpt_api_core.sendMessage and logs to the same Excel file (Name column = condition-runN).

Usage:
  python run_chatgpt_experiments.py
  python run_chatgpt_experiments.py --naive-prompt naive.txt --smart-prompt smart.txt
"""
import argparse
import os
import random
import string
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chatgpt_api_core import createClient, sendMessage, getLogPath, appendRowToExcel

# Field 1
# {"lat": 40.472647, "lng": -86.994222},
# {"lat": 40.472647, "lng": -86.993606},
# {"lat": 40.472710, "lng": -86.993606},
# {"lat": 40.472710, "lng": -86.994222}

# Field2
# {"lat": 40.472427, "lng": -86.99420036983601},
# {"lat": 40.47255932254134, "lng": -86.99360813836627},
# {"lat": 40.472427413383, "lng": -86.99360799999999},
# {"lat": 40.472559, "lng": -86.99385806292733},

# Default prompts (override with --naive-prompt / --smart-prompt file paths)
NAIVE_PROMPT = """You are a UAV flight planning assistant. Generate a UAV flight plan that fully covers a rectangular plot defined by four corner coordinates.
The input will provide four corner coordinates (latitude, longitude), flight altitude (meters), image width (meters), and overlap percentage.
Compute a set of ordered flight waypoints that cover the entire area using a lawnmower (back-and-forth) pattern.
Output requirements:
Output only plain text.
No explanations.
Provide ordered waypoints covering the area.
Each waypoint must contain: latitude, longitude, altitude.
altitude: 10m
image width: 4m
overlap: 80
coordinates:
{"lat": 40.472647, "lng": -86.994222},
{"lat": 40.472647, "lng": -86.993606},
{"lat": 40.472710, "lng": -86.993606},
{"lat": 40.472710, "lng": -86.994222}
"""

SMART_PROMPT = """You are a UAV flight planning assistant. **Use the code interpreter tool to compute the flight plan.** Generate a UAV flight plan that fully covers a rectangular plot defined by four corner coordinates.
The input will provide four corner coordinates (latitude, longitude), flight altitude (meters), image width (meters), and overlap percentage.
Compute a set of ordered flight waypoints that cover the entire area using a lawnmower (back-and-forth) pattern.
Output requirements:
Output only plain text.
No explanations.
Provide ordered waypoints covering the area.
Each waypoint must contain: latitude, longitude, altitude.
altitude: 10m
image width: 4m
overlap: 80
coordinates:
{"lat": 40.472647, "lng": -86.994222},
{"lat": 40.472647, "lng": -86.993606},
{"lat": 40.472710, "lng": -86.993606},
{"lat": 40.472710, "lng": -86.994222}"""

# Conditions: (name, promptKey, model, reasoning, temperature, codeInterpreter)
# reasoning "high" => temperature omitted. promptKey "naive" | "smart"
CONDITIONS = [
    {"name": "naive-5.2-reason-none", "promptKey": "naive", "model": "gpt-5.2", "reasoning": "none", "temperature": 0.3, "codeInterpreter": False},
    {"name": "naive-5.2-reason-high", "promptKey": "naive", "model": "gpt-5.2", "reasoning": "high", "temperature": None, "codeInterpreter": False},
    {"name": "smart-5.2-code-interpreter", "promptKey": "smart", "model": "gpt-5.2", "reasoning": "none", "temperature": 0.3, "codeInterpreter": True},
    {"name": "naive-5.4-reason-none", "promptKey": "naive", "model": "gpt-5.4", "reasoning": "none", "temperature": 0.3, "codeInterpreter": False},
]

RUNS_PER_CONDITION = 4 # run1, run2, run3


def loadPrompt(path):
    if not path or not os.path.isfile(path):
        return None
    with open(path, "r") as f:
        return f.read().strip()


def getPrompt(promptKey, naivePrompt, smartPrompt):
    return smartPrompt if promptKey == "smart" else naivePrompt


def addCacheBuster(prompt):
    """Prepend a random string to avoid API response caching."""
    chars = string.ascii_letters + string.digits
    token = "".join(random.choices(chars, k=14))
    return f"[cache-bust: {token}]\n\n{prompt}"


def main():
    parser = argparse.ArgumentParser(description="Run ChatGPT experiments (3 runs per condition).")
    parser.add_argument("--naive-prompt", type=str, default=None, help="Path to file containing the naive user prompt")
    parser.add_argument("--smart-prompt", type=str, default=None, help="Path to file containing the smart user prompt")
    args = parser.parse_args()

    naivePrompt = loadPrompt(args.naive_prompt) if args.naive_prompt else NAIVE_PROMPT
    smartPrompt = loadPrompt(args.smart_prompt) if args.smart_prompt else SMART_PROMPT

    try:
        client = createClient()
    except ValueError as e:
        print(e, file=sys.stderr)
        sys.exit(1)

    logPath = getLogPath()
    print(f"Logging to: {logPath}")
    print(f"Conditions: {len(CONDITIONS)}, runs per condition: {RUNS_PER_CONDITION}")
    print()

    # Run order: run1 for all conditions, then run2 for all, then run3 (so 1 run per condition before 2nd run)
    for run in range(1, RUNS_PER_CONDITION + 1):
        for cond in CONDITIONS:
            prompt = getPrompt(cond["promptKey"], naivePrompt, smartPrompt)
            promptForApi = addCacheBuster(prompt)
            rowName = f"{cond['name']}-run{run}"
            print(f"[{rowName}] Sending...")
            try:
                result = sendMessage(
                    client,
                    promptForApi,
                    model=cond["model"],
                    reasoning=cond["reasoning"],
                    temperature=cond.get("temperature"),
                    codeInterpreter=cond.get("codeInterpreter", False),
                    codeInterpreterMemory="4g",
                    conversationId=None,
                )
            except Exception as e:
                print(f"  Error: {e}", file=sys.stderr)
                continue

            appendRowToExcel(logPath, (
                rowName,
                datetime.now().isoformat(),
                promptForApi,
                result["outputText"],
                result["inputTokens"] or "",
                result["outputTokens"] or "",
                f"{result['cost']:.6f}" if result["cost"] is not None else "",
                round(result["elapsedSec"], 2),
            ))
            print(f"  Done. Time: {result['elapsedSec']:.2f}s, tokens out: {result['outputTokens'] or 0}")

    print("\nAll runs finished.")


if __name__ == "__main__":
    main()
