type Props = {
  vu: number;
  showLabel: boolean;
};

const BAR_PROFILE = [6, 10, 15, 20, 17, 12, 11, 16, 20, 16, 12, 7];
const MIN_HEIGHT = 3;

export function Waveform({ vu, showLabel }: Props): React.ReactElement {
  return (
    <>
      <div className="waveform">
        {BAR_PROFILE.map((max, i) => {
          const driven = MIN_HEIGHT + vu * (max - MIN_HEIGHT);
          return (
            <div
              key={i}
              className="waveform-bar"
              style={{ height: `${driven}px` }}
            />
          );
        })}
      </div>
      {showLabel && <span className="capsule-label">Translate</span>}
    </>
  );
}
