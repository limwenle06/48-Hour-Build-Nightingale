import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import { resolveStaffIdentity } from "@/server/data/staff-repository";
import {
  ApiRouteError,
  apiFailure,
  apiSuccess,
  newRequestId,
  parseJsonRequest,
} from "@/server/http/api-response";
import { staffPersistenceApiError } from "@/server/staff/api-error";
import { staffAuthRequestSchema } from "@/server/staff/schemas";
import { createSupabaseAdminClient } from "@/server/supabase/admin-client";
import { getNightingaleClinicId } from "@/server/supabase/config";
import { createSupabaseServerClient } from "@/server/supabase/server-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = newRequestId();

  try {
    const input = await parseJsonRequest(request, staffAuthRequestSchema);
    const supabase = await createSupabaseServerClient();

    if (input.action === "sign_out") {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new ApiRouteError(
          503,
          "dependency_unavailable",
          "Sign out could not be completed.",
        );
      }
      return apiSuccess(
        { authenticated: false, staff_user: null },
        requestId,
      );
    }

    const authResult = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (authResult.error) {
      throw new ApiRouteError(
        (authResult.error.status ?? 0) >= 500 ? 503 : 401,
        (authResult.error.status ?? 0) >= 500
          ? "dependency_unavailable"
          : "unauthenticated",
        (authResult.error.status ?? 0) >= 500
          ? "Authentication is temporarily unavailable."
          : "The work email or password was not accepted.",
      );
    }

    const authUser = await requireVerifiedAuthUser(supabase);
    let staffUser;
    try {
      staffUser = await resolveStaffIdentity(createSupabaseAdminClient(), {
        auth_user_id: authUser.id,
        clinic_id: getNightingaleClinicId(),
      });
    } catch (cause) {
      await supabase.auth.signOut();
      throw cause;
    }
    return apiSuccess(
      { authenticated: true, staff_user: staffUser },
      requestId,
    );
  } catch (cause) {
    return apiFailure(staffPersistenceApiError(cause), requestId);
  }
}
