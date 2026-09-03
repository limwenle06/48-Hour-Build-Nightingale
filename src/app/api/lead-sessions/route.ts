import { openingStrategyFor } from "@/config/channel-openings";
import {
  createLeadRecoveryCredential,
  getLeadRecoveryTokenHash,
  hashRecoveryToken,
  refreshLeadRecoveryCookie,
  setLeadRecoveryCookie,
} from "@/server/auth/recovery-cookie";
import {
  createLeadSession,
  recoverLeadSession,
  type LeadSessionState,
} from "@/server/data/guest-repository";
import { guestPersistenceApiError } from "@/server/guest/api-error";
import { leadSessionRequestSchema } from "@/server/guest/schemas";
import { createSafeGuestResponse } from "@/server/guest/safe-response";
import {
  ApiRouteError,
  apiFailure,
  apiSuccess,
  newRequestId,
  parseJsonRequest,
} from "@/server/http/api-response";
import { createSupabaseAdminClient } from "@/server/supabase/admin-client";
import { getNightingaleClinicId } from "@/server/supabase/config";

export const runtime = "nodejs";

function publicLeadState(state: LeadSessionState) {
  const recoveredRiskLevels = state.recovered_messages
    .filter((message) => message.sender_type === "guest")
    .map((message) => createSafeGuestResponse(message.content).risk_level);
  const activeGuestRiskLevel = recoveredRiskLevels.includes("high")
    ? "high"
    : recoveredRiskLevels.includes("medium")
      ? "medium"
      : recoveredRiskLevels.length > 0
        ? "low"
        : null;

  return {
    lead_session_id: state.lead_session_id,
    identity_level: state.identity_level,
    opening_strategy: openingStrategyFor(
      state.source_channel,
      state.identity_level,
      new Date(),
      state.clinic_timezone,
    ),
    recovery_expires_at: state.recovery_expires_at,
    recovered_messages: state.recovered_messages,
    active_guest_risk_level: activeGuestRiskLevel,
  };
}

export async function POST(request: Request) {
  const requestId = newRequestId();

  try {
    const input = await parseJsonRequest(request, leadSessionRequestSchema);
    if (input.clinic_id !== getNightingaleClinicId()) {
      throw new ApiRouteError(404, "not_found", "The clinic was not found.");
    }

    const admin = createSupabaseAdminClient();
    const existingTokenHash = await getLeadRecoveryTokenHash();
    if (existingTokenHash) {
      const recovered = await recoverLeadSession(admin, {
        clinic_id: input.clinic_id,
        recovery_token_hash: existingTokenHash,
      });
      if (recovered) {
        await refreshLeadRecoveryCookie();
        return apiSuccess(publicLeadState(recovered), requestId);
      }
    }

    const recovery = createLeadRecoveryCredential();
    const created = await createLeadSession(admin, {
      ...input,
      recovery_token_hash: recovery.token_hash,
      referral_token_hash: input.referral_token
        ? hashRecoveryToken(input.referral_token)
        : null,
    });
    await setLeadRecoveryCookie(recovery.raw_token);

    return apiSuccess(publicLeadState(created), requestId, 201);
  } catch (cause) {
    return apiFailure(guestPersistenceApiError(cause, "public"), requestId);
  }
}
