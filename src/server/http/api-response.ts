import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export type ApiErrorCode =
  | "validation_error"
  | "unauthenticated"
  | "conflict"
  | "forbidden"
  | "consent_required"
  | "rate_limited"
  | "processing_blocked"
  | "dependency_unavailable"
  | "persistence_failed"
  | "internal_error"
  | "not_found";

export class ApiRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export function newRequestId() {
  return randomUUID();
}

export function apiSuccess<T>(data: T, requestId: string, status = 200) {
  return NextResponse.json({ data, request_id: requestId }, { status });
}

export function apiFailure(cause: unknown, requestId: string) {
  const error =
    cause instanceof ApiRouteError
      ? cause
      : cause instanceof Error && cause.name === "SupabaseConfigurationError"
        ? new ApiRouteError(
            503,
            "dependency_unavailable",
            "The secure data service is not available.",
          )
      : new ApiRouteError(
          500,
          "internal_error",
          "The request could not be completed safely.",
        );

  return NextResponse.json(
    {
      error: { code: error.code, message: error.message },
      request_id: requestId,
    },
    { status: error.status },
  );
}

export async function parseJsonRequest<T>(request: Request, schema: ZodType<T>) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiRouteError(
      400,
      "validation_error",
      "Content-Type must be application/json.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiRouteError(
      400,
      "validation_error",
      "A valid JSON body is required.",
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiRouteError(
      400,
      "validation_error",
      "The request fields are invalid.",
    );
  }

  return result.data;
}
