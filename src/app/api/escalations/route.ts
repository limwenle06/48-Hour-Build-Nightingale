import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import {
  apiFailure,
  apiSuccess,
  newRequestId,
  parseJsonRequest,
} from "@/server/http/api-response";
import { createPatientEscalation } from "@/server/services/escalation-service";
import { staffPersistenceApiError } from "@/server/staff/api-error";
import { escalationRequestSchema } from "@/server/staff/schemas";
import { createSupabaseAdminClient } from "@/server/supabase/admin-client";
import { getNightingaleClinicId } from "@/server/supabase/config";
import { createSupabaseServerClient } from "@/server/supabase/server-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = newRequestId();

  try {
    const input = await parseJsonRequest(request, escalationRequestSchema);
    const authUser = await requireVerifiedAuthUser(
      await createSupabaseServerClient(),
    );
    const escalation = await createPatientEscalation(
      createSupabaseAdminClient(),
      {
        auth_user_id: authUser.id,
        clinic_id: getNightingaleClinicId(),
        ...input,
        request_id: requestId,
      },
    );
    return apiSuccess(
      { escalation, expected_response_window: "12-18 hours" as const },
      requestId,
      201,
    );
  } catch (cause) {
    return apiFailure(staffPersistenceApiError(cause), requestId);
  }
}

