"use client";

import { useCallback } from "react";
import { X } from "lucide-react";
import { useModal } from "./modalContext";

const sizeClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export default function ModalShell() {
  const { isOpen, options, closeModal } = useModal();

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) closeModal();
    },
    [closeModal]
  );

  if (!isOpen || !options) return null;

  const size = sizeClasses[options.size ?? "lg"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full ${size} mx-4 max-h-[85vh] flex flex-col rounded-xl border border-[#cfb991]/40 bg-zinc-900 shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-bold text-zinc-200">{options.title}</h2>
          <button
            onClick={closeModal}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {options.content}
        </div>
      </div>
    </div>
  );
}
