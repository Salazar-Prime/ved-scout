"use client";

import YourPlots from "../overview/widgets/yourPlots";
import MapOverview from "../overview/widgets/mapOverview";
import { MapOverviewFocusProvider } from "../overview/mapOverviewFocusContext";

export default function YourPlotsPage() {
  return (
    <MapOverviewFocusProvider>
      <div className="flex flex-col h-full min-h-0 p-6 gap-4">
        <h1 className="text-2xl font-bold text-zinc-200 shrink-0">Your Plots</h1>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          <div className="h-[42vh] lg:h-auto lg:flex-1 min-h-[240px] rounded-xl border border-[#cfb991]/40 overflow-hidden shadow-sm bg-zinc-900/40">
            <MapOverview />
          </div>

          <div className="flex-1 min-h-[280px] lg:min-h-0 rounded-xl border border-[#cfb991]/40 bg-zinc-900/80 backdrop-blur-sm shadow-sm p-4 relative flex flex-col min-h-0">
            <YourPlots />
          </div>
        </div>
      </div>
    </MapOverviewFocusProvider>
  );
}
