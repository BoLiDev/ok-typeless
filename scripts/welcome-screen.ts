import { readFileSync } from "fs";
import { join } from "path";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  white: "\x1b[37m",
} as const;

const LOGO = [
  "  ██████╗ ██╗  ██╗",
  "  ██╔═══██╗██║ ██╔╝",
  "  ██║   ██║█████╔╝ ",
  "  ██║   ██║██╔═██╗ ",
  "  ╚██████╔╝██║  ██╗",
  "   ╚═════╝ ╚═╝  ╚═╝",
] as const;

type Shortcut = { key: string; description: string };

const SHORTCUTS: Shortcut[] = [
  { key: "Hold Right ⌘", description: "speak" },
  { key: "Hold Right ⌘ + Shift", description: "speak → English" },
  { key: "Esc", description: "cancel" },
];

const LOGO_ANNOTATIONS: ReadonlyArray<(version: string) => string> = [
  () => "",
  () => `   ${ANSI.cyan}TYPELESS${ANSI.reset}`,
  (v) =>
    `   ${ANSI.dim}macOS voice input  ·  ${ANSI.reset}${ANSI.cyan}v${v}${ANSI.reset}`,
  () => "",
  () => "",
  () => "",
];

function buildShortcutLines(): string[] {
  const maxKeyWidth = Math.max(...SHORTCUTS.map((s) => s.key.length));
  return SHORTCUTS.map(
    (s) =>
      `  ${ANSI.white}${s.key.padEnd(maxKeyWidth)}${ANSI.reset}   ${ANSI.dim}→  ${s.description}${ANSI.reset}`,
  );
}

export function readVersion(): string {
  const raw: unknown = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf-8"),
  );
  if (
    raw !== null &&
    typeof raw === "object" &&
    "version" in raw &&
    typeof (raw as Record<string, unknown>)["version"] === "string"
  ) {
    return (raw as Record<string, unknown>)["version"] as string;
  }
  throw new Error("package.json is missing a valid version string");
}

export function buildWelcomeScreen(version: string): string {
  const lines: string[] = [""];

  for (let i = 0; i < LOGO.length; i++) {
    const annotation = LOGO_ANNOTATIONS[i]?.(version) ?? "";
    lines.push(`${ANSI.bold}${ANSI.white}${LOGO[i]}${ANSI.reset}${annotation}`);
  }

  lines.push("");
  lines.push("");

  for (const line of buildShortcutLines()) {
    lines.push(line);
  }

  lines.push("");
  lines.push("");
  lines.push(
    `  ${ANSI.green}✓${ANSI.reset}  ${ANSI.dim}Running. Close this window anytime.${ANSI.reset}`,
  );
  lines.push("");

  return lines.join("\n");
}
