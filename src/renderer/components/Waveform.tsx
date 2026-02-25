import { motion } from "framer-motion";

type Props = {
  vu: number;
  showLabel: boolean;
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

export function Waveform({ vu, showLabel }: Props): React.ReactElement {
  const isSilent = vu < SILENCE_THRESHOLD;

  return (
    <>
      <div className="waveform">
        {BAR_PROFILE.map((max, i) => {
          const driven = MIN_HEIGHT + vu * (max - MIN_HEIGHT);
          const breathingPeak = MIN_HEIGHT + max * 0.15;

          return (
            <motion.div
              key={i}
              className="waveform-bar"
              initial={{ height: MIN_HEIGHT }}
              animate={
                isSilent
                  ? { height: [MIN_HEIGHT, breathingPeak, MIN_HEIGHT] }
                  : { height: driven }
              }
              transition={
                isSilent
                  ? {
                      height: {
                        duration: 1.3 + (i % 4) * 0.15,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.07,
                      },
                    }
                  : { height: HEIGHT_SPRING }
              }
            />
          );
        })}
      </div>
      {showLabel && <span className="capsule-label">Translate</span>}
    </>
  );
}
