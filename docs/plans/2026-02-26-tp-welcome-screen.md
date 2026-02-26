# tp Welcome Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace raw `electron-vite dev` output with a clean welcome screen when users run `tp`.

**Architecture:** Extract pure formatting logic into `scripts/welcome-screen.ts` (testable), and keep all IO/process side effects in `scripts/tp-welcome.ts` (untestable by design). `tp-start.sh` is updated to call the new entry point instead of `npm run start` directly.

**Tech Stack:** TypeScript, tsx (already in devDependencies), vitest, child_process (Node built-in)

---

### Task 1: Extend vitest config to cover scripts tests

The current `vitest.config.mts` only picks up `src/**/*.test.ts`. The formatting logic lives in `scripts/`, so we need to extend the include pattern.

**Files:**

- Modify: `vitest.config.mts`

**Step 1: Update the include pattern**

Change `vitest.config.mts` from:

```typescript
include: ["src/**/*.test.ts"],
```

to:

```typescript
include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
```

**Step 2: Verify tests still pass**

```bash
npm test
```

Expected: all existing tests pass (no new tests yet).

**Step 3: Commit**

```bash
git add vitest.config.mts
git commit -m "test: extend vitest to include scripts tests"
```

---

### Task 2: Create pure formatting module + tests

This module has zero side effects — it only takes a version string and returns a formatted string. The arrow-alignment behavior is the main thing worth testing.

**Files:**

- Create: `scripts/welcome-screen.ts`
- Create: `scripts/welcome-screen.test.ts`

**Step 1: Write the failing tests**

Create `scripts/welcome-screen.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildWelcomeScreen } from "./welcome-screen";

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("buildWelcomeScreen", () => {
  it("includes the version number", () => {
    const screen = buildWelcomeScreen("2.3.4");
    expect(screen).toContain("v2.3.4");
  });

  it("includes TYPELESS", () => {
    const screen = buildWelcomeScreen("1.0.0");
    expect(stripAnsi(screen)).toContain("TYPELESS");
  });

  it("aligns all arrows at the same column", () => {
    const plain = stripAnsi(buildWelcomeScreen("1.0.0"));
    const lines = plain.split("\n");
    const arrowColumns = lines
      .filter((line) => line.includes("→"))
      .map((line) => line.indexOf("→"));
    expect(arrowColumns.length).toBe(3);
    expect(new Set(arrowColumns).size).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './welcome-screen'`

**Step 3: Implement the formatting module**

Create `scripts/welcome-screen.ts`:

```typescript
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  white: "\x1b[37m",
} as const;

const LOGO = [
  "  ██████╗ ██╗  ██╗",
  "  ██╔═══██╗██║ ██╔╝",
  "  ██║   ██║█████╔╝ ",
  "  ██║   ██║██╔═██╗ ",
  "  ╚██████╔╝██║  ██╗",
  "   ╚═════╝ ╚═╝  ╚═╝",
] as const;

type Shortcut = { key: string; description: string };

const SHORTCUTS: Shortcut[] = [
  { key: "Hold Right ⌘", description: "speak" },
  { key: "Hold Right ⌘ + Shift", description: "speak → English" },
  { key: "Esc", description: "cancel" },
];

const LOGO_ANNOTATIONS: ReadonlyArray<(version: string) => string> = [
  () => "",
  () => `   ${ANSI.cyan}TYPELESS${ANSI.reset}`,
  (v) =>
    `   ${ANSI.dim}macOS voice input  ·  ${ANSI.reset}${ANSI.cyan}v${v}${ANSI.reset}`,
  () => "",
  () => "",
  () => "",
];

function buildShortcutLines(): string[] {
  const maxKeyWidth = Math.max(...SHORTCUTS.map((s) => s.key.length));
  return SHORTCUTS.map(
    (s) =>
      `  ${ANSI.white}${s.key.padEnd(maxKeyWidth)}${ANSI.reset}   ${ANSI.dim}→  ${s.description}${ANSI.reset}`,
  );
}

export function buildWelcomeScreen(version: string): string {
  const lines: string[] = [""];

  for (let i = 0; i < LOGO.length; i++) {
    const annotation = LOGO_ANNOTATIONS[i]?.(version) ?? "";
    lines.push(`${ANSI.bold}${ANSI.white}${LOGO[i]}${ANSI.reset}${annotation}`);
  }

  lines.push("");
  lines.push("");

  for (const line of buildShortcutLines()) {
    lines.push(line);
  }

  lines.push("");
  lines.push("");
  lines.push(
    `  ${ANSI.green}✓${ANSI.reset}  ${ANSI.dim}Running. Close this window anytime.${ANSI.reset}`,
  );
  lines.push("");

  return lines.join("\n");
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: 3 new tests pass, all existing tests still pass.

**Step 5: Commit**

```bash
git add scripts/welcome-screen.ts scripts/welcome-screen.test.ts
git commit -m "feat: add welcome screen formatting module with tests"
```

---

### Task 3: Create the tp entry point script

This file handles all side effects: reads `package.json`, writes to stdout, spawns the detached process, and keeps the process alive. None of this is unit-testable — the formatting it delegates to `welcome-screen.ts`.

**Files:**

- Create: `scripts/tp-welcome.ts`

**Step 1: Create the script**

Create `scripts/tp-welcome.ts`:

```typescript
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { buildWelcomeScreen } from "./welcome-screen";

function readVersion(): string {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf-8"),
  ) as { version: string };
  return pkg.version;
}

function launchApp(): void {
  const child = spawn("npm", ["run", "start"], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });
  child.unref();
}

process.stdout.write("\x1bc");
process.stdout.write(buildWelcomeScreen(readVersion()));

launchApp();

process.stdin.resume();
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
```

**Step 2: Verify it type-checks**

```bash
npm run typecheck
```

Expected: no errors.

**Step 3: Smoke-test manually**

```bash
cd /path/to/project
node_modules/.bin/tsx scripts/tp-welcome.ts
```

Expected: welcome screen appears, Electron app launches, terminal stays at the welcome screen. Press Ctrl+C — terminal exits, app keeps running.

**Step 4: Commit**

```bash
git add scripts/tp-welcome.ts
git commit -m "feat: add tp-welcome entry point script"
```

---

### Task 4: Update tp-start.sh to call the new script

**Files:**

- Modify: `scripts/alias/tp-start.sh`

**Step 1: Update the script**

Replace the contents of `scripts/alias/tp-start.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${PROJECT_ROOT}"
"${PROJECT_ROOT}/node_modules/.bin/tsx" scripts/tp-welcome.ts
```

Using `node_modules/.bin/tsx` directly avoids relying on `tsx` being in the system PATH (since this is called from a shell alias, not via `npm run`).

**Step 2: Smoke-test via the alias**

```bash
tp
```

Expected: screen clears, welcome screen appears, app launches in the background.

**Step 3: Commit**

```bash
git add scripts/alias/tp-start.sh
git commit -m "feat: tp command shows welcome screen instead of raw dev output"
```

---

### Task 5: Update README

**Files:**

- Modify: `scripts/alias/README.md`

**Step 1: Update the README**

Replace the "What `tp` Does" section:

```markdown
## What `tp` Does

`tp` launches the app in the background and shows a welcome screen in the terminal.
The app continues running even if you close the terminal window.

For full dev output (logs, errors, HMR), run `npm run start` directly.
```

**Step 2: Commit**

```bash
git add scripts/alias/README.md
git commit -m "docs: update tp README to reflect welcome screen behavior"
```
