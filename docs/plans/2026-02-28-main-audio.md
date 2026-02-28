# Main-Process Launch Cue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move launch-cue audio playback from the renderer's Web Audio pipeline into the main process using macOS's native `afplay` binary.

**Architecture:** Strip all audio logic from `useAudioRecorder.ts`. Add a `playLaunchCue()` function to `ipc-handlers.ts` that calls `spawn('afplay', [path])`. Wire it into `handleMicReady()` so the sound fires at the same moment as today — after the renderer confirms the mic stream is live.

**Tech Stack:** Node.js `child_process.spawn`, macOS `afplay`, vitest + `vi.mock`

---

### Task 1: Strip audio from the renderer

**Files:**
- Modify: `src/renderer/hooks/useAudioRecorder.ts`

**Step 1: Remove the `LAUNCH_CUE_URL` constant and the `playLaunchCue` function**

Delete lines 8–25 in `useAudioRecorder.ts` (the `const LAUNCH_CUE_URL = ...` block and the entire `async function playLaunchCue(...)` function).

**Step 2: Remove the call site**

Delete the `void playLaunchCue(ctx);` line inside `startRecording()`.

**Step 3: Verify the renderer still compiles**

```bash
npm run typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/renderer/hooks/useAudioRecorder.ts
git commit -m "refactor: remove launch cue from renderer"
```

---

### Task 2: Add `playLaunchCue` to the main process and test it

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Create: `src/main/ipc-handlers.test.ts`

**Step 1: Write the failing test**

Create `src/main/ipc-handlers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const spawnMock = vi.fn(() => ({ on: vi.fn() }));

vi.mock("electron", () => ({
  ipcMain: { on: vi.fn() },
  BrowserWindow: vi.fn(),
}));

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

describe("playLaunchCue", () => {
  beforeEach(() => {
    spawnMock.mockClear();
  });

  it("spawns afplay with the launch.mp3 path", async () => {
    const { playLaunchCue } = await import("./ipc-handlers");
    playLaunchCue();
    expect(spawnMock).toHaveBeenCalledWith(
      "afplay",
      [expect.stringContaining("launch.mp3")],
    );
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/main/ipc-handlers.test.ts
```

Expected: FAIL — `playLaunchCue is not a function` (it doesn't exist yet).

**Step 3: Add `playLaunchCue` to `ipc-handlers.ts`**

Add at the top of the file, after the existing imports:

```typescript
import { spawn } from "child_process";
import { join } from "path";
```

Add the function before `registerIpcHandlers`:

```typescript
export function playLaunchCue(): void {
  const audioPath = join(__dirname, "../../audio/launch.mp3");
  const proc = spawn("afplay", [audioPath]);
  proc.on("error", (err) => console.error("[launch-cue]", err));
}
```

**Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/main/ipc-handlers.test.ts
```

Expected: PASS.

**Step 5: Wire `playLaunchCue` into `handleMicReady`**

In `handleMicReady()`, call it before advancing the state machine:

```typescript
function handleMicReady(): void {
  ipcMain.on(IPC_CHANNELS.MIC_READY, () => {
    playLaunchCue();
    stateMachine.send({ type: "MIC_READY" });
  });
}
```

**Step 6: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/ipc-handlers.test.ts
git commit -m "feat: play launch cue in main process via afplay"
```
