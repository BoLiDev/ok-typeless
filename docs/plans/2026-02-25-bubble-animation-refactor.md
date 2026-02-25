# Bubble Animation Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove Framer Motion from `Capsule.tsx` and `TipBubble.tsx`, replacing state-transition animations with plain React re-renders and entry animations with CSS keyframes.

**Architecture:** State content switches become instant React re-renders (no AnimatePresence, no motion wrappers). Capsule and TipBubble entry animations are driven by CSS `@keyframes` applied on mount. Framer Motion stays only in `Waveform.tsx` where spring physics are genuinely needed.

**Tech Stack:** React, CSS keyframes, TypeScript. Framer Motion remains in package.json (used by Waveform).

---

### Task 1: Add CSS keyframe animations

**Files:**
- Modify: `src/renderer/styles/capsule.css`

**Step 1: Add the `capsule-enter` keyframe and apply it to `.capsule`**

In `capsule.css`, add the keyframe after the existing `@keyframes pulse` block, and add the `animation` property to the `.capsule` rule:

```css
@keyframes capsule-enter {
  from { opacity: 0; transform: scale(0.82) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

Add to the `.capsule` rule:
```css
animation: capsule-enter 0.2s cubic-bezier(0.34, 1.2, 0.64, 1) both;
```

The full updated `.capsule` rule becomes:
```css
.capsule {
  position: relative;
  width: fit-content;
  padding: 0 20px;
  height: 44px;
  background: #000;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
  animation: capsule-enter 0.2s cubic-bezier(0.34, 1.2, 0.64, 1) both;
}
```

**Step 2: Add the `tip-enter` keyframe and apply it to `.tip-bubble`**

The tip bubble uses `transform: translateX(-50%)` for centering. The keyframe must include this transform in both states to avoid a visual jump:

```css
@keyframes tip-enter {
  from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.95); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
```

Add to the `.tip-bubble` rule:
```css
animation: tip-enter 0.15s ease-out both;
```

The full updated `.tip-bubble` rule becomes:
```css
.tip-bubble {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #000;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 10px;
  white-space: nowrap;
  pointer-events: none;
  animation: tip-enter 0.15s ease-out both;
}
```

**Step 3: Verify CSS compiles without errors**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add src/renderer/styles/capsule.css
git commit -m "feat: replace Framer Motion entry animations with CSS keyframes"
```

---

### Task 2: Refactor Capsule.tsx

**Files:**
- Modify: `src/renderer/components/Capsule.tsx`

**Step 1: Rewrite the file**

Replace the entire file content with:

```tsx
import type { AppState } from "@shared/types";
import { Waveform } from "./Waveform";
import { TipBubble } from "./TipBubble";
import "../styles/capsule.css";

type Props = {
  state: Exclude<AppState, { status: "idle" }>;
  vu: number;
};

function CapsuleContent({ state, vu }: Props): React.ReactElement {
  switch (state.status) {
    case "connecting":
      return (
        <>
          <div className="connecting-dot" />
          <span className="capsule-label">
            {state.mode === "translate" ? "Translate" : "Connecting…"}
          </span>
        </>
      );

    case "recording":
      return <Waveform vu={vu} showLabel={state.mode === "translate"} />;

    case "processing":
      return (
        <span className="capsule-label">
          {state.mode === "translate" ? "Translating…" : "Transcribing…"}
        </span>
      );

    case "error":
      return <span className="capsule-label">✕</span>;
  }
}

export function Capsule({ state, vu }: Props): React.ReactElement {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {state.status === "error" && <TipBubble message={state.message} />}
      <div className="capsule">
        <div className="capsule-content">
          <CapsuleContent state={state} vu={vu} />
        </div>
      </div>
    </div>
  );
}
```

Key changes from original:
- Removed `AnimatePresence`, `motion` imports (framer-motion no longer imported)
- `motion.div.capsule` → plain `div.capsule` (entry animation now CSS)
- Removed `layout`, `initial`, `animate`, `transition` props from capsule div
- Removed `AnimatePresence mode="popLayout"` wrapper around content
- Removed `motion.div.capsule-content` wrapper — now a plain `div`
- `state.status === "error"` condition renders `TipBubble` directly (no AnimatePresence key)

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/renderer/components/Capsule.tsx
git commit -m "refactor: remove Framer Motion from Capsule, use plain div + CSS animation"
```

---

### Task 3: Refactor TipBubble.tsx

**Files:**
- Modify: `src/renderer/components/TipBubble.tsx`

**Step 1: Rewrite the file**

Replace the entire file content with:

```tsx
type Props = {
  message: string;
};

export function TipBubble({ message }: Props): React.ReactElement {
  return <div className="tip-bubble">{message}</div>;
}
```

Key changes:
- Removed `motion` import (framer-motion no longer imported)
- `motion.div` → plain `div` (entry animation now CSS via `tip-enter` keyframe)
- Removed `initial`, `animate`, `exit`, `transition` props

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/renderer/components/TipBubble.tsx
git commit -m "refactor: remove Framer Motion from TipBubble, use plain div + CSS animation"
```

---

### Task 4: Verify in Storybook

**Files:** none

**Step 1: Start Storybook**

Run: `npm run storybook`

**Step 2: Check each story visually**

Open each story and verify:

| Story | What to check |
|-------|---------------|
| `ConnectingTranscribe` | Capsule animates in (scale + fade), dot pulses |
| `RecordingTranscribe` | Waveform bars respond to `vu=0.6` |
| `RecordingSilence` | Waveform bars breathe with `vu=0.0` |
| `ErrorState` | Capsule shows ✕, TipBubble animates in above capsule |
| `FullFlow` | States snap instantly (no squeeze), waveform animates |

**Step 3: Verify no content squeezing**

In `FullFlow`, watch the transition from `connecting` → `recording` → `processing`. The content should switch instantly — no compression, no cross-fade.

**Step 4: Commit**

No code changes — if everything looks good, no commit needed for this task.
