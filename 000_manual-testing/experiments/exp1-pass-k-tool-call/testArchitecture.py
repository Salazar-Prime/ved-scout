#!/usr/bin/env python3
"""
Quick test script to verify the new architecture works.
Tests OpenAI client and Tools client separately.
"""
import json
import sys

# Test imports
try:
    from config import SYSTEM_PROMPT, TOOL_SCHEMAS
    from openaiClient import createOpenAiClient
    from toolsClient import createToolsClient
    print("✓ All imports successful")
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)


def testOpenAiClient():
    """Test OpenAI client with a simple message (no tools)."""
    print("\n=== Testing OpenAI Client ===")
    
    try:
        client = createOpenAiClient(model="gpt-5.2")
        print("✓ Created OpenAI client")
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say 'Hello from OpenAI!' and nothing else."},
        ]
        
        print("Calling OpenAI API...")
        response = client.chatCompletion(
            messages=messages,
            tools=None,  # No tools for this test
            cacheBust=False,
        )
        
        if response.get("error"):
            print(f"✗ OpenAI error: {response['error']}")
            return False
        
        content = response.get("content", "")
        usage = response.get("usage", {})
        
        print(f"✓ OpenAI response: {content}")
        print(f"  Tokens: {usage.get('promptTokens', 0)} in, {usage.get('completionTokens', 0)} out")
        return True
        
    except Exception as e:
        print(f"✗ OpenAI client test failed: {e}")
        return False


def testToolsClient():
    """Test Tools client with a simple list operation."""
    print("\n=== Testing Tools Client ===")
    
    try:
        client = createToolsClient(baseUrl="http://localhost:3000")
        print("✓ Created Tools client")
        
        print("Calling plotManagement list...")
        result = client.executeTool(
            toolName="plotManagement",
            arguments={"action": "list"}
        )
        
        if result.get("error"):
            print(f"✗ Tools error: {result['error']}")
            print("  Make sure Next.js server is running (npm run dev)")
            return False
        
        toolResult = result.get("result", {})
        plots = toolResult.get("plots", [])
        
        print(f"✓ Tools response: Found {len(plots)} plots")
        if plots:
            print(f"  First plot: {plots[0].get('name', 'Unnamed')}")
        return True
        
    except Exception as e:
        print(f"✗ Tools client test failed: {e}")
        print("  Make sure Next.js server is running (npm run dev)")
        return False


def testIntegration():
    """Test OpenAI + Tools integration with a tool-calling prompt."""
    print("\n=== Testing Integration (OpenAI + Tools) ===")
    
    try:
        openaiClient = createOpenAiClient(model="gpt-5.2")
        toolsClient = createToolsClient(baseUrl="http://localhost:3000")
        print("✓ Created both clients")
        
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "List all plots"},
        ]
        
        print("Calling OpenAI with tool schemas...")
        response = openaiClient.chatCompletion(
            messages=messages,
            tools=TOOL_SCHEMAS,
            toolChoice="auto",
            cacheBust=False,
        )
        
        if response.get("error"):
            print(f"✗ OpenAI error: {response['error']}")
            return False
        
        toolCalls = response.get("toolCalls", [])
        
        if not toolCalls:
            print("✗ OpenAI did not call any tools")
            print(f"  Response: {response.get('content', '')}")
            return False
        
        print(f"✓ OpenAI called {len(toolCalls)} tool(s)")
        
        # Execute tools
        toolResults = toolsClient.executeToolCalls(toolCalls)
        
        if not toolResults:
            print("✗ No tool results")
            return False
        
        print(f"✓ Executed {len(toolResults)} tool(s)")
        
        for tr in toolResults:
            toolName = tr.get("toolName")
            result = tr.get("result", {})
            print(f"  - {toolName}: {result.get('message', 'OK')}")
        
        return True
        
    except Exception as e:
        print(f"✗ Integration test failed: {e}")
        return False


def main():
    print("==============================================")
    print("  Pass^k Architecture Test Suite")
    print("==============================================")
    
    tests = [
        ("OpenAI Client", testOpenAiClient),
        ("Tools Client", testToolsClient),
        ("Integration", testIntegration),
    ]
    
    results = []
    
    for testName, testFunc in tests:
        try:
            success = testFunc()
            results.append((testName, success))
        except Exception as e:
            print(f"\n✗ Test '{testName}' crashed: {e}")
            results.append((testName, False))
    
    print("\n==============================================")
    print("  Test Results")
    print("==============================================")
    
    for testName, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {testName}")
    
    allPassed = all(success for _, success in results)
    
    print("\n==============================================")
    if allPassed:
        print("  ✓ ALL TESTS PASSED")
    else:
        print("  ✗ SOME TESTS FAILED")
    print("==============================================")
    
    sys.exit(0 if allPassed else 1)


if __name__ == "__main__":
    main()
