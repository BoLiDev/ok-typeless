// ─── App State ───────────────────────────────────────────────────────────────

export type RecordingMode = "transcribe" | "translate";

export type AppState =
  | { status: "idle" }
  | { status: "connecting"; mode: RecordingMode }
  | { status: "recording"; mode: RecordingMode }
  | { status: "processing"; mode: RecordingMode }
  | { status: "error"; message: string };

// ─── IPC Channels ────────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  /** Main → Renderer: push full AppState on every transition */
  STATE_UPDATE: "state-update",
  /** Main → Renderer: begin audio capture */
  START_RECORDING: "start-recording",
  /** Main → Renderer: stop recorder and send audio */
  STOP_RECORDING: "stop-recording",
  /** Renderer → Main: assembled audio ArrayBuffer */
  AUDIO_DATA: "audio-data",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// ─── Provider Config ──────────────────────────────────────────────────────────

export type ProviderName = "groq" | "openai";

export type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  sttModel: string;
  llmModel: string;
};

// ─── Window API (exposed via contextBridge) ───────────────────────────────────

export type TypelessApi = {
  onStateUpdate: (callback: (state: AppState) => void) => void;
  onStartRecording: (callback: () => void) => void;
  onStopRecording: (callback: () => void) => void;
  sendAudioData: (buffer: ArrayBuffer) => void;
};

declare global {
  interface Window {
    typeless: TypelessApi;
  }
}
