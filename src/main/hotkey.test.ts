import { describe, it, expect } from "vitest";
import { reduceTap, initialTapState } from "./hotkey";
import type { TapState, TapEvent } from "./hotkey";

function send(
  state: TapState,
  ...events: TapEvent[]
): ReturnType<typeof reduceTap> {
  let result = {
    nextState: state,
    action: null as ReturnType<typeof reduceTap>["action"],
  };
  for (const event of events) {
    result = reduceTap(result.nextState, event);
  }
  return result;
}

const down = (keycode: TapEvent["keycode"], shiftKey = false): TapEvent => ({
  kind: "keydown",
  keycode,
  shiftKey,
});

const up = (keycode: TapEvent["keycode"], shiftKey = false): TapEvent => ({
  kind: "keyup",
  keycode,
  shiftKey,
});

describe("reduceTap", () => {
  it("tap → transcribe", () => {
    const result = send(initialTapState(), down("MetaRight"), up("MetaRight"));
    expect(result.action).toEqual({ kind: "transcribe" });
  });

  it("shift-tap → translate", () => {
    const result = send(
      initialTapState(),
      down("MetaRight"),
      up("MetaRight", true),
    );
    expect(result.action).toEqual({ kind: "translate" });
  });

  it("modifier-use → null (MetaRight + C)", () => {
    const result = send(
      initialTapState(),
      down("MetaRight"),
      down("other"),
      up("MetaRight"),
    );
    expect(result.action).toBeNull();
  });

  it("shift held (shift pressed after MetaRight) → translate", () => {
    const result = send(
      initialTapState(),
      down("MetaRight"),
      down("other", true),
      up("MetaRight", true),
    );
    expect(result.action).toBeNull();
  });

  it("unrelated keydown while MetaRight up → no-op", () => {
    const result = send(initialTapState(), down("other"));
    expect(result.action).toBeNull();
    expect(result.nextState).toEqual(initialTapState());
  });

  it("MetaRight keyup without prior keydown → no action", () => {
    const result = send(initialTapState(), up("MetaRight"));
    expect(result.action).toBeNull();
  });

  it("state resets rightCmdDown on MetaRight keyup", () => {
    const result = send(initialTapState(), down("MetaRight"), up("MetaRight"));
    expect(result.nextState.rightCmdDown).toBe(false);
  });
});
