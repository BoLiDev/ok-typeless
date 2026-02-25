import type { AppState } from "@shared/types";
import { Waveform } from "./Waveform";
import { TipBubble } from "./TipBubble";
import "../styles/capsule.css";

type Props = {
  state: Exclude<AppState, { status: "idle" }>;
  vu: number;
};

function capsuleContent(
  state: Exclude<AppState, { status: "idle" }>,
  vu: number
): React.ReactElement {
  switch (state.status) {
    case "connecting":
      return (
        <>
          <div className="connecting-dot" />
          <span className="capsule-label">
            {state.mode === "translate" ? "Translate" : "Connecting…"}
          </span>
        </>
      );

    case "recording":
      return <Waveform vu={vu} showLabel={state.mode === "translate"} />;

    case "processing":
      return (
        <span className="capsule-label">
          {state.mode === "translate" ? "Translating…" : "Transcribing…"}
        </span>
      );

    case "error":
      return <span className="capsule-label">✕</span>;
  }
}

export function Capsule({ state, vu }: Props): React.ReactElement {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {state.status === "error" && <TipBubble message={state.message} />}
      <div className="capsule">{capsuleContent(state, vu)}</div>
    </div>
  );
}
