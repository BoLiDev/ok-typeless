import { spawn } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { buildWelcomeScreen } from "./welcome-screen";

function readVersion(): string {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf-8"),
  ) as { version: string };
  return pkg.version;
}

function launchApp(): void {
  const child = spawn("npm", ["run", "start"], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });
  child.unref();
}

process.stdout.write("\x1bc");
process.stdout.write(buildWelcomeScreen(readVersion()));

launchApp();

process.stdin.resume();
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
