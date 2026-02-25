# Ralph Setup Design

**Date:** 2026-02-25
**Status:** Approved

## Context

All 13 MVP tasks are complete. This document covers the setup of Ralph — an autonomous bash-driven Claude Code loop — for future feature development on ok-typeless.

Ralph runs `claude --dangerously-skip-permissions --print` repeatedly from a bash script. Each iteration implements one user story from a `prd.json` task list, commits the work, and marks the story complete. The loop exits when all stories pass or max iterations are reached.

## Directory Structure

```
.ralph/
  ralph.sh          # upstream ralph.sh adapted with .ralph/* paths
  CLAUDE.md         # Ralph agent prompt (separate from project CLAUDE.md)
  prd.json          # task list; populate before each Ralph run
  progress.txt      # append-only knowledge base; committed to git
  archive/          # auto-created when branch changes
```

The project root `CLAUDE.md` is untouched. `.ralph/CLAUDE.md` is the agent's prompt.

`progress.txt` is committed to git so the agent accumulates project-specific knowledge across runs.

## `ralph.sh` Path Adjustments

Three variables at the top of the upstream script are changed:

```bash
CLAUDE_FILE=".ralph/CLAUDE.md"
PROGRESS_FILE=".ralph/progress.txt"
ARCHIVE_DIR=".ralph/archive"
```

All `prd.json` references become `.ralph/prd.json`. All other loop logic, completion detection, and archiving behavior is unchanged.

**Invocation:**

```bash
bash .ralph/ralph.sh --tool claude --max-iterations 20
```

**Completion signal the agent must output:**

```
<promise>COMPLETE</promise>
```

## `.ralph/CLAUDE.md` Structure

The agent prompt contains four sections:

1. **Project context pointer** — instructs the agent to read root `CLAUDE.md` and `docs/` for architecture, conventions, and tech stack
2. **Workflow** — read `.ralph/prd.json`, pick highest-priority story where `passes: false`, implement it, run `tsc` and `npm test`, commit, set `passes: true`
3. **Progress log** — append implementation summary and learnings to `.ralph/progress.txt`
4. **Completion signal** — if all stories are `passes: true`, output `<promise>COMPLETE</promise>`

The agent is explicitly instructed to follow `~/.claude/CLAUDE.md` coding principles (readability, encapsulation, TypeScript safety, back pressure).

## `prd.json` Starting State

Starts as an empty template; populate before each Ralph run:

```json
{
  "project": "ok-typeless",
  "branchName": "master",
  "description": "",
  "userStories": []
}
```

## Housekeeping

- `docs/plans/2026-02-25-mvp.md` moved to `docs/archive/` (all 13 tasks complete)
- Project root `CLAUDE.md` updated to reflect completed status and Ralph setup
