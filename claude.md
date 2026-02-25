# ok-typeless

macOS desktop voice input tool. Hold the Right Cmd key and speak — your words appear at the cursor (in Chinese or translated to English).

## Tech Stack

- Electron + TypeScript
- React (capsule UI)
- uiohook-napi (global Right Cmd hotkey)
- Groq / OpenAI API (Whisper STT + LLM cleanup/translation)
- Provider selected via the `TYPELESS_PROVIDER` environment variable (`groq` by default, optional `openai`)

## Architecture

Main-heavy: Core logic is handled in the main process; the renderer is responsible only for the capsule UI and audio recording.

## Key Documents

- PRD: `docs/2026-02-23-prd.md`
- Tech Design: `docs/2026-02-24-tech-design.md`

## Current Status

Tech design completed, pending implementation.

## Conventions

1. Strictly follow `~/.claude/CLAUDE.md`
2. Update this file and related `/docs` documentation as the project progresses to ensure persistent information
