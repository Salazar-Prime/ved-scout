"use client";

import { useState } from "react";
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

const navItems = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
  { name: "Live Missions", href: "/live-missions", icon: Radio },
  { name: "Flight History", href: "/flight-history", icon: History },
];

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleVoiceCommand = () => {
    router.push("/overview?autoRecord=true");
  };

  return (
    <aside
      className={`flex flex-col h-screen bg-zinc-900 text-zinc-300 border-r border-zinc-800 transition-all duration-300 ${
        isExpanded ? "w-60" : "w-16"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-zinc-800">
        {isExpanded && (
          <span className="text-sm font-semibold text-white tracking-wide truncate">
            Ved Scout
          </span>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors ml-auto"
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? (
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
            ${!isExpanded ? "justify-center" : ""}`}
          title={!isExpanded ? "Voice Command" : undefined}
        >
          <Mic size={22} className="shrink-0" />
          {isExpanded && (
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#cfb991]/10 text-[#cfb991] border border-[#cfb991]/30"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent"
              } ${!isExpanded ? "justify-center" : ""}`}
              title={!isExpanded ? item.name : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {isExpanded && (
                <span className="truncate">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
