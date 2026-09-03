import {
  refreshLeadRecoveryCookie,
  requireLeadRecoveryTokenHash,
} from "@/server/auth/recovery-cookie";
import { recordGuestFunnelEvent } from "@/server/data/guest-repository";
import { guestPersistenceApiError } from "@/server/guest/api-error";
import { funnelEventRequestSchema } from "@/server/guest/schemas";
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
    const input = await parseJsonRequest(request, funnelEventRequestSchema);
    const recoveryTokenHash = await requireLeadRecoveryTokenHash();
    const funnelEvent = await recordGuestFunnelEvent(
      createSupabaseAdminClient(),
      {
        lead_session_id: input.lead_session_id,
        recovery_token_hash: recoveryTokenHash,
        event_name: input.event_name,
        metadata: input.metadata ?? {},
      },
    );
    await refreshLeadRecoveryCookie();

    return apiSuccess({ funnel_event: funnelEvent }, requestId, 201);
  } catch (cause) {
    return apiFailure(guestPersistenceApiError(cause, "recovery"), requestId);
  }
}
