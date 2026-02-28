import { describe, it, expect, vi, beforeEach } from "vitest";

const spawnMock = vi.fn(() => ({ on: vi.fn() }));

vi.mock("electron", () => ({
  ipcMain: { on: vi.fn() },
  BrowserWindow: vi.fn(),
}));

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

describe("playLaunchCue", () => {
  beforeEach(() => {
    spawnMock.mockClear();
  });

  it("spawns afplay with the launch.mp3 path", async () => {
    const { playLaunchCue } = await import("./ipc-handlers");
    playLaunchCue();
    expect(spawnMock).toHaveBeenCalledWith(
      "afplay",
      [expect.stringContaining("launch.mp3")],
    );
  });
});
