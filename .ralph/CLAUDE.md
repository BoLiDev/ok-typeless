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
