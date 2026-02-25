# PRD: Local Session Logging

## Introduction

Each time the user completes a voice input session (audio recorded → transcription
entered), there is no record of what happened. Audio is discarded, timings are
invisible, and LLM output quality cannot be reviewed after the fact.

This feature introduces a lightweight local logging system: every completed session
is persisted to disk as a structured plain-text log entry, and the raw audio file is
saved alongside it. The logs are written to the project's `logs/` folder and are
intended for manual review or AI-assisted analysis.

---

## Goals

- Save the raw audio for every completed session so it can be re-listened to.
- Record Whisper STT output and processing time per session.
- Record LLM post-processing output and processing time per session.
- Record the final text pasted and total end-to-end processing time.
- Make logs human-readable without tooling, and trivially parseable by an AI.

---

## User Stories

### US-001: Bootstrap logging infrastructure

**Description:** As a developer, I need a `SessionLogger` module and a `logs/`
directory structure in place so that other stories have somewhere to write data.

**Acceptance Criteria:**

- [ ] `src/main/session-logger.ts` module exists and is the single entry point for
      all logging writes.
- [ ] On first write the module creates `logs/` and `logs/recordings/` directories
      if they do not exist (using `fs.mkdirSync` with `{ recursive: true }`).
- [ ] `logs/` and `logs/recordings/` are added to `.gitignore`.
- [ ] The log file path is `logs/typeless.log` relative to the project root.
- [ ] Typecheck passes (`npm run typecheck` or equivalent).

---

### US-002: Save audio file to disk on session start

**Description:** As a user, I want the raw audio of every completed recording saved
to disk so I can re-listen to what I said.

**Acceptance Criteria:**

- [ ] When `AUDIO_DATA` arrives in `ipc-handlers.ts`, the audio `ArrayBuffer` is
      written to `logs/recordings/YYYYMMDD-HHmmss-SSS.webm` before `transcribe()` is
      called.
- [ ] The generated file path is passed into the log entry so it appears in the log.
- [ ] Files are not deleted or overwritten (each session gets a unique timestamp
      filename).
- [ ] If the write fails, the error is logged to `console.error` and processing
      continues normally (audio save failure must not block transcription).
- [ ] Typecheck passes.

---

### US-003: Instrument STT and LLM steps with timing

**Description:** As a developer, I need `api.ts` to return per-step timing and raw
outputs so they can be included in the log entry.

**Acceptance Criteria:**

- [ ] `transcribe()` in `api.ts` returns a richer result type instead of `string`:
  ```
  {
    sttRaw:   string   // raw Whisper output before LLM
    sttMs:    number   // Whisper wall-clock time in milliseconds
    llmOut:   string   // LLM output (= final pasted text)
    llmMs:    number   // LLM wall-clock time in milliseconds
  }
  ```
- [ ] Timing is measured with `Date.now()` before and after each API call.
- [ ] `ipc-handlers.ts` is updated to use the new return type (no behaviour change
      for the happy path — `text` is now `result.llmOut`).
- [ ] When `TYPELESS_MOCK_TRANSCRIPTION` is set, the mock result fills all fields
      with zeroed timing so tests are unaffected.
- [ ] All existing `api.test.ts` tests pass.
- [ ] Typecheck passes.

---

### US-004: Write complete session log entry

**Description:** As a developer reviewing past sessions, I want a single log entry
appended to `logs/typeless.log` at the end of every completed session so I can
inspect what happened.

**Acceptance Criteria:**

- [ ] After a successful `transcribe()` call in `ipc-handlers.ts`, one entry is
      appended to `logs/typeless.log` in this exact format:

  ```
  [2026-02-25 14:32:01] transcribe
    audio:  logs/recordings/20260225-143201-042.webm
    stt:    "hello world this is a test"  (342ms)
    llm:    "Hello world, this is a test."  (891ms)
    pasted: "Hello world, this is a test."  total: 1233ms
  ---
  ```

  Field notes:

  - Timestamp is local time, formatted as `YYYY-MM-DD HH:mm:ss`.
  - Mode is `transcribe` or `translate`.
  - `stt` and `llm` quotes use straight double-quotes.
  - Timing values are integers (no decimal).
  - `total` = `sttMs + llmMs` (does not include audio save time).
  - Each entry ends with a `---` separator line followed by a blank line.

- [ ] If the log write fails, the error is logged to `console.error` and the app
      continues (log failure must not break the paste step).
- [ ] Sessions that fail in the API step (empty transcription, API error) are NOT
      logged — only sessions that reach `API_SUCCESS` produce an entry.
- [ ] Typecheck passes.

---

## Functional Requirements

- FR-1: All logging writes go through `src/main/session-logger.ts`. No other module
  writes directly to the log file or recordings directory.
- FR-2: `logs/` and `logs/recordings/` are created lazily on first write.
- FR-3: Audio files are named `YYYYMMDD-HHmmss-SSS.webm` (SSS = milliseconds) to
  guarantee uniqueness across rapid sessions.
- FR-4: The log file is append-only; existing entries are never modified or deleted.
- FR-5: Timing is wall-clock milliseconds captured with `Date.now()`.
- FR-6: Log and audio write failures are non-fatal — they must not interrupt the
  transcription or paste flow.

---

## Non-Goals

- No in-app log viewer or UI of any kind.
- No log rotation, size limits, or auto-deletion.
- No structured / machine-readable format (JSON, SQLite, etc.).
- No logging of sessions that fail before reaching the `processing` state (mic
  errors, cancellations).
- No logging of the audio save timing itself.

---

## Technical Considerations

- Project root at runtime (Electron main process): use `app.getAppPath()` or
  `path.resolve(__dirname, '../../..')` to locate the project root. Verify the
  chosen approach works in both `npm start` (dev) and a packaged build if relevant.
- Audio format: the renderer sends `audio/webm` by default (MediaRecorder). The
  filename should use `.webm` extension to match.
- `api.ts` currently returns `Promise<string>`. Changing the return type is a
  **breaking change** to its public interface — update `ipc-handlers.ts` and any
  tests accordingly.
- `session-logger.ts` should use synchronous `fs.appendFileSync` (simpler, no
  interleaving risk for single-user desktop app) or `fs.promises.appendFile`
  (non-blocking). Either is acceptable; prefer async to avoid blocking the main
  process event loop.

---

## Success Metrics

- After each voice session, a `.webm` file exists in `logs/recordings/`.
- After each voice session, a new entry appears at the bottom of `logs/typeless.log`
  with the correct structure.
- STT and LLM timings in the log are plausible (STT typically 300–1500ms, LLM
  typically 500–3000ms).

---

## Open Questions

- Should failed sessions (API error after a successful recording) still save the
  audio file even though no log entry is written? Currently the PRD saves audio
  first (before transcription), so audio will always be saved for any session that
  reaches `processing` state — this is probably desirable but worth confirming.
