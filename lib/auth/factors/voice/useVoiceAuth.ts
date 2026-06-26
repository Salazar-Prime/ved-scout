"use client";

import { useState, useEffect } from "react";
import { AuthFactorState } from "../types";
import { VOICE_AUTH_STUB_ALWAYS_AUTHENTICATED } from "./voiceAuthStub";

export function useVoiceAuth(): AuthFactorState {
  const [state, setState] = useState<AuthFactorState>({ status: "idle" });

  useEffect(() => {
    if (VOICE_AUTH_STUB_ALWAYS_AUTHENTICATED) {
      setState({ status: "authenticated" });
    }
  }, []);

  return state;
}
