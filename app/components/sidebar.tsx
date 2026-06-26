"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  History,
  MapPin,
  Camera,
  Crosshair,
  Plug,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Wrench,
  MessageSquare,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Home",
    items: [
      { name: "Overview", href: "/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Setup",
    items: [
      { name: "Plots", href: "/your-plots", icon: MapPin },
      { name: "Cameras", href: "/camera-sensors", icon: Camera },
      { name: "Mission types", href: "/mission-types", icon: Crosshair },
    ],
  },
  {
    label: "Operations",
    items: [
      { name: "Flight script", href: "/flight-script", icon: Terminal },
      { name: "Live missions", href: "/live-missions", icon: Radio },
    ],
  },
  {
    label: "History",
    items: [
      { name: "Flight history", href: "/flight-history", icon: History },
      { name: "Saved chats", href: "/saved-chats", icon: MessageSquare },
    ],
  },
];

const devNavGroup: NavGroup = {
  label: "Dev",
  items: [
    { name: "WebSocket", href: "/websocket-connect", icon: Plug },
    { name: "Dev WS chat", href: "/dev-ws-chat", icon: Wrench },
  ],
};

const visibleNavGroups =
  process.env.NODE_ENV === "production"
    ? navGroups
    : [...navGroups, devNavGroup];

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
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

      {/* Navigation */}
      <nav className="flex-1 flex flex-col p-2 mt-1 overflow-y-auto">
        {visibleNavGroups.map((group, groupIndex) => (
          <div
            key={group.label}
            className={groupIndex > 0 ? "mt-3" : ""}
          >
            {expanded ? (
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {group.label}
              </p>
            ) : (
              groupIndex > 0 && (
                <div className="mx-2 mb-2 border-t border-zinc-800" />
              )
            )}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
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
            </div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="p-2 border-t border-zinc-800">
        <button
          onClick={handleSignOut}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500
            hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors cursor-pointer
            ${!expanded ? "justify-center" : ""}`}
          title={!expanded ? "Sign out" : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {expanded && <span className="truncate">Sign out</span>}
        </button>
      </div>
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
