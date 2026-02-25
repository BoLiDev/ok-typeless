# Ralph Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the bash-driven Ralph autonomous loop in `.ralph/`, install the ralph-skills plugin, and clean up stale project docs.

**Architecture:** Ralph lives entirely in `.ralph/`. The upstream `ralph.sh` uses `SCRIPT_DIR` so it resolves all file paths relative to its own location — no modifications needed. A separate `.ralph/CLAUDE.md` holds the agent prompt; the project root `CLAUDE.md` is untouched.

**Tech Stack:** bash, jq (already installed), `claude --dangerously-skip-permissions --print`

---

### Task 1: Register the ralph-marketplace and install ralph-skills

**Files:**
- Modify: `~/.claude/plugins/known_marketplaces.json`

**Step 1: Add the ralph-marketplace entry**

Open `~/.claude/plugins/known_marketplaces.json` and add the following entry inside the top-level object:

```json
"ralph-marketplace": {
  "source": {
    "source": "github",
    "repo": "snarktank/ralph"
  },
  "installLocation": "/Users/libo/.claude/plugins/marketplaces/ralph-marketplace",
  "lastUpdated": "2026-02-25T00:00:00.000Z"
}
```

**Step 2: Install the plugin via Claude Code**

In a Claude Code session, run:

```
/plugin install ralph-skills@ralph-marketplace
```

Expected: Two new skills appear — one for writing PRDs, one for converting PRDs to `prd.json` format.

**Step 3: Verify skills are available**

In a Claude Code session, confirm these slash commands are now listed:
- A skill triggered by "write a PRD" or similar
- A skill triggered by "convert this PRD" / "create prd.json"

**Step 4: Commit nothing** — plugin installation is user-level (`~/.claude/`), not project-level.

---

### Task 2: Create `.ralph/ralph.sh`

**Files:**
- Create: `.ralph/ralph.sh`

**Step 1: Create the file**

Copy the upstream script exactly — no path changes needed because `SCRIPT_DIR` already resolves everything relative to `.ralph/`:

```bash
#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--tool amp|claude] [max_iterations]

set -e

TOOL="amp"
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp' or 'claude'."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    DATE=$(date +%Y-%m-%d)
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"

    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | amp --dangerously-allow-all 2>&1 | tee /dev/stderr) || true
  else
    OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true
  fi

  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi

  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
```

**Step 2: Make it executable**

```bash
chmod +x .ralph/ralph.sh
```

**Step 3: Commit**

```bash
git add .ralph/ralph.sh
git commit -m "feat: add .ralph/ralph.sh"
```

---

### Task 3: Create `.ralph/CLAUDE.md`

**Files:**
- Create: `.ralph/CLAUDE.md`

**Step 1: Write the agent prompt**

```markdown
# Ralph Agent Instructions

You are an autonomous coding agent implementing tasks for the ok-typeless project.

## Before You Start

1. Read `/CLAUDE.md` for project architecture, tech stack, and conventions.
2. Read `~/.claude/CLAUDE.md` for coding principles (readability, encapsulation, TypeScript safety, back pressure). These are non-negotiable.
3. Read `.ralph/progress.txt` for a log of what previous iterations have done.
4. Read `.ralph/prd.json` to see all user stories and their completion status.

## Your Workflow (follow exactly)

1. Read `.ralph/prd.json`. Find the highest-priority story (`priority` field, lowest number first) where `passes` is `false`.
2. If no such story exists — all stories have `passes: true` — output `<promise>COMPLETE</promise>` and stop.
3. Implement the story fully. Follow the acceptance criteria exactly.
4. Run quality checks: `npm run typecheck` and `npm test`. Both must pass before you commit. Fix failures before proceeding.
5. Commit the changes with a descriptive message.
6. Set `passes: true` for the completed story in `.ralph/prd.json` and commit that change.
7. Append a summary to `.ralph/progress.txt`:
   - What story you completed
   - Which files you changed
   - Any gotchas, patterns, or learnings worth knowing for future iterations
8. Commit the progress.txt update.
9. Output `<promise>COMPLETE</promise>` if all stories now pass. Otherwise stop — the loop will restart you.

## Quality Standards

- `npm run typecheck` must pass with zero errors (no `any`, no `as unknown as`).
- `npm test` must pass. Do not commit broken tests.
- Follow all conventions in `/CLAUDE.md` and `~/.claude/CLAUDE.md`.
- Each commit should be atomic and meaningful.
```

**Step 2: Commit**

```bash
git add .ralph/CLAUDE.md
git commit -m "feat: add .ralph/CLAUDE.md agent prompt"
```

---

### Task 4: Create `.ralph/prd.json`

**Files:**
- Create: `.ralph/prd.json`

**Step 1: Write the empty template**

```json
{
  "project": "ok-typeless",
  "branchName": "master",
  "description": "",
  "userStories": []
}
```

**Step 2: Commit**

```bash
git add .ralph/prd.json
git commit -m "feat: add .ralph/prd.json template"
```

---

### Task 5: Archive stale plan docs and update CLAUDE.md

**Files:**
- Create dir: `docs/archive/`
- Move: `docs/plans/2026-02-25-mvp.md` → `docs/archive/2026-02-25-mvp.md`
- Modify: `CLAUDE.md`

**Step 1: Create archive dir and move the old plan**

```bash
mkdir -p docs/archive
git mv docs/plans/2026-02-25-mvp.md docs/archive/2026-02-25-mvp.md
```

**Step 2: Update `CLAUDE.md` — replace the Current Status section**

Find:
```
## Current Status

Tasks 1–9 complete on branch `feature/implement` (worktree: `.worktrees/implement`).
Tasks 10–13 in progress.

VAD (voice activity detection) added to design — see tech design for details. Auto-submits after 1.5 s of silence. Two new IPC channels: `mic-ready`, `mic-error`.
```

Replace with:
```
## Current Status

All 13 MVP tasks complete. The app is fully functional on `master`.

Ralph autonomous loop is set up in `.ralph/`. To run new feature work:
1. Populate `.ralph/prd.json` with user stories (use the ralph-skills PRD workflow).
2. Run: `bash .ralph/ralph.sh --tool claude --max-iterations 20`
```

Also remove this stale line from Key Documents:
```
- Implementation Plan: `docs/plans/2026-02-25-mvp.md`
```

**Step 3: Commit**

```bash
git add docs/archive/2026-02-25-mvp.md CLAUDE.md
git commit -m "docs: archive MVP plan, update CLAUDE.md to reflect completed status and Ralph setup"
```

---

### Task 6: Verify the setup

**Step 1: Confirm directory structure**

```bash
ls -la .ralph/
```

Expected output:
```
CLAUDE.md
prd.json
ralph.sh
```

**Step 2: Dry-run ralph.sh**

```bash
bash .ralph/ralph.sh --tool claude --max-iterations 1
```

With an empty `userStories` array, the first iteration should output `<promise>COMPLETE</promise>` immediately and exit 0.

**Step 3: Confirm progress.txt was created**

```bash
cat .ralph/progress.txt
```

Expected: header line "# Ralph Progress Log" with a start timestamp.

**Step 4: Commit progress.txt**

```bash
git add .ralph/progress.txt
git commit -m "chore: add initial .ralph/progress.txt from dry run"
```
