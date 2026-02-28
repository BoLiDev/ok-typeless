import { ipcMain, BrowserWindow } from "electron";
import { AppState, IPC_CHANNELS } from "@shared/types";
import { stateMachine } from "./state-machine";
import { transcribe } from "./llm/api";
import { pasteText } from "./clipboard-output";
import { saveRecording, writeLogEntry } from "./session-logger";
import { getSettings } from "./settings-store";
import { spawn } from "child_process";
import { join } from "path";

export function playLaunchCue(): void {
  const audioPath = join(__dirname, "../../audio/launch.mp3");
  const proc = spawn("afplay", [audioPath]);
  proc.on("error", (err) => console.error("[launch-cue]", err));
}

export function registerIpcHandlers(capsule: BrowserWindow): void {
  broadcastStateOnTransition(capsule);
  broadcastInitialSettings(capsule);
  handleMicReady();
  handleMicError();
  handleAudioData();
}

function broadcastStateOnTransition(capsule: BrowserWindow): void {
  let prevStatus: AppState["status"] = "idle";

  stateMachine.subscribe((state) => {
    capsule.webContents.send(IPC_CHANNELS.STATE_UPDATE, state);

    if (state.status === "connecting") {
      capsule.webContents.send(IPC_CHANNELS.START_RECORDING);
    }

    const wasActive = prevStatus === "connecting" || prevStatus === "recording";
    const isActive =
      state.status === "connecting" || state.status === "recording";

    if (wasActive && !isActive) {
      capsule.webContents.send(IPC_CHANNELS.STOP_RECORDING);
    }

    prevStatus = state.status;
  });
}

function broadcastInitialSettings(capsule: BrowserWindow): void {
  capsule.webContents.on("did-finish-load", () => {
    capsule.webContents.send(IPC_CHANNELS.SETTINGS_UPDATE, getSettings());
  });
}

function handleMicReady(): void {
  ipcMain.on(IPC_CHANNELS.MIC_READY, () => {
    if (stateMachine.getState().status !== "connecting") return;
    playLaunchCue();
    stateMachine.send({ type: "MIC_READY" });
  });
}

function handleMicError(): void {
  ipcMain.on(IPC_CHANNELS.MIC_ERROR, (_event, message: string) => {
    stateMachine.send({ type: "MIC_FAILED", message });
  });
}

function handleAudioData(): void {
  ipcMain.on(IPC_CHANNELS.AUDIO_DATA, (_event, buffer: ArrayBuffer) => {
    // VAD auto-stop arrives while still in `recording` — transition first.
    if (stateMachine.getState().status === "recording") {
      stateMachine.send({ type: "STOP_RECORDING" });
    }

    const state = stateMachine.getState();
    if (state.status !== "processing") return;

    const mode = state.mode;
    const audioPath = saveRecording(buffer);
    const { skipPostProcessing } = getSettings();

    transcribe(buffer, mode, "audio.webm", skipPostProcessing)
      .then((result) => {
        if (result.llmOut.trim() === "") {
          stateMachine.send({ type: "API_FAILURE", message: "Nothing heard" });
          return;
        }
        stateMachine.send({ type: "API_SUCCESS", text: result.llmOut });
        writeLogEntry({
          mode,
          audioPath,
          sttRaw: result.sttRaw,
          sttMs: result.sttMs,
          llmOut: result.llmOut,
          llmMs: result.llmMs,
          pastedText: result.llmOut,
        });
        return pasteText(result.llmOut);
      })
      .catch((err: unknown) => {
        console.error("[transcribe] API error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        stateMachine.send({ type: "API_FAILURE", message });
      });
  });
}
