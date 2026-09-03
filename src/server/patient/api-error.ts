import { PatientPersistenceError } from "@/server/data/patient-repository";
import { ApiRouteError } from "@/server/http/api-response";

export function patientPersistenceApiError(cause: unknown) {
  if (!(cause instanceof PatientPersistenceError)) return cause;

  if (cause.databaseCode === "NHC01") {
    return new ApiRouteError(
      403,
      "consent_required",
      "Healthcare consent is required before continuing.",
    );
  }

  if (cause.databaseCode === "NGR01") {
    return new ApiRouteError(
      429,
      "rate_limited",
      "Please wait a moment before sending another message.",
    );
  }

  if (cause.databaseCode === "42501") {
    return new ApiRouteError(
      403,
      "forbidden",
      "This patient record is not available to your account.",
    );
  }

  if (cause.databaseCode === "23503") {
    return new ApiRouteError(
      404,
      "not_found",
      "The patient session was not found.",
    );
  }

  if (["22023", "23514"].includes(cause.databaseCode ?? "")) {
    return new ApiRouteError(
      400,
      "validation_error",
      "The patient message could not be accepted.",
    );
  }

  return new ApiRouteError(
    503,
    "persistence_failed",
    "The patient record could not be saved safely.",
  );
}

