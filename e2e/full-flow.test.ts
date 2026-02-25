import { test, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication } from "@playwright/test";
import { join } from "path";
import { execSync } from "child_process";
import { existsSync } from "fs";

// Ensure the app is built before running tests.
// Run: npm run build && npm run test:e2e
const MAIN_JS = join(__dirname, "../out/main/main.js");

function buildIfNeeded(): void {
  if (!existsSync(MAIN_JS)) {
    execSync("npm run build", { cwd: join(__dirname, ".."), stdio: "inherit" });
  }
}

type TestHelpers = {
  sendEvent: (event: Record<string, unknown>) => void;
  getState: () => Record<string, unknown>;
  isWindowVisible: () => boolean;
};

async function helpers(electronApp: ElectronApplication): Promise<TestHelpers> {
  return electronApp.evaluate(() => {
    return (global as Record<string, unknown>).testHelpers as TestHelpers;
  });
}

async function sendEvent(
  electronApp: ElectronApplication,
  event: Record<string, unknown>
): Promise<void> {
  await electronApp.evaluate(({ app: _app }, ev) => {
    const h = (global as Record<string, unknown>).testHelpers as TestHelpers;
    h.sendEvent(ev as Parameters<TestHelpers["sendEvent"]>[0]);
  }, event);
}

async function getState(
  electronApp: ElectronApplication
): Promise<Record<string, unknown>> {
  return electronApp.evaluate(() => {
    const h = (global as Record<string, unknown>).testHelpers as TestHelpers;
    return h.getState();
  });
}

async function isWindowVisible(electronApp: ElectronApplication): Promise<boolean> {
  return electronApp.evaluate(() => {
    const h = (global as Record<string, unknown>).testHelpers as TestHelpers;
    return h.isWindowVisible();
  });
}

function launchApp(env: Record<string, string> = {}): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN_JS],
    env: {
      ...process.env,
      TYPELESS_TEST_MODE: "1",
      GROQ_API_KEY: "test-key-not-used",
      ...env,
    },
  });
}

test.beforeAll(() => {
  buildIfNeeded();
});

test("window starts hidden in idle state", async () => {
  const electronApp = await launchApp();
  try {
    await electronApp.firstWindow();
    const state = await getState(electronApp);
    expect(state["status"]).toBe("idle");
    const visible = await isWindowVisible(electronApp);
    expect(visible).toBe(false);
  } finally {
    await electronApp.close();
  }
});

test("HOTKEY_TRANSCRIBE makes window visible in connecting state", async () => {
  const electronApp = await launchApp();
  try {
    await electronApp.firstWindow();
    await sendEvent(electronApp, { type: "HOTKEY_TRANSCRIBE" });
    const state = await getState(electronApp);
    expect(state["status"]).toBe("connecting");
    expect(state["mode"]).toBe("transcribe");
    const visible = await isWindowVisible(electronApp);
    expect(visible).toBe(true);
  } finally {
    await electronApp.close();
  }
});

test("CANCEL from connecting returns to idle and hides window", async () => {
  const electronApp = await launchApp();
  try {
    await electronApp.firstWindow();
    await sendEvent(electronApp, { type: "HOTKEY_TRANSCRIBE" });
    await sendEvent(electronApp, { type: "CANCEL" });
    const state = await getState(electronApp);
    expect(state["status"]).toBe("idle");
    const visible = await isWindowVisible(electronApp);
    expect(visible).toBe(false);
  } finally {
    await electronApp.close();
  }
});

test("connecting → recording via MIC_READY", async () => {
  const electronApp = await launchApp();
  try {
    await electronApp.firstWindow();
    await sendEvent(electronApp, { type: "HOTKEY_TRANSCRIBE" });
    await sendEvent(electronApp, { type: "MIC_READY" });
    const state = await getState(electronApp);
    expect(state["status"]).toBe("recording");
    expect(state["mode"]).toBe("transcribe");
  } finally {
    await electronApp.close();
  }
});

test("MIC_FAILED produces error state with message", async () => {
  const electronApp = await launchApp();
  try {
    await electronApp.firstWindow();
    await sendEvent(electronApp, { type: "HOTKEY_TRANSCRIBE" });
    await sendEvent(electronApp, { type: "MIC_FAILED", message: "Microphone permission denied" });
    const state = await getState(electronApp);
    expect(state["status"]).toBe("error");
    expect(state["message"]).toBe("Microphone permission denied");
  } finally {
    await electronApp.close();
  }
});

test("error state auto-returns to idle after 2 seconds", async () => {
  test.setTimeout(10_000);
  const electronApp = await launchApp();
  try {
    await electronApp.firstWindow();
    await sendEvent(electronApp, { type: "HOTKEY_TRANSCRIBE" });
    await sendEvent(electronApp, { type: "MIC_FAILED", message: "Test error" });
    expect((await getState(electronApp))["status"]).toBe("error");
    await new Promise((r) => setTimeout(r, 2200));
    const state = await getState(electronApp);
    expect(state["status"]).toBe("idle");
    expect(await isWindowVisible(electronApp)).toBe(false);
  } finally {
    await electronApp.close();
  }
});

test("happy path: audio data triggers transcribe → paste → idle", async () => {
  const electronApp = await launchApp({
    TYPELESS_MOCK_TRANSCRIPTION: "Hello world",
  });
  const window = await electronApp.firstWindow();
  try {
    await sendEvent(electronApp, { type: "HOTKEY_TRANSCRIBE" });
    await sendEvent(electronApp, { type: "MIC_READY" });
    expect((await getState(electronApp))["status"]).toBe("recording");

    // Send audio data from renderer — triggers handleAudioData in main
    await window.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).typeless.sendAudioData(new ArrayBuffer(100));
    });

    // Poll until state returns to idle (transcribe + paste is async)
    let state: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      state = await getState(electronApp);
      if (state["status"] === "idle") break;
    }
    expect(state["status"]).toBe("idle");

    // Clipboard should have the mock transcription (paste in test mode skips key-tap but leaves text in clipboard)
    const clipboardText = await electronApp.evaluate(({ clipboard }) =>
      clipboard.readText()
    );
    expect(clipboardText).toBe("Hello world");
  } finally {
    await electronApp.close();
  }
});

test("empty transcription shows 'Nothing heard' error", async () => {
  const electronApp = await launchApp({
    TYPELESS_MOCK_TRANSCRIPTION: "",
  });
  const window = await electronApp.firstWindow();
  try {
    await sendEvent(electronApp, { type: "HOTKEY_TRANSCRIBE" });
    await sendEvent(electronApp, { type: "MIC_READY" });

    await window.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).typeless.sendAudioData(new ArrayBuffer(100));
    });

    let state: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      state = await getState(electronApp);
      if (state["status"] === "error") break;
    }
    expect(state["status"]).toBe("error");
    expect(state["message"]).toBe("Nothing heard");
  } finally {
    await electronApp.close();
  }
});

test("HOTKEY_TRANSLATE sets mode to translate", async () => {
  const electronApp = await launchApp();
  try {
    await electronApp.firstWindow();
    await sendEvent(electronApp, { type: "HOTKEY_TRANSLATE" });
    const state = await getState(electronApp);
    expect(state["status"]).toBe("connecting");
    expect(state["mode"]).toBe("translate");
  } finally {
    await electronApp.close();
  }
});
