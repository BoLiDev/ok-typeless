import { motion } from "framer-motion";

type Props = {
  vu: number;
  showLabel: boolean;
  dimmed?: boolean;
};

const BAR_PROFILE = [6, 10, 15, 20, 17, 12, 11, 16, 20, 16, 12, 7];
const MIN_HEIGHT = 3;
const SILENCE_THRESHOLD = 0.04;

const HEIGHT_SPRING = {
  type: "spring",
  stiffness: 320,
  damping: 28,
  mass: 0.6,
} as const;

export function Waveform({ vu, showLabel, dimmed = false }: Props): React.ReactElement {
  const isSilent = vu < SILENCE_THRESHOLD;

  return (
    <>
      <div className={`waveform${dimmed ? " waveform--dimmed" : ""}`}>
        {BAR_PROFILE.map((max, i) => {
          const driven = MIN_HEIGHT + vu * (max - MIN_HEIGHT);

          return (
            <motion.div
              key={i}
              className="waveform-bar"
              initial={{ height: MIN_HEIGHT }}
              animate={{ height: dimmed || isSilent ? MIN_HEIGHT : driven }}
              transition={{ height: HEIGHT_SPRING }}
            />
          );
        })}
      </div>
      {showLabel && <span className="capsule-label">Translate</span>}
    </>
  );
}
