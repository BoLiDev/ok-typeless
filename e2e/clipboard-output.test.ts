import { test, expect, _electron as electron } from "@playwright/test";
import { join } from "path";

// Requires macOS accessibility permissions for uiohook keyTap to work.
// Run with: npm run test:e2e

test("pasteText pastes text into the focused input", async () => {
  const electronApp = await electron.launch({
    args: [join(__dirname, "fixtures/paste-main.cjs")],
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState("domcontentloaded");

  // Focus the input
  await electronApp.evaluate(async ({ app }) => {
    await (app as unknown as { focusInput: () => Promise<void> }).focusInput();
  });

  // Set a known original clipboard value
  await electronApp.evaluate(({ clipboard }) => {
    clipboard.writeText("__original__");
  });

  // Call pasteText
  await electronApp.evaluate(async ({ app }) => {
    await (
      app as unknown as { pasteText: (t: string) => Promise<void> }
    ).pasteText("hello world");
  });

  // Text should land in the input
  const inputValue = await electronApp.evaluate(async ({ app }) => {
    return (
      app as unknown as { getInputValue: () => Promise<string> }
    ).getInputValue();
  });
  expect(inputValue).toBe("hello world");

  // Original clipboard should be restored
  const clipboardValue = await electronApp.evaluate(({ app }) => {
    return (app as unknown as { getClipboard: () => string }).getClipboard();
  });
  expect(clipboardValue).toBe("__original__");

  await electronApp.close();
});
