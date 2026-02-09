"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface VoiceCommandContextValue {
  shouldAutoRecord: boolean;
  triggerAutoRecord: () => void;
  clearAutoRecord: () => void;
}

const VoiceCommandContext = createContext<VoiceCommandContextValue | null>(null);

export function VoiceCommandProvider({ children }: { children: ReactNode }) {
  const [shouldAutoRecord, setShouldAutoRecord] = useState(false);

  const triggerAutoRecord = useCallback(() => {
    setShouldAutoRecord(true);
  }, []);

  const clearAutoRecord = useCallback(() => {
    setShouldAutoRecord(false);
  }, []);

  return (
    <VoiceCommandContext.Provider
      value={{ shouldAutoRecord, triggerAutoRecord, clearAutoRecord }}
    >
      {children}
    </VoiceCommandContext.Provider>
  );
}

export function useVoiceCommand() {
  const ctx = useContext(VoiceCommandContext);
  if (!ctx) {
    throw new Error("useVoiceCommand must be used within a VoiceCommandProvider");
  }
  return ctx;
}
