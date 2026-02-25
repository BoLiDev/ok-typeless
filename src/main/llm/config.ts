import { ProviderConfig, ProviderName } from "@shared/types";

export const PROVIDERS: Record<ProviderName, Omit<ProviderConfig, "apiKey">> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    sttModel: "whisper-large-v3-turbo",
    llmModel: "openai/gpt-oss-120b",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    sttModel: "whisper-1",
    llmModel: "gpt-4o-mini",
  },
};
