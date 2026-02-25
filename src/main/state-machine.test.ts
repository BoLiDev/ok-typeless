import { describe, it, expect, beforeEach } from "vitest";
import { StateMachine } from "./state-machine";

// Each describe block corresponds to a "From" state in the transition table.
// The 13 transitions are numbered in comments.

describe("StateMachine", () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  // ── From: idle ─────────────────────────────────────────────────────────────

  it("T1: idle + HOTKEY_TRANSCRIBE → connecting(transcribe)", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    expect(sm.getState()).toEqual({ status: "connecting", mode: "transcribe" });
  });

  it("T2: idle + HOTKEY_TRANSLATE → connecting(translate)", () => {
    sm.send({ type: "HOTKEY_TRANSLATE" });
    expect(sm.getState()).toEqual({ status: "connecting", mode: "translate" });
  });

  // ── From: connecting ───────────────────────────────────────────────────────

  it("T3: connecting + MIC_READY → recording (preserves mode)", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    expect(sm.getState()).toEqual({ status: "recording", mode: "transcribe" });
  });

  it("T4: connecting + MIC_FAILED → error(message)", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_FAILED", message: "Permission denied" });
    expect(sm.getState()).toEqual({
      status: "error",
      message: "Permission denied",
    });
  });

  it("T5: connecting + MIC_TIMEOUT → error('Mic timeout')", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_TIMEOUT" });
    expect(sm.getState()).toEqual({ status: "error", message: "Mic timeout" });
  });

  it("T6: connecting + CANCEL → idle", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "CANCEL" });
    expect(sm.getState()).toEqual({ status: "idle" });
  });

  // ── From: recording ────────────────────────────────────────────────────────

  it("T7: recording + STOP_RECORDING → processing (≥500ms path)", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "STOP_RECORDING" });
    expect(sm.getState()).toEqual({
      status: "processing",
      mode: "transcribe",
    });
  });

  it("T8: recording + CANCEL (hotkey <500ms path) → idle", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "CANCEL" });
    expect(sm.getState()).toEqual({ status: "idle" });
  });

  it("T9: recording + CANCEL (Esc path) → idle", () => {
    sm.send({ type: "HOTKEY_TRANSLATE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "CANCEL" });
    expect(sm.getState()).toEqual({ status: "idle" });
  });

  it("T9a: recording + HOTKEY_TRANSCRIBE (second tap) → processing (preserves mode)", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    expect(sm.getState()).toEqual({ status: "processing", mode: "transcribe" });
  });

  it("T9b: recording + HOTKEY_TRANSLATE (second tap) → processing (preserves mode)", () => {
    sm.send({ type: "HOTKEY_TRANSLATE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "HOTKEY_TRANSLATE" });
    expect(sm.getState()).toEqual({ status: "processing", mode: "translate" });
  });

  // ── From: processing ───────────────────────────────────────────────────────

  it("T10: processing + API_SUCCESS (non-empty) → idle", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "STOP_RECORDING" });
    sm.send({ type: "API_SUCCESS", text: "hello world" });
    expect(sm.getState()).toEqual({ status: "idle" });
  });

  it("T11: processing + API_SUCCESS (empty) → error('Nothing heard')", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "STOP_RECORDING" });
    sm.send({ type: "API_SUCCESS", text: "  " });
    expect(sm.getState()).toEqual({
      status: "error",
      message: "Nothing heard",
    });
  });

  it("T12: processing + API_FAILURE → error(message)", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "STOP_RECORDING" });
    sm.send({ type: "API_FAILURE", message: "Network error" });
    expect(sm.getState()).toEqual({
      status: "error",
      message: "Network error",
    });
  });

  // ── From: error ────────────────────────────────────────────────────────────

  it("T13: error + ERROR_TIMEOUT → idle", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "STOP_RECORDING" });
    sm.send({ type: "API_FAILURE", message: "oops" });
    sm.send({ type: "ERROR_TIMEOUT" });
    expect(sm.getState()).toEqual({ status: "idle" });
  });

  // ── Invalid transition (no-op) ─────────────────────────────────────────────

  it("invalid: HOTKEY during processing is a no-op", () => {
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "STOP_RECORDING" });
    const stateBeforeSpam = sm.getState();
    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    expect(sm.getState()).toEqual(stateBeforeSpam);
  });

  // ── subscribe ──────────────────────────────────────────────────────────────

  it("subscribe fires on every state change", () => {
    const states: ReturnType<typeof sm.getState>[] = [];
    sm.subscribe((s) => states.push(s));

    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    sm.send({ type: "MIC_READY" });
    sm.send({ type: "STOP_RECORDING" });

    expect(states).toHaveLength(3);
    expect(states[0]).toEqual({ status: "connecting", mode: "transcribe" });
    expect(states[1]).toEqual({ status: "recording", mode: "transcribe" });
    expect(states[2]).toEqual({ status: "processing", mode: "transcribe" });
  });

  it("unsubscribe stops receiving updates", () => {
    const states: ReturnType<typeof sm.getState>[] = [];
    const unsub = sm.subscribe((s) => states.push(s));

    sm.send({ type: "HOTKEY_TRANSCRIBE" });
    unsub();
    sm.send({ type: "MIC_READY" });

    expect(states).toHaveLength(1);
  });
});
