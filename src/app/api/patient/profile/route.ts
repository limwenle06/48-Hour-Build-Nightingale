import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import { getPatientProfile } from "@/server/data/patient-repository";
import { apiFailure, apiSuccess, newRequestId } from "@/server/http/api-response";
import { patientPersistenceApiError } from "@/server/patient/api-error";
import { createSupabaseAdminClient } from "@/server/supabase/admin-client";
import { getNightingaleClinicId } from "@/server/supabase/config";
import { createSupabaseServerClient } from "@/server/supabase/server-client";

export const runtime = "nodejs";

export async function GET() {
  const requestId = newRequestId();

  try {
    const authUser = await requireVerifiedAuthUser(
      await createSupabaseServerClient(),
    );
    const result = await getPatientProfile(createSupabaseAdminClient(), {
      auth_user_id: authUser.id,
      clinic_id: getNightingaleClinicId(),
    });

    return apiSuccess(result, requestId);
  } catch (cause) {
    return apiFailure(patientPersistenceApiError(cause), requestId);
  }
}

