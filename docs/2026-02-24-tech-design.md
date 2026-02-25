# Tech Design: ok-typeless

## Overview

macOS desktop voice input tool. Press Right Cmd to speak, text appears at cursor — transcribed in the spoken language (with cleanup) or translated to English.

Electron + TypeScript. Main-heavy architecture: business logic in main process, renderer is a dumb UI for the capsule overlay.

## Architecture

```
Main Process                          Renderer (Capsule Window)
─────────────                         ────────────────────────
- Global hotkey (uiohook-napi)        - Waveform animation
- State machine                       - Status text display
- API calls (Whisper + LLM cleanup)    - Audio recording (Web Audio API)
- Clipboard save/paste/restore        - Sends audio buffer via IPC
- App lifecycle (tray, menu)          - Receives state updates via IPC
- Permission checks
```

Single source of truth in main process. Renderer can crash/reload without losing state. IPC is minimal — main pushes state, renderer sends audio.

## Module Structure

```
src/
├── main/
│   ├── main.ts                  # App entry, creates tray + capsule window
│   ├── state-machine.ts         # Core state machine
│   ├── hotkey.ts                # Right Cmd tap detection via uiohook-napi
│   ├── api.ts                   # Provider-agnostic STT + LLM cleanup/translation
│   ├── clipboard-output.ts      # Save clipboard → paste → restore
│   └── ipc-handlers.ts          # IPC channel definitions + handlers
├── renderer/
│   ├── index.html               # Capsule window HTML shell
│   ├── index.tsx                # React entry
│   ├── App.tsx                  # Root component, listens to state via IPC
│   ├── components/
│   │   ├── Capsule.tsx          # Black rounded container, fade animation
│   │   ├── Waveform.tsx         # White waveform animation during recording
│   │   └── TipBubble.tsx        # Error/status bubble above capsule
│   ├── hooks/
│   │   └── useAudioRecorder.ts  # Web Audio API recording logic
│   └── styles/
│       └── capsule.css          # Capsule styling
├── shared/
│   └── types.ts                 # Shared types (AppState, IPC channels)
└── preload/
    └── preload.ts               # contextBridge — minimal IPC surface
```

## State Machine

Plain TypeScript — no library. 5 states, exhaustive transitions.

### States

```typescript
type AppState =
  | { status: "idle" }
  | { status: "connecting"; mode: "transcribe" | "translate" }
  | { status: "recording"; mode: "transcribe" | "translate" }
  | { status: "processing"; mode: "transcribe" | "translate" }
  | { status: "error"; message: string };
```

### Transition Table

| From       | Event                   | To                     | Side Effect                             |
| ---------- | ----------------------- | ---------------------- | --------------------------------------- |
| idle       | hotkey                  | connecting(transcribe) | Show capsule, request mic               |
| idle       | hotkey+shift            | connecting(translate)  | Show capsule + "Translate", request mic |
| connecting | mic ready               | recording              | Start MediaRecorder                     |
| connecting | mic failed              | error(message)         | Show tip bubble                         |
| connecting | timeout (5s)            | error("Mic timeout")   | Show tip bubble                         |
| connecting | hotkey / Esc            | idle                   | Cancel mic request, hide capsule        |
| recording  | hotkey (≥500ms)         | processing             | Stop recorder, send to API              |
| recording  | hotkey (<500ms)         | idle                   | Too short, treat as cancel              |
| recording  | Esc                     | idle                   | Discard audio, hide capsule             |
| processing | API success (non-empty) | idle                   | Paste text, hide capsule                |
| processing | API success (empty)     | error("Nothing heard") | Show tip bubble                         |
| processing | API failure             | error(message)         | Show tip bubble                         |
| error      | 2s timeout              | idle                   | Hide capsule                            |

### Spam Protection

The state machine is the gatekeeper — invalid transitions are no-ops. Pressing hotkey during `processing` does nothing. The 500ms minimum recording duration prevents accidental double-taps from triggering API calls.

## Hotkey System

**Library:** `uiohook-napi` — N-API bindings for libuiohook. Prebuilt binaries, no electron-rebuild.

**Trigger:** Right Cmd key tap (press and release without using it as a modifier).

**Tap detection logic:**

```typescript
import { uIOhook, UiohookKey } from "uiohook-napi";

let rightCmdDown = false;
let usedAsModifier = false;

uIOhook.on("keydown", (e) => {
  if (e.keycode === UiohookKey.MetaRight) {
    rightCmdDown = true;
    usedAsModifier = false;
    return;
  }
  if (rightCmdDown) usedAsModifier = true;
});

uIOhook.on("keyup", (e) => {
  if (e.keycode === UiohookKey.MetaRight && !usedAsModifier) {
    const event = e.shiftKey ? "translate" : "transcribe";
    stateMachine.send(event);
  }
  if (e.keycode === UiohookKey.MetaRight) rightCmdDown = false;
});
```

**Key bindings:**

| Action            | Trigger                        |
| ----------------- | ------------------------------ |
| Toggle transcribe | Right Cmd tap                  |
| Toggle translate  | Right Cmd tap while Shift held |

## Audio Pipeline

```
[Mic] → getUserMedia() → MediaRecorder ──────────────────── ArrayBuffer ──IPC──→ [Main] → Groq API
         (renderer)                         (renderer)                              (main)
                      ↘ AudioContext → ScriptProcessorNode → VadLite → auto-stop ──╯
                                           (renderer)
```

Two parallel paths on the same mic stream:

1. **MediaRecorder** captures `audio/webm;codecs=opus` — assembled into an ArrayBuffer and sent to main via `audio-data` IPC when recording ends.
2. **AudioContext + ScriptProcessorNode** converts the stream to 16-bit PCM frames at 16 kHz and feeds them into `VadLite` for voice activity detection.

- **Connecting state:** `getUserMedia()` is async. The `connecting` state covers the time between hotkey press and mic stream ready. 5s timeout. On success the renderer sends `mic-ready` IPC; on failure it sends `mic-error`.
- **Manual stop:** main sends `stop-recording` to renderer (triggered when hotkey is pressed again) → renderer stops MediaRecorder → sends `audio-data`.
- **VAD auto-stop:** `VadLite` detects 1.5 s of silence after voice activity → renderer stops MediaRecorder → sends `audio-data`. Main's `audio-data` handler checks if state is `recording` and transitions to `processing` before proceeding.

## Voice Activity Detection (VAD)

Energy-based VAD ported from the `scribe` project (`VadLite`).

**Algorithm:** RMS → dBFS → attack/release EMA smoothing → dynamic noise floor (self-calibrated over first 800 ms) → hysteresis state machine.

**Configuration (ok-typeless tuning):**

| Parameter        | Value | Meaning                                  |
| ---------------- | ----- | ---------------------------------------- |
| `hopSec`         | 0.016 | ~16 ms frames (256 samples @ 16 kHz)     |
| `attackTau`      | 0.04  | 40 ms attack                             |
| `releaseTau`     | 0.3   | 300 ms release                           |
| `bootstrapSec`   | 0.8   | 800 ms noise-floor calibration           |
| `enterDeltaDb`   | 12    | Noise floor + 12 dB to enter voice       |
| `exitHysteresisDb` | 3   | Hysteresis — exit at enter − 3 dB        |
| `holdFrames`     | 8     | 8 frames hold before state flip          |
| `silenceHoldMs`  | 1500  | 1.5 s continuous silence → auto-stop     |

**Outputs used:**
- `vu` (0–1 normalised) → drives waveform bar animation in real time
- `isSpeaking` state → auto-stop trigger

## API Integration

**Two API calls per request.** Plain `fetch`, no SDK. Provider-agnostic — Groq and OpenAI share the same OpenAI-compatible API format.

### Provider Config

Controlled by `TYPELESS_PROVIDER` env var (`groq` by default):

```typescript
type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  sttModel: string;
  llmModel: string;
};

const providers: Record<string, ProviderConfig> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
    sttModel: "whisper-large-v3-turbo",
    llmModel: "llama-3.3-70b-versatile",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    sttModel: "whisper-1",
    llmModel: "gpt-4o-mini",
  },
};
```

All `fetch` calls use `config.baseUrl` + `config.apiKey`. Same endpoints, same request format, different config.

### Transcribe Flow

```
Audio → Whisper STT (auto-detected language) → LLM cleanup → output
```

1. POST audio to `{baseUrl}/audio/transcriptions` (model: `config.sttModel`, no `language` param — Whisper auto-detects)
2. POST transcription to `{baseUrl}/chat/completions` (model: `config.llmModel`)
   - System prompt: "Clean up the following speech transcription. Remove filler words, fix obvious grammar mistakes, and remove hallucinated text from silence (repeated phrases, nonsense). Preserve the original language. Return only the cleaned text, nothing else."

### Translate Flow

```
Audio → Whisper STT (auto-detected language) → LLM cleanup + translate to English → output
```

1. Same Whisper call (no `language` param)
2. Same LLM call, different prompt:
   - "Clean up the following speech transcription (remove filler words, fix grammar, remove hallucinated nonsense from silence), then translate to natural English. Return only the English translation, nothing else."

### Environment Variables

| Var                 | Required           | Default | Purpose                             |
| ------------------- | ------------------ | ------- | ----------------------------------- |
| `TYPELESS_PROVIDER` | No                 | `groq`  | Select provider: `groq` or `openai` |
| `GROQ_API_KEY`      | If provider=groq   | —       | Groq API key                        |
| `OPENAI_API_KEY`    | If provider=openai | —       | OpenAI API key                      |

At startup, check that the API key for the selected provider is set. If missing, show dialog and quit.

## Clipboard Output

```typescript
async function pasteText(text: string): Promise<void> {
  const original = clipboard.readText();
  clipboard.writeText(text);
  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Meta]);
  await delay(100);
  clipboard.writeText(original);
}
```

- `electron.clipboard` for read/write
- `uiohook.keyTap` for Cmd+V simulation
- 100ms delay before restore (gives target app time to process paste)
- Text-only save/restore for MVP

## Capsule Window

### Electron BrowserWindow Config

```typescript
const capsule = new BrowserWindow({
  width: 200,
  height: 44,
  x: centerX,
  y: screenHeight - 44 - 16,
  frame: false,
  transparent: true,
  alwaysOnTop: true,
  focusable: false,
  skipTaskbar: true,
  resizable: false,
  hasShadow: false,
  type: "panel",
  webPreferences: { preload: "preload.js" },
});
capsule.setVisibleOnAllWorkspaces(true);
capsule.setIgnoreMouseEvents(true);
```

**Never-steal-focus properties:** `focusable: false`, `type: 'panel'`, `setIgnoreMouseEvents(true)`.

### React Components

| Component       | Responsibility                                      |
| --------------- | --------------------------------------------------- |
| `App.tsx`       | Listens to state via IPC, renders correct child     |
| `Capsule.tsx`   | Black rounded container, fade-in/fade-out animation |
| `Waveform.tsx`  | CSS pulsing bars animation during recording         |
| `TipBubble.tsx` | Error/status message above capsule, 2s auto-dismiss |

### Capsule States

| App State  | Capsule shows                                    |
| ---------- | ------------------------------------------------ |
| connecting | Pulsing dot / "Connecting..."                    |
| recording  | White waveform (+ "Translate" if translate mode) |
| processing | "Transcribing..." or "Translating..."            |
| error      | Tip bubble above with error message              |

## IPC Design

6 channels via `contextBridge`:

| Direction       | Channel           | Payload          | Purpose                                     |
| --------------- | ----------------- | ---------------- | ------------------------------------------- |
| Main → Renderer | `state-update`    | `AppState`       | Push state changes to UI                    |
| Main → Renderer | `start-recording` | —                | Begin audio capture                         |
| Main → Renderer | `stop-recording`  | —                | Manual stop — assemble and send audio       |
| Renderer → Main | `audio-data`      | `ArrayBuffer`    | Recorded audio (manual or VAD auto-stop)    |
| Renderer → Main | `mic-ready`       | —                | Mic stream acquired → MIC_READY event       |
| Renderer → Main | `mic-error`       | `string`         | Mic failed/timed out → MIC_FAILED event     |

### preload.ts

```typescript
contextBridge.exposeInMainWorld('typeless', {
  onStateUpdate: (cb: (state: AppState) => void) => void,
  onStartRecording: (cb: () => void) => void,
  onStopRecording: (cb: () => void) => void,
  sendAudioData: (buffer: ArrayBuffer) => void,
  sendMicReady: () => void,
  sendMicError: (message: string) => void,
});
```

## Permissions & Startup

### Startup Sequence

```
App launches
  → Check Accessibility permission (systemPreferences.isTrustedAccessibilityClient)
  → If missing: show dialog, open System Prefs, quit
  → Read TYPELESS_PROVIDER (default: groq)
  → Check API key for selected provider
  → If missing: show dialog, quit
  → Register hotkey (uIOhook.start())
  → Show tray icon
  → Ready (idle state)
```

### Runtime Errors

All errors flow through: state machine → `error` state → tip bubble → 2s → `idle`.

| Error                 | Source                 | Tip bubble message             |
| --------------------- | ---------------------- | ------------------------------ |
| Mic permission denied | getUserMedia rejection | "Microphone permission denied" |
| Mic timeout           | 5s no stream           | "Mic timeout"                  |
| Network error         | fetch failure          | "Network error"                |
| API error             | 4xx/5xx response       | Error message from API         |
| Empty transcription   | Whisper returns blank  | "Nothing heard"                |

## Back Pressure

### Approach

Pure core, real harnesses at the edges.

Business logic (state machine transitions, hotkey tap detection) is extracted as pure functions — no side effects, no external dependencies. Unit tests call these functions directly with synthetic inputs; no mocking required. This gives instant, reliable feedback for the logic most likely to have subtle bugs.

External integrations (API, clipboard, UI) are validated against real systems: real provider API, real Electron clipboard, real running app under Playwright. Mocking these would test the mock, not the integration.

### Goal Map

| Goal             | What "passing" means                                                                                                              | Mechanism                                                                                                                             | Tier                            | Tooling                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------- |
| Hotkey Detection | Tap fires correct action; modifier-use does not fire; Shift-tap fires translate                                                   | Pure reducer `reduceTap(state, event) → { nextState, action }` unit tests covering all key sequences                                  | Compile-time + Commit-time      | Vitest                 |
| STT Pipeline     | Real API call with a fixture audio file returns a non-empty transcription                                                         | Integration test POSTing a known audio file to the real provider API, asserting non-empty result                                      | Integration-time                | Vitest + real API key  |
| Clipboard Paste  | Text lands in a focused input field; original clipboard is restored                                                               | Playwright drives an Electron test window with a focused text input; calls `pasteText`, asserts field value and clipboard restoration | Integration-time                | Playwright             |
| UI Fidelity      | Each AppState renders correctly (aesthetic); real app transitions produce correct capsule UI                                      | Storybook story per AppState for aesthetic iteration; Playwright screenshots per state transition in the running app                  | Compile-time + Integration-time | Storybook + Playwright |
| Error Resilience | Every error path (mic denied, timeout, network error, API error, empty transcription) reaches `error` state and returns to `idle` | Pure state machine unit tests for all error transitions; Playwright injects real error conditions in the running app                  | Commit-time + Integration-time  | Vitest + Playwright    |

### Hotkey Tap Detection: Architectural Note

The hotkey module is split into two layers:

1. **Tap detection logic** — a pure reducer `reduceTap(state: TapState, event: TapEvent): { nextState: TapState; action: TapAction | null }`. Contains all decision logic. Zero dependency on uiohook.
2. **uiohook binding** — a thin wiring layer that translates uiohook events into `TapEvent` objects and calls `reduceTap`.

Unit tests operate only on `reduceTap`. uiohook is trusted as a third-party library — we verify only that our logic on top of it is correct.

| Scenario                       | Key sequence                       | Expected action          |
| ------------------------------ | ---------------------------------- | ------------------------ |
| Tap                            | MetaRight↓ → MetaRight↑            | `{ kind: 'transcribe' }` |
| Shift-tap                      | MetaRight↓ → MetaRight↑ (shiftKey) | `{ kind: 'translate' }`  |
| Modifier-use                   | MetaRight↓ → C↓ → MetaRight↑       | `null`                   |
| Shift held (expected modifier) | MetaRight↓ → Shift↓ → MetaRight↑   | `{ kind: 'translate' }`  |

## Dependencies

| Package      | Purpose                             |
| ------------ | ----------------------------------- |
| electron     | App shell                           |
| uiohook-napi | Global hotkey (Right Cmd detection) |
| react        | Capsule UI                          |
| react-dom    | Capsule UI                          |
| typescript   | Type safety                         |
