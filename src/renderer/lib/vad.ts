// Ported from the scribe project (VadLite).
// Energy-based VAD: RMS → dBFS → attack/release EMA → dynamic noise floor → hysteresis.

type VadState = "silence" | "voice";

interface VadConfig {
  hopSec: number;
  attackTau: number;
  releaseTau: number;
  bootstrapSec: number;
  enterDeltaDb: number;
  exitHysteresisDb: number;
  holdFrames: number;
  dbFloor: number;
}

export interface VadResult {
  db: number;
  vu: number;
  isSpeaking: boolean;
  noiseFloorDb: number;
}

const DEFAULT_CFG: VadConfig = {
  hopSec: 0.016,
  attackTau: 0.04,
  releaseTau: 0.3,
  bootstrapSec: 0.8,
  enterDeltaDb: 12,
  exitHysteresisDb: 3,
  holdFrames: 8,
  dbFloor: -60,
};

function percentile(arr: number[], p: number): number {
  const a = arr.slice().sort((x, y) => x - y);
  const idx = Math.min(
    a.length - 1,
    Math.max(0, Math.floor((p / 100) * (a.length - 1))),
  );
  return a[idx];
}

export class VadLite {
  private cfg: VadConfig;
  private attackAlpha: number;
  private releaseAlpha: number;

  private smoothedDb = -Infinity;
  private noiseFloorDb = -50;
  private enterThresh = -38;
  private exitThresh = -41;

  private state: VadState = "silence";
  private enterCounter = 0;
  private exitCounter = 0;

  private bootstrapFramesNeeded: number;
  private bootstrapDb: number[] = [];

  constructor(cfg: Partial<VadConfig> = {}) {
    this.cfg = { ...DEFAULT_CFG, ...cfg };
    this.attackAlpha = 1 - Math.exp(-this.cfg.hopSec / this.cfg.attackTau);
    this.releaseAlpha = 1 - Math.exp(-this.cfg.hopSec / this.cfg.releaseTau);
    this.bootstrapFramesNeeded = Math.max(
      1,
      Math.round(this.cfg.bootstrapSec / this.cfg.hopSec),
    );
  }

  pushFrame(int16: Int16Array): VadResult {
    let sum = 0;
    for (let i = 0; i < int16.length; i++) {
      const s = int16[i] / 32768;
      sum += s * s;
    }
    const rms = Math.sqrt(sum / int16.length);

    const eps = 1e-12;
    const instDb = 20 * Math.log10(Math.max(rms, eps));

    const alpha =
      instDb > this.smoothedDb ? this.attackAlpha : this.releaseAlpha;
    this.smoothedDb = isFinite(this.smoothedDb)
      ? alpha * instDb + (1 - alpha) * this.smoothedDb
      : instDb;

    if (this.bootstrapDb.length < this.bootstrapFramesNeeded) {
      this.bootstrapDb.push(this.smoothedDb);
      if (this.bootstrapDb.length === this.bootstrapFramesNeeded) {
        this.noiseFloorDb = Math.max(percentile(this.bootstrapDb, 25), -50);
        this.updateThresholds();
      }
    }

    if (this.bootstrapDb.length >= this.bootstrapFramesNeeded) {
      if (this.state === "silence") {
        if (this.smoothedDb > this.enterThresh) {
          this.enterCounter++;
          this.exitCounter = 0;
          if (this.enterCounter >= this.cfg.holdFrames) {
            this.state = "voice";
            this.enterCounter = 0;
          }
        } else {
          this.enterCounter = 0;
        }
      } else {
        if (this.smoothedDb < this.exitThresh) {
          this.exitCounter++;
          this.enterCounter = 0;
          if (this.exitCounter >= this.cfg.holdFrames) {
            this.state = "silence";
            this.exitCounter = 0;
          }
        } else {
          this.exitCounter = 0;
        }
      }
    }

    const vu = Math.max(
      0,
      Math.min(
        1,
        (this.smoothedDb - this.cfg.dbFloor) / (0 - this.cfg.dbFloor),
      ),
    );

    return {
      db: this.smoothedDb,
      vu,
      isSpeaking: this.state === "voice",
      noiseFloorDb: this.noiseFloorDb,
    };
  }

  reset(): void {
    this.bootstrapDb = [];
    this.state = "silence";
    this.enterCounter = 0;
    this.exitCounter = 0;
    this.smoothedDb = -Infinity;
  }

  private updateThresholds(): void {
    this.enterThresh = this.noiseFloorDb + this.cfg.enterDeltaDb;
    this.exitThresh = this.enterThresh - this.cfg.exitHysteresisDb;
  }
}
