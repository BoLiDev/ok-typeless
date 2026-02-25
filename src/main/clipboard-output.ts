import { clipboard } from "electron";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pasteText(text: string): Promise<void> {
  const original = clipboard.readText();
  clipboard.writeText(text);
  if (process.env["TYPELESS_TEST_MODE"] === "1") {
    // In test mode: skip the OS-level keyTap (requires accessibility permission).
    // Clipboard holds the pasted text so tests can verify it.
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { uIOhook, UiohookKey } = require("uiohook-napi") as typeof import("uiohook-napi");
  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Meta]);
  await delay(100);
  clipboard.writeText(original);
}
