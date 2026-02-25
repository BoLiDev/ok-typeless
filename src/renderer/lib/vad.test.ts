import { describe, it, expect } from "vitest";
import { VadLite } from "./vad";

function makeFrame(amplitude: number, length = 256): Int16Array {
  const frame = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    frame[i] = Math.round(amplitude * 32767);
  }
  return frame;
}

function bootstrap(vad: VadLite, frames = 60): void {
  for (let i = 0; i < frames; i++) {
    vad.pushFrame(makeFrame(0.001)); // ~60 dB below full scale — quiet room
  }
}

describe("VadLite", () => {
  it("starts in silence and returns vu in [0, 1]", () => {
    const vad = new VadLite();
    const result = vad.pushFrame(makeFrame(0));
    expect(result.isSpeaking).toBe(false);
    expect(result.vu).toBeGreaterThanOrEqual(0);
    expect(result.vu).toBeLessThanOrEqual(1);
  });

  it("detects voice after bootstrap and sustained loud input", () => {
    const vad = new VadLite();
    bootstrap(vad);

    let speaking = false;
    for (let i = 0; i < 20; i++) {
      const result = vad.pushFrame(makeFrame(0.5)); // loud voice
      if (result.isSpeaking) speaking = true;
    }
    expect(speaking).toBe(true);
  });

  it("returns to silence after voice ends", () => {
    const vad = new VadLite();
    bootstrap(vad);

    for (let i = 0; i < 20; i++) vad.pushFrame(makeFrame(0.5));
    for (let i = 0; i < 30; i++) vad.pushFrame(makeFrame(0.0001));

    const result = vad.pushFrame(makeFrame(0.0001));
    expect(result.isSpeaking).toBe(false);
  });

  it("reset clears state", () => {
    const vad = new VadLite();
    bootstrap(vad);
    for (let i = 0; i < 20; i++) vad.pushFrame(makeFrame(0.5));

    vad.reset();
    const result = vad.pushFrame(makeFrame(0.5));
    expect(result.isSpeaking).toBe(false); // bootstrap not complete yet
  });

  it("vu increases with louder input after bootstrap", () => {
    const vad = new VadLite();
    bootstrap(vad);

    const quiet = vad.pushFrame(makeFrame(0.01)).vu;
    const loud = vad.pushFrame(makeFrame(0.8)).vu;
    expect(loud).toBeGreaterThan(quiet);
  });
});
