"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Plus, Trash2, X } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";

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
  const [shapeFile, setShapeFile] = useState<File | null>(null);
  const [corners, setCorners] = useState<CornerCoordinate[]>(() =>
    Array.from({ length: 4 }, (_, i) => createCorner(i))
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setShapeFile(file);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setShapeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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

  return (
    <>
      <div className="px-5 py-4 space-y-6">
        {/* Shapefile Upload */}
        <section>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Upload Shapefile</h3>
          <div
            className="relative flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 hover:border-[#cfb991]/50 bg-zinc-800/40 p-6 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} className="text-zinc-500" />
            {shapeFile ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-300 truncate max-w-[240px]">
                  {shapeFile.name}
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
                Click to upload <span className="text-zinc-600">(.shp, .zip)</span>
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".shp,.zip,.geojson,.kml"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-500 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

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
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-800">
        <button
          onClick={closeModal}
          className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-[#cfb991] text-zinc-900 hover:bg-[#cfb991]/80 transition-colors">
          Add Plot
        </button>
      </div>
    </>
  );
}
