import OpenAI from "openai";

import type {
  LlmProvider,
  LlmProviderRequest,
  LlmProviderResult,
} from "./provider";

const DEFAULT_TIMEOUT_MS = 8_000;

interface OpenAiResponseRequest {
  model: string;
  instructions: string;
  input: string;
  store: false;
  max_output_tokens: number;
}

interface OpenAiRequestOptions {
  timeout: number;
  signal?: AbortSignal;
}

interface OpenAiResponseResult {
  output_text: string;
}

export type OpenAiResponseCreator = (
  request: OpenAiResponseRequest,
  options: OpenAiRequestOptions,
) => Promise<OpenAiResponseResult>;

export interface OpenAiProviderConfig {
  api_key: string;
  model: string;
  timeout_ms?: number;
}

export class OpenAiProvider implements LlmProvider {
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly createResponse: OpenAiResponseCreator;

  constructor(
    config: OpenAiProviderConfig,
    createResponse?: OpenAiResponseCreator,
  ) {
    const apiKey = config.api_key.trim();
    this.model = config.model.trim();
    this.timeoutMs = config.timeout_ms ?? DEFAULT_TIMEOUT_MS;

    if (!apiKey || !this.model || this.timeoutMs <= 0) {
      throw new Error("Invalid OpenAI provider configuration.");
    }

    if (createResponse) {
      this.createResponse = createResponse;
      return;
    }

    const client = new OpenAI({ apiKey });
    this.createResponse = async (request, options) => {
      const response = await client.responses.create(request, options);
      return { output_text: response.output_text };
    };
  }

  async generate(request: LlmProviderRequest): Promise<LlmProviderResult> {
    const response = await this.createResponse(
      {
        model: this.model,
        instructions: request.instructions,
        input: request.redacted_input,
        store: false,
        max_output_tokens: request.max_output_tokens,
      },
      {
        timeout: this.timeoutMs,
        signal: request.signal,
      },
    );

    return {
      text: response.output_text,
      provider: "openai",
      model: this.model,
    };
  }
}
