"""
WebSocket server for Soysan testing.

This server does NOT execute any flight binaries.
When it receives a flight_script message with valid credentials it:
  1. Records the time the request was received (ISO-8601 UTC)
  2. Logs the mission details to stdout
  3. Returns an acknowledgement with receivedAt and the full mission payload

Response shape:
{
  "commandId":  "<echo>",
  "status":     "acknowledged",
  "receivedAt": "2025-01-01T12:00:00.000Z",   # ISO-8601 UTC
  "scriptName": "<echo>",
  "plot":       { ... },
  "mission":    { ... },
  "camera":     { ... },
  "parameters": { ... }
}
"""

import asyncio
import json
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
import websockets
from websockets.server import serve

load_dotenv()
PRIVATE_KEY = os.getenv('PRIVATE_KEY')


class SoysanWebSocketServer:
    def __init__(self, host='0.0.0.0', port=8765):
        self.host = host
        self.port = port

    async def handleClient(self, websocket):
        clientAddress = websocket.remote_address
        print(f"[soysan] Client connected: {clientAddress}")
        try:
            async for message in websocket:
                await self.processMessage(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            print(f"[soysan] Client disconnected: {clientAddress}")

    async def processMessage(self, websocket, message):
        data = None
        try:
            data = json.loads(message)

            messageType = data.get('type')
            scriptName  = data.get('scriptName')
            privateKey  = data.get('privateKey')
            commandId   = data.get('commandId')
            parameters  = data.get('parameters', {})
            plot        = data.get('plot', {})
            mission     = data.get('mission', {})
            camera      = data.get('camera', {})

            # --- Validate required envelope fields ---
            if not all([messageType, scriptName, privateKey, commandId]):
                await self.sendResponse(websocket, {
                    'commandId': commandId or 'unknown',
                    'status': 'failed',
                    'error': 'Missing required fields: type, scriptName, privateKey, commandId',
                })
                return

            # --- Validate private key ---
            if privateKey != PRIVATE_KEY:
                await self.sendResponse(websocket, {
                    'commandId': commandId,
                    'status': 'failed',
                    'error': 'Invalid private key',
                })
                return

            if messageType == 'flight_script':
                await self.handleFlightScriptAck(
                    websocket, commandId, scriptName,
                    plot, mission, camera, parameters,
                )
            else:
                await self.sendResponse(websocket, {
                    'commandId': commandId,
                    'status': 'failed',
                    'error': f'Unknown message type: {messageType}',
                })

        except json.JSONDecodeError:
            await self.sendResponse(websocket, {
                'commandId': 'unknown',
                'status': 'failed',
                'error': 'Invalid JSON format',
            })
        except Exception as exc:
            cmdId = (data.get('commandId', 'unknown') if data else 'unknown')
            await self.sendResponse(websocket, {
                'commandId': cmdId,
                'status': 'failed',
                'error': f'Error processing message: {exc}',
            })

    async def handleFlightScriptAck(
        self, websocket, commandId, scriptName,
        plot, mission, camera, parameters,
    ):
        """Acknowledge receipt of mission details without executing anything."""

        receivedAt = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

        # Pretty-print to server console for traceability
        print(
            f"\n[soysan] ── Mission received ──────────────────────────────\n"
            f"  receivedAt : {receivedAt}\n"
            f"  commandId  : {commandId}\n"
            f"  scriptName : {scriptName}\n"
            f"  plot       : {json.dumps(plot, indent=4)}\n"
            f"  mission    : {json.dumps(mission, indent=4)}\n"
            f"  camera     : {json.dumps(camera, indent=4)}\n"
            f"  parameters : {json.dumps(parameters, indent=4)}\n"
            f"────────────────────────────────────────────────────────────\n"
        )

        await self.sendResponse(websocket, {
            'commandId':  commandId,
            'status':     'acknowledged',
            'receivedAt': receivedAt,
            'scriptName': scriptName,
            'plot':       plot,
            'mission':    mission,
            'camera':     camera,
            'parameters': parameters,
        })

    async def sendResponse(self, websocket, response):
        try:
            await websocket.send(json.dumps(response))
        except Exception as exc:
            print(f"[soysan] Error sending response: {exc}")

    async def start(self):
        async with serve(self.handleClient, self.host, self.port):
            print(f"[soysan] WebSocket server started on ws://{self.host}:{self.port}")
            await asyncio.Future()


async def main():
    if not PRIVATE_KEY:
        print("[soysan] ERROR: PRIVATE_KEY not found in .env file")
        return
    server = SoysanWebSocketServer(host='0.0.0.0', port=8765)
    await server.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[soysan] Server stopped by user")
