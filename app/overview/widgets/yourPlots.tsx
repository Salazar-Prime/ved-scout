"use client";

import { Plus, MapPin, Loader2 } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import { usePlots } from "../../components/plotsContext";
import AddPlotContent from "./addPlotModal";
import ScrollableList, { type ListItem } from "../../components/scrollableList";

export default function YourPlots() {
  const { openModal } = useModal();
  const { plots, isLoading } = usePlots();

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
    const plotName = plot.name?.trim() || "Unnamed Plot";
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
