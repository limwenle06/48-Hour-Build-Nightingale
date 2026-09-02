export interface LlmProviderRequest {
  redacted_input: string;
  instructions: string;
  max_output_tokens: number;
  signal?: AbortSignal;
}

export interface LlmProviderResult {
  text: string;
  provider: string;
  model: string;
}

export interface LlmProvider {
  generate(request: LlmProviderRequest): Promise<LlmProviderResult>;
}
