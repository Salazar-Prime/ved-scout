"""
Configuration for Pass^k Tool-Call Experiments
"""
import os
from typing import Optional

# ============================================================================
# OpenAI Configuration
# ============================================================================

def getOpenAiApiKey() -> str:
    """Get OpenAI API key from environment."""
    apiKey = os.getenv("OPENAI_API_KEY")
    if not apiKey:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    return apiKey


DEFAULT_MODEL = "gpt-5.2"
DEFAULT_REASONING = "none"
DEFAULT_MAX_TOKENS = 4096  # Note: Used as max_completion_tokens for newer models
DEFAULT_TEMPERATURE = 1.0
DEFAULT_TOP_P = 1.0

# OpenAI API endpoint
OPENAI_API_BASE = "https://api.openai.com/v1"

# Model pricing (input cost per 1M tokens, output cost per 1M tokens) in USD
MODEL_PRICING = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4-turbo": (10.00, 30.00),
    "gpt-4": (30.00, 60.00),
    "gpt-3.5-turbo": (0.50, 1.50),
    "gpt-5.2": (1.75, 14.00),
    "gpt-5.4": (2.50, 15.00),
}


# ============================================================================
# Next.js Tools API Configuration
# ============================================================================

DEFAULT_TOOLS_BASE_URL = "http://localhost:3000"


# ============================================================================
# System Prompt
# ============================================================================

SYSTEM_PROMPT = """You are VED-SCOUT, a voice-enabled autonomous drone weed scouting assistant. You help users manage agricultural drone flight missions.

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
   - Available procedure: "test-flight-script-1" only
   - You can include optional parameters (e.g., altitude, speed) that will be sent to the drone
   - The drone handles all internal configuration and execution - just send the command with parameters

Be concise but helpful. Confirm actions after performing them."""


# ============================================================================
# Tool Schemas (for OpenAI function calling)
# ============================================================================

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "plotManagement",
            "description": """Manage agricultural plots — add, update, delete, or list plots.
Use action "add" to create a new plot with a name and corner coordinates.
Use action "update" to modify an existing plot's name or corners (requires the plot ID).
Use action "delete" to remove a plot (requires the plot ID).
Use action "list" to retrieve all existing plots and their details.
Always list plots first if you need to find a plot's ID for update/delete.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["add", "update", "delete", "list"],
                        "description": "The operation to perform on plots"
                    },
                    "name": {
                        "type": "string",
                        "description": "Name of the plot (required for add, optional for update)"
                    },
                    "corners": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "lat": {"type": "number", "description": "Latitude of the corner"},
                                "lng": {"type": "number", "description": "Longitude of the corner"}
                            },
                            "required": ["lat", "lng"]
                        },
                        "description": "Array of corner coordinates defining the plot boundary (required for add, optional for update). Minimum 3 corners."
                    },
                    "id": {
                        "type": "string",
                        "description": "Plot document ID (required for update and delete)"
                    }
                },
                "required": ["action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "missionManagement",
            "description": """Manage mission types — add, update, delete, or list mission type configurations.
Use action "add" to create a new mission type with name, type (mapping, dsm, imagePoint, recordVideo), and optional camera/overlap/flight params.
Use action "update" to modify an existing mission (requires the mission ID).
Use action "delete" to remove a mission type (requires the mission ID).
Use action "list" to retrieve all mission types and their details.
Always list first if you need to find a mission's ID for update/delete.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["add", "update", "delete", "list"],
                        "description": "The operation to perform on mission types"
                    },
                    "id": {
                        "type": "string",
                        "description": "Mission type document ID (required for update and delete)"
                    },
                    "name": {
                        "type": "string",
                        "description": "Mission name (required for add, optional for update)"
                    },
                    "cameraId": {
                        "type": "string",
                        "description": "ID of the camera sensor to use (optional for add/update)"
                    },
                    "cameraName": {
                        "type": "string",
                        "description": "Display name of the camera (optional for add/update)"
                    },
                    "type": {
                        "type": "string",
                        "enum": ["mapping", "dsm", "imagePoint", "recordVideo"],
                        "description": "Mission type (required for add, optional for update)"
                    },
                    "frontOverlap": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Front overlap percentage 0-100 (optional for add/update)"
                    },
                    "sideOverlap": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Side overlap percentage 0-100 (optional for add/update)"
                    },
                    "flightHeight": {
                        "type": "number",
                        "minimum": 0,
                        "description": "Flight height in meters (optional for add/update)"
                    },
                    "flightSpeed": {
                        "type": "number",
                        "minimum": 0,
                        "description": "Flight speed in m/s (optional for add/update)"
                    }
                },
                "required": ["action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cameraSensors",
            "description": """Manage camera sensors — add, update, delete, or list camera sensor configurations.
Use action "add" to create a new camera with name and optional image dimensions (imageWidth, imageHeight, focalLength, sensorWidth).
Use action "update" to modify an existing camera (requires the camera ID).
Use action "delete" to remove a camera sensor (requires the camera ID).
Use action "list" to retrieve all camera sensors and their details.
Always list first if you need to find a camera's ID for update/delete.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["add", "update", "delete", "list"],
                        "description": "The operation to perform on camera sensors"
                    },
                    "id": {
                        "type": "string",
                        "description": "Camera sensor document ID (required for update and delete)"
                    },
                    "name": {
                        "type": "string",
                        "description": "Camera name (required for add, optional for update)"
                    },
                    "imageWidth": {
                        "type": "number",
                        "minimum": 1,
                        "description": "Image width in pixels (optional for add/update)"
                    },
                    "imageHeight": {
                        "type": "number",
                        "minimum": 1,
                        "description": "Image height in pixels (optional for add/update)"
                    },
                    "focalLength": {
                        "type": "number",
                        "minimum": 0,
                        "description": "Focal length in mm (optional for add/update)"
                    },
                    "sensorWidth": {
                        "type": "number",
                        "minimum": 0,
                        "description": "Sensor width in mm (optional for add/update)"
                    }
                },
                "required": ["action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "executeFlightScript",
            "description": """
Available procedure: "test-flight-script-1"
The command will be sent to the drone with the script name, private key, and any parameters.
The drone will handle all execution details internally.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "procedure": {
                        "type": "string",
                        "enum": ["test-flight-script-1"],
                        "description": "The flight procedure to execute (only test-flight-script-1 is available)"
                    },
                    "parameters": {
                        "type": "object",
                        "description": "Optional parameters to pass to the flight script (e.g., altitude, speed, waypoints, etc.)"
                    }
                },
                "required": ["procedure"]
            }
        }
    }
]
