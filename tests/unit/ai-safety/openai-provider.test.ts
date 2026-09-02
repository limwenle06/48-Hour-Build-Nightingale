import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "../../../src/server/ai/openai-provider";
import {
  createLlmProvider,
  LlmConfigurationError,
} from "../../../src/server/ai/provider-factory";

describe("OpenAiProvider", () => {
  it("uses the Responses API contract with storage disabled", async () => {
    const requests: unknown[] = [];
    const options: unknown[] = [];
    const provider = new OpenAiProvider(
      {
        api_key: "synthetic-test-key",
        model: "synthetic-test-model",
        timeout_ms: 500,
      },
      (request, requestOptions) => {
        requests.push(request);
        options.push(requestOptions);
        return Promise.resolve({ output_text: "Safe general information." });
      },
    );

    const result = await provider.generate({
      redacted_input: "My name is [REDACTED].",
      instructions: "Synthetic instructions",
      max_output_tokens: 100,
    });

    expect(requests).toEqual([
      {
        model: "synthetic-test-model",
        instructions: "Synthetic instructions",
        input: "My name is [REDACTED].",
        store: false,
        max_output_tokens: 100,
      },
    ]);
    expect(options).toEqual([{ timeout: 500, signal: undefined }]);
    expect(result).toEqual({
      text: "Safe general information.",
      provider: "openai",
      model: "synthetic-test-model",
    });
  });
});

describe("createLlmProvider", () => {
  it("creates an OpenAI provider from server configuration", () => {
    const provider = createLlmProvider({
      LLM_PROVIDER: "openai",
      LLM_MODEL: "synthetic-test-model",
      LLM_API_KEY: "synthetic-test-key",
    });

    expect(provider).toBeInstanceOf(OpenAiProvider);
  });

  it("rejects missing provider configuration", () => {
    expect(() => createLlmProvider({})).toThrow(LlmConfigurationError);
  });

  it("rejects missing OpenAI model or key", () => {
    expect(() => createLlmProvider({ LLM_PROVIDER: "openai" })).toThrow(
      LlmConfigurationError,
    );
  });
});
