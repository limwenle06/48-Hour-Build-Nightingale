import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import { patientPersistenceApiError } from "@/server/patient/api-error";
import { patientMessageRequestSchema } from "@/server/patient/schemas";
import {
  apiFailure,
  apiSuccess,
  newRequestId,
  parseJsonRequest,
} from "@/server/http/api-response";
import { handlePatientMessage } from "@/server/services/patient-message-service";
import { createSupabaseAdminClient } from "@/server/supabase/admin-client";
import { getNightingaleClinicId } from "@/server/supabase/config";
import { createSupabaseServerClient } from "@/server/supabase/server-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = newRequestId();

  try {
    const input = await parseJsonRequest(request, patientMessageRequestSchema);
    const authUser = await requireVerifiedAuthUser(
      await createSupabaseServerClient(),
    );
    const result = await handlePatientMessage(createSupabaseAdminClient(), {
      auth_user_id: authUser.id,
      clinic_id: getNightingaleClinicId(),
      patient_session_id: input.patient_session_id,
      content: input.content,
      request_id: requestId,
    });

    return apiSuccess(result, requestId, 201);
  } catch (cause) {
    return apiFailure(patientPersistenceApiError(cause), requestId);
  }
}

