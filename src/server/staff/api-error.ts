import { StaffPersistenceError } from "@/server/data/staff-repository";
import { ApiRouteError } from "@/server/http/api-response";

export function staffPersistenceApiError(cause: unknown) {
  if (!(cause instanceof StaffPersistenceError)) return cause;

  if (cause.databaseCode === "NHC01") {
    return new ApiRouteError(
      403,
      "consent_required",
      "Current healthcare consent is required for this record.",
    );
  }

  if (cause.databaseCode === "42501") {
    return new ApiRouteError(
      403,
      "forbidden",
      "Your clinic role does not allow this action.",
    );
  }

  if (cause.databaseCode === "23503") {
    return new ApiRouteError(404, "not_found", "The record was not found.");
  }

  if (["22023", "23514"].includes(cause.databaseCode ?? "")) {
    return new ApiRouteError(
      400,
      "validation_error",
      "The request could not be accepted.",
    );
  }

  return new ApiRouteError(
    503,
    "persistence_failed",
    "The clinic record could not be saved safely.",
  );
}

