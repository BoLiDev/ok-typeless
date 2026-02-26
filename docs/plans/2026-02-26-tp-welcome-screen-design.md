# tp Welcome Screen Design

## Goal

When users run `tp`, show a clean welcome screen instead of raw `electron-vite dev` output.
`npm run start` remains unchanged for developers who want full logs.

## Behavior

- `tp` launches the Electron app in the background (detached, stdout/stderr suppressed)
- Terminal stays at the welcome screen
- Closing the terminal does **not** kill the app
- Pressing Ctrl+C exits only the terminal script; app continues running

## Visual Design

Minimal, no border. Arrows vertically aligned.

```
  ██████╗ ██╗  ██╗
  ██╔═══██╗██║ ██╔╝   TYPELESS
  ██║   ██║█████╔╝    macOS voice input  ·  v1.0.0
  ██║   ██║██╔═██╗
  ╚██████╔╝██║  ██╗
   ╚═════╝ ╚═╝  ╚═╝


  Hold Right ⌘           →  speak in Chinese
  Hold Right ⌘ + Shift   →  speak in English
  Esc                    →  cancel


  ✓  Running. Close this window anytime.
```

### Color scheme

| Element | Color |
|---------|-------|
| Pixel logo | bold white |
| `TYPELESS` / `v1.0.0` | cyan |
| `macOS voice input  ·` | dim/gray |
| Shortcut keys (`Hold Right ⌘`, `Esc`) | white |
| `→` + description | dim/gray |
| `✓` | green |
| Status text | dim/gray |

### Dynamic content

- `v1.0.0` — read from `package.json` at runtime
- `speak in Chinese` / `speak in English` — static (these are the two fixed modes)

## File Changes

| File | Action |
|------|--------|
| `scripts/tp-welcome.ts` | New — prints welcome screen, spawns detached process |
| `scripts/alias/tp-start.sh` | Modified — call `tsx scripts/tp-welcome.ts` instead of `npm run start` |

## Implementation Notes

- Use `child_process.spawn('npm', ['run', 'start'], { detached: true, stdio: 'ignore' })` then `unref()` to fully detach
- Keep the welcome script alive with `process.stdin.resume()` so the terminal doesn't exit
- ANSI colors via raw escape codes (no new dependency)
- Version read via `JSON.parse(fs.readFileSync('package.json'))` relative to project root
- Arrow alignment: pad each key label to the width of the longest (`Hold Right ⌘ + Shift` = 20 chars), then `  →  `
