import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transcribe, resolveProvider } from "./api";

const FIXTURE = resolve(__dirname, "../../fixtures/test-audio.wav");

const hasGroqKey = !!process.env["GROQ_API_KEY"];
const hasOpenAiKey = !!process.env["OPENAI_API_KEY"];
const hasAnyKey = hasGroqKey || hasOpenAiKey;

describe.skipIf(!hasAnyKey)("api — real integration", () => {
  it("transcribe(fixture, 'transcribe') returns a non-empty llmOut string", async () => {
    const buffer = readFileSync(FIXTURE).buffer as ArrayBuffer;
    const result = await transcribe(buffer, "transcribe", "test-audio.wav");
    expect(typeof result.llmOut).toBe("string");
    expect(result.llmOut.trim().length).toBeGreaterThan(0);
  }, 30_000);

  it("transcribe(fixture, 'translate') returns a non-empty English llmOut string", async () => {
    const buffer = readFileSync(FIXTURE).buffer as ArrayBuffer;
    const result = await transcribe(buffer, "translate", "test-audio.wav");
    expect(typeof result.llmOut).toBe("string");
    expect(result.llmOut.trim().length).toBeGreaterThan(0);
  }, 30_000);
});

describe("resolveProvider", () => {
  it("throws when no API key is set for the selected provider", () => {
    const saved = process.env["GROQ_API_KEY"];
    const savedProvider = process.env["TYPELESS_PROVIDER"];
    delete process.env["GROQ_API_KEY"];
    process.env["TYPELESS_PROVIDER"] = "groq";

    expect(() => resolveProvider()).toThrow(/Missing API key/);

    process.env["GROQ_API_KEY"] = saved;
    process.env["TYPELESS_PROVIDER"] = savedProvider;
  });

  it("throws when an unknown provider name is given", () => {
    const saved = process.env["TYPELESS_PROVIDER"];
    process.env["TYPELESS_PROVIDER"] = "unknown-provider";

    expect(() => resolveProvider()).toThrow(/Unknown provider/);

    process.env["TYPELESS_PROVIDER"] = saved;
  });
});

describe("transcribe — mock mode", () => {
  it("returns TranscribeResult with zero timings when TYPELESS_MOCK_TRANSCRIPTION is set", async () => {
    const saved = process.env["TYPELESS_MOCK_TRANSCRIPTION"];
    process.env["TYPELESS_MOCK_TRANSCRIPTION"] = "hello world";

    const result = await transcribe(new ArrayBuffer(0), "transcribe");

    expect(result.sttRaw).toBe("hello world");
    expect(result.llmOut).toBe("hello world");
    expect(result.sttMs).toBe(0);
    expect(result.llmMs).toBe(0);

    if (saved === undefined) {
      delete process.env["TYPELESS_MOCK_TRANSCRIPTION"];
    } else {
      process.env["TYPELESS_MOCK_TRANSCRIPTION"] = saved;
    }
  });
});
