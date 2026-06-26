"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type PlotZoomRequest = { plotId: string; seq: number };

type MapFocusContextValue = {
  plotZoomRequest: PlotZoomRequest | null;
  requestZoomToPlot: (plotId: string) => void;
};

export const MapFocusContext = createContext<MapFocusContextValue | null>(null);

export function MapFocusProvider({ children }: { children: ReactNode }) {
  const [plotZoomRequest, setPlotZoomRequest] = useState<PlotZoomRequest | null>(null);

  const requestZoomToPlot = useCallback((plotId: string) => {
    setPlotZoomRequest((prev) => ({
      plotId,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  return (
    <MapFocusContext.Provider value={{ plotZoomRequest, requestZoomToPlot }}>
      {children}
    </MapFocusContext.Provider>
  );
}

export function useMapFocusOptional() {
  return useContext(MapFocusContext);
}
