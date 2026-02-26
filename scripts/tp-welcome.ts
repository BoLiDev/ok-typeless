import { spawn } from "child_process";
import { buildWelcomeScreen, readVersion } from "./welcome-screen";

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
