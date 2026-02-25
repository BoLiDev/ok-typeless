import type { StateMachineEvent } from "./state-machine";

export type TapState = {
  rightCmdDown: boolean;
  usedAsModifier: boolean;
};

export type TapEvent =
  | { kind: "keydown"; keycode: "MetaRight" | "other"; shiftKey: boolean }
  | { kind: "keyup"; keycode: "MetaRight" | "other"; shiftKey: boolean };

export type TapAction = { kind: "transcribe" } | { kind: "translate" };

export type TapResult = {
  nextState: TapState;
  action: TapAction | null;
};

export function initialTapState(): TapState {
  return { rightCmdDown: false, usedAsModifier: false };
}

export function reduceTap(state: TapState, event: TapEvent): TapResult {
  if (event.kind === "keydown") {
    if (event.keycode === "MetaRight") {
      return {
        nextState: { rightCmdDown: true, usedAsModifier: false },
        action: null,
      };
    }
    if (state.rightCmdDown) {
      return {
        nextState: { ...state, usedAsModifier: true },
        action: null,
      };
    }
    return { nextState: state, action: null };
  }

  if (event.kind === "keyup" && event.keycode === "MetaRight") {
    const action: TapAction | null =
      !state.rightCmdDown || state.usedAsModifier
        ? null
        : event.shiftKey
          ? { kind: "translate" }
          : { kind: "transcribe" };

    return {
      nextState: { rightCmdDown: false, usedAsModifier: state.usedAsModifier },
      action,
    };
  }

  return { nextState: state, action: null };
}

export function tapActionToEvent(action: TapAction): StateMachineEvent {
  return action.kind === "transcribe"
    ? { type: "HOTKEY_TRANSCRIBE" }
    : { type: "HOTKEY_TRANSLATE" };
}
