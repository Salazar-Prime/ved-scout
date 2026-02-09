"use client";

import CameraSensors from "../overview/widgets/cameraSensors";

export default function CameraSensorsPage() {
  return (
    <div className="flex flex-col h-full p-6">
      <h1 className="text-2xl font-bold text-zinc-200 mb-4">Camera Sensors</h1>
      <div className="flex-1 min-h-0 rounded-xl border border-[#cfb991]/40 bg-zinc-900/80 backdrop-blur-sm shadow-sm p-4 relative">
        <CameraSensors />
      </div>
    </div>
  );
}
