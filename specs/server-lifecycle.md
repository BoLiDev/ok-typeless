# Server Lifecycle

## Overview

When `TYPELESS_PROVIDER=local`, the app must launch whisper-server and llama-server as child processes on startup and terminate them on quit. The user should never need to start or stop these servers manually.

## Requirements

- On app launch (when provider is `local`), spawn `whisper-server` and `llama-server` as child processes with correct model paths and port arguments
- Wait for both servers to become ready (respond to health/readiness check) before transitioning the app to the ready state
- On app quit, send SIGTERM to both child processes and wait for graceful shutdown
- If a server process crashes during the app's lifetime, transition to an error state with a clear message (do not silently fail)
- If a port is already in use at launch, surface an actionable error (e.g. "port 8178 in use — is another instance running?")
- Server stdout/stderr should be captured for diagnostics (logged to file or console) but not shown to the user in normal operation
- Servers are only launched when `TYPELESS_PROVIDER=local` — no processes spawned for `groq` or `openai`

## Acceptance Criteria

- Launching the app with `TYPELESS_PROVIDER=local` starts both server processes automatically
- The app does not accept voice input until both servers report ready
- Quitting the app terminates both server processes — no orphaned processes remain
- Killing the app (force quit / SIGKILL) does not leave orphaned server processes `[Assumption: use process group or PID file cleanup on next launch — revisit if orphan cleanup proves unreliable]`
- A server crash mid-session produces a visible error, not silent failures
- With `TYPELESS_PROVIDER=groq`, no local server processes are spawned

## Edge Cases & Constraints

- Server startup time may be significant (model loading takes seconds) — the app should show a loading/warming-up state
- Both servers must bind to `127.0.0.1` only — no external network exposure
- The app should handle the case where binaries or model files are missing (setup not run) with a clear error directing the user to run the setup script

## Dependencies

- `setup-script` — server binaries and models must exist at expected paths
- `local-provider` — provider config determines which ports/models to use
