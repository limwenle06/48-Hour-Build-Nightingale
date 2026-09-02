import { OpenAiProvider } from "./openai-provider";
import type { LlmProvider } from "./provider";

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigurationError";
  }
}

export interface LlmEnvironment {
  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  LLM_API_KEY?: string;
}

export function createLlmProvider(
  environment: LlmEnvironment = process.env,
): LlmProvider {
  const provider = environment.LLM_PROVIDER?.trim().toLowerCase();
  const model = environment.LLM_MODEL?.trim();
  const apiKey = environment.LLM_API_KEY?.trim();

  if (provider !== "openai") {
    throw new LlmConfigurationError(
      "LLM_PROVIDER must be set to a supported server-side provider.",
    );
  }

  if (!model || !apiKey) {
    throw new LlmConfigurationError(
      "LLM_MODEL and LLM_API_KEY are required for the OpenAI provider.",
    );
  }

  return new OpenAiProvider({ api_key: apiKey, model });
}
