import type { AppState } from "@shared/types";
import { Waveform } from "./Waveform";
import { TipBubble } from "./TipBubble";
import "../styles/capsule.css";

type Props = {
  state: Exclude<AppState, { status: "idle" }>;
  vu: number;
};

function CapsuleContent({ state, vu }: Props): React.ReactElement {
  switch (state.status) {
    case "connecting":
      return <Waveform vu={0} dimmed showLabel={state.mode === "translate"} />;

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
      <div className="capsule">
        <div className="capsule-content">
          <CapsuleContent state={state} vu={vu} />
        </div>
      </div>
    </div>
  );
}
