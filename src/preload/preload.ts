import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@shared/types";
import type { AppState, TypelessApi } from "@shared/types";

const api: TypelessApi = {
  onStateUpdate(callback: (state: AppState) => void): void {
    ipcRenderer.on(IPC_CHANNELS.STATE_UPDATE, (_event, state: AppState) =>
      callback(state)
    );
  },

  onStartRecording(callback: () => void): void {
    ipcRenderer.on(IPC_CHANNELS.START_RECORDING, () => callback());
  },

  onStopRecording(callback: () => void): void {
    ipcRenderer.on(IPC_CHANNELS.STOP_RECORDING, () => callback());
  },

  sendAudioData(buffer: ArrayBuffer): void {
    ipcRenderer.send(IPC_CHANNELS.AUDIO_DATA, buffer);
  },

  sendMicReady(): void {
    ipcRenderer.send(IPC_CHANNELS.MIC_READY);
  },

  sendMicError(message: string): void {
    ipcRenderer.send(IPC_CHANNELS.MIC_ERROR, message);
  },
};

contextBridge.exposeInMainWorld("typeless", api);
