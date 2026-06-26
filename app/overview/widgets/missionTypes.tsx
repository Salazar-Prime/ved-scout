"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Plus, Crosshair, Loader2, Pencil } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import { db } from "../../../lib/firebase";
import { collections } from "../../../lib/firestore";
import AddMissionContent, { missionTypeLabels, type MissionType, type EditableMission } from "./addMissionModal";
import ScrollableList, { type ListItem } from "../../components/scrollableList";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MissionDoc {
  id: string;
  name: string;
  cameraId: string;
  cameraName: string;
  type: MissionType;
  frontOverlap: number;
  sideOverlap: number;
  flightHeight: number;
  flightSpeed: number;
  createdAt?: string;
}

export default function MissionTypes() {
  const { openModal } = useModal();
  const [missions, setMissions] = useState<MissionDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, collections.missionTypes),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as MissionDoc[];
        setMissions(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error("Failed to listen to mission types:", err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleAddMission = () => {
    openModal({
      title: "Add Mission Type",
      content: <AddMissionContent />,
      size: "lg",
    });
  };

  const handleEditMission = (m: MissionDoc) => {
    const editData: EditableMission = {
      id: m.id,
      name: m.name,
      cameraId: m.cameraId,
      cameraName: m.cameraName,
      type: m.type,
      frontOverlap: m.frontOverlap,
      sideOverlap: m.sideOverlap,
      flightHeight: m.flightHeight,
      flightSpeed: m.flightSpeed,
    };
    openModal({
      title: "Edit Mission Type",
      content: <AddMissionContent editMission={editData} />,
      size: "lg",
    });
  };

  /* ---- Map docs → list items ---- */
  const listItems: ListItem[] = missions.map((m) => {
    const typeLabel = missionTypeLabels[m.type] ?? m.type;
    const subtitle = [
      typeLabel,
      `${m.frontOverlap}/${m.sideOverlap}% overlap`,
      `${m.flightHeight}m`,
      `${m.flightSpeed}m/s`,
      m.cameraName || undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      id: m.id,
      title: m.name || "Unnamed Mission",
      subtitle,
      leading: <Crosshair size={16} className="text-[#cfb991]" />,
      trailing: (
        <button
          onClick={() => handleEditMission(m)}
          className="p-1.5 rounded-md text-zinc-500 hover:text-[#cfb991] hover:bg-zinc-800 transition-colors"
          aria-label={`Edit ${m.name}`}
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
          emptyMessage="No mission types yet"
        />
      )}

      {/* Floating add button */}
      <button
        onClick={handleAddMission}
        className="absolute bottom-2 right-2 p-2 rounded-full bg-[#cfb991] text-zinc-900 shadow-lg hover:bg-[#cfb991]/80 transition-colors z-10"
        aria-label="Add mission type"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
