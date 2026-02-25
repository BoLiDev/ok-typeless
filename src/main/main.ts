import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  dialog,
  systemPreferences,
  screen,
} from "electron";
import { join } from "path";
import { uIOhook } from "uiohook-napi";
import { stateMachine } from "./state-machine";
import { registerIpcHandlers } from "./ipc-handlers";
import { resolveProvider } from "./api";
import { reduceTap, initialTapState, tapActionToEvent } from "./hotkey";
import type { TapState } from "./hotkey";

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

function createTray(): Tray {
  const iconPath = join(__dirname, "../../assets/tray-icon.png");
  const tray = new Tray(iconPath);
  tray.setToolTip("ok-typeless");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "About ok-typeless", role: "about" },
      { type: "separator" },
      { label: "Quit", role: "quit" },
    ])
  );
  return tray;
}

function startHotkey(capsule: BrowserWindow): void {
  let tapState: TapState = initialTapState();

  uIOhook.on("keydown", (e) => {
    const keycode =
      e.keycode === 3676
        ? "MetaRight"
        : ("other" as const);
    const result = reduceTap(tapState, {
      kind: "keydown",
      keycode,
      shiftKey: e.shiftKey,
    });
    tapState = result.nextState;
  });

  uIOhook.on("keyup", (e) => {
    const keycode =
      e.keycode === 3676
        ? "MetaRight"
        : ("other" as const);

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
  checkAccessibility();
  checkApiKey();

  const capsule = createCapsuleWindow();
  createTray();

  registerIpcHandlers(capsule);
  watchStateForWindowVisibility(capsule);
  scheduleAutoReturnsToIdle();
  startHotkey(capsule);
});

app.on("window-all-closed", () => {
  // Keep running — this is a tray app with no regular windows.
});
