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

  it("uses Groq OpenAI-family model by default", () => {
    const savedProvider = process.env["TYPELESS_PROVIDER"];
    const savedGroqKey = process.env["GROQ_API_KEY"];
    const savedPostModel = process.env["TYPELESS_GROQ_POST_MODEL"];

    process.env["TYPELESS_PROVIDER"] = "groq";
    process.env["GROQ_API_KEY"] = savedGroqKey ?? "test-groq-key";
    delete process.env["TYPELESS_GROQ_POST_MODEL"];

    const provider = resolveProvider();
    expect(provider.llmModel).toBe("openai/gpt-oss-120b");

    process.env["TYPELESS_PROVIDER"] = savedProvider;
    process.env["GROQ_API_KEY"] = savedGroqKey;
    if (savedPostModel === undefined) {
      delete process.env["TYPELESS_GROQ_POST_MODEL"];
    } else {
      process.env["TYPELESS_GROQ_POST_MODEL"] = savedPostModel;
    }
  });

  it("uses llama model when TYPELESS_GROQ_POST_MODEL=llama", () => {
    const savedProvider = process.env["TYPELESS_PROVIDER"];
    const savedGroqKey = process.env["GROQ_API_KEY"];
    const savedPostModel = process.env["TYPELESS_GROQ_POST_MODEL"];

    process.env["TYPELESS_PROVIDER"] = "groq";
    process.env["GROQ_API_KEY"] = savedGroqKey ?? "test-groq-key";
    process.env["TYPELESS_GROQ_POST_MODEL"] = "llama";

    const provider = resolveProvider();
    expect(provider.llmModel).toBe("llama-3.3-70b-versatile");

    process.env["TYPELESS_PROVIDER"] = savedProvider;
    process.env["GROQ_API_KEY"] = savedGroqKey;
    if (savedPostModel === undefined) {
      delete process.env["TYPELESS_GROQ_POST_MODEL"];
    } else {
      process.env["TYPELESS_GROQ_POST_MODEL"] = savedPostModel;
    }
  });

  it("throws when TYPELESS_GROQ_POST_MODEL is invalid", () => {
    const savedProvider = process.env["TYPELESS_PROVIDER"];
    const savedGroqKey = process.env["GROQ_API_KEY"];
    const savedPostModel = process.env["TYPELESS_GROQ_POST_MODEL"];

    process.env["TYPELESS_PROVIDER"] = "groq";
    process.env["GROQ_API_KEY"] = savedGroqKey ?? "test-groq-key";
    process.env["TYPELESS_GROQ_POST_MODEL"] = "invalid";

    expect(() => resolveProvider()).toThrow(/Unknown TYPELESS_GROQ_POST_MODEL/);

    process.env["TYPELESS_PROVIDER"] = savedProvider;
    process.env["GROQ_API_KEY"] = savedGroqKey;
    if (savedPostModel === undefined) {
      delete process.env["TYPELESS_GROQ_POST_MODEL"];
    } else {
      process.env["TYPELESS_GROQ_POST_MODEL"] = savedPostModel;
    }
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
