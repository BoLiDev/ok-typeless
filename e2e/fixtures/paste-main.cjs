// Minimal Electron fixture for the clipboard-output Playwright test.
// Plain CJS so it can be launched directly by Electron without a build step.
const { app, BrowserWindow, clipboard } = require("electron");
const { uIOhook, UiohookKey } = require("uiohook-napi");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pasteText(text) {
  const original = clipboard.readText();
  clipboard.writeText(text);
  uIOhook.keyTap(UiohookKey.V, [UiohookKey.Meta]);
  await delay(100);
  clipboard.writeText(original);
}

app.on("ready", () => {
  const win = new BrowserWindow({
    width: 400,
    height: 120,
    show: true,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(
    "data:text/html,<!DOCTYPE html><html><body>" +
      '<input id="input" autofocus style="width:90%;margin:16px;font-size:16px"/>' +
      "</body></html>"
  );

  // Expose helpers on app for electronApp.evaluate() calls in tests.
  app.pasteText = pasteText;
  app.getInputValue = () =>
    win.webContents.executeJavaScript(
      'document.getElementById("input").value'
    );
  app.getClipboard = () => clipboard.readText();
  app.focusInput = () =>
    win.webContents.executeJavaScript(
      'document.getElementById("input").focus(), "focused"'
    );
});
