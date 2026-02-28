# Local Provider

## Overview

A third provider (`local`) that routes STT and post-processing requests to locally running whisper.cpp and llama.cpp servers instead of cloud APIs. From the user's perspective, setting `TYPELESS_PROVIDER=local` should make the app behave identically to `groq` or `openai` — same transcribe/translate modes, same output quality expectations.

## Requirements

- Add `"local"` to the `ProviderName` union type and register it in the `PROVIDERS` config
- Local provider config uses `http://127.0.0.1:<port>` base URLs for both whisper-server and llama-server `[Assumption: whisper-server on port 8178, llama-server on port 8179 — revisit if conflicts arise]`
- Local provider requires no API key — skip API key validation for provider `local`
- `whisperTranscribe()` works against whisper.cpp's `/inference` endpoint, adapting request format if it differs from OpenAI's `/v1/audio/transcriptions` `[Assumption: whisper.cpp server uses a different endpoint shape — verify during implementation]`
- `llmProcess()` works against llama.cpp's OpenAI-compatible `/v1/chat/completions` endpoint with no changes to request format
- Model names are configured in the provider entry: `large-v3-turbo` for STT, `llama3.1:8b` for LLM `[Assumption: model names match the gguf filenames or aliases used by the servers — verify during implementation]`
- The existing prompts (`CLEANUP_PROMPT`, `TRANSLATE_PROMPT`, `TRANSLATE_ONLY_PROMPT`) are used as-is — no local-specific prompts
- `skipPostProcessing` behavior is unchanged

## Acceptance Criteria

- With `TYPELESS_PROVIDER=local` and both servers running, the full transcribe flow (audio → STT → LLM cleanup → paste) works
- With `TYPELESS_PROVIDER=local` and both servers running, the translate flow works
- No API key is required or validated for the local provider
- Switching between `groq`, `openai`, and `local` providers requires only changing the env var — no code or config changes

## Dependencies

- `setup-script` — binaries and models must be installed first
- `server-lifecycle` — servers must be running before requests are made
