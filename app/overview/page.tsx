"use client";

import DraggableGrid from "../components/draggablePanes_overview";
import MapOverview from "@/features/map/mapOverview";
import PlotList from "@/features/plots/plotList";
import FlightHistoryPanel from "@/features/flightHistory/flightHistoryPanel";
import MissionList from "@/features/missions/missionList";
import CameraList from "@/features/cameras/cameraList";
import VoiceRecorder from "./widgets/voiceRecorder";
import { MapFocusProvider } from "@/features/map/mapFocusContext";

const widgets = [
  { id: "mapOverview", title: "Map Overview", component: <MapOverview />, hideTitle: true },
  { id: "yourPlots", title: "Your Plots", component: <PlotList /> },
  { id: "flightHistory", title: "Flight History", component: <FlightHistoryPanel /> },
  { id: "missionTypes", title: "Mission Types", component: <MissionList /> },
  { id: "cameraSensors", title: "Camera Sensors", component: <CameraList /> },
];

export default function OverviewPage() {
  return (
    <MapFocusProvider>
      <div className="p-4 h-full">
        <VoiceRecorder />
        <DraggableGrid widgets={widgets} />
      </div>
    </MapFocusProvider>
  );
}
