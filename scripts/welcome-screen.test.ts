import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { buildWelcomeScreen, readVersion } from "./welcome-screen";

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("buildWelcomeScreen", () => {
  it("includes the version number", () => {
    const screen = buildWelcomeScreen("2.3.4");
    expect(screen).toContain("v2.3.4");
  });

  it("includes TYPELESS", () => {
    const screen = buildWelcomeScreen("1.0.0");
    expect(stripAnsi(screen)).toContain("TYPELESS");
  });

  it("aligns all arrows at the same column", () => {
    const plain = stripAnsi(buildWelcomeScreen("1.0.0"));
    const lines = plain.split("\n");
    const arrowColumns = lines
      .filter((line) => line.includes("→"))
      .map((line) => line.indexOf("→"));
    expect(arrowColumns.length).toBe(3);
    expect(new Set(arrowColumns).size).toBe(1);
  });
});

describe("readVersion", () => {
  it("returns the version from package.json", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf-8"),
    ) as { version: string };
    expect(readVersion()).toBe(pkg.version);
  });
});
