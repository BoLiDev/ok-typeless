# Connecting / Silence UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dedicated connecting UI with dimmed waveform bars, and make the silence state fully static (no breathing animation).

**Architecture:** `Waveform` gains a `dimmed` prop that sets CSS opacity on the container. Silence removes the Framer Motion breathing loop — bars spring to MIN_HEIGHT and stay static. `Capsule` renders `Waveform` for both `connecting` and `recording`, passing `dimmed` only during connecting. A CSS `transition: opacity` on `.waveform` gives the smooth light-up for free.

**Tech Stack:** React, TypeScript, Framer Motion (speech animation only), CSS

---

### Task 1: Remove breathing animation and add `dimmed` prop to Waveform

**Files:**
- Modify: `src/renderer/components/Waveform.tsx`
- Modify: `src/renderer/styles/capsule.css`

**Step 1: Remove the breathing animation — silence becomes static**

In `Waveform.tsx`, the `isSilent` branch of `animate` currently runs a looping height array. Change it to a static target.

Find this block:
```tsx
animate={
  isSilent
    ? { height: [MIN_HEIGHT, breathingPeak, MIN_HEIGHT] }
    : { height: driven }
}
transition={
  isSilent
    ? {
        height: {
          duration: 1.3 + (i % 4) * 0.15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: i * 0.07,
        },
      }
    : { height: HEIGHT_SPRING }
}
```

Replace with:
```tsx
animate={{ height: isSilent ? MIN_HEIGHT : driven }}
transition={{ height: HEIGHT_SPRING }}
```

Also remove the now-unused `breathingPeak` variable:
```tsx
// DELETE this line:
const breathingPeak = MIN_HEIGHT + max * 0.15;
```

**Step 2: Add the `dimmed` prop**

Update the `Props` type at the top of `Waveform.tsx`:
```tsx
type Props = {
  vu: number;
  showLabel: boolean;
  dimmed?: boolean;
};
```

Update the function signature:
```tsx
export function Waveform({ vu, showLabel, dimmed = false }: Props): React.ReactElement {
```

Apply dimmed opacity to the waveform container div:
```tsx
<div className="waveform" style={dimmed ? { opacity: 0.28 } : undefined}>
```

**Step 3: Add CSS opacity transition so the light-up is smooth**

In `capsule.css`, add a transition to `.waveform`:
```css
.waveform {
  display: flex;
  align-items: center;
  gap: 2.5px;
  height: 22px;
  transition: opacity 0.25s ease;
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```bash
git add src/renderer/components/Waveform.tsx src/renderer/styles/capsule.css
git commit -m "refactor: remove Waveform breathing animation, add dimmed prop"
```

---

### Task 2: Update Capsule to use Waveform for connecting state, remove dead CSS

**Files:**
- Modify: `src/renderer/components/Capsule.tsx`
- Modify: `src/renderer/styles/capsule.css`
- Modify: `src/renderer/components/Capsule.stories.tsx`

**Step 1: Replace connecting UI in Capsule**

In `Capsule.tsx`, find the `connecting` case:
```tsx
case "connecting":
  return (
    <>
      <div className="connecting-dot" />
      <span className="capsule-label">
        {state.mode === "translate" ? "Translate" : "Connecting…"}
      </span>
    </>
  );
```

Replace with:
```tsx
case "connecting":
  return <Waveform vu={0} dimmed showLabel={state.mode === "translate"} />;
```

**Step 2: Remove dead CSS**

In `capsule.css`, delete the `.connecting-dot` rule and `@keyframes pulse`:
```css
/* DELETE these: */
.connecting-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.35; transform: scale(0.75); }
}
```

**Step 3: Update Storybook stories**

The `ConnectingTranscribe` and `ConnectingTranslate` stories still work as-is (they pass `state` and `vu` to `Capsule` — no change needed to their args). No update required.

However, the `FullFlow` story's `connecting` step duration of 900ms is a good chance to visually verify the light-up transition. No code change needed — just note it for manual verification.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```bash
git add src/renderer/components/Capsule.tsx src/renderer/styles/capsule.css
git commit -m "feat: use dimmed waveform bars for connecting state, remove pulse dot"
```
