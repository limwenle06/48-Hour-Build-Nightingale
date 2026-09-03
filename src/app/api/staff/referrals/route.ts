import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import { createStaffReferral } from "@/server/data/staff-repository";
import {
  apiFailure,
  apiSuccess,
  newRequestId,
  parseJsonRequest,
} from "@/server/http/api-response";
import { staffPersistenceApiError } from "@/server/staff/api-error";
import { createStaffReferralCredential } from "@/server/staff/referral-token";
import { staffReferralRequestSchema } from "@/server/staff/schemas";
import { createSupabaseAdminClient } from "@/server/supabase/admin-client";
import { getNightingaleClinicId } from "@/server/supabase/config";
import { createSupabaseServerClient } from "@/server/supabase/server-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = newRequestId();
  try {
    const input = await parseJsonRequest(request, staffReferralRequestSchema);
    const authUser = await requireVerifiedAuthUser(
      await createSupabaseServerClient(),
    );
    const credential = createStaffReferralCredential();
    const staffReferral = await createStaffReferral(
      createSupabaseAdminClient(),
      {
        auth_user_id: authUser.id,
        clinic_id: getNightingaleClinicId(),
        topic: input.topic,
        token_hash: credential.token_hash,
        expires_in_hours: input.expires_in_hours,
        request_id: requestId,
      },
    );
    const referralUrl = new URL("/start", request.url);
    referralUrl.searchParams.set("source_channel", "staff_referral");
    referralUrl.searchParams.set("source_platform", "clinic");
    referralUrl.searchParams.set("referral_token", credential.raw_token);

    return apiSuccess(
      {
        staff_referral: staffReferral,
        referral_url: referralUrl.toString(),
      },
      requestId,
      201,
    );
  } catch (cause) {
    return apiFailure(staffPersistenceApiError(cause), requestId);
  }
}

