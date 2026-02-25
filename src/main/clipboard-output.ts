import { clipboard } from "electron";
import { uIOhook, UiohookKey } from "uiohook-napi";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pasteText(text: string): Promise<void> {
  const original = clipboard.readText();
  clipboard.writeText(text);
  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Meta]);
  await delay(100);
  clipboard.writeText(original);
}
