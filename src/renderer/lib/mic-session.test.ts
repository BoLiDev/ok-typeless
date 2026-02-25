import { describe, it, expect, vi } from "vitest";
import { MicSession } from "./mic-session";

function makeTrack() {
  return { stop: vi.fn() };
}

function makeRecorder(state: MediaRecorder["state"] = "recording") {
  return { state, stop: vi.fn() };
}

function makeAudioCtx() {
  return { close: vi.fn().mockResolvedValue(undefined) };
}

describe("MicSession", () => {
  it("stops all stream tracks when stop() is called", () => {
    const t1 = makeTrack();
    const t2 = makeTrack();
    const session = new MicSession(
      makeRecorder(),
      { getTracks: () => [t1, t2] },
      makeAudioCtx(),
    );

    session.stop();

    expect(t1.stop).toHaveBeenCalledTimes(1);
    expect(t2.stop).toHaveBeenCalledTimes(1);
  });

  it("closes the AudioContext when stop() is called", () => {
    const ctx = makeAudioCtx();
    const session = new MicSession(
      makeRecorder(),
      { getTracks: () => [] },
      ctx,
    );

    session.stop();

    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  it("stops the recorder when state is not inactive", () => {
    const recorder = makeRecorder("recording");
    const session = new MicSession(
      recorder,
      { getTracks: () => [] },
      makeAudioCtx(),
    );

    session.stop();

    expect(recorder.stop).toHaveBeenCalledTimes(1);
  });

  it("does not stop the recorder when state is already inactive", () => {
    const recorder = makeRecorder("inactive");
    const session = new MicSession(
      recorder,
      { getTracks: () => [] },
      makeAudioCtx(),
    );

    session.stop();

    expect(recorder.stop).not.toHaveBeenCalled();
  });

  it("stops tracks before (or concurrently with) recorder.stop() — not deferred", () => {
    const callOrder: string[] = [];
    const recorder = {
      state: "recording" as const,
      stop: vi.fn(() => callOrder.push("recorder.stop")),
    };
    const track = { stop: vi.fn(() => callOrder.push("track.stop")) };
    const session = new MicSession(
      recorder,
      { getTracks: () => [track] },
      makeAudioCtx(),
    );

    session.stop();

    // track.stop() must be called in the same synchronous turn as recorder.stop(),
    // not deferred to an async callback (e.g. recorder.onstop).
    expect(callOrder).toContain("track.stop");
    expect(callOrder).toContain("recorder.stop");
  });

  it("disconnects all audio nodes when stop() is called", () => {
    const node1 = { disconnect: vi.fn() };
    const node2 = { disconnect: vi.fn() };
    const session = new MicSession(
      makeRecorder(),
      { getTracks: () => [] },
      makeAudioCtx(),
      [node1, node2],
    );

    session.stop();

    expect(node1.disconnect).toHaveBeenCalledTimes(1);
    expect(node2.disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects audio nodes before stopping stream tracks", () => {
    const callOrder: string[] = [];
    const node = { disconnect: vi.fn(() => callOrder.push("node.disconnect")) };
    const track = { stop: vi.fn(() => callOrder.push("track.stop")) };
    const session = new MicSession(
      makeRecorder("inactive"),
      { getTracks: () => [track] },
      makeAudioCtx(),
      [node],
    );

    session.stop();

    expect(callOrder.indexOf("node.disconnect")).toBeLessThan(
      callOrder.indexOf("track.stop"),
    );
  });

  it("is idempotent — cleanup runs exactly once even if stop() is called twice", () => {
    const track = makeTrack();
    const session = new MicSession(
      makeRecorder(),
      { getTracks: () => [track] },
      makeAudioCtx(),
    );

    session.stop();
    session.stop();

    expect(track.stop).toHaveBeenCalledTimes(1);
  });
});
