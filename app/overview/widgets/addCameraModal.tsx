"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import { addDocument, updateDocument, collections } from "../../../lib/firestore";

export interface EditableCamera {
  id: string;
  name: string;
  imageWidth: number;
  imageHeight: number;
  focalLength: number;
  sensorWidth: number;
}

interface CameraFormData {
  cameraName: string;
  imageWidth: string;
  imageHeight: string;
  focalLength: string;
  sensorWidth: string;
}

const initialFormData: CameraFormData = {
  cameraName: "",
  imageWidth: "",
  imageHeight: "",
  focalLength: "",
  sensorWidth: "",
};

const fields: { key: keyof CameraFormData; label: string; placeholder: string; unit?: string }[] = [
  { key: "cameraName", label: "Camera Name", placeholder: "e.g. DJI Mavic 3 Multispectral" },
  { key: "imageWidth", label: "Image Width", placeholder: "e.g. 5280", unit: "px" },
  { key: "imageHeight", label: "Image Height", placeholder: "e.g. 3956", unit: "px" },
  { key: "focalLength", label: "Focal Length", placeholder: "e.g. 4.4", unit: "mm" },
  { key: "sensorWidth", label: "Sensor Width", placeholder: "e.g. 6.3", unit: "mm" },
];

interface AddCameraContentProps {
  editCamera?: EditableCamera;
}

export default function AddCameraContent({ editCamera }: AddCameraContentProps) {
  const isEditing = !!editCamera;
  const { closeModal } = useModal();
  const [formData, setFormData] = useState<CameraFormData>(() =>
    editCamera
      ? {
          cameraName: editCamera.name,
          imageWidth: String(editCamera.imageWidth),
          imageHeight: String(editCamera.imageHeight),
          focalLength: String(editCamera.focalLength),
          sensorWidth: String(editCamera.sensorWidth),
        }
      : initialFormData
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((key: keyof CameraFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (formData.cameraName.trim() === "") {
      setError("Please enter a camera name.");
      return;
    }

    const numericFields = [
      { key: "imageWidth" as const, label: "Image Width" },
      { key: "imageHeight" as const, label: "Image Height" },
      { key: "focalLength" as const, label: "Focal Length" },
      { key: "sensorWidth" as const, label: "Sensor Width" },
    ];

    for (const { key, label } of numericFields) {
      const val = formData[key].trim();
      if (val === "") {
        setError(`Please enter ${label}.`);
        return;
      }
      if (isNaN(parseFloat(val)) || parseFloat(val) <= 0) {
        setError(`${label} must be a positive number.`);
        return;
      }
    }

    const payload = {
      name: formData.cameraName.trim(),
      imageWidth: parseFloat(formData.imageWidth),
      imageHeight: parseFloat(formData.imageHeight),
      focalLength: parseFloat(formData.focalLength),
      sensorWidth: parseFloat(formData.sensorWidth),
    };

    setIsSaving(true);
    try {
      if (isEditing && editCamera) {
        await updateDocument(collections.cameraSensors, editCamera.id, payload);
      } else {
        await addDocument(collections.cameraSensors, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }
      closeModal();
    } catch (err) {
      console.error("Failed to save camera sensor:", err);
      setError("Failed to save camera sensor. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [formData, closeModal, isEditing, editCamera]);

  return (
    <>
      <div className="px-5 py-4 space-y-4">
        {fields.map(({ key, label, placeholder, unit }) => (
          <section key={key}>
            <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
              {label}
              {unit && <span className="ml-1 text-xs text-zinc-500 font-normal">({unit})</span>}
            </label>
            <input
              type={key === "cameraName" ? "text" : "number"}
              placeholder={placeholder}
              value={formData[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#cfb991]/50 transition-colors"
            />
          </section>
        ))}
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
            {isSaving ? "Saving..." : isEditing ? "Update Camera" : "Add Camera"}
          </button>
        </div>
      </div>
    </>
  );
}
