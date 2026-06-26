import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase Firestore schema (used by overview widgets and app)
 *
 * Collection: plots (yourPlots.tsx, plotsContext, API /api/plots)
 *   Document: { id, name?: string, corners: { lat: number; lng: number }[], createdAt?: string }
 *
 * Collection: missionTypes (missionTypes.tsx, addMissionModal, missionManagementTool)
 *   Document: { id, name: string, cameraId: string, cameraName: string, type: MissionType,
 *               frontOverlap: number, sideOverlap: number, flightHeight: number, flightSpeed: number, createdAt?: string }
 *   MissionType: "mapping" | "imagePoint" | etc.
 *
 * Collection: cameraSensors (cameraSensors.tsx, addCameraModal, cameraSensorsTool)
 *   Document: { id, name: string, imageWidth: number, imageHeight: number,
 *               focalLength: number, sensorWidth: number, createdAt?: string }
 *
 * Collection: flightScriptSavedChats (saved-chats page, flightScriptSavedChatsFirebase.ts)
 *   Document id: same as local saved chat id. Fields: chatName, noteMessage, savedAt, messages,
 *                 uploadedAt (ISO string when written to Firestore)
 *
 * Execute flight script (executeFlightScriptTool — tool input, not Firestore)
 *   Input: { procedure: "test-flight-script-1", parameters?: Record<string, unknown> }
 *
 * ---------------------------------------------------------------------------
 * Tool function definitions (flight-assistant / app/api/tools)
 * ---------------------------------------------------------------------------
 *
 * plotManagement
 *   Description: Manage agricultural plots — add, update, delete, or list. List first to get IDs for update/delete.
 *   Parameters:
 *     - action (required): "add" | "update" | "delete" | "list"
 *     - name (required): string
 *     - corners (required): { lat: number; lng: number }[]
 *     - id (auto-generated): string — omit for add; required for update/delete
 *
 * missionManagement
 *   Description: Manage mission types — add, update, delete, or list. List first to get IDs for update/delete. cameraId must be from the set of cameraSensors (list cameraSensors to get valid IDs).
 *   Parameters:
 *     - action (required): "add" | "update" | "delete" | "list"
 *     - id (auto-generated): string — omit for add; required for update/delete
 *     - name (required): string
 *     - cameraId (required): string — id from cameraSensors
 *     - cameraName (required): string — display name of camera from cameraSensors
 *     - type (required): "mapping" | "dsm" | "imagePoint" | "recordVideo"
 *     - frontOverlap (required): number 0–100
 *     - sideOverlap (required): number 0–100
 *     - flightHeight (required): number
 *     - flightSpeed (required): number
 *
 * cameraSensors
 *   Description: Manage camera sensors — add, update, delete, or list. List first to get IDs for update/delete.
 *   Parameters:
 *     - action (required): "add" | "update" | "delete" | "list"
 *     - id (auto-generated): string — omit for add; required for update/delete
 *     - name (required): string
 *     - imageWidth (required): number
 *     - imageHeight (required): number
 *     - focalLength (required): number
 *     - sensorWidth (required): number
 *
 * executeFlightScript
 *   Description: Execute the test flight procedure on the drone via WebSocket. Only when WebSocket is connected.
 *   Parameters:
 *     - procedure (required): "test-flight-script-1"
 *     - parameters (required): Record<string, unknown>
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once (prevents re-initialization in dev hot-reload)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);

export { app, db };
