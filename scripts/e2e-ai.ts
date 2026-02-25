import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { transcribe, GROQ_POST_MODELS } from "../src/main/llm/api";
import type { GroqPostModelName } from "../src/main/llm/api";
import type { RecordingMode } from "@shared/types";

interface E2eAiConfig {
  mode: RecordingMode;
  skipPostProcessing: boolean;
  groqPostModel?: GroqPostModelName | "all";
}

type ModelResult =
  | { status: "ok"; modelKey: GroqPostModelName; llmOut: string; llmMs: number }
  | { status: "error"; modelKey: GroqPostModelName; error: string };

const ROOT = resolve(__dirname, "..");
const FIXTURES_DIR = resolve(ROOT, "test/e2e-ai/fixtures");
const CONFIG_PATH = resolve(ROOT, "test/e2e-ai/config.json");

const TERM_WIDTH = process.stdout.columns ?? 100;
const RIGHT_PAD = 4;
const CONTENT_WIDTH = TERM_WIDTH - 5 - RIGHT_PAD;
const SEP_WIDTH = TERM_WIDTH - 2;

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
const INNER_SEP = `  ${ansi.dim("│")}  `;
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

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleWidth(s: string): number {
  let w = 0;
  for (const char of stripAnsi(s)) {
    w += charDisplayWidth(char.codePointAt(0) ?? 0);
  }
  return w;
}

function padToWidth(s: string, width: number): string {
  const padding = Math.max(0, width - visibleWidth(s));
  return s + " ".repeat(padding);
}

function wrapText(text: string, maxWidth: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    result.push(...wrapLine(paragraph, maxWidth));
  }
  return result;
}

function printColLine(cells: string[], colWidth: number): void {
  const parts = cells.map((cell) => padToWidth(cell, colWidth));
  console.log(`  ${BORDER}  ${parts.join(INNER_SEP)}`);
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
  const prefixLen = 2 + 1 + 1 + indexStr.length + 2 + fileName.length + 1;
  const dashCount = Math.max(2, TERM_WIDTH - prefixLen);
  return (
    `  ${ansi.dim("┌")} ${ansi.boldCyan(indexStr)}  ${ansi.bold(fileName)} ` +
    ansi.dim("─".repeat(dashCount))
  );
}

async function runFixtureAllModels(
  buffer: ArrayBuffer,
  fileName: string,
  config: E2eAiConfig,
  modelKeys: GroqPostModelName[],
): Promise<{ sttRaw: string; sttMs: number; models: ModelResult[]; anyFailed: boolean }> {
  let sttRaw = "";
  let sttMs = 0;
  let sttCaptured = false;
  const models: ModelResult[] = [];
  let anyFailed = false;

  for (const modelKey of modelKeys) {
    process.env["TYPELESS_GROQ_POST_MODEL"] = modelKey;
    try {
      const result = await transcribe(
        buffer,
        config.mode,
        fileName,
        config.skipPostProcessing,
      );
      if (!sttCaptured) {
        sttRaw = result.sttRaw;
        sttMs = result.sttMs;
        sttCaptured = true;
      }
      models.push({ status: "ok", modelKey, llmOut: result.llmOut, llmMs: result.llmMs });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      models.push({ status: "error", modelKey, error });
      anyFailed = true;
    }
  }

  return { sttRaw, sttMs, models, anyFailed };
}

function printAllModelsResult(
  sttRaw: string,
  sttMs: number,
  models: ModelResult[],
): void {
  console.log(`  ${BORDER}  ${ansi.boldYellow("STT")}  ${ansi.dim(`${sttMs}ms`)}`);
  printLines(sttRaw);
  console.log(`  ${BORDER}`);

  const N = models.length;
  const colWidth = Math.floor((CONTENT_WIDTH - 5 * (N - 1)) / N);

  const headers = models.map((r) =>
    r.status === "ok"
      ? `${ansi.boldGreen("LLM")} [${ansi.cyan(r.modelKey)}]  ${ansi.dim(`${r.llmMs}ms`)}`
      : `${ansi.boldRed("LLM")} [${ansi.cyan(r.modelKey)}]  ${ansi.red("ERROR")}`,
  );
  printColLine(headers, colWidth);

  const wrappedCols = models.map((r) =>
    r.status === "ok"
      ? wrapText(r.llmOut, colWidth)
      : [ansi.red(r.error)],
  );
  const maxLines = Math.max(...wrappedCols.map((c) => c.length));

  for (let i = 0; i < maxLines; i++) {
    const cells = wrappedCols.map((lines) => lines[i] ?? "");
    printColLine(cells, colWidth);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const fixtures = loadFixtures();

  const isAllMode = config.groqPostModel === "all";
  const modelKeys: GroqPostModelName[] = isAllMode
    ? (Object.keys(GROQ_POST_MODELS) as GroqPostModelName[])
    : [((config.groqPostModel as GroqPostModelName | undefined) ?? "openai")];

  if (!isAllMode && config.groqPostModel !== undefined) {
    process.env["TYPELESS_GROQ_POST_MODEL"] = config.groqPostModel as string;
  }

  if (fixtures.length === 0) {
    console.log("No fixtures found in test/e2e-ai/fixtures/");
    return;
  }

  const modelDisplay = isAllMode
    ? `all (${modelKeys.join(", ")})`
    : modelKeys[0];

  console.log();
  console.log(
    `  ${ansi.bold("E2E AI Test")}  ${ansi.dim("·")}  mode: ${ansi.cyan(config.mode)}  ${ansi.dim("·")}  model: ${ansi.cyan(modelDisplay)}  ${ansi.dim("·")}  skipPostProcessing: ${ansi.cyan(String(config.skipPostProcessing))}`,
  );
  console.log(`  ${SEP}`);

  let failed = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const fileName = fixtures[i];
    const filePath = resolve(FIXTURES_DIR, fileName);

    console.log();
    console.log(fixtureHeader(i + 1, fixtures.length, fileName));
    console.log(`  ${BORDER}`);

    const nodeBuffer = readFileSync(filePath);
    const buffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength,
    ) as ArrayBuffer;

    if (isAllMode) {
      const { sttRaw, sttMs, models, anyFailed } = await runFixtureAllModels(
        buffer,
        fileName,
        config,
        modelKeys,
      );
      printAllModelsResult(sttRaw, sttMs, models);
      if (anyFailed) failed++;
    } else {
      try {
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
