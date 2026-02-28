# ok-typeless

macOS desktop voice input tool. Hold the Right Cmd key and speak — your words appear at the cursor (in Chinese or translated to English).

## Tech Stack

- Electron + TypeScript
- React (capsule UI)
- uiohook-napi (global Right Cmd hotkey)
- Groq / OpenAI API (Whisper STT + LLM cleanup/translation)
- Provider selected via `TYPELESS_PROVIDER` (`groq` by default, optional `openai`)
- When using Groq, post-processing model is selected by `TYPELESS_GROQ_POST_MODEL` (`openai` or `llama`)
- dotenv — loads `.env` from project root at startup (copy `.env.example` → `.env` to set API keys)

## Architecture

Main-heavy: Core logic is handled in the main process; the renderer is responsible only for the capsule UI and audio recording.

## Current Status

All MVP tasks complete. The app is fully functional on `master`.

## Conventions

1. Strictly follow `~/.claude/CLAUDE.md`
2. Update this file and related `/docs` documentation as the project progresses to ensure persistent information
