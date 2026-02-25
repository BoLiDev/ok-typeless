import { motion } from "framer-motion";

type Props = {
  showLabel: boolean;
  dimmed?: boolean;
};

const BAR_HEIGHTS = [5, 9, 14, 20, 22, 18, 13, 8];
const MIN_HEIGHT = 3;

export function Waveform({ showLabel, dimmed = false }: Props): React.ReactElement {
  return (
    <>
      <div className={`waveform${dimmed ? " waveform--dimmed" : ""}`}>
        {BAR_HEIGHTS.map((maxHeight, i) => {
          const duration = 0.7 + i * 0.06;
          const delay = Math.sin(i * 0.9) * 0.35;

          return (
            <motion.div
              key={i}
              className="waveform-bar"
              initial={{ height: MIN_HEIGHT }}
              animate={
                dimmed
                  ? { height: MIN_HEIGHT }
                  : { height: [MIN_HEIGHT, maxHeight, MIN_HEIGHT] }
              }
              transition={
                dimmed
                  ? {}
                  : {
                      duration,
                      delay,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />
          );
        })}
      </div>
      {showLabel && <span className="capsule-label">Translate</span>}
    </>
  );
}
