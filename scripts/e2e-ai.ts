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
const DIVIDER = "─".repeat(70);

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

async function main(): Promise<void> {
  const config = loadConfig();
  const fixtures = loadFixtures();

  if (fixtures.length === 0) {
    console.log("No fixtures found in test/e2e-ai/fixtures/");
    return;
  }

  console.log(
    `\nE2E AI Test  (mode: ${config.mode} | skipPostProcessing: ${config.skipPostProcessing})`,
  );
  console.log(DIVIDER);

  let failed = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const fileName = fixtures[i];
    const filePath = resolve(FIXTURES_DIR, fileName);

    console.log(`\n[${i + 1}/${fixtures.length}] ${fileName}`);

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
      console.log(`  STT (${result.sttMs}ms):  ${result.sttRaw}`);
      console.log(`  LLM (${result.llmMs}ms): ${result.llmOut}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${message}`);
      failed++;
    }
  }

  console.log(`\n${DIVIDER}`);
  if (failed > 0) {
    console.log(`✗  ${failed} failed, ${fixtures.length - failed} passed`);
    process.exit(1);
  } else {
    console.log(`✓  ${fixtures.length} fixtures completed`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
