import type { AppState } from "@shared/types";
import { Waveform } from "./Waveform";
import { TipBubble } from "./TipBubble";
import "../styles/capsule.css";

type Props = {
  state: Exclude<AppState, { status: "idle" }>;
  skipPostProcessing: boolean;
};

function CapsuleContent({ state, skipPostProcessing }: Props): React.ReactElement {
  switch (state.status) {
    case "connecting":
      return <Waveform dimmed showLabel={state.mode === "translate"} />;

    case "recording":
      return (
        <>
          <Waveform showLabel={state.mode === "translate"} />
          {skipPostProcessing && <span className="capsule-label">raw</span>}
        </>
      );

    case "processing":
      return (
        <>
          <span className="capsule-label">
            {state.mode === "translate" ? "Translating…" : "Transcribing…"}
          </span>
          {skipPostProcessing && <span className="capsule-label">raw</span>}
        </>
      );

    case "error":
      return <span className="capsule-label">✕</span>;
  }
}

export function Capsule({ state, skipPostProcessing }: Props): React.ReactElement {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {state.status === "error" && <TipBubble message={state.message} />}
      <div className="capsule">
        <div className="capsule-content">
          <CapsuleContent state={state} skipPostProcessing={skipPostProcessing} />
        </div>
      </div>
    </div>
  );
}
