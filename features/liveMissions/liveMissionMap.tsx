"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
  CircleMarker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePlots, type PlotDoc } from "@/app/components/plotsContext";
import { getPlotColor } from "@/lib/plotColors";
import { type TelemetryData } from "./useWebSocketTelemetry";

const defaultCenter: [number, number] = [40.470078114634596, -86.99176832710066];
const defaultZoom = 15;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface LiveMissionMapProps {
  telemetry: TelemetryData | null;
  droneTrail: [number, number][];
}

/* ------------------------------------------------------------------ */
/*  Sort corners in counter-clockwise order so the polygon draws       */
/*  correctly (no bowtie / crossed edges).                             */
/* ------------------------------------------------------------------ */

function sortCornersCcw(positions: [number, number][]): [number, number][] {
  if (positions.length <= 2) return positions;

  const cx = positions.reduce((s, p) => s + p[0], 0) / positions.length;
  const cy = positions.reduce((s, p) => s + p[1], 0) / positions.length;

  return [...positions].sort(
    (a, b) =>
      Math.atan2(a[0] - cx, a[1] - cy) - Math.atan2(b[0] - cx, b[1] - cy)
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: fit map bounds to all plot polygons ONCE on first load     */
/* ------------------------------------------------------------------ */

function FitBoundsOnce({ plots }: { plots: PlotDoc[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current || plots.length === 0) return;

    const allPoints: [number, number][] = [];
    for (const p of plots) {
      for (const c of p.corners ?? []) {
        const lat =
          typeof c.lat === "number" ? c.lat : parseFloat(String(c.lat));
        const lng =
          typeof c.lng === "number" ? c.lng : parseFloat(String(c.lng));
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          allPoints.push([lat, lng]);
        }
      }
    }

    if (allPoints.length === 0) return;

    hasFitted.current = true;
    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
  }, [plots, map]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Pan map to drone once on first telemetry                           */
/* ------------------------------------------------------------------ */

function PanToDroneOnce({ telemetry }: { telemetry: TelemetryData | null }) {
  const map = useMap();
  const hasPanned = useRef(false);

  useEffect(() => {
    if (hasPanned.current || !telemetry) return;
    hasPanned.current = true;
    map.setView([telemetry.latitude, telemetry.longitude], 17, {
      animate: true,
    });
  }, [telemetry, map]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Main live-mission map                                              */
/* ------------------------------------------------------------------ */

export default function LiveMissionMap({
  telemetry,
  droneTrail,
}: LiveMissionMapProps) {
  const { plots } = usePlots();

  const polygons = useMemo(() => {
    const result: {
      id: string;
      name: string;
      positions: [number, number][];
      color: string;
    }[] = [];

    plots.forEach((p, i) => {
      if (!Array.isArray(p.corners)) return;

      const validPositions: [number, number][] = [];
      for (const c of p.corners) {
        const lat =
          typeof c.lat === "number" ? c.lat : parseFloat(String(c.lat));
        const lng =
          typeof c.lng === "number" ? c.lng : parseFloat(String(c.lng));
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          validPositions.push([lat, lng]);
        }
      }

      if (validPositions.length >= 3) {
        result.push({
          id: p.id,
          name: p.name?.trim() || "Unnamed Plot",
          positions: sortCornersCcw(validPositions),
          color: getPlotColor(i),
        });
      }
    });

    return result;
  }, [plots]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      className="h-full w-full"
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <FitBoundsOnce plots={plots} />
      <PanToDroneOnce telemetry={telemetry} />

      {polygons.map((poly) => (
        <Polygon
          key={poly.id}
          positions={poly.positions}
          pathOptions={{
            color: poly.color,
            weight: 2,
            fillColor: poly.color,
            fillOpacity: 0.15,
          }}
        >
          <Tooltip sticky>{poly.name}</Tooltip>
        </Polygon>
      ))}

      {/* Drone trail path */}
      {droneTrail.length > 1 && (
        <Polyline
          positions={droneTrail}
          pathOptions={{
            color: "#cfb991",
            weight: 2,
            opacity: 0.5,
            dashArray: "6, 4",
          }}
        />
      )}

      {/* Drone position marker */}
      {telemetry && (
        <CircleMarker
          center={[telemetry.latitude, telemetry.longitude]}
          radius={8}
          pathOptions={{
            color: "#cfb991",
            weight: 3,
            fillColor: "#cfb991",
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <div className="text-xs font-mono space-y-1">
              <div className="font-semibold text-sm">Drone Position</div>
              <div>Lat: {telemetry.latitude.toFixed(6)}</div>
              <div>Lng: {telemetry.longitude.toFixed(6)}</div>
              <div>Alt: {telemetry.altitude.toFixed(1)}m</div>
              <div>Speed: {telemetry.speed.toFixed(2)} m/s</div>
              <div>Heading: {telemetry.heading.toFixed(1)}°</div>
            </div>
          </Popup>
        </CircleMarker>
      )}

      {/* Heading indicator — a smaller dot ahead of the drone */}
      {telemetry && (
        <CircleMarker
          center={[
            telemetry.latitude +
              0.0002 * Math.cos((telemetry.heading * Math.PI) / 180),
            telemetry.longitude +
              0.0002 * Math.sin((telemetry.heading * Math.PI) / 180),
          ]}
          radius={3}
          pathOptions={{
            color: "#cfb991",
            weight: 1,
            fillColor: "#fff",
            fillOpacity: 0.9,
          }}
        />
      )}
    </MapContainer>
  );
}
