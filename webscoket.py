import asyncio
import json
import os
import subprocess
from pathlib import Path
from dotenv import load_dotenv
import websockets
from websockets.server import serve

# Load environment variables
load_dotenv()
PRIVATE_KEY = os.getenv('PRIVATE_KEY')

# Path to the flight control sample
FLIGHT_CONTROL_SAMPLE_PATH = '/home/usr/work/Onboard-SDK/build/bin/djiosdk-flightcontrol-sample'

class WebSocketServer:
    def __init__(self, host='0.0.0.0', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
    
    async def handleClient(self, websocket):
        """Handle individual client connection"""
        self.clients.add(websocket)
        clientAddress = websocket.remote_address
        print(f"Client connected: {clientAddress}")
        
        try:
            async for message in websocket:
                await self.processMessage(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            print(f"Client disconnected: {clientAddress}")
        finally:
            self.clients.remove(websocket)
    
    async def processMessage(self, websocket, message):
        """Process incoming message from client"""
        try:
            data = json.loads(message)
            messageType = data.get('type')
            scriptName = data.get('scriptName')
            privateKey = data.get('privateKey')
            parameters = data.get('parameters', {})
            commandId = data.get('commandId')
            
            # Validate required fields
            if not all([messageType, scriptName, privateKey, commandId]):
                await self.sendResponse(websocket, {
                    'commandId': commandId or 'unknown',
                    'status': 'failed',
                    'error': 'Missing required fields: type, scriptName, privateKey, commandId'
                })
                return
            
            # Validate private key
            if privateKey != PRIVATE_KEY:
                await self.sendResponse(websocket, {
                    'commandId': commandId,
                    'status': 'failed',
                    'error': 'Invalid private key'
                })
                return
            
            # Handle message types
            if messageType == 'flight_script':
                await self.handleFlightScript(websocket, scriptName, parameters, commandId)
            else:
                await self.sendResponse(websocket, {
                    'commandId': commandId,
                    'status': 'failed',
                    'error': f'Unknown message type: {messageType}'
                })
        
        except json.JSONDecodeError:
            await self.sendResponse(websocket, {
                'commandId': 'unknown',
                'status': 'failed',
                'error': 'Invalid JSON format'
            })
        except Exception as e:
            await self.sendResponse(websocket, {
                'commandId': data.get('commandId', 'unknown') if 'data' in locals() else 'unknown',
                'status': 'failed',
                'error': f'Error processing message: {str(e)}'
            })
    
    async def handleFlightScript(self, websocket, scriptName, parameters, commandId):
        """Execute the flight script with given parameters"""
        
        # Map script names to executables
        scriptMapping = {
            'test-flight-script-1': FLIGHT_CONTROL_SAMPLE_PATH,
        }
        
        # Get script path
        scriptPath = scriptMapping.get(scriptName)
        
        if not scriptPath:
            await self.sendResponse(websocket, {
                'commandId': commandId,
                'status': 'failed',
                'error': f'Unknown script name: {scriptName}'
            })
            return
        
        # Check if binary exists
        if not Path(scriptPath).exists():
            await self.sendResponse(websocket, {
                'commandId': commandId,
                'status': 'failed',
                'error': f'Script not found at {scriptPath}'
            })
            return
        
        try:
            # Build command with config file parameter if provided
            command = [scriptPath]
            
            # Check if UserConfig.txt parameter is provided or use default
            configPath = parameters.get('configPath')
            if not configPath:
                # Try default location (same directory as binary)
                defaultConfig = Path(scriptPath).parent / 'UserConfig.txt'
                if defaultConfig.exists():
                    configPath = str(defaultConfig)
            
            # Add config path as argument if the binary supports it
            # Most DJI SDK samples expect UserConfig.txt in the same directory
            # or you can pass it as an argument
            if configPath:
                command.append(configPath)
            
            # Execute the flight control sample
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=Path(scriptPath).parent  # Run from binary directory
            )
            
            # Wait for process to complete
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                await self.sendResponse(websocket, {
                    'commandId': commandId,
                    'status': 'completed',
                    'message': 'Flight completed successfully'
                })
            else:
                errorMessage = stderr.decode('utf-8').strip() or stdout.decode('utf-8').strip() or 'Script execution failed'
                await self.sendResponse(websocket, {
                    'commandId': commandId,
                    'status': 'failed',
                    'error': errorMessage
                })
        
        except Exception as e:
            await self.sendResponse(websocket, {
                'commandId': commandId,
                'status': 'failed',
                'error': f'Failed to execute script: {str(e)}'
            })

    
    async def sendResponse(self, websocket, response):
        """Send response to client"""
        try:
            await websocket.send(json.dumps(response))
        except Exception as e:
            print(f"Error sending response: {e}")
    
    async def start(self):
        """Start the WebSocket server"""
        async with serve(self.handleClient, self.host, self.port):
            print(f"WebSocket server started on ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever

async def main():
    """Main entry point"""
    if not PRIVATE_KEY:
        print("ERROR: PRIVATE_KEY not found in .env file")
        return
    
    server = WebSocketServer(host='0.0.0.0', port=8765)
    await server.start()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user")
