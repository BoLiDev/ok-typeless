import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOGS_DIR = join(process.cwd(), "logs");
const RECORDINGS_DIR = join(LOGS_DIR, "recordings");
const LOG_FILE = join(LOGS_DIR, "typeless.log");

function ensureDirectories(): void {
  mkdirSync(LOGS_DIR, { recursive: true });
  mkdirSync(RECORDINGS_DIR, { recursive: true });
}

function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

function padThree(n: number): string {
  return String(n).padStart(3, "0");
}

function formatFileTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = padTwo(date.getMonth() + 1);
  const day = padTwo(date.getDate());
  const hours = padTwo(date.getHours());
  const minutes = padTwo(date.getMinutes());
  const seconds = padTwo(date.getSeconds());
  const ms = padThree(date.getMilliseconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}-${ms}`;
}

function formatLogTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = padTwo(date.getMonth() + 1);
  const day = padTwo(date.getDate());
  const hours = padTwo(date.getHours());
  const minutes = padTwo(date.getMinutes());
  const seconds = padTwo(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function saveRecording(buffer: ArrayBuffer): string {
  try {
    ensureDirectories();
    const filePath = join(
      RECORDINGS_DIR,
      `${formatFileTimestamp(new Date())}.webm`,
    );
    writeFileSync(filePath, Buffer.from(buffer));
    return filePath;
  } catch (err) {
    console.error("[session-logger] Failed to save recording:", err);
    return "";
  }
}

export type SessionLogEntry = {
  mode: string;
  audioPath: string;
  sttRaw: string;
  sttMs: number;
  llmOut: string;
  llmMs: number;
  pastedText: string;
};

export function writeLogEntry(entry: SessionLogEntry): void {
  try {
    ensureDirectories();
    const timestamp = formatLogTimestamp(new Date());
    const total = Math.round(entry.sttMs + entry.llmMs);
    const text =
      `[${timestamp}] ${entry.mode}\n` +
      `  audio:  ${entry.audioPath}\n` +
      `  stt:    "${entry.sttRaw}"  (${Math.round(entry.sttMs)}ms)\n` +
      `  llm:    "${entry.llmOut}"  (${Math.round(entry.llmMs)}ms)\n` +
      `  pasted: "${entry.pastedText}"  total: ${total}ms\n` +
      `---\n`;
    appendFileSync(LOG_FILE, text);
  } catch (err) {
    console.error("[session-logger] Failed to write log entry:", err);
  }
}
