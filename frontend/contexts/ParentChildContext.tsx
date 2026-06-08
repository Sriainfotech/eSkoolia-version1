"use client";

/**
 * ParentChildContext
 *
 * Single source of truth for the parent portal's "which child am I viewing?"
 * state. Loaded once at layout level; all pages consume via useParentChild().
 *
 * Persistence: selected child id is stored in localStorage so the choice
 * survives page refreshes. If the stored id is no longer valid (child was
 * removed), falls back to the first child in the list.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchParentMe, type ChildSummary, type ParentMe } from "@/lib/api/parent";

const STORAGE_KEY = "parent_selected_child_id";

interface ParentChildContextValue {
  me: ParentMe | null;
  children: ChildSummary[];
  selectedChild: ChildSummary | null;
  setSelectedChildId: (id: number) => void;
  loading: boolean;
}

const ParentChildContext = createContext<ParentChildContextValue>({
  me: null,
  children: [],
  selectedChild: null,
  setSelectedChildId: () => {},
  loading: true,
});

export function ParentChildProvider({ children: reactChildren }: { children: ReactNode }) {
  const [me, setMe] = useState<ParentMe | null>(null);
  const [selectedChildId, setSelectedChildIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParentMe()
      .then((data) => {
        setMe(data);

        // Restore from localStorage if valid, else default to first child
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedId = stored ? parseInt(stored, 10) : null;
        const validId =
          data.children.find((c) => c.id === storedId)?.id ??
          data.children[0]?.id ??
          null;
        setSelectedChildIdState(validId);
      })
      .catch(() => {
        // Keep loading=true so pages show an error state via me===null
      })
      .finally(() => setLoading(false));
  }, []);

  function setSelectedChildId(id: number) {
    setSelectedChildIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }

  const childList = me?.children ?? [];
  const selectedChild = childList.find((c) => c.id === selectedChildId) ?? null;

  return (
    <ParentChildContext.Provider
      value={{ me, children: childList, selectedChild, setSelectedChildId, loading }}
    >
      {reactChildren}
    </ParentChildContext.Provider>
  );
}

export function useParentChild() {
  return useContext(ParentChildContext);
}
