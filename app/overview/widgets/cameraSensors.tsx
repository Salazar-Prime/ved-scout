"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Camera, Loader2, Pencil } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import { fetchCollection, collections } from "../../../lib/firestore";
import AddCameraContent, { type EditableCamera } from "./addCameraModal";
import ScrollableList, { type ListItem } from "../../components/scrollableList";

interface CameraSensor {
  id: string;
  name: string;
  imageWidth: number;
  imageHeight: number;
  focalLength: number;
  sensorWidth: number;
  createdAt?: string;
}

export default function CameraSensors() {
  const { openModal } = useModal();
  const [cameras, setCameras] = useState<CameraSensor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCameras = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await fetchCollection<CameraSensor>(collections.cameraSensors);
      setCameras(docs);
    } catch (err) {
      console.error("Failed to load camera sensors:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  const handleAddCamera = () => {
    openModal({
      title: "Add Camera Sensor",
      content: <AddCameraContent />,
      size: "md",
    });
  };

  const handleEditCamera = (cam: CameraSensor) => {
    const editData: EditableCamera = {
      id: cam.id,
      name: cam.name,
      imageWidth: cam.imageWidth,
      imageHeight: cam.imageHeight,
      focalLength: cam.focalLength,
      sensorWidth: cam.sensorWidth,
    };
    openModal({
      title: "Edit Camera Sensor",
      content: <AddCameraContent editCamera={editData} />,
      size: "md",
    });
  };

  const listItems: ListItem[] = cameras.map((cam) => {
    const subtitle = `${cam.imageWidth}×${cam.imageHeight}px · ${cam.focalLength}mm · Sensor ${cam.sensorWidth}mm`;
    return {
      id: cam.id,
      title: cam.name || "Unnamed Camera",
      subtitle,
      leading: <Camera size={16} className="text-[#cfb991]" />,
      trailing: (
        <button
          onClick={() => handleEditCamera(cam)}
          className="p-1.5 rounded-md text-zinc-500 hover:text-[#cfb991] hover:bg-zinc-800 transition-colors"
          aria-label={`Edit ${cam.name}`}
        >
          <Pencil size={14} />
        </button>
      ),
    };
  });

  return (
    <div className="relative h-full">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : (
        <ScrollableList
          items={listItems}
          emptyMessage="No camera sensors yet"
        />
      )}

      {/* Floating add button */}
      <button
        onClick={handleAddCamera}
        className="absolute bottom-2 right-2 p-2 rounded-full bg-[#cfb991] text-zinc-900 shadow-lg hover:bg-[#cfb991]/80 transition-colors z-10"
        aria-label="Add camera sensor"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
