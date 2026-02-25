import { config as loadDotenv } from "dotenv";
import { join } from "path";
loadDotenv({ path: join(process.cwd(), ".env") });

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  dialog,
  systemPreferences,
  screen,
  nativeImage,
} from "electron";
import { stateMachine } from "./state-machine";
import type { StateMachineEvent } from "./state-machine";
import { registerIpcHandlers } from "./ipc-handlers";
import { resolveProvider } from "./llm/api";
import { reduceTap, initialTapState, tapActionToEvent } from "./hotkey";
import type { TapState } from "./hotkey";
import { getSettings, saveSettings } from "./settings-store";
import { IPC_CHANNELS } from "@shared/types";

const TEST_MODE = process.env["TYPELESS_TEST_MODE"] === "1";

app.dock?.hide();

function checkAccessibility(): void {
  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  if (!trusted) {
    dialog.showMessageBoxSync({
      type: "warning",
      title: "Accessibility Permission Required",
      message:
        "ok-typeless needs Accessibility permission to detect the Right Cmd key.\n\n" +
        "Please enable it in System Settings → Privacy & Security → Accessibility.",
      buttons: ["Open System Settings", "Quit"],
      defaultId: 0,
    });
    systemPreferences.isTrustedAccessibilityClient(true);
    app.quit();
    process.exit(0);
  }
}

function checkApiKey(): void {
  try {
    resolveProvider();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dialog.showMessageBoxSync({
      type: "error",
      title: "API Key Missing",
      message,
      buttons: ["Quit"],
    });
    app.quit();
    process.exit(1);
  }
}

function createCapsuleWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  const winWidth = 200;
  const winHeight = 44;

  const capsule = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((screenWidth - winWidth) / 2),
    y: screenHeight - winHeight - 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    type: "panel",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  capsule.setVisibleOnAllWorkspaces(true);
  capsule.setIgnoreMouseEvents(true);

  if (process.env["ELECTRON_RENDERER_URL"]) {
    capsule.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    capsule.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return capsule;
}

function buildTrayMenu(tray: Tray, capsule: BrowserWindow): void {
  const { skipPostProcessing } = getSettings();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "About ok-typeless", role: "about" },
      { type: "separator" },
      {
        label: "Skip Post-Processing",
        type: "checkbox",
        checked: skipPostProcessing,
        click: () => {
          saveSettings({ skipPostProcessing: !skipPostProcessing });
          buildTrayMenu(tray, capsule);
          capsule.webContents.send(IPC_CHANNELS.SETTINGS_UPDATE, getSettings());
        },
      },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ]),
  );
}

function createTray(capsule: BrowserWindow): Tray {
  const iconPath = join(__dirname, "../../assets/tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip("ok-typeless");
  buildTrayMenu(tray, capsule);
  return tray;
}

function startHotkey(capsule: BrowserWindow): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { uIOhook } = require("uiohook-napi") as typeof import("uiohook-napi");
  let tapState: TapState = initialTapState();

  uIOhook.on("keydown", (e) => {
    const keycode = e.keycode === 3676 ? "MetaRight" : ("other" as const);
    const result = reduceTap(tapState, {
      kind: "keydown",
      keycode,
      shiftKey: e.shiftKey,
    });
    tapState = result.nextState;
  });

  uIOhook.on("keyup", (e) => {
    const keycode = e.keycode === 3676 ? "MetaRight" : ("other" as const);

    if (e.keycode === 1) {
      stateMachine.send({ type: "CANCEL" });
      return;
    }

    const result = reduceTap(tapState, {
      kind: "keyup",
      keycode,
      shiftKey: e.shiftKey,
    });
    tapState = result.nextState;

    if (result.action) {
      stateMachine.send(tapActionToEvent(result.action));
    }
  });

  uIOhook.start();
}

function watchStateForWindowVisibility(capsule: BrowserWindow): void {
  stateMachine.subscribe((state) => {
    if (state.status === "idle") {
      capsule.hide();
    } else {
      capsule.show();
    }
  });
}

function scheduleAutoReturnsToIdle(): void {
  stateMachine.subscribe((state) => {
    if (state.status === "error") {
      setTimeout(() => stateMachine.send({ type: "ERROR_TIMEOUT" }), 2000);
    }
  });
}

app.whenReady().then(() => {
  if (!TEST_MODE) {
    checkAccessibility();
    checkApiKey();
  }

  const capsule = createCapsuleWindow();

  if (!TEST_MODE) {
    createTray(capsule);
  }

  registerIpcHandlers(capsule);
  watchStateForWindowVisibility(capsule);
  scheduleAutoReturnsToIdle();

  if (!TEST_MODE) {
    startHotkey(capsule);
  }

  if (TEST_MODE) {
    (global as Record<string, unknown>).testHelpers = {
      sendEvent: (event: StateMachineEvent) => stateMachine.send(event),
      getState: () => stateMachine.getState(),
      isWindowVisible: () => capsule.isVisible(),
    };
  }
});

app.on("window-all-closed", () => {
  // Keep running — this is a tray app with no regular windows.
});
