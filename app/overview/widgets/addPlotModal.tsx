"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Plus, Trash2, X, Loader2, FileCheck, MapPin } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import { addDocument, collections } from "../../../lib/firestore";
import { parseKml, type ParsedPolygon } from "../../../lib/kmlParser";

interface CornerCoordinate {
  id: string;
  lat: string;
  lng: string;
}

function createCorner(index: number): CornerCoordinate {
  return { id: `corner-${Date.now()}-${index}`, lat: "", lng: "" };
}

export default function AddPlotContent() {
  const { closeModal } = useModal();
  const [plotName, setPlotName] = useState("");
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [kmlPolygons, setKmlPolygons] = useState<ParsedPolygon[]>([]);
  const [kmlError, setKmlError] = useState<string | null>(null);
  const [corners, setCorners] = useState<CornerCoordinate[]>(() =>
    Array.from({ length: 4 }, (_, i) => createCorner(i))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- KML file handling ---- */
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setKmlFile(file);
    setKmlPolygons([]);
    setKmlError(null);

    if (!file) return;

    try {
      const text = await file.text();
      const polygons = parseKml(text);

      if (polygons.length === 0) {
        setKmlError("No polygon Placemarks found in this KML file.");
        return;
      }

      setKmlPolygons(polygons);
    } catch (err) {
      console.error("KML parse error:", err);
      setKmlError(err instanceof Error ? err.message : "Failed to parse KML file.");
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setKmlFile(null);
    setKmlPolygons([]);
    setKmlError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /* ---- Manual corner handling ---- */
  const handleCornerChange = useCallback(
    (id: string, field: "lat" | "lng", value: string) => {
      setCorners((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  const handleAddCorner = useCallback(() => {
    setCorners((prev) => [...prev, createCorner(prev.length)]);
  }, []);

  const handleRemoveCorner = useCallback((id: string) => {
    setCorners((prev) => (prev.length <= 3 ? prev : prev.filter((c) => c.id !== id)));
  }, []);

  /* ---- Submit ---- */
  const handleSubmit = useCallback(async () => {
    setError(null);

    // ---- Path A: KML file with parsed polygons ----
    if (kmlPolygons.length > 0) {
      setIsSaving(true);
      try {
        for (const poly of kmlPolygons) {
          await addDocument(collections.plots, {
            name: poly.name,
            corners: poly.corners,
            createdAt: new Date().toISOString(),
          });
        }
        closeModal();
      } catch (err) {
        console.error("Failed to save KML plots:", err);
        setError("Failed to save plots. Please try again.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ---- Path B: Manual coordinates ----
    if (plotName.trim() === "") {
      setError("Please enter a plot name.");
      return;
    }

    const filledCorners = corners.filter((c) => c.lat.trim() !== "" || c.lng.trim() !== "");
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
      await addDocument(collections.plots, {
        name: plotName.trim(),
        corners: parsed,
        createdAt: new Date().toISOString(),
      });
      closeModal();
    } catch (err) {
      console.error("Failed to save plot:", err);
      setError("Failed to save plot. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [plotName, corners, kmlPolygons, closeModal]);

  const hasKmlData = kmlPolygons.length > 0;

  return (
    <>
      <div className="px-5 py-4 space-y-6">
        {/* KML File Upload */}
        <section>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Upload KML File</h3>
          <div
            className="relative flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 hover:border-[#cfb991]/50 bg-zinc-800/40 p-6 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} className="text-zinc-500" />
            {kmlFile ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-300 truncate max-w-[240px]">
                  {kmlFile.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                  className="p-0.5 rounded text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <span className="text-sm text-zinc-500">
                Click to upload <span className="text-zinc-600">(.kml)</span>
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".kml"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* KML parse error */}
          {kmlError && (
            <p className="mt-2 text-sm text-red-400">{kmlError}</p>
          )}

          {/* KML parsed polygons preview */}
          {hasKmlData && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <FileCheck size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">
                  Found {kmlPolygons.length} polygon{kmlPolygons.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                {kmlPolygons.map((poly, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-800/60 text-sm"
                  >
                    <MapPin size={14} className="text-zinc-400 shrink-0" />
                    <span className="text-zinc-200 truncate">{poly.name}</span>
                    <span className="ml-auto text-xs text-zinc-500 shrink-0">
                      {poly.corners.length} pts
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Divider */}
        {!hasKmlData && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">or enter manually</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Plot Name */}
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

            {/* Corner Coordinates */}
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
                onClick={handleAddCorner}
                className="mt-3 flex items-center gap-1.5 text-sm text-[#cfb991] hover:text-[#cfb991]/80 transition-colors"
              >
                <Plus size={14} />
                Add Corner
              </button>
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800 space-y-3">
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={closeModal}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#cfb991] text-zinc-900 hover:bg-[#cfb991]/80 transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {isSaving
              ? "Saving..."
              : hasKmlData
                ? `Import ${kmlPolygons.length} Plot${kmlPolygons.length !== 1 ? "s" : ""}`
                : "Add Plot"}
          </button>
        </div>
      </div>
    </>
  );
}
