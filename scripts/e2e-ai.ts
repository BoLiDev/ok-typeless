import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { transcribe } from "../src/main/llm/api";
import type { RecordingMode } from "@shared/types";

interface E2eAiConfig {
  mode: RecordingMode;
  skipPostProcessing: boolean;
}

const ROOT = resolve(__dirname, "..");
const FIXTURES_DIR = resolve(ROOT, "test/e2e-ai/fixtures");
const CONFIG_PATH = resolve(ROOT, "test/e2e-ai/config.json");

const TERM_WIDTH = process.stdout.columns ?? 100;
const RIGHT_PAD = 4;
const CONTENT_WIDTH = TERM_WIDTH - 5 - RIGHT_PAD; // "  │  " prefix + right padding
const SEP_WIDTH = TERM_WIDTH - 2; // "  " indent is 2 chars

const ansi = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  boldCyan: (s: string) => `\x1b[1;36m${s}\x1b[0m`,
  boldGreen: (s: string) => `\x1b[1;32m${s}\x1b[0m`,
  boldRed: (s: string) => `\x1b[1;31m${s}\x1b[0m`,
  boldYellow: (s: string) => `\x1b[1;33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const BORDER = ansi.dim("│");
const SEP = ansi.dim("─".repeat(SEP_WIDTH));
const BOTTOM = `  ${ansi.dim("└" + "─".repeat(SEP_WIDTH - 1))}`;

function charDisplayWidth(codePoint: number): 1 | 2 {
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

function wrapLine(line: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [line];
  const result: string[] = [];
  let current = "";
  let width = 0;

  for (const char of line) {
    const w = charDisplayWidth(char.codePointAt(0) ?? 0);
    if (width + w > maxWidth) {
      result.push(current);
      current = char;
      width = w;
    } else {
      current += char;
      width += w;
    }
  }
  result.push(current);
  return result;
}

function printLines(text: string): void {
  for (const paragraph of text.split("\n")) {
    for (const line of wrapLine(paragraph, CONTENT_WIDTH)) {
      console.log(`  ${BORDER}  ${line}`);
    }
  }
}

function loadConfig(): E2eAiConfig {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as E2eAiConfig;
}

function loadFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((f) => [".wav", ".webm"].includes(extname(f)))
    .sort();
}

function fixtureHeader(index: number, total: number, fileName: string): string {
  const indexStr = `[${index}/${total}]`;
  // visible: "  " + "┌" + " " + indexStr + "  " + fileName + " " + dashes
  const prefixLen = 2 + 1 + 1 + indexStr.length + 2 + fileName.length + 1;
  const dashCount = Math.max(2, TERM_WIDTH - prefixLen);
  return (
    `  ${ansi.dim("┌")} ${ansi.boldCyan(indexStr)}  ${ansi.bold(fileName)} ` +
    ansi.dim("─".repeat(dashCount))
  );
}

async function main(): Promise<void> {
  const config = loadConfig();
  const fixtures = loadFixtures();

  if (fixtures.length === 0) {
    console.log("No fixtures found in test/e2e-ai/fixtures/");
    return;
  }

  console.log();
  console.log(
    `  ${ansi.bold("E2E AI Test")}  ${ansi.dim("·")}  mode: ${ansi.cyan(config.mode)}  ${ansi.dim("·")}  skipPostProcessing: ${ansi.cyan(String(config.skipPostProcessing))}`,
  );
  console.log(`  ${SEP}`);

  let failed = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const fileName = fixtures[i];
    const filePath = resolve(FIXTURES_DIR, fileName);

    console.log();
    console.log(fixtureHeader(i + 1, fixtures.length, fileName));
    console.log(`  ${BORDER}`);

    try {
      const nodeBuffer = readFileSync(filePath);
      const buffer = nodeBuffer.buffer.slice(
        nodeBuffer.byteOffset,
        nodeBuffer.byteOffset + nodeBuffer.byteLength,
      ) as ArrayBuffer;

      const result = await transcribe(
        buffer,
        config.mode,
        fileName,
        config.skipPostProcessing,
      );

      console.log(
        `  ${BORDER}  ${ansi.boldYellow("STT")}  ${ansi.dim(`${result.sttMs}ms`)}`,
      );
      printLines(result.sttRaw);
      console.log(`  ${BORDER}`);
      console.log(
        `  ${BORDER}  ${ansi.boldGreen("LLM")}  ${ansi.dim(`${result.llmMs}ms`)}`,
      );
      printLines(result.llmOut);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(
        `  ${BORDER}  ${ansi.boldRed("ERROR")}  ${ansi.red(message)}`,
      );
      failed++;
    }

    console.log(`  ${BORDER}`);
    console.log(BOTTOM);
  }

  console.log();
  console.log(`  ${SEP}`);
  if (failed > 0) {
    console.log(
      `  ${ansi.boldRed("✗")}  ${failed} failed, ${fixtures.length - failed} passed`,
    );
    process.exit(1);
  } else {
    console.log(
      `  ${ansi.boldGreen("✓")}  ${fixtures.length} fixtures completed`,
    );
  }
  console.log();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
