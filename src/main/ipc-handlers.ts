import { ipcMain, BrowserWindow } from "electron";
import { IPC_CHANNELS } from "@shared/types";
import { stateMachine } from "./state-machine";
import { transcribe } from "./api";
import { pasteText } from "./clipboard-output";

export function registerIpcHandlers(capsule: BrowserWindow): void {
  broadcastStateOnTransition(capsule);
  handleAudioData(capsule);
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

function handleAudioData(capsule: BrowserWindow): void {
  ipcMain.on(IPC_CHANNELS.AUDIO_DATA, (_event, buffer: ArrayBuffer) => {
    const state = stateMachine.getState();
    if (state.status !== "processing") return;

    const mode = state.mode;

    transcribe(buffer, mode)
      .then((text) => {
        stateMachine.send({ type: "API_SUCCESS", text });
        if (text.trim() !== "") {
          return pasteText(text);
        }
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        stateMachine.send({ type: "API_FAILURE", message });
      });
  });
}
