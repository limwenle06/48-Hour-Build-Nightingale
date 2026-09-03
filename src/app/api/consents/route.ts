import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import {
  getLeadRecoveryTokenHash,
  refreshLeadRecoveryCookie,
} from "@/server/auth/recovery-cookie";
import { consentRequestSchema } from "@/server/auth/schemas";
import {
  recordPatientConsent,
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
import { getNightingaleClinicId } from "@/server/supabase/config";
import { createSupabaseServerClient } from "@/server/supabase/server-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = newRequestId();

  try {
    const input = await parseJsonRequest(request, consentRequestSchema);
    if (input.clinic_id !== getNightingaleClinicId()) {
      throw new ApiRouteError(403, "forbidden", "The clinic is not available.");
    }

    const authUser = await requireVerifiedAuthUser(
      await createSupabaseServerClient(),
    );
    const recoveryTokenHash = await getLeadRecoveryTokenHash();
    const result = await recordPatientConsent(createSupabaseAdminClient(), {
      auth_user_id: authUser.id,
      ...input,
      recovery_token_hash: recoveryTokenHash,
    });
    if (recoveryTokenHash) await refreshLeadRecoveryCookie();

    return apiSuccess(result, requestId, 201);
  } catch (cause) {
    if (cause instanceof PersistenceError) {
      return apiFailure(
        new ApiRouteError(
          cause.databaseCode === "42501" ? 403 : 503,
          cause.databaseCode === "42501"
            ? "forbidden"
            : "persistence_failed",
          cause.databaseCode === "42501"
            ? "A verified patient account is required for this consent."
            : "The consent decision could not be recorded safely.",
        ),
        requestId,
      );
    }

    return apiFailure(cause, requestId);
  }
}
