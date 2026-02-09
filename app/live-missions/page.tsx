"use client";

import dynamic from "next/dynamic";
import TelemetryConsole from "./telemetryConsole";

const LiveMissionMap = dynamic(() => import("./liveMissionMap"), { ssr: false });

export default function LiveMissionsPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Map — takes up the top portion, fills available space */}
      <div className="flex-1 min-h-0 relative">
        <LiveMissionMap />
      </div>

      {/* Telemetry console — fixed height at the bottom */}
      <div className="h-[280px] shrink-0 border-t border-[#cfb991]/20 bg-zinc-900/95 backdrop-blur-sm">
        <TelemetryConsole />
      </div>
    </div>
  );
}
