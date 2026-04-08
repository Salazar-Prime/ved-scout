"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import type { PlotDoc } from "../../components/plotsContext";

interface CornerCoordinate {
  id: string;
  lat: string;
  lng: string;
}

function createCorner(plotId: string, index: number): CornerCoordinate {
  return { id: `corner-${plotId}-${Date.now()}-${index}`, lat: "", lng: "" };
}

function plotCornersToState(plot: PlotDoc): CornerCoordinate[] {
  const raw = plot.corners ?? [];
  if (raw.length === 0) {
    return Array.from({ length: 4 }, (_, i) => createCorner(plot.id, i));
  }
  return raw.map((c, i) => ({
    id: `corner-${plot.id}-${i}`,
    lat: String(c.lat),
    lng: String(c.lng),
  }));
}

export default function EditPlotContent({ plot }: { plot: PlotDoc }) {
  const { closeModal } = useModal();
  const [plotName, setPlotName] = useState(() => plot.name?.trim() ?? "");
  const [corners, setCorners] = useState<CornerCoordinate[]>(() =>
    plotCornersToState(plot)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCornerChange = useCallback(
    (id: string, field: "lat" | "lng", value: string) => {
      setCorners((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  const handleAddCorner = useCallback(() => {
    setCorners((prev) => [...prev, createCorner(plot.id, prev.length)]);
  }, [plot.id]);

  const handleRemoveCorner = useCallback((id: string) => {
    setCorners((prev) => (prev.length <= 3 ? prev : prev.filter((c) => c.id !== id)));
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (plotName.trim() === "") {
      setError("Please enter a plot name.");
      return;
    }

    const filledCorners = corners.filter(
      (c) => c.lat.trim() !== "" || c.lng.trim() !== ""
    );
    if (filledCorners.length < 3) {
      setError("Please enter at least 3 corner coordinates.");
      return;
    }

    const hasIncomplete = filledCorners.some(
      (c) => c.lat.trim() === "" || c.lng.trim() === ""
    );
    if (hasIncomplete) {
      setError("Each corner must have both latitude and longitude.");
      return;
    }

    const parsed = filledCorners.map((c) => ({
      lat: parseFloat(c.lat),
      lng: parseFloat(c.lng),
    }));

    if (parsed.some((p) => isNaN(p.lat) || isNaN(p.lng))) {
      setError("Coordinates must be valid numbers.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/plots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: plot.id,
          name: plotName.trim(),
          corners: parsed,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update plot");
      }
      closeModal();
    } catch (err) {
      console.error("Failed to update plot:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update plot. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }, [plotName, corners, plot.id, closeModal]);

  return (
    <>
      <div className="px-5 py-4 space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Plot Name</h3>
          <input
            type="text"
            placeholder="e.g. North Field, Block A"
            value={plotName}
            onChange={(e) => setPlotName(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
          />
        </section>

        <section>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Corner Coordinates</h3>
          <div className="space-y-3">
            {corners.map((corner, index) => (
              <div key={corner.id} className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-6 shrink-0 text-right">
                  {index + 1}.
                </span>
                <input
                  type="text"
                  placeholder="Latitude"
                  value={corner.lat}
                  onChange={(e) => handleCornerChange(corner.id, "lat", e.target.value)}
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Longitude"
                  value={corner.lng}
                  onChange={(e) => handleCornerChange(corner.id, "lng", e.target.value)}
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
                />
                {corners.length > 3 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCorner(corner.id)}
                    className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddCorner}
            className="mt-3 flex items-center gap-1.5 text-sm text-[#cfb991] hover:text-[#cfb991]/80 transition-colors"
          >
            <Plus size={14} />
            Add Corner
          </button>
        </section>
      </div>

      <div className="px-5 py-4 border-t border-zinc-800 space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeModal}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#cfb991] text-zinc-900 hover:bg-[#cfb991]/80 transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}
