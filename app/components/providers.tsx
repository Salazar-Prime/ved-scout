"use client";

import { type ReactNode } from "react";
import { ModalProvider } from "./modal/modalContext";
import { PlotsProvider } from "./plotsContext";
import { VoiceCommandProvider } from "./voiceCommandContext";
import ModalShell from "./modal/modalShell";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ModalProvider>
      <PlotsProvider>
        <VoiceCommandProvider>
          {children}
          <ModalShell />
        </VoiceCommandProvider>
      </PlotsProvider>
    </ModalProvider>
  );
}
