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
const SEP = ansi.dim("─".repeat(60));

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

function printLines(text: string): void {
  for (const line of text.split("\n")) {
    console.log(`  ${BORDER}  ${line}`);
  }
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
    console.log(
      `  ${ansi.dim("┌")} ${ansi.boldCyan(`[${i + 1}/${fixtures.length}]`)}  ${ansi.bold(fileName)}`,
    );
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
    console.log(`  ${ansi.dim("└" + "─".repeat(50))}`);
  }

  console.log();
  console.log(`  ${SEP}`);
  if (failed > 0) {
    console.log(
      `  ${ansi.boldRed("✗")}  ${failed} failed, ${fixtures.length - failed} passed`,
    );
    process.exit(1);
  } else {
    console.log(`  ${ansi.boldGreen("✓")}  ${fixtures.length} fixtures completed`);
  }
  console.log();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
