import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import { listWarmLeads } from "@/server/data/staff-repository";
import { apiFailure, apiSuccess, newRequestId } from "@/server/http/api-response";
import { staffPersistenceApiError } from "@/server/staff/api-error";
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
    const leads = await listWarmLeads(createSupabaseAdminClient(), {
      auth_user_id: authUser.id,
      clinic_id: getNightingaleClinicId(),
    });
    return apiSuccess({ leads }, requestId);
  } catch (cause) {
    return apiFailure(staffPersistenceApiError(cause), requestId);
  }
}

