# E2E AI Test Design

## Goal

A manual-review test harness for the STT + LLM pipeline. Runs a set of pre-recorded audio fixtures through the full `transcribe()` chain, prints results to the terminal, and lets the developer judge quality by eye.

The test always passes unless the API throws an error.

## File Structure

```
test/e2e-ai/
  config.json          ← shared test parameters
  fixtures/            ← .wav / .webm files (gitignored)
scripts/
  e2e-ai.ts            ← runner script
```

## config.json

```json
{
  "mode": "transcribe",
  "skipPostProcessing": false
}
```

`mode` is `"transcribe"` or `"translate"`. All fixtures use the same config.

## Terminal Output

```
E2E AI Test  (mode: transcribe | skipPostProcessing: false)
──────────────────────────────────────────────────────────────────────────

[1/3] hello-world.wav
  STT (42ms):  今天天气怎么样帮我查一下
  LLM (380ms): 今天天气怎么样？帮我查一下。

[2/3] long-speech.wav
  STT (65ms):  ...
  LLM (420ms): ...

──────────────────────────────────────────────────────────────────────────
✓  3 fixtures completed
```

If a fixture throws, print the error and continue. Exit with code 1 after all fixtures if any failed.

## Implementation

- Add `tsx` as a dev dependency (handles TypeScript + tsconfig path aliases)
- Script imports `dotenv/config` to load `.env` automatically
- Script imports `transcribe()` directly from `src/main/llm/api.ts`
- npm script: `"test:ai": "tsx scripts/e2e-ai.ts"`
- `test/e2e-ai/fixtures/` is gitignored (audio files not committed)
- `test/e2e-ai/config.json` is committed

## Non-goals

- No assertions on output content — quality is judged by eye
- No per-fixture config — one config applies to all fixtures
- No HTML/Markdown report — terminal output only
