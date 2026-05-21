"use client";

import { useSyncExternalStore, useCallback } from "react";

// ── Types ──

export interface FilterPreset {
  id: string;
  name: string;
  locationId: number;
  groupId: number;
  floors: string[];
  minCapacity: number;
  features: string[];
  onlyAvailable: boolean;
  onlyFavorites: boolean;
  sort: string;
  createdAt: number;
}

// ── Storage ──

const STORAGE_KEY = "ucsc-filter-presets";
const MAX_PRESETS = 10;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function readPresets(): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writePresets(presets: FilterPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)));
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return localStorage.getItem(STORAGE_KEY) || "[]";
}

function getServerSnapshot(): string {
  return "[]";
}

// ── Hook ──

export function useFilterPresets() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const presets: FilterPreset[] = JSON.parse(raw);

  const addPreset = useCallback((preset: Omit<FilterPreset, "id" | "createdAt">) => {
    const current = readPresets();
    const id = `preset-${Date.now()}`;
    writePresets([{ ...preset, id, createdAt: Date.now() }, ...current]);
  }, []);

  const removePreset = useCallback((id: string) => {
    writePresets(readPresets().filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    writePresets([]);
  }, []);

  return { presets, addPreset, removePreset, clearAll };
}
