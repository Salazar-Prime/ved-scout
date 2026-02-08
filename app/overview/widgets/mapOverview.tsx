"use client";

import dynamic from "next/dynamic";

const MapRenderer = dynamic(() => import("./mapRenderer"), { ssr: false });

export default function MapOverview() {
  return (
    <div className="h-full w-full">
      <MapRenderer />
    </div>
  );
}
