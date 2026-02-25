# Connecting / Silence UI Design

## Problem

The current `connecting` state shows a pulsing dot with a "Connecting…" label — a distinct UI that adds visual noise for a transition that is nearly instantaneous. The `recording` silence state runs a breathing animation on the waveform bars via Framer Motion, but the low frame rate makes it feel unpolished.

## Goal

- Unify `connecting` and `recording` (silent) visually using the same waveform bar layout
- Make silence completely static — no animation until the user speaks
- Signal "connecting" via dimmed bar color; signal "ready" via full-brightness bars

## Approach: `dimmed` prop on Waveform (Option A)

Explicit prop on `Waveform` drives the visual state. CSS `transition: opacity` handles the light-up automatically on re-render.

## Component Changes

### `Waveform.tsx`

- Add `dimmed?: boolean` prop
- Apply `opacity: 0.28` to the waveform container when `dimmed`
- **Remove breathing animation**: change the silent `animate` target from `[MIN_HEIGHT, breathingPeak, MIN_HEIGHT]` with `repeat: Infinity` to `{ height: MIN_HEIGHT }` — bars spring to rest and stay static
- Speaking animation (vu-driven spring) is unchanged

### `Capsule.tsx`

- `connecting` case: replace dot + label with `<Waveform vu={0} dimmed showLabel={state.mode === "translate"} />`
- `recording` case: unchanged, but now `Waveform` renders statically when silent

### `capsule.css`

- Remove `.connecting-dot` and `@keyframes pulse` (dead code)
- Add `transition: opacity 0.25s ease` on `.waveform` for smooth gray → white light-up

## Visual Behaviour

| State              | Bars                    | Opacity |
|--------------------|-------------------------|---------|
| `connecting`       | static at MIN_HEIGHT    | ~28%    |
| `recording` silent | static at MIN_HEIGHT    | 100%    |
| `recording` speaking | spring-animated by vu | 100%    |

The opacity transition fires naturally as React re-renders with `dimmed` removed — no explicit animation logic required.

## Out of Scope

- Replacing Framer Motion for the speaking animation (vu-driven spring stays)
- Any changes to `processing` or `error` states
