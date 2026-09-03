import {
  refreshLeadRecoveryCookie,
  requireLeadRecoveryTokenHash,
} from "@/server/auth/recovery-cookie";
import { appendGuestExchange } from "@/server/data/guest-repository";
import { guestPersistenceApiError } from "@/server/guest/api-error";
import { guestMessageRequestSchema } from "@/server/guest/schemas";
import { createSafeGuestResponse } from "@/server/guest/safe-response";
import {
  apiFailure,
  apiSuccess,
  newRequestId,
  parseJsonRequest,
} from "@/server/http/api-response";
import { createSupabaseAdminClient } from "@/server/supabase/admin-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = newRequestId();

  try {
    const input = await parseJsonRequest(request, guestMessageRequestSchema);
    const recoveryTokenHash = await requireLeadRecoveryTokenHash();
    const safeResponse = createSafeGuestResponse(input.content);
    const result = await appendGuestExchange(createSupabaseAdminClient(), {
      lead_session_id: input.lead_session_id,
      recovery_token_hash: recoveryTokenHash,
      guest_content: input.content,
      assistant_content: safeResponse.content,
      value_type: safeResponse.value_type,
    });
    await refreshLeadRecoveryCookie();

    return apiSuccess(
      {
        ...result,
        risk_level: safeResponse.risk_level,
        trust_transition_available: true,
      },
      requestId,
      201,
    );
  } catch (cause) {
    return apiFailure(guestPersistenceApiError(cause, "recovery"), requestId);
  }
}
