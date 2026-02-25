type Props = {
  vu: number;
  showLabel: boolean;
};

const BAR_COUNT = 5;
const BAR_HEIGHTS = [10, 16, 20, 16, 10]; // resting shape

export function Waveform({ vu, showLabel }: Props): React.ReactElement {
  return (
    <>
      <div className="waveform">
        {BAR_HEIGHTS.map((base, i) => {
          const driven = base + vu * (20 - base);
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
