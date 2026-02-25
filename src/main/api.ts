import type {
  ProviderConfig,
  ProviderName,
  RecordingMode,
} from "@shared/types";

const PROVIDERS: Record<ProviderName, Omit<ProviderConfig, "apiKey">> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    sttModel: "whisper-large-v3-turbo",
    llmModel: "llama-3.3-70b-versatile",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    sttModel: "whisper-1",
    llmModel: "gpt-4o-mini",
  },
};

const CLEANUP_PROMPT =
  "Clean up the following speech transcription. Remove filler words, fix obvious grammar mistakes, and remove hallucinated text from silence (repeated phrases, nonsense). Preserve the original language. Return only the cleaned text, nothing else.";

const TRANSLATE_PROMPT =
  "Clean up the following speech transcription (remove filler words, fix grammar, remove hallucinated nonsense from silence), then translate to natural English. Return only the English translation, nothing else.";

const TRANSLATE_ONLY_PROMPT =
  "Translate the following to natural English. Return only the translation, nothing else.";

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

  return { ...base, apiKey };
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
    return { sttRaw: mockText, sttMs: 0, llmOut: mockText, llmMs: 0 };
  }

  const config = resolveProvider();

  const sttStart = Date.now();
  const raw = await whisperTranscribe(audio, config, fileName);
  const sttMs = Date.now() - sttStart;

  if (raw.trim() === "") {
    return { sttRaw: "", sttMs, llmOut: "", llmMs: 0 };
  }

  if (skipPostProcessing && mode === "transcribe") {
    return { sttRaw: raw, sttMs, llmOut: raw, llmMs: 0 };
  }

  const llmStart = Date.now();
  const llmOut = await llmProcess(raw, pickPrompt(mode, skipPostProcessing), config);
  const llmMs = Date.now() - llmStart;

  return { sttRaw: raw, sttMs, llmOut, llmMs };
}
