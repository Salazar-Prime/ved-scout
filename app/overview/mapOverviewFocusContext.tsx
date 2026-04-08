"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type PlotZoomRequest = { plotId: string; seq: number };

type MapOverviewFocusContextValue = {
  plotZoomRequest: PlotZoomRequest | null;
  requestZoomToPlot: (plotId: string) => void;
};

export const MapOverviewFocusContext =
  createContext<MapOverviewFocusContextValue | null>(null);

export function MapOverviewFocusProvider({ children }: { children: ReactNode }) {
  const [plotZoomRequest, setPlotZoomRequest] = useState<PlotZoomRequest | null>(
    null,
  );

  const requestZoomToPlot = useCallback((plotId: string) => {
    setPlotZoomRequest((prev) => ({
      plotId,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  return (
    <MapOverviewFocusContext.Provider
      value={{ plotZoomRequest, requestZoomToPlot }}
    >
      {children}
    </MapOverviewFocusContext.Provider>
  );
}

export function useMapOverviewFocusOptional() {
  return useContext(MapOverviewFocusContext);
}
