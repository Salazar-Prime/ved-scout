"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative z-0 flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
