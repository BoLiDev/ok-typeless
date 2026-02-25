import { ipcMain, BrowserWindow } from "electron";
import { IPC_CHANNELS } from "@shared/types";
import { stateMachine } from "./state-machine";
import { transcribe } from "./api";
import { pasteText } from "./clipboard-output";

export function registerIpcHandlers(capsule: BrowserWindow): void {
  broadcastStateOnTransition(capsule);
  handleMicReady();
  handleMicError();
  handleAudioData();
}

function broadcastStateOnTransition(capsule: BrowserWindow): void {
  stateMachine.subscribe((state) => {
    capsule.webContents.send(IPC_CHANNELS.STATE_UPDATE, state);

    if (state.status === "connecting") {
      capsule.webContents.send(IPC_CHANNELS.START_RECORDING);
    }

    if (state.status === "processing") {
      capsule.webContents.send(IPC_CHANNELS.STOP_RECORDING);
    }
  });
}

function handleMicReady(): void {
  ipcMain.on(IPC_CHANNELS.MIC_READY, () => {
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

    transcribe(buffer, mode)
      .then((text) => {
        if (text.trim() === "") {
          stateMachine.send({ type: "API_FAILURE", message: "Nothing heard" });
          return;
        }
        stateMachine.send({ type: "API_SUCCESS", text });
        return pasteText(text);
      })
      .catch((err: unknown) => {
        console.error("[transcribe] API error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        stateMachine.send({ type: "API_FAILURE", message });
      });
  });
}
