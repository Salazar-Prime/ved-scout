"""
Tools Client for Firebase Operations via Next.js API
Executes Firebase tools through Next.js backend
"""
import json
from typing import Any, Dict, Optional

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.parse
    import urllib.error
    HAS_REQUESTS = False

from config import DEFAULT_TOOLS_BASE_URL


# ============================================================================
# Tools Client
# ============================================================================

class ToolsClient:
    """
    Client for executing Firebase tools via Next.js API.
    Separates OpenAI logic from Firebase operations.
    """
    
    def __init__(self, baseUrl: str = DEFAULT_TOOLS_BASE_URL):
        self.baseUrl = baseUrl.rstrip("/")
        self.endpoint = f"{self.baseUrl}/api/tools/execute"
    
    def executeTool(
        self,
        toolName: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute a Firebase tool via Next.js API.
        
        Args:
            toolName: Name of the tool (plotManagement, missionManagement, etc.)
            arguments: Tool arguments as dict
        
        Returns:
            {
                "success": bool,
                "result": Any,
                "error": Optional[str]
            }
        """
        payload = {
            "toolName": toolName,
            "arguments": arguments,
        }
        
        headers = {"Content-Type": "application/json"}
        
        try:
            if HAS_REQUESTS:
                resp = requests.post(
                    self.endpoint,
                    json=payload,
                    headers=headers,
                    timeout=30
                )
                
                if resp.status_code != 200:
                    return {
                        "success": False,
                        "result": None,
                        "error": f"HTTP {resp.status_code}: {resp.text}",
                    }
                
                data = resp.json()
                return {
                    "success": True,
                    "result": data.get("result"),
                    "error": None,
                }
            else:
                # Fallback to urllib
                req = urllib.request.Request(
                    self.endpoint,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=headers
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return {
                        "success": True,
                        "result": data.get("result"),
                        "error": None,
                    }
        
        except Exception as e:
            return {
                "success": False,
                "result": None,
                "error": str(e),
            }
    
    def executeToolCalls(
        self,
        toolCalls: list[Dict[str, Any]],
    ) -> list[Dict[str, Any]]:
        """
        Execute multiple tool calls and return results.
        
        Args:
            toolCalls: List of tool calls from OpenAI response
                [{"id": str, "function": {"name": str, "arguments": str}}]
        
        Returns:
            List of results with toolCallId, toolName, and result
        """
        results = []
        
        for tc in toolCalls:
            toolCallId = tc.get("id")
            functionName = tc.get("function", {}).get("name")
            argumentsStr = tc.get("function", {}).get("arguments", "{}")
            
            # Parse arguments JSON
            try:
                arguments = json.loads(argumentsStr) if isinstance(argumentsStr, str) else argumentsStr
            except json.JSONDecodeError:
                arguments = {}
            
            # Execute tool
            result = self.executeTool(functionName, arguments)
            
            results.append({
                "toolCallId": toolCallId,
                "toolName": functionName,
                "arguments": arguments,
                "result": result.get("result"),
                "error": result.get("error"),
            })
        
        return results


# ============================================================================
# Convenience Function
# ============================================================================

def createToolsClient(baseUrl: str = DEFAULT_TOOLS_BASE_URL) -> ToolsClient:
    """Create tools client with specified base URL."""
    return ToolsClient(baseUrl=baseUrl)
