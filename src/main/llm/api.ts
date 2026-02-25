import type {
  ProviderConfig,
  ProviderName,
  RecordingMode,
} from "@shared/types";

import { PROVIDERS } from "./config";
import {
  CLEANUP_PROMPT,
  TRANSLATE_PROMPT,
  TRANSLATE_ONLY_PROMPT,
} from "./prompt";
import { toSimplifiedChinese } from "../text/chinese-variant";

export const GROQ_POST_MODELS = {
  openai: "openai/gpt-oss-120b",
  llama: "llama-3.3-70b-versatile",
} as const;

export type GroqPostModelName = keyof typeof GROQ_POST_MODELS;

function resolveGroqPostModel(): string {
  const selected = (process.env["TYPELESS_GROQ_POST_MODEL"] ??
    "openai") as GroqPostModelName;

  if (selected in GROQ_POST_MODELS) {
    return GROQ_POST_MODELS[selected];
  }

  throw new Error(
    `Unknown TYPELESS_GROQ_POST_MODEL: ${selected}. ` +
      `Expected one of: ${Object.keys(GROQ_POST_MODELS).join(", ")}`,
  );
}

export function resolveProvider(): ProviderConfig {
  const providerName = (process.env["TYPELESS_PROVIDER"] ??
    "groq") as ProviderName;
  const base = PROVIDERS[providerName];
  if (!base) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  const apiKey =
    providerName === "groq"
      ? process.env["GROQ_API_KEY"]
      : process.env["OPENAI_API_KEY"];

  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${providerName}". ` +
        `Set ${providerName === "groq" ? "GROQ_API_KEY" : "OPENAI_API_KEY"}.`,
    );
  }

  const llmModel =
    providerName === "groq" ? resolveGroqPostModel() : base.llmModel;

  return { ...base, apiKey, llmModel };
}

async function whisperTranscribe(
  audio: ArrayBuffer,
  config: ProviderConfig,
  fileName = "audio.webm",
): Promise<string> {
  const mimeType = fileName.endsWith(".wav") ? "audio/wav" : "audio/webm";
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), fileName);
  form.append("model", config.sttModel);
  form.append("temperature", "0");

  const res = await fetch(`${config.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { text: string };
  return json.text;
}

async function llmProcess(
  text: string,
  systemPrompt: string,
  config: ProviderConfig,
): Promise<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.llmModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices[0]?.message.content ?? "";
}

function pickPrompt(mode: RecordingMode, skipPostProcessing: boolean): string {
  if (skipPostProcessing && mode === "translate") return TRANSLATE_ONLY_PROMPT;
  return mode === "translate" ? TRANSLATE_PROMPT : CLEANUP_PROMPT;
}

export type TranscribeResult = {
  sttRaw: string;
  sttMs: number;
  llmOut: string;
  llmMs: number;
};

export async function transcribe(
  audio: ArrayBuffer,
  mode: RecordingMode,
  fileName = "audio.webm",
  skipPostProcessing = false,
): Promise<TranscribeResult> {
  const mockText = process.env["TYPELESS_MOCK_TRANSCRIPTION"];
  if (mockText !== undefined) {
    return {
      sttRaw: mockText,
      sttMs: 0,
      llmOut: toSimplifiedChinese(mockText),
      llmMs: 0,
    };
  }

  const config = resolveProvider();

  const sttStart = Date.now();
  const raw = await whisperTranscribe(audio, config, fileName);
  const sttMs = Date.now() - sttStart;

  if (raw.trim() === "") {
    return { sttRaw: "", sttMs, llmOut: "", llmMs: 0 };
  }

  if (skipPostProcessing && mode === "transcribe") {
    return { sttRaw: raw, sttMs, llmOut: toSimplifiedChinese(raw), llmMs: 0 };
  }

  const llmStart = Date.now();
  const llmOut = await llmProcess(
    raw,
    pickPrompt(mode, skipPostProcessing),
    config,
  );
  const normalizedLlmOut = toSimplifiedChinese(llmOut);
  const llmMs = Date.now() - llmStart;

  return { sttRaw: raw, sttMs, llmOut: normalizedLlmOut, llmMs };
}
