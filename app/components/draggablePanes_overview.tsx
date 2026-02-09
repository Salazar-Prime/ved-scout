"use client";

import {
  useContainerWidth,
  ResponsiveGridLayout,
  type ResponsiveLayouts,
  type Layout,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";

interface GridWidget {
  id: string;
  title: string;
  component: React.ReactNode;
  hideTitle?: boolean;
}

interface DraggableGridProps {
  widgets: GridWidget[];
  defaultLayouts?: ResponsiveLayouts;
}

const defaultBreakpointLayouts: ResponsiveLayouts = {
  lg: [
    { i: "mapOverview", x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
    { i: "yourPlots", x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
    { i: "flightHistory", x: 0, y: 4, w: 4, h: 4, minW: 3, minH: 2 },
    { i: "missionTypes", x: 4, y: 4, w: 4, h: 4, minW: 3, minH: 2 },
    { i: "cameraSensors", x: 8, y: 4, w: 4, h: 4, minW: 3, minH: 2 },
  ],
  md: [
    { i: "mapOverview", x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
    { i: "yourPlots", x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
    { i: "flightHistory", x: 0, y: 4, w: 4, h: 4, minW: 3, minH: 2 },
    { i: "missionTypes", x: 4, y: 4, w: 4, h: 4, minW: 3, minH: 2 },
    { i: "cameraSensors", x: 8, y: 4, w: 4, h: 4, minW: 3, minH: 2 },
  ],
  sm: [
    { i: "mapOverview", x: 0, y: 0, w: 12, h: 4, minW: 3, minH: 2 },
    { i: "yourPlots", x: 0, y: 4, w: 12, h: 4, minW: 3, minH: 2 },
    { i: "flightHistory", x: 0, y: 8, w: 12, h: 4, minW: 3, minH: 2 },
    { i: "missionTypes", x: 0, y: 12, w: 12, h: 4, minW: 3, minH: 2 },
    { i: "cameraSensors", x: 0, y: 16, w: 12, h: 4, minW: 3, minH: 2 },
  ],
};

export default function DraggableGrid({ widgets, defaultLayouts }: DraggableGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  const handleLayoutChange = (_currentLayout: Layout, _allLayouts: ResponsiveLayouts) => {
    // Future: persist layout to localStorage or backend
  };

  return (
    <div ref={containerRef} className="w-full">
      {mounted && (
        <ResponsiveGridLayout
          width={width}
          layouts={defaultLayouts ?? defaultBreakpointLayouts}
          breakpoints={{ lg: 1200, md: 768, sm: 0 }}
          cols={{ lg: 12, md: 12, sm: 12 }}
          rowHeight={80}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          dragConfig={{ enabled: true, handle: ".drag-handle", bounded: false, threshold: 3 }}
          resizeConfig={{ enabled: true, handles: ["se"] }}
        >
          {widgets.map((widget) => (
            <div key={widget.id} className="overflow-hidden">
              <div className="flex flex-col h-full rounded-xl border border-[#cfb991]/40 bg-zinc-900/80 backdrop-blur-sm shadow-sm">
                {!widget.hideTitle && (
                  <div className="drag-handle flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing select-none">
                    <h3 className="text-sm font-bold text-zinc-300">{widget.title}</h3>
                    <svg
                      className="w-4 h-4 text-zinc-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8h16M4 16h16"
                      />
                    </svg>
                  </div>
                )}
                <div className={`flex-1 overflow-hidden ${widget.hideTitle ? "drag-handle cursor-grab active:cursor-grabbing" : "p-4"}`}>
                  {widget.component}
                </div>
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
