"use client";

import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePlots, type PlotDoc } from "../../components/plotsContext";
import { getPlotColor } from "../../../lib/plotColors";

const defaultCenter: [number, number] = [40.470078114634596, -86.99176832710066];
const defaultZoom = 15;

/* ------------------------------------------------------------------ */
/*  Sort corners in counter-clockwise order so the polygon draws       */
/*  correctly (no bowtie / crossed edges).                             */
/* ------------------------------------------------------------------ */

function sortCornersCcw(positions: [number, number][]): [number, number][] {
  if (positions.length <= 2) return positions;

  // Compute centroid
  const cx = positions.reduce((s, p) => s + p[0], 0) / positions.length;
  const cy = positions.reduce((s, p) => s + p[1], 0) / positions.length;

  // Sort by angle from centroid
  return [...positions].sort(
    (a, b) => Math.atan2(a[0] - cx, a[1] - cy) - Math.atan2(b[0] - cx, b[1] - cy)
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: fit map bounds to all plot polygons ONCE on first load     */
/* ------------------------------------------------------------------ */

function FitBoundsOnce({ plots }: { plots: PlotDoc[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    // Only fit once — after that the user controls the map
    if (hasFitted.current || plots.length === 0) return;

    const allPoints: [number, number][] = [];
    for (const p of plots) {
      for (const c of p.corners ?? []) {
        const lat = typeof c.lat === "number" ? c.lat : parseFloat(String(c.lat));
        const lng = typeof c.lng === "number" ? c.lng : parseFloat(String(c.lng));
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
/*  Main renderer                                                      */
/* ------------------------------------------------------------------ */

export default function MapRenderer() {
  const { plots } = usePlots();

  // Convert PlotDoc[] → polygon position arrays (with validation + sorting)
  const polygons = useMemo(() => {
    const result: { id: string; name: string; positions: [number, number][]; color: string }[] = [];

    plots.forEach((p, i) => {
      if (!Array.isArray(p.corners)) return;

      // Only keep corners that have valid finite lat/lng
      const validPositions: [number, number][] = [];
      for (const c of p.corners) {
        const lat = typeof c.lat === "number" ? c.lat : parseFloat(String(c.lat));
        const lng = typeof c.lng === "number" ? c.lng : parseFloat(String(c.lng));
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
      className="h-full w-full rounded-xl"
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Fit bounds once on initial load, then let the user explore freely */}
      <FitBoundsOnce plots={plots} />

      {/* Draw each plot as a polygon */}
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
    </MapContainer>
  );
}
