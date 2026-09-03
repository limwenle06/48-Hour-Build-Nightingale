import { createSupabaseAdminClient } from "@/server/supabase/admin-client";
import { createSupabaseServerClient } from "@/server/supabase/server-client";
import { getNightingaleClinicId } from "@/server/supabase/config";
import {
  ApiRouteError,
  apiFailure,
  apiSuccess,
  newRequestId,
  parseJsonRequest,
} from "@/server/http/api-response";
import { patientAuthRequestSchema } from "@/server/auth/schemas";
import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import {
  ensurePatientIdentity,
  PersistenceError,
} from "@/server/data/patient-auth-repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = newRequestId();

  try {
    const input = await parseJsonRequest(request, patientAuthRequestSchema);
    if (input.clinic_id !== getNightingaleClinicId()) {
      throw new ApiRouteError(403, "forbidden", "The clinic is not available.");
    }

    const supabase = await createSupabaseServerClient();
    const authResult =
      input.action === "sign_up"
        ? await supabase.auth.signUp({
            email: input.email,
            password: input.password,
            options: {
              data: { phone: input.phone ?? null },
            },
          })
        : await supabase.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });

    if (authResult.error) {
      if ((authResult.error.status ?? 0) >= 500) {
        throw new ApiRouteError(
          503,
          "dependency_unavailable",
          "Authentication is temporarily unavailable.",
        );
      }

      const emailNeedsVerification = /email.*(?:confirm|verif)/i.test(
        authResult.error.message,
      );
      if (emailNeedsVerification) {
        throw new ApiRouteError(
          403,
          "forbidden",
          "Verify your email before continuing.",
        );
      }

      throw new ApiRouteError(
        input.action === "sign_in" ? 401 : 400,
        input.action === "sign_in"
          ? "unauthenticated"
          : "validation_error",
        input.action === "sign_in"
          ? "The email or password was not accepted."
          : "The account could not be created with those details.",
      );
    }

    if (!authResult.data.session || !authResult.data.user?.email_confirmed_at) {
      return apiSuccess(
        {
          authenticated: false,
          verification_required: true,
          patient: null,
        },
        requestId,
        202,
      );
    }

    const authUser = await requireVerifiedAuthUser(supabase);
    const identity = await ensurePatientIdentity(createSupabaseAdminClient(), {
      auth_user_id: authUser.id,
      verified_email: authUser.email,
      phone: input.phone ?? null,
      clinic_id: input.clinic_id,
    });

    return apiSuccess(
      {
        authenticated: true,
        verification_required: false,
        patient: identity.patient,
      },
      requestId,
    );
  } catch (cause) {
    if (cause instanceof PersistenceError) {
      return apiFailure(
        new ApiRouteError(
          cause.databaseCode === "42501" ? 403 : 503,
          cause.databaseCode === "42501"
            ? "forbidden"
            : "persistence_failed",
          cause.databaseCode === "42501"
            ? "This account cannot be used as a patient account."
            : "The patient account could not be prepared safely.",
        ),
        requestId,
      );
    }

    return apiFailure(cause, requestId);
  }
}
