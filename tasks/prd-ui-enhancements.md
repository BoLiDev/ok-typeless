# PRD: UI Enhancements

## Introduction

Four targeted improvements to the ok-typeless UI and UX:

1. **Capsule border** — a light silver-gray border to define the capsule edge against any background
2. **Waveform animation** — replace the VU-driven animation (barely moves at low signal) with a self-driven, scribe-style infinite keyframe animation that always looks fluid
3. **Tray icon** — replace the aliased PNG circle with a Unicode character rendered as a text title
4. **Skip Post-Processing** — a persistent tray menu toggle that outputs raw Whisper text instead of LLM-processed text

---

## Goals

- Capsule looks polished and clearly bounded on any desktop background
- Audio animation feels fluid and organic at all signal levels
- Tray icon is crisp and professional at all display densities
- Power users can bypass the LLM step for speed or debugging

---

## User Stories

### US-001: Capsule silver-gray border

**Description:** As a user, I want the capsule to have a subtle silver-gray border so its boundaries are clearly visible regardless of desktop background.

**Acceptance Criteria:**
- [ ] `.capsule` has a 1px border in a light silver-gray color (e.g. `rgba(255,255,255,0.18)` or similar that passes visual review)
- [ ] Border is visible on both dark and light desktop wallpapers
- [ ] No other capsule styling is changed
- [ ] Typecheck passes

---

### US-002: Scribe-style waveform animation

**Description:** As a user, I want the recording animation to look fluid and organic so the capsule feels alive during voice input.

**Acceptance Criteria:**
- [ ] `Waveform.tsx` uses infinite repeating keyframe animations per bar, not VU-driven heights
- [ ] 8 bars with a frequency-amplitude profile: center bars taller, outer bars shorter
- [ ] Each bar has a unique animation duration and staggered delay (derived from bar index), creating organic-looking movement
- [ ] During `recording` state: bars animate continuously (no VU input required for movement)
- [ ] During `connecting` state: bars are static/dimmed (unchanged from current behavior)
- [ ] Animation uses `framer-motion` (already a project dependency); no new dependencies added
- [ ] The `vu` prop may be removed or kept as an optional amplitude multiplier — implementer's call
- [ ] Typecheck passes

**Reference implementation:** `/Users/libo/workspace/project/scribe/src/renderer/src/dictation/components/Scriber/components/ScriberBars.tsx`

The key technique: each bar gets `keyframes: [minH%, mid1%, mid2%, ..., minH%]` with `repeat: Infinity` and a per-bar `delay` and `duration` derived from `Math.sin(index * constant)`.

---

### US-003: Replace tray icon with Unicode character

**Description:** As a user, I want the menu bar icon to be crisp and professional so it doesn't look jagged at any display density.

**Acceptance Criteria:**
- [ ] The PNG icon is no longer used as the primary visual (or is replaced with a minimal template image)
- [ ] `tray.setTitle()` is called with a suitable Unicode character (suggested: `⊙`, `◉`, or similar non-emoji symbol — implementer chooses the most visually appropriate)
- [ ] The icon/title looks sharp on Retina displays
- [ ] The tooltip `"ok-typeless"` is preserved
- [ ] Typecheck passes

**Technical note:** On macOS, `tray.setTitle(char)` renders text natively in the menu bar with no aliasing. A 1×1 transparent template PNG can be used as the icon image if Electron requires a non-null image. Alternatively, create a proper `nativeImage` template from a simple SVG.

---

### US-004: Settings persistence module

**Description:** As a developer, I need a simple persistent settings store so user preferences survive app restarts.

**Acceptance Criteria:**
- [ ] New file `src/main/settings-store.ts` with a `SettingsStore` class (or equivalent module)
- [ ] Settings are stored as JSON in `app.getPath('userData')/settings.json`
- [ ] Exported API: `get(): Settings`, `set(patch: Partial<Settings>): void`
- [ ] `Settings` type defined in `src/shared/types.ts`: `{ skipPostProcessing: boolean }`
- [ ] Handles missing or malformed file gracefully (falls back to defaults)
- [ ] No new npm dependencies — use Node `fs` directly
- [ ] Typecheck passes

---

### US-005: Skip Post-Processing toggle in tray menu and API

**Description:** As a user, I want a tray menu option to skip LLM post-processing so I get faster raw output when I don't need cleanup.

**Acceptance Criteria:**
- [ ] Tray context menu includes a checkmark menu item: `"Skip Post-Processing"`
- [ ] Clicking the item toggles the setting and updates the checkmark immediately
- [ ] The setting is persisted via the `SettingsStore` from US-004
- [ ] When `skipPostProcessing` is `true`:
  - Transcribe mode: `transcribe()` in `api.ts` returns `sttRaw` as the final output (LLM call is skipped)
  - Translate mode: `transcribe()` calls the LLM with a simplified translate-only prompt (no formatting/cleanup step — just "translate to English, return only the translation")
- [ ] When `skipPostProcessing` is `false`: existing behavior is unchanged
- [ ] Typecheck passes

---

### US-006: Capsule indicator for Skip Post-Processing

**Description:** As a user, I want to see in the capsule when Skip Post-Processing is active so I'm never surprised by unformatted output.

**Acceptance Criteria:**
- [ ] When `skipPostProcessing` is active, the capsule shows a subtle `"raw"` label during `recording` and `processing` states
- [ ] The label uses the existing `.capsule-label` style (dimmed white text)
- [ ] The label does not appear when `skipPostProcessing` is `false`
- [ ] The `skipPostProcessing` flag is surfaced to the renderer: add it to `AppState` or send it as a separate `SETTINGS_UPDATE` IPC event on startup and on each toggle — implementer chooses the cleanest approach
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** `.capsule` in `capsule.css` gains a 1px solid light-silver border
- **FR-2:** `Waveform.tsx` uses `framer-motion` infinite keyframe animations with per-bar frequency-amplitude profiles and staggered timing
- **FR-3:** Tray icon rendered as a Unicode character via `tray.setTitle()` with no aliasing
- **FR-4:** `src/main/settings-store.ts` exposes `get()` / `set()` backed by `userData/settings.json`
- **FR-5:** `Settings` type (`{ skipPostProcessing: boolean }`) lives in `src/shared/types.ts`
- **FR-6:** Tray context menu has a checkmark toggle for Skip Post-Processing
- **FR-7:** `transcribe()` in `api.ts` respects `skipPostProcessing`: skips LLM in transcribe mode, uses a raw-translate prompt in translate mode
- **FR-8:** Active skip-post-processing state is communicated to the renderer and shown as a `"raw"` label in the capsule

---

## Non-Goals

- No new translation engine or Whisper task configuration
- No settings UI window — tray menu is the only settings surface
- No other settings beyond `skipPostProcessing` in this iteration
- No changes to the hotkey behavior or state machine transitions

---

## Technical Considerations

- `framer-motion` is already installed — no new dependency for US-002
- `electron-store` is NOT to be used — keep Node `fs` to avoid adding a dependency
- For US-003, Electron requires a valid `nativeImage` for `new Tray(image)` — a 1×1 transparent PNG or a proper template image must still be passed; `setTitle()` adds text alongside it
- For US-006, the simplest IPC approach is adding `skipPostProcessing?: boolean` to the non-idle `AppState` variants, or sending a dedicated `SETTINGS_UPDATE` channel at startup and on toggle. The state machine does not need to change — settings are orthogonal to recording state.

---

## Success Metrics

- Capsule edge is visible on any wallpaper without looking heavy
- Animation looks natural and organic without requiring the user to actually speak loudly
- Tray icon is pixel-perfect on Retina displays
- Skip Post-Processing output matches raw Whisper text exactly (verifiable via existing session logs)

---

## Open Questions

- Should the `vu` prop be retained in `Waveform.tsx` as an optional amplitude multiplier, or removed entirely? (Either is acceptable — the animation should look good regardless)
- Which specific Unicode character best represents the app in the menu bar? (Suggested candidates: `⊙` U+2299, `◉` U+25C9, `⎙` U+2399 — implementer decides)
