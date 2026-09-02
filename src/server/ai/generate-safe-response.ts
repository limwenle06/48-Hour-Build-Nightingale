import {
  assistantResponseSchema,
  redactionResultSchema,
  riskDecisionSchema,
  type AssistantResponse,
  type RedactionResult,
  type RiskDecision,
} from "../../contracts";
import {
  createProviderFailureResponse,
  createRedactionFailureResponse,
  createRiskSafetyResponse,
} from "./fallback-response";
import {
  isTrustQuestion,
  NIGHTINGALE_SYSTEM_INSTRUCTIONS,
  TRUST_RESPONSE,
  validateProviderOutput,
} from "./nightingale-policy";
import type { LlmProvider, LlmProviderResult } from "./provider";

const DEFAULT_RESPONSE_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_TOKENS = 320;

export interface SafeResponseInput {
  redaction: RedactionResult;
  risk: RiskDecision;
}

export interface SafeResponseOptions {
  provider: LlmProvider;
  timeout_ms?: number;
}

class ResponseTimeoutError extends Error {
  constructor() {
    super("The LLM provider response timed out.");
    this.name = "ResponseTimeoutError";
  }
}

async function generateWithTimeout(
  provider: LlmProvider,
  redactedInput: string,
  timeoutMs: number,
): Promise<LlmProviderResult> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new ResponseTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      provider.generate({
        redacted_input: redactedInput,
        instructions: NIGHTINGALE_SYSTEM_INSTRUCTIONS,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function generateSafeAssistantResponse(
  input: SafeResponseInput,
  options: SafeResponseOptions,
): Promise<AssistantResponse> {
  const redactionResult = redactionResultSchema.safeParse(input.redaction);

  if (!redactionResult.success || redactionResult.data.status === "failed") {
    return createRedactionFailureResponse();
  }

  const riskResult = riskDecisionSchema.safeParse(input.risk);

  if (!riskResult.success) {
    return createProviderFailureResponse();
  }

  if (riskResult.data.escalation_required) {
    return createRiskSafetyResponse(riskResult.data);
  }

  const redactedText = redactionResult.data.redacted_text;

  if (isTrustQuestion(redactedText)) {
    return {
      content: TRUST_RESPONSE,
      response_kind: "normal",
    };
  }

  const timeoutMs = options.timeout_ms ?? DEFAULT_RESPONSE_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return createProviderFailureResponse();
  }

  try {
    const providerResult = await generateWithTimeout(
      options.provider,
      redactedText,
      timeoutMs,
    );
    const content = providerResult.text.trim();
    const policyValidation = validateProviderOutput(content);

    if (!content || !policyValidation.safe) {
      return createProviderFailureResponse();
    }

    const assistantResponse = assistantResponseSchema.safeParse({
      content,
      response_kind: "normal",
    });

    return assistantResponse.success
      ? assistantResponse.data
      : createProviderFailureResponse();
  } catch {
    return createProviderFailureResponse();
  }
}
