"use client";

import { type ReactNode } from "react";
import { ModalProvider } from "./modal/modalContext";
import { PlotsProvider } from "./plotsContext";
import { WebSocketProvider } from "./webSocketContext";
import ModalShell from "./modal/modalShell";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ModalProvider>
      <PlotsProvider>
        <WebSocketProvider>
          {children}
          <ModalShell />
        </WebSocketProvider>
      </PlotsProvider>
    </ModalProvider>
  );
}
