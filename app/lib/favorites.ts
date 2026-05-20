"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ucsc-room-favorites";

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(STORAGE_KEY) || "[]";
}

function getServerSnapshot(): string {
  return "[]";
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns an array of favorited room IDs */
export function useFavorites() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ids: number[] = JSON.parse(raw);

  const isFavorite = useCallback(
    (roomId: number) => ids.includes(roomId),
    [ids]
  );

  const toggle = useCallback((roomId: number) => {
    const current: number[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const next = current.includes(roomId)
      ? current.filter((id) => id !== roomId)
      : [...current, roomId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitChange();
  }, []);

  const remove = useCallback((roomId: number) => {
    const current: number[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const next = current.filter((id) => id !== roomId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitChange();
  }, []);

  const clearAll = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "[]");
    emitChange();
  }, []);

  return { ids, isFavorite, toggle, remove, clearAll };
}
