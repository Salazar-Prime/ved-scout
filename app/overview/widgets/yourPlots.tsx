"use client";

import { useEffect, useState } from "react";
import { Plus, MapPin, Loader2 } from "lucide-react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { collections } from "../../../lib/firestore";
import { useModal } from "../../components/modal/modalContext";
import AddPlotContent from "./addPlotModal";
import ScrollableList, { type ListItem } from "../../components/scrollableList";

interface PlotCorner {
  lat: number;
  lng: number;
}

interface PlotDoc {
  id: string;
  name?: string;
  corners: PlotCorner[];
  createdAt?: string;
}

export default function YourPlots() {
  const { openModal } = useModal();
  const [plots, setPlots] = useState<PlotDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Real-time listener – auto-updates when plots are added/removed
  useEffect(() => {
    const q = query(
      collection(db, collections.plots),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PlotDoc[];
        setPlots(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error("Failed to listen to plots:", err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAddPlot = () => {
    openModal({
      title: "Add New Plot",
      content: <AddPlotContent />,
      size: "lg",
    });
  };

  // Map Firestore docs → ListItem[]
  const listItems: ListItem[] = plots.map((plot) => {
    const cornerCount = plot.corners?.length ?? 0;
    const plotName = plot.name?.trim() || `Unnamed Plot`;
    const dateLabel = plot.createdAt
      ? new Date(plot.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
    const subtitle = [
      `${cornerCount} corner${cornerCount !== 1 ? "s" : ""}`,
      dateLabel,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      id: plot.id,
      title: plotName,
      subtitle,
      leading: <MapPin size={16} />,
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
          emptyMessage="No plots yet"
        />
      )}

      {/* Floating add button */}
      <button
        onClick={handleAddPlot}
        className="absolute bottom-2 right-2 p-2 rounded-full bg-[#cfb991] text-zinc-900 shadow-lg hover:bg-[#cfb991]/80 transition-colors z-10"
        aria-label="Add plot"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
