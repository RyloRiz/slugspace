"use client";

import { useSyncExternalStore, useCallback } from "react";

// ── Storage ──

const STORAGE_KEY = "ucsc-room-notes";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

type NotesMap = Record<string, string>; // roomId -> note text

function readNotes(): NotesMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeNotes(notes: NotesMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "{}";
  return localStorage.getItem(STORAGE_KEY) || "{}";
}

function getServerSnapshot(): string {
  return "{}";
}

// ── Hook ──

export function useRoomNotes() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const notes: NotesMap = JSON.parse(raw);

  const getNote = useCallback(
    (roomId: number) => notes[String(roomId)] || "",
    [notes]
  );

  const setNote = useCallback((roomId: number, text: string) => {
    const current = readNotes();
    const trimmed = text.trim();
    if (trimmed) {
      current[String(roomId)] = trimmed;
    } else {
      delete current[String(roomId)];
    }
    writeNotes(current);
  }, []);

  const hasNote = useCallback(
    (roomId: number) => Boolean(notes[String(roomId)]),
    [notes]
  );

  const allNotes = notes;

  return { getNote, setNote, hasNote, allNotes };
}
