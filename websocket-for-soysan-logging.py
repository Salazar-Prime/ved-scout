"""
WebSocket server for Soysan testing.

This server does NOT execute any flight binaries.
When it receives a flight_script message with valid credentials it:
  1. Runs pre-flight safety checks
  2. Records the time the request was received (ISO-8601 UTC)
  3. Logs the mission details to stdout
  4. Returns an acknowledgement with receivedAt and the full mission payload

Response shape (success):
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

Response shape (safety failure):
{
  "commandId":       "<echo>",
  "status":          "safety_failure",
  "safetyFailures":  ["<reason 1>", "<reason 2>", ...]
}

Safety checks applied before execution:
  1. All flight parameters present (plot, mission, camera non-empty)
  2. Flight height does not exceed FAA limit (122 m / 400 ft AGL)
  3. UAS battery level is above 50 %
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
import websockets
from websockets.server import serve

load_dotenv()
PRIVATE_KEY = os.getenv('PRIVATE_KEY')

# ---------------------------------------------------------------------------
# Safety constants
# ---------------------------------------------------------------------------
FAA_MAX_ALTITUDE_METERS = 122.0   # 400 ft AGL
UAS_BATTERY_LEVEL_PCT   = 82      # Hard-coded until real telemetry is wired in


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

    def runSafetyChecks(self, plot: dict, mission: dict, camera: dict) -> list[dict]:
        """
        Run pre-flight safety checks.

        Returns a list of check result dicts:
          { id, label, passed, detail }

        The list always contains every check so the client can show a full
        per-check breakdown regardless of pass/fail state.
        """
        checks: list[dict] = []

        # 1. Plot parameters present
        plotOk = (
            bool(plot) and isinstance(plot, dict)
            and all(k in plot for k in ('id', 'name', 'corners'))
        )
        checks.append({
            'id':     'plot-params',
            'label':  'Plot details',
            'passed': plotOk,
            'detail': (
                f"{plot.get('name')} — {len(plot.get('corners', []))} corner(s)"
                if plotOk else 'id, name, and corners are required'
            ),
        })

        # 2. Mission parameters present
        missionOk = (
            bool(mission) and isinstance(mission, dict)
            and all(k in mission for k in ('id', 'name', 'type'))
        )
        checks.append({
            'id':     'mission-params',
            'label':  'Mission details',
            'passed': missionOk,
            'detail': (
                f"{mission.get('name')} ({mission.get('type')})"
                if missionOk else 'id, name, and type are required'
            ),
        })

        # 3. Camera parameters present
        cameraOk = (
            bool(camera) and isinstance(camera, dict)
            and all(k in camera for k in ('id', 'name'))
        )
        checks.append({
            'id':     'camera-params',
            'label':  'Camera sensor details',
            'passed': cameraOk,
            'detail': (
                camera.get('name', '—') if cameraOk
                else 'id and name are required'
            ),
        })

        # 4. FAA altitude limit (122 m / 400 ft AGL)
        flightHeight = mission.get('flightHeight') if isinstance(mission, dict) else None
        if flightHeight is not None:
            try:
                heightVal = float(flightHeight)
                altOk = heightVal <= FAA_MAX_ALTITUDE_METERS
                checks.append({
                    'id':     'faa-altitude',
                    'label':  f'FAA altitude limit ({FAA_MAX_ALTITUDE_METERS} m / 400 ft)',
                    'passed': altOk,
                    'detail': (
                        f'{heightVal} m — within limit' if altOk
                        else f'{heightVal} m exceeds {FAA_MAX_ALTITUDE_METERS} m limit'
                    ),
                })
            except (TypeError, ValueError):
                checks.append({
                    'id':     'faa-altitude',
                    'label':  f'FAA altitude limit ({FAA_MAX_ALTITUDE_METERS} m / 400 ft)',
                    'passed': False,
                    'detail': f'Invalid flight height value: {flightHeight!r}',
                })
        else:
            checks.append({
                'id':     'faa-altitude',
                'label':  f'FAA altitude limit ({FAA_MAX_ALTITUDE_METERS} m / 400 ft)',
                'passed': True,
                'detail': 'No flight height set',
            })

        # 5. UAS battery must be above 50 %
        batteryOk = UAS_BATTERY_LEVEL_PCT > 50
        checks.append({
            'id':     'battery',
            'label':  'UAS battery level (> 50%)',
            'passed': batteryOk,
            'detail': (
                f'{UAS_BATTERY_LEVEL_PCT}% — sufficient' if batteryOk
                else f'{UAS_BATTERY_LEVEL_PCT}% — charge before flying'
            ),
        })

        return checks

    async def handleFlightScriptAck(
        self, websocket, commandId, scriptName,
        plot, mission, camera, parameters,
    ):
        """Run safety checks, then acknowledge receipt of mission details."""

        # --- Safety layer ---
        safetyChecks = self.runSafetyChecks(plot, mission, camera)
        allPassed = all(c['passed'] for c in safetyChecks)

        if not allPassed:
            failed = [c for c in safetyChecks if not c['passed']]
            print(
                f"\n[soysan] ── Safety check FAILED ──────────────────────────\n"
                + "".join(f"  ✗ {c['label']}: {c['detail']}\n" for c in failed)
                + f"────────────────────────────────────────────────────────────\n"
            )
            await self.sendResponse(websocket, {
                'commandId':    commandId,
                'status':       'safety_failure',
                'safetyChecks': safetyChecks,
            })
            return

        receivedAt = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

        safetyLines = "".join(
            f"  {'✓' if c['passed'] else '✗'} {c['label']}: {c['detail']}\n"
            for c in safetyChecks
        )
        print(
            f"\n[soysan] ── Mission received ──────────────────────────────\n"
            f"  receivedAt : {receivedAt}\n"
            f"  commandId  : {commandId}\n"
            f"  scriptName : {scriptName}\n"
            f"  plot       : {json.dumps(plot, indent=4)}\n"
            f"  mission    : {json.dumps(mission, indent=4)}\n"
            f"  camera     : {json.dumps(camera, indent=4)}\n"
            f"  parameters : {json.dumps(parameters, indent=4)}\n"
            f"  safety     :\n{safetyLines}"
            f"────────────────────────────────────────────────────────────\n"
        )

        await self.sendResponse(websocket, {
            'commandId':    commandId,
            'status':       'acknowledged',
            'receivedAt':   receivedAt,
            'scriptName':   scriptName,
            'plot':         plot,
            'mission':      mission,
            'camera':       camera,
            'parameters':   parameters,
            'safetyChecks': safetyChecks,
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
