import type { AppState, RecordingMode } from "@shared/types";

export type StateMachineEvent =
  | { type: "HOTKEY_TRANSCRIBE" }
  | { type: "HOTKEY_TRANSLATE" }
  | { type: "MIC_READY" }
  | { type: "MIC_FAILED"; message: string }
  | { type: "MIC_TIMEOUT" }
  | { type: "CANCEL" }
  | { type: "STOP_RECORDING" }
  | { type: "API_SUCCESS"; text: string }
  | { type: "API_FAILURE"; message: string }
  | { type: "ERROR_TIMEOUT" };

function transition(
  state: AppState,
  event: StateMachineEvent
): AppState | null {
  switch (state.status) {
    case "idle":
      if (event.type === "HOTKEY_TRANSCRIBE") {
        return { status: "connecting", mode: "transcribe" };
      }
      if (event.type === "HOTKEY_TRANSLATE") {
        return { status: "connecting", mode: "translate" };
      }
      return null;

    case "connecting": {
      const mode: RecordingMode = state.mode;
      if (event.type === "MIC_READY") {
        return { status: "recording", mode };
      }
      if (event.type === "MIC_FAILED") {
        return { status: "error", message: event.message };
      }
      if (event.type === "MIC_TIMEOUT") {
        return { status: "error", message: "Mic timeout" };
      }
      if (event.type === "CANCEL") {
        return { status: "idle" };
      }
      return null;
    }

    case "recording": {
      const mode: RecordingMode = state.mode;
      if (
        event.type === "STOP_RECORDING" ||
        event.type === "HOTKEY_TRANSCRIBE" ||
        event.type === "HOTKEY_TRANSLATE"
      ) {
        return { status: "processing", mode };
      }
      if (event.type === "CANCEL") {
        return { status: "idle" };
      }
      return null;
    }

    case "processing":
      if (event.type === "API_SUCCESS") {
        if (event.text.trim() === "") {
          return { status: "error", message: "Nothing heard" };
        }
        return { status: "idle" };
      }
      if (event.type === "API_FAILURE") {
        return { status: "error", message: event.message };
      }
      return null;

    case "error":
      if (event.type === "ERROR_TIMEOUT") {
        return { status: "idle" };
      }
      return null;
  }
}

type StateChangeListener = (state: AppState) => void;

export class StateMachine {
  private state: AppState = { status: "idle" };
  private listeners = new Set<StateChangeListener>();

  getState(): AppState {
    return this.state;
  }

  send(event: StateMachineEvent): void {
    const next = transition(this.state, event);
    if (next !== null) {
      this.state = next;
      this.listeners.forEach((l) => l(this.state));
    }
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const stateMachine = new StateMachine();
