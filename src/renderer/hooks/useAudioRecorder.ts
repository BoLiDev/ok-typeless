import { useEffect, useRef, useState } from "react";
import { VadLite } from "../lib/vad";
import { MicSession } from "../lib/mic-session";

const MIC_TIMEOUT_MS = 5000;
const VAD_SAMPLE_RATE = 16000;
const VAD_FRAME_SIZE = 256; // ~16 ms at 16 kHz
const LAUNCH_CUE_URL = new URL("../../../audio/launch.mp3", import.meta.url).toString();

function playLaunchCue(): void {
  try {
    const audio = new Audio(LAUNCH_CUE_URL);
    void audio.play().catch(() => {
      // Silent fallback: recording should continue even if cue playback fails.
    });
  } catch {
    // Silent fallback for environments where Audio is unavailable.
  }
}

export function useAudioRecorder(): { vu: number } {
  const [vu, setVu] = useState(0);

  const micSessionRef = useRef<MicSession | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadRef = useRef(new VadLite());
  const stoppedRef = useRef(false);

  useEffect(() => {
    function stopAndSend(): void {
      if (stoppedRef.current) return;
      stoppedRef.current = true;

      micSessionRef.current?.stop();
      micSessionRef.current = null;
    }

    async function startRecording(): Promise<void> {
      chunksRef.current = [];
      vadRef.current = new VadLite();
      micSessionRef.current = null;
      stoppedRef.current = false;
      setVu(0);

      const timeoutId = setTimeout(() => {
        window.typeless.sendMicError("Mic timeout");
      }, MIC_TIMEOUT_MS);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        clearTimeout(timeoutId);
        const message =
          err instanceof Error ? err.message : "Microphone permission denied";
        window.typeless.sendMicError(message);
        return;
      }

      clearTimeout(timeoutId);

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blob.arrayBuffer().then((buf) => window.typeless.sendAudioData(buf));
        setVu(0);
      };

      const ctx = new AudioContext({ sampleRate: VAD_SAMPLE_RATE });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(VAD_FRAME_SIZE, 1, 1);
      micSessionRef.current = new MicSession(recorder, stream, ctx, [
        processor,
        source,
      ]);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          int16[i] = Math.round(Math.max(-1, Math.min(1, input[i])) * 32767);
        }

        const result = vadRef.current.pushFrame(int16);
        setVu(result.vu);
      };

      const silentSink = ctx.createGain();
      silentSink.gain.value = 0;
      source.connect(processor);
      processor.connect(silentSink);
      silentSink.connect(ctx.destination);

      recorder.start();
      window.typeless.sendMicReady();
      playLaunchCue();
    }

    window.typeless.onStartRecording(() => void startRecording());
    window.typeless.onStopRecording(stopAndSend);

    return () => {
      stopAndSend();
    };
  }, []);

  return { vu };
}
