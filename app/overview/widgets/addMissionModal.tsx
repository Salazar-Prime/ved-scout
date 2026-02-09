"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import { addDocument, updateDocument, fetchCollection, collections } from "../../../lib/firestore";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MissionType = "mapping" | "dsm" | "imagePoint" | "recordVideo";

export const missionTypeLabels: Record<MissionType, string> = {
  mapping: "Mapping",
  dsm: "DSM",
  imagePoint: "Image Point",
  recordVideo: "Record Video",
};

interface CameraSensor {
  id: string;
  name: string;
}

export interface EditableMission {
  id: string;
  name: string;
  cameraId: string;
  cameraName: string;
  type: MissionType;
  frontOverlap: number;
  sideOverlap: number;
  flightHeight: number;
  flightSpeed: number;
}

interface MissionFormData {
  missionName: string;
  cameraId: string;
  type: MissionType;
  frontOverlap: string;
  sideOverlap: string;
  flightHeight: string;
  flightSpeed: string;
}

const initialFormData: MissionFormData = {
  missionName: "",
  cameraId: "",
  type: "mapping",
  frontOverlap: "",
  sideOverlap: "",
  flightHeight: "",
  flightSpeed: "",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface AddMissionContentProps {
  editMission?: EditableMission;
}

export default function AddMissionContent({ editMission }: AddMissionContentProps) {
  const isEditing = !!editMission;
  const { closeModal } = useModal();
  const [formData, setFormData] = useState<MissionFormData>(() =>
    editMission
      ? {
          missionName: editMission.name,
          cameraId: editMission.cameraId,
          type: editMission.type,
          frontOverlap: String(editMission.frontOverlap),
          sideOverlap: String(editMission.sideOverlap),
          flightHeight: String(editMission.flightHeight),
          flightSpeed: String(editMission.flightSpeed),
        }
      : initialFormData
  );
  const [cameras, setCameras] = useState<CameraSensor[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCollection<CameraSensor>(collections.cameraSensors)
      .then(setCameras)
      .catch((err) => console.error("Failed to load cameras:", err));
  }, []);

  const handleChange = useCallback(
    (key: keyof MissionFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (formData.missionName.trim() === "") {
      setError("Please enter a mission name.");
      return;
    }
    if (formData.cameraId === "") {
      setError("Please select a camera sensor.");
      return;
    }

    const numericFields: { key: keyof MissionFormData; label: string }[] = [
      { key: "frontOverlap", label: "Front Overlap" },
      { key: "sideOverlap", label: "Side Overlap" },
      { key: "flightHeight", label: "Flight Height" },
      { key: "flightSpeed", label: "Flight Speed" },
    ];

    for (const { key, label } of numericFields) {
      const val = (formData[key] as string).trim();
      if (val === "") {
        setError(`Please enter ${label}.`);
        return;
      }
      if (isNaN(parseFloat(val)) || parseFloat(val) <= 0) {
        setError(`${label} must be a positive number.`);
        return;
      }
    }

    const selectedCamera = cameras.find((c) => c.id === formData.cameraId);

    const payload = {
      name: formData.missionName.trim(),
      cameraId: formData.cameraId,
      cameraName: selectedCamera?.name ?? "",
      type: formData.type,
      frontOverlap: parseFloat(formData.frontOverlap),
      sideOverlap: parseFloat(formData.sideOverlap),
      flightHeight: parseFloat(formData.flightHeight),
      flightSpeed: parseFloat(formData.flightSpeed),
    };

    setIsSaving(true);
    try {
      if (isEditing && editMission) {
        await updateDocument(collections.missionTypes, editMission.id, payload);
      } else {
        await addDocument(collections.missionTypes, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }
      closeModal();
    } catch (err) {
      console.error("Failed to save mission:", err);
      setError("Failed to save mission. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [formData, cameras, closeModal, isEditing, editMission]);

  return (
    <>
      <div className="px-5 py-4 space-y-4">
        {/* Mission Name */}
        <section>
          <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
            Mission Name
          </label>
          <input
            type="text"
            placeholder="e.g. Field Survey Alpha"
            value={formData.missionName}
            onChange={(e) => handleChange("missionName", e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
          />
        </section>

        {/* Camera Sensor */}
        <section>
          <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
            Camera Sensor
          </label>
          <div className="relative">
            <select
              value={formData.cameraId}
              onChange={(e) => handleChange("cameraId", e.target.value)}
              className="w-full appearance-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 pr-8 text-sm text-zinc-200 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
            >
              <option value="" disabled>
                Select a camera…
              </option>
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id}>
                  {cam.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
          </div>
          {cameras.length === 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              No cameras found. Add one in the Camera Sensors pane first.
            </p>
          )}
        </section>

        {/* Mission Type */}
        <section>
          <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
            Type
          </label>
          <div className="relative">
            <select
              value={formData.type}
              onChange={(e) => handleChange("type", e.target.value)}
              className="w-full appearance-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 pr-8 text-sm text-zinc-200 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
            >
              {(Object.entries(missionTypeLabels) as [MissionType, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
          </div>
        </section>

        {/* Numeric fields – two per row */}
        <div className="grid grid-cols-2 gap-4">
          <section>
            <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
              Front Overlap
              <span className="ml-1 text-xs text-zinc-500 font-normal">(%)</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 80"
              value={formData.frontOverlap}
              onChange={(e) => handleChange("frontOverlap", e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
            />
          </section>

          <section>
            <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
              Side Overlap
              <span className="ml-1 text-xs text-zinc-500 font-normal">(%)</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 80"
              value={formData.sideOverlap}
              onChange={(e) => handleChange("sideOverlap", e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
            />
          </section>

          <section>
            <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
              Flight Height
              <span className="ml-1 text-xs text-zinc-500 font-normal">(m)</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 10"
              value={formData.flightHeight}
              onChange={(e) => handleChange("flightHeight", e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
            />
          </section>

          <section>
            <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
              Flight Speed
              <span className="ml-1 text-xs text-zinc-500 font-normal">(m/s)</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 1"
              value={formData.flightSpeed}
              onChange={(e) => handleChange("flightSpeed", e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
            />
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800 space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}
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
            {isSaving ? "Saving..." : isEditing ? "Update Mission" : "Add Mission"}
          </button>
        </div>
      </div>
    </>
  );
}
