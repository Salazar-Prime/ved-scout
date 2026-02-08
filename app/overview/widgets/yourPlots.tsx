"use client";

import { Plus } from "lucide-react";
import { useModal } from "../../components/modal/modalContext";
import AddPlotContent from "./addPlotModal";

export default function YourPlots() {
  const { openModal } = useModal();

  const handleAddPlot = () => {
    openModal({
      title: "Add New Plot",
      content: <AddPlotContent />,
      size: "lg",
    });
  };

  return (
    <div className="relative flex items-center justify-center h-full text-zinc-500 text-sm">
      <span>No plots yet</span>

      {/* Floating add button */}
      <button
        onClick={handleAddPlot}
        className="absolute bottom-2 right-2 p-2 rounded-full bg-[#cfb991] text-zinc-900 shadow-lg hover:bg-[#cfb991]/80 transition-colors"
        aria-label="Add plot"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
