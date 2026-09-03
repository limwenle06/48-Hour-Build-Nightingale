import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import { requireLeadRecoveryTokenHash } from "@/server/auth/recovery-cookie";
import { conversionRequestSchema } from "@/server/auth/schemas";
import {
  convertLeadSession,
  PersistenceError,
} from "@/server/data/patient-auth-repository";
import {
  ApiRouteError,
  apiFailure,
  apiSuccess,
  newRequestId,
  parseJsonRequest,
} from "@/server/http/api-response";
import { createSupabaseAdminClient } from "@/server/supabase/admin-client";
import { createSupabaseServerClient } from "@/server/supabase/server-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = newRequestId();

  try {
    const input = await parseJsonRequest(request, conversionRequestSchema);
    const authUser = await requireVerifiedAuthUser(
      await createSupabaseServerClient(),
    );
    const recoveryTokenHash = await requireLeadRecoveryTokenHash();
    const result = await convertLeadSession(createSupabaseAdminClient(), {
      auth_user_id: authUser.id,
      lead_session_id: input.lead_session_id,
      health_consent_id: input.health_consent_id,
      recovery_token_hash: recoveryTokenHash,
    });

    return apiSuccess(result, requestId);
  } catch (cause) {
    if (cause instanceof PersistenceError) {
      const forbidden = cause.databaseCode === "42501";
      const conflict = cause.databaseCode === "23514";
      return apiFailure(
        new ApiRouteError(
          forbidden ? 403 : conflict ? 409 : 503,
          forbidden
            ? "forbidden"
            : conflict
              ? "conflict"
              : "persistence_failed",
          forbidden
            ? "The guest session could not be converted securely."
            : conflict
              ? "The guest session cannot be converted from its current state."
              : "The guest session conversion could not be completed.",
        ),
        requestId,
      );
    }

    return apiFailure(cause, requestId);
  }
}
