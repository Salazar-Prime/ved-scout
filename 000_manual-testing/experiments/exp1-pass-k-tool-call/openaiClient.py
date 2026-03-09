"""
OpenAI Client for Pass^k Experiments
Direct OpenAI API calls with full parameter control
"""
import json
import random
import string
from typing import Any, Dict, List, Optional

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.parse
    import urllib.error
    HAS_REQUESTS = False

from config import (
    getOpenAiApiKey,
    OPENAI_API_BASE,
    DEFAULT_MODEL,
    DEFAULT_REASONING,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_P,
    SYSTEM_PROMPT,
    TOOL_SCHEMAS,
)


# ============================================================================
# Cache Busting
# ============================================================================

def addCacheBuster(message: str) -> str:
    """
    Prepend a random cache-busting string to avoid API response caching.
    Format: [random14chars:cachemiss] message
    """
    chars = string.ascii_letters + string.digits
    token = "".join(random.choices(chars, k=14))
    return f"[{token}:cachemiss] {message}"


# ============================================================================
# OpenAI Chat Completion Client
# ============================================================================

class OpenAIClient:
    """
    Client for OpenAI Chat Completions API with full parameter control.
    Supports tool calling (function calling) and reasoning effort.
    """
    
    def __init__(
        self,
        apiKey: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        temperature: float = DEFAULT_TEMPERATURE,
        topP: float = DEFAULT_TOP_P,
        maxTokens: int = DEFAULT_MAX_TOKENS,
    ):
        self.apiKey = apiKey or getOpenAiApiKey()
        self.model = model
        self.temperature = temperature
        self.topP = topP
        self.maxTokens = maxTokens
        self.endpoint = f"{OPENAI_API_BASE}/chat/completions"
    
    def chatCompletion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        toolChoice: str = "auto",
        reasoning: str = DEFAULT_REASONING,
        previousResponseId: Optional[str] = None,
        cacheBust: bool = True,
    ) -> Dict[str, Any]:
        """
        Call OpenAI Chat Completions API.
        
        Args:
            messages: List of message objects (role, content)
            tools: Optional list of tool definitions (function calling)
            toolChoice: "auto", "none", or {"type": "function", "function": {"name": "..."}}
            reasoning: "none" or "high" (for o1/o3 models)
            previousResponseId: Optional response ID for conversation continuity
            cacheBust: Whether to add cache-busting token to last user message
        
        Returns:
            {
                "responseId": str,
                "content": str,
                "toolCalls": [...],
                "usage": {
                    "promptTokens": int,
                    "completionTokens": int,
                    "totalTokens": int
                },
                "finishReason": str,
                "error": Optional[str]
            }
        """
        # Add cache buster to last user message if requested
        if cacheBust and messages:
            for i in range(len(messages) - 1, -1, -1):
                if messages[i].get("role") == "user":
                    originalContent = messages[i]["content"]
                    messages[i]["content"] = addCacheBuster(originalContent)
                    break
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "top_p": self.topP,
            "max_completion_tokens": self.maxTokens,  # Use max_completion_tokens for newer models
        }
        
        # Add tools if provided
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = toolChoice
        
        # Add reasoning effort for supported models
        if reasoning != "none" and reasoning in ["low", "medium", "high"]:
            payload["reasoning_effort"] = reasoning
        
        # Add previousResponseId if provided (for conversation continuity)
        if previousResponseId:
            payload["previous_response_id"] = previousResponseId
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.apiKey}",
        }
        
        try:
            if HAS_REQUESTS:
                resp = requests.post(
                    self.endpoint,
                    json=payload,
                    headers=headers,
                    timeout=120
                )
                
                if resp.status_code != 200:
                    return {
                        "responseId": None,
                        "content": "",
                        "toolCalls": [],
                        "usage": {},
                        "finishReason": "error",
                        "error": f"HTTP {resp.status_code}: {resp.text}",
                    }
                
                data = resp.json()
            else:
                # Fallback to urllib
                req = urllib.request.Request(
                    self.endpoint,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=headers
                )
                with urllib.request.urlopen(req, timeout=120) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
            
            # Parse response
            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {})
            
            toolCalls = []
            if "tool_calls" in message and message["tool_calls"]:
                for tc in message["tool_calls"]:
                    toolCalls.append({
                        "id": tc.get("id"),
                        "type": tc.get("type"),
                        "function": {
                            "name": tc.get("function", {}).get("name"),
                            "arguments": tc.get("function", {}).get("arguments"),
                        }
                    })
            
            usage = data.get("usage", {})
            
            return {
                "responseId": data.get("id"),
                "content": message.get("content", ""),
                "toolCalls": toolCalls,
                "usage": {
                    "promptTokens": usage.get("prompt_tokens", 0),
                    "completionTokens": usage.get("completion_tokens", 0),
                    "totalTokens": usage.get("total_tokens", 0),
                },
                "finishReason": choice.get("finish_reason", "unknown"),
                "error": None,
            }
        
        except Exception as e:
            return {
                "responseId": None,
                "content": "",
                "toolCalls": [],
                "usage": {},
                "finishReason": "error",
                "error": str(e),
            }


# ============================================================================
# Convenience Function
# ============================================================================

def createOpenAiClient(
    model: str = DEFAULT_MODEL,
    temperature: float = DEFAULT_TEMPERATURE,
    topP: float = DEFAULT_TOP_P,
    maxTokens: int = DEFAULT_MAX_TOKENS,
) -> OpenAIClient:
    """Create OpenAI client with specified configuration."""
    return OpenAIClient(
        model=model,
        temperature=temperature,
        topP=topP,
        maxTokens=maxTokens,
    )


def simpleChat(
    userMessage: str,
    model: str = DEFAULT_MODEL,
    systemPrompt: str = SYSTEM_PROMPT,
    tools: Optional[List[Dict[str, Any]]] = None,
    reasoning: str = DEFAULT_REASONING,
) -> Dict[str, Any]:
    """
    Simple one-shot chat completion with optional tools.
    
    Args:
        userMessage: User message content
        model: OpenAI model name
        systemPrompt: System prompt
        tools: Optional tool definitions
        reasoning: Reasoning effort level
    
    Returns:
        Response dict with content, toolCalls, usage, etc.
    """
    client = createOpenAiClient(model=model)
    messages = [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": userMessage},
    ]
    
    return client.chatCompletion(
        messages=messages,
        tools=tools or TOOL_SCHEMAS,
        reasoning=reasoning,
    )
