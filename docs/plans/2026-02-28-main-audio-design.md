# Design: Move Launch Cue to Main Process

**Date:** 2026-02-28

## Problem

The launch sound was played in the renderer using the Web Audio API (`AudioContext` + `decodeAudioData`). This caused two issues:

1. **Tearing / double-play** — the `AudioContext` runs at 16 kHz (required for VAD). Decoding the MP3 through it downsizes the audio from its native rate, degrading quality. In development, React StrictMode can also cause double-play.
2. **Reduced quality** — the MP3 is decoded at 16 kHz instead of its native rate (~44 kHz), producing tinny output.

## Decision

Move audio playback to the main process using macOS's native `afplay` CLI via `child_process.spawn`.

## Design

### What changes

| Location | Change |
|---|---|
| `src/renderer/hooks/useAudioRecorder.ts` | Remove `LAUNCH_CUE_URL`, `playLaunchCue`, and the `void playLaunchCue(ctx)` call |
| `src/main/ipc-handlers.ts` | Add `playLaunchCue()` using `spawn('afplay', [audioPath])`; call it in `handleMicReady()` |

### Trigger timing

Sound fires when main receives `MIC_READY` from the renderer — after `getUserMedia` succeeds, before the state machine advances to `recording`. This matches the previous timing.

### Audio file path

```
join(__dirname, "../../audio/launch.mp3")
```

Follows the same pattern as `assets/tray-icon.png` in `main.ts`. No new IPC channels required.

### Error handling

Fire-and-forget: `afplay` errors are logged to console; recording is never interrupted.

## Why `afplay`

- Built into every macOS installation — zero new dependencies
- Plays MP3 at native fidelity
- Runs as a separate OS process — never blocks the main thread or interferes with the `AudioContext`
- This app is macOS-only, so no cross-platform concern
