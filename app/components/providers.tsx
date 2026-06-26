"use client";

import { type ReactNode } from "react";
import { ModalProvider } from "./modal/modalContext";
import { PlotsProvider } from "./plotsContext";
import { VoiceCommandProvider } from "./voiceCommandContext";
import { WebSocketProvider } from "./webSocketContext";
import ModalShell from "./modal/modalShell";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ModalProvider>
      <PlotsProvider>
        <VoiceCommandProvider>
          <WebSocketProvider>
            {children}
            <ModalShell />
          </WebSocketProvider>
        </VoiceCommandProvider>
      </PlotsProvider>
    </ModalProvider>
  );
}
