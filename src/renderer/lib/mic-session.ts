interface Stoppable {
  stop(): void;
}

interface Disconnectable {
  disconnect(): void;
}

export class MicSession {
  private stopped = false;

  constructor(
    private readonly recorder: Pick<MediaRecorder, "state" | "stop">,
    private readonly stream: { getTracks(): Stoppable[] },
    private readonly audioCtx: Pick<AudioContext, "close">,
    private readonly nodes: Disconnectable[] = [],
  ) {}

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    if (this.recorder.state !== "inactive") {
      this.recorder.stop();
    }

    this.nodes.forEach((n) => n.disconnect());
    this.stream.getTracks().forEach((t) => t.stop());
    // AudioContext cleanup should never block releasing the microphone device.
    void this.audioCtx.close().catch(() => undefined);
  }
}
