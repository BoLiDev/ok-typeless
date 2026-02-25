import { AnimatePresence, motion } from "framer-motion";
import type { AppState } from "@shared/types";
import { Waveform } from "./Waveform";
import { TipBubble } from "./TipBubble";
import "../styles/capsule.css";

type Props = {
  state: Exclude<AppState, { status: "idle" }>;
  vu: number;
};

const CAPSULE_SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 30,
} as const;

const CONTENT_TRANSITION = { duration: 0.12, ease: "easeInOut" } as const;

function CapsuleContent({ state, vu }: Props): React.ReactElement {
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
      <AnimatePresence>
        {state.status === "error" && (
          <TipBubble key="tip" message={state.message} />
        )}
      </AnimatePresence>
      <motion.div
        className="capsule"
        layout="size"
        initial={{ opacity: 0, scale: 0.82, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          layout: CAPSULE_SPRING,
          opacity: { duration: 0.2 },
          scale: CAPSULE_SPRING,
          y: CAPSULE_SPRING,
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={state.status}
            className="capsule-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CONTENT_TRANSITION}
          >
            <CapsuleContent state={state} vu={vu} />
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
