"use client";

import { useEffect, useMemo, useState } from "react";

type StoredPagination = {
  page: number;
  pageSize: number;
};

function parseStored(value: string | null): StoredPagination | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredPagination>;
    const page = Number(parsed.page);
    const pageSize = Number(parsed.pageSize);
    if (!Number.isFinite(page) || page <= 0) return null;
    if (!Number.isFinite(pageSize) || pageSize <= 0) return null;
    return { page, pageSize };
  } catch {
    return null;
  }
}

export function usePersistentPagination(storageKey: string, defaultPage = 1, defaultPageSize = 10) {
  const key = useMemo(() => `pagination:${storageKey}`, [storageKey]);

  const [page, setPageState] = useState(defaultPage);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = parseStored(window.localStorage.getItem(key));
    if (stored) {
      setPageState(stored.page);
      setPageSizeState(stored.pageSize);
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: StoredPagination = {
      page: Math.max(1, page),
      pageSize: Math.max(1, pageSize),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, [key, page, pageSize]);

  const setPage = (next: number) => setPageState(Math.max(1, Number(next) || 1));
  const setPageSize = (next: number) => {
    const normalized = Math.max(1, Number(next) || defaultPageSize);
    setPageSizeState(normalized);
  };

  return { page, pageSize, setPage, setPageSize };
}
