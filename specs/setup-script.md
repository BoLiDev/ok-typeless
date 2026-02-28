# Setup Script

## Overview

A single setup script that installs whisper.cpp, llama.cpp (both with Metal GPU acceleration), and downloads the required models. The user runs this once after cloning the project to enable the local provider. It must be idempotent — safe to re-run without duplicating work.

## Requirements

- Install or build whisper.cpp with Metal support for macOS (Apple Silicon)
- Install or build llama.cpp with Metal support for macOS (Apple Silicon)
- Download the Whisper `large-v3-turbo` model in ggml format (~6 GB)
- Download the Llama 3.1 8B model in Q4_K_M GGUF quantization (~4.7 GB)
- Store all binaries and models within the project tree (e.g. `local-models/`) so the app can locate them by relative path
- Be idempotent: skip steps that are already complete (binary exists, model file exists)
- Print clear progress — model downloads are large and the user needs feedback
- Fail fast with actionable error messages if prerequisites are missing (Xcode CLI tools, cmake, Homebrew)
- Require no network connection after initial setup is complete

## Acceptance Criteria

- Running the script on a clean macOS (Apple Silicon) machine with Xcode CLI tools produces working `whisper-server` and `llama-server` binaries and both model files
- Running the script a second time completes in seconds with no redundant downloads or rebuilds
- The binaries start and respond to HTTP health checks when launched manually
- All artifacts land inside the project tree — nothing installed globally

## Edge Cases & Constraints

- Minimum ~12 GB free disk space required (models + build artifacts)
- Minimum 16 GB system RAM to run both models simultaneously
- Intel Macs are out of scope — Apple Silicon only
- The script should verify Homebrew, cmake, and Xcode CLI tools are present and error clearly if not

## Dependencies

- Xcode Command Line Tools (for Metal compilation)
- cmake (for building whisper.cpp and llama.cpp)
- Homebrew (for installing cmake if needed)
