"use client";

import DraggableGrid from "../components/draggablePanes_overview";
import MapOverview from "./widgets/mapOverview";
import YourPlots from "./widgets/yourPlots";
import FlightHistory from "./widgets/flightHistory";
import MissionTypes from "./widgets/missionTypes";
import CameraSensors from "./widgets/cameraSensors";
import VoiceRecorder from "./widgets/voiceRecorder";

const widgets = [
  { id: "mapOverview", title: "Map Overview", component: <MapOverview />, hideTitle: true },
  { id: "yourPlots", title: "Your Plots", component: <YourPlots /> },
  { id: "flightHistory", title: "Flight History", component: <FlightHistory /> },
  { id: "missionTypes", title: "Mission Types", component: <MissionTypes /> },
  { id: "cameraSensors", title: "Camera Sensors", component: <CameraSensors /> },
];

export default function OverviewPage() {
  return (
    <div className="p-4 h-full">
      <VoiceRecorder />
      <DraggableGrid widgets={widgets} />
    </div>
  );
}
