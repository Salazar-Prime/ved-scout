"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Crosshair, Loader2, Pencil } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import {
  fetchCollection,
  addDocument,
  collections,
} from "../../../lib/firestore";
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

/* ------------------------------------------------------------------ */
/*  Default missions to seed on first load                             */
/* ------------------------------------------------------------------ */

const defaultMissions: Omit<MissionDoc, "id">[] = [
  {
    name: "Survey",
    cameraId: "",
    cameraName: "Zenmuse P1 (Image)",
    type: "mapping",
    frontOverlap: 80,
    sideOverlap: 80,
    flightHeight: 10,
    flightSpeed: 1,
    createdAt: new Date().toISOString(),
  },
  {
    name: "Point of Interest",
    cameraId: "",
    cameraName: "Zenmuse P1 (Image)",
    type: "imagePoint",
    frontOverlap: 100,
    sideOverlap: 100,
    flightHeight: 10,
    flightSpeed: 1,
    createdAt: new Date().toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MissionTypes() {
  const { openModal } = useModal();
  const [missions, setMissions] = useState<MissionDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMissions = useCallback(async () => {
    setIsLoading(true);
    try {
      let docs = await fetchCollection<MissionDoc>(collections.missionTypes);

      /* Seed any missing defaults */
      const existingNames = new Set(docs.map((d) => d.name));
      const missing = defaultMissions.filter((m) => !existingNames.has(m.name));

      if (missing.length > 0) {
        for (const mission of missing) {
          await addDocument(collections.missionTypes, {
            ...mission,
            createdAt: new Date().toISOString(),
          });
        }
        docs = await fetchCollection<MissionDoc>(collections.missionTypes);
      }

      setMissions(docs);
    } catch (err) {
      console.error("Failed to load missions:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMissions();
  }, [loadMissions]);

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
