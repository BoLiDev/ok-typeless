export type RecordingMode = "transcribe" | "translate";

export type AppState =
  | { status: "idle" }
  | { status: "connecting"; mode: RecordingMode }
  | { status: "recording"; mode: RecordingMode }
  | { status: "processing"; mode: RecordingMode }
  | { status: "error"; message: string };

export const IPC_CHANNELS = {
  /** Main → Renderer: push full AppState on every transition */
  STATE_UPDATE: "state-update",
  /** Main → Renderer: begin audio capture */
  START_RECORDING: "start-recording",
  /** Main → Renderer: stop recorder and send audio */
  STOP_RECORDING: "stop-recording",
  /** Renderer → Main: assembled audio ArrayBuffer (manual or VAD auto-stop) */
  AUDIO_DATA: "audio-data",
  /** Renderer → Main: mic stream acquired successfully */
  MIC_READY: "mic-ready",
  /** Renderer → Main: mic failed or timed out */
  MIC_ERROR: "mic-error",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type ProviderName = "groq" | "openai";

export type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  sttModel: string;
  llmModel: string;
};

export type TypelessApi = {
  onStateUpdate: (callback: (state: AppState) => void) => void;
  onStartRecording: (callback: () => void) => void;
  onStopRecording: (callback: () => void) => void;
  sendAudioData: (buffer: ArrayBuffer) => void;
  sendMicReady: () => void;
  sendMicError: (message: string) => void;
};

declare global {
  interface Window {
    typeless: TypelessApi;
  }
}
