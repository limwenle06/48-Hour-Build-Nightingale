import type {
  LlmProvider,
  LlmProviderRequest,
  LlmProviderResult,
} from "./provider";

export type FakeProviderResponder = (
  request: LlmProviderRequest,
) => Promise<string> | string;

export class FakeLlmProvider implements LlmProvider {
  readonly calls: LlmProviderRequest[] = [];

  constructor(
    private readonly responder: FakeProviderResponder = () =>
      "I can provide general information, but I cannot diagnose a condition.",
  ) {}

  async generate(request: LlmProviderRequest): Promise<LlmProviderResult> {
    this.calls.push({ ...request });
    const text = await this.responder(request);

    return {
      text,
      provider: "fake",
      model: "fake-test-model",
    };
  }
}
