"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { collections } from "../../lib/firestore";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PlotCorner {
  lat: number;
  lng: number;
}

export interface PlotDoc {
  id: string;
  name?: string;
  corners: PlotCorner[];
  createdAt?: string;
}

interface PlotsContextValue {
  plots: PlotDoc[];
  isLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const PlotsContext = createContext<PlotsContextValue>({
  plots: [],
  isLoading: true,
});

export function usePlots() {
  return useContext(PlotsContext);
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function PlotsProvider({ children }: { children: ReactNode }) {
  const [plots, setPlots] = useState<PlotDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, collections.plots),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PlotDoc[];
        setPlots(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error("Failed to listen to plots:", err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <PlotsContext.Provider value={{ plots, isLoading }}>
      {children}
    </PlotsContext.Provider>
  );
}
