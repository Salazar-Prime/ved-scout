"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Mic,
  LayoutDashboard,
  Radio,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useVoiceCommand } from "./voiceCommandContext";

const navItems = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
  { name: "Live Missions", href: "/live-missions", icon: Radio },
  { name: "Flight History", href: "/flight-history", icon: History },
];

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { triggerAutoRecord } = useVoiceCommand();

  // Two-phase animation: mount overlay first, then animate in
  useEffect(() => {
    if (isExpanded) {
      // Mount, then trigger CSS transition on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
    }
  }, [isExpanded]);

  const handleTransitionEnd = () => {
    // Unmount overlay after slide-out completes
    // (handled by keeping isExpanded true until animation finishes)
  };

  const handleClose = () => {
    setIsVisible(false);
    // Wait for the transition to finish before unmounting
    setTimeout(() => setIsExpanded(false), 300);
  };

  const handleVoiceCommand = () => {
    triggerAutoRecord();
    if (pathname !== "/overview") {
      router.push("/overview");
    }
    handleClose();
  };

  const sidebarContent = (expanded: boolean) => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-zinc-800">
        {expanded && (
          <span className="text-sm font-semibold text-white tracking-wide truncate">
            Ved Scout
          </span>
        )}
        <button
          onClick={() => (expanded ? handleClose() : setIsExpanded(true))}
          className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors ml-auto cursor-pointer"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <ChevronLeft size={18} />
          ) : (
            <ChevronRight size={18} />
          )}
        </button>
      </div>

      {/* Voice Command — bold prominent button */}
      <div className="p-2 mt-2">
        <button
          onClick={handleVoiceCommand}
          className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer
            bg-[#cfb991]/15 text-[#cfb991] border-2 border-[#cfb991]/40
            hover:bg-[#cfb991]/25 hover:border-[#cfb991]/60 hover:shadow-[0_0_20px_rgba(207,185,145,0.15)]
            active:scale-[0.97]
            ${!expanded ? "justify-center" : ""}`}
          title={!expanded ? "Voice Command" : undefined}
        >
          <Mic size={22} className="shrink-0" />
          {expanded && (
            <span className="truncate tracking-wide">Voice Command</span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-2 mt-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#cfb991]/10 text-[#cfb991] border border-[#cfb991]/30"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent"
              } ${!expanded ? "justify-center" : ""}`}
              title={!expanded ? item.name : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {expanded && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Collapsed sidebar — always in flow, never resizes content */}
      <aside className="flex flex-col w-16 shrink-0 h-screen bg-zinc-900 text-zinc-300 border-r border-zinc-800">
        {sidebarContent(false)}
      </aside>

      {/* Expanded overlay — smooth slide animation */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 transition-all duration-300 ease-in-out"
            style={{
              backgroundColor: isVisible ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0)",
              backdropFilter: isVisible ? "blur(4px)" : "blur(0px)",
            }}
            onClick={handleClose}
          />
          {/* Sliding panel */}
          <aside
            className="fixed top-0 left-0 z-50 flex flex-col w-60 h-screen bg-zinc-900 text-zinc-300 border-r border-zinc-800 shadow-2xl transition-transform duration-300 ease-in-out"
            style={{
              transform: isVisible ? "translateX(0)" : "translateX(-100%)",
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {sidebarContent(true)}
          </aside>
        </>
      )}
    </>
  );
}
