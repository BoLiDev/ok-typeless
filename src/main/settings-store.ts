import { app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";
import type { Settings } from "@shared/types";

const DEFAULTS: Settings = { skipPostProcessing: false };

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

export function getSettings(): Settings {
  try {
    const raw = readFileSync(settingsPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): void {
  const current = getSettings();
  writeFileSync(settingsPath(), JSON.stringify({ ...current, ...patch }, null, 2), "utf-8");
}
