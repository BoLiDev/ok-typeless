# Bubble Animation Redesign

**Date:** 2026-02-25
**Status:** Approved

## Problem

The current `Capsule.tsx` uses Framer Motion's `layout="size"` and `AnimatePresence mode="popLayout"` for state transitions. When the state changes (e.g. connecting → recording), the container resizes and the content cross-fades simultaneously. These two animations fight each other, causing content to be visually compressed mid-transition.

## Decision

State transitions are **instant snaps** — no cross-fade, no layout animation between states. Only within-state animations (the waveform bars) need to be smooth.

Framer Motion is kept only in `Waveform.tsx`, where spring physics and infinite breathing loops add genuine value. `Capsule.tsx` and `TipBubble.tsx` drop all Framer Motion usage.

## Design

### State transitions

Plain React re-renders. When `state.status` changes, `CapsuleContent` immediately renders the new content. No `AnimatePresence`, no `motion.div` wrapper around content.

### Entry animations (CSS keyframes)

Both the capsule and the tip bubble animate in on mount via CSS `@keyframes`. This replaces Framer Motion's `initial`/`animate` props.

**Capsule entry** — scale + fade, light overshoot:
```css
@keyframes capsule-enter {
  from { opacity: 0; transform: scale(0.82) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```
Applied with `cubic-bezier(0.34, 1.2, 0.64, 1)` over ~200ms.

**Tip bubble entry** — scale + fade:
```css
@keyframes tip-enter {
  from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.95); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
```
Applied with `ease-out` over ~150ms.

### Exit animations

Capsule and tip bubble disappear instantly when React unmounts them. CSS cannot animate before unmount without additional state complexity. Instant exit is acceptable — transition polish is not a requirement.

### Waveform

`Waveform.tsx` is unchanged. Framer Motion stays in `package.json`.

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/components/Capsule.tsx` | Remove `motion.div`, `AnimatePresence`, `layout`, Framer Motion import |
| `src/renderer/components/TipBubble.tsx` | Remove `motion.div`, Framer Motion import |
| `src/renderer/styles/capsule.css` | Add `capsule-enter` and `tip-enter` keyframes |
| `src/renderer/components/Waveform.tsx` | No change |
