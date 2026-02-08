"use client";

import DraggableGrid from "../components/draggablePanes_overview";
import MapOverview from "./widgets/mapOverview";
import YourPlots from "./widgets/yourPlots";
import FlightHistory from "./widgets/flightHistory";
import MissionTypes from "./widgets/missionTypes";

const widgets = [
  { id: "mapOverview", title: "Map Overview", component: <MapOverview />, hideTitle: true },
  { id: "yourPlots", title: "Your Plots", component: <YourPlots /> },
  { id: "flightHistory", title: "Flight History", component: <FlightHistory /> },
  { id: "missionTypes", title: "Mission Types", component: <MissionTypes /> },
];

export default function OverviewPage() {
  return (
    <div className="p-4 h-full">
      <DraggableGrid widgets={widgets} />
    </div>
  );
}
