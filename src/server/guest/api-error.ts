import { GuestPersistenceError } from "@/server/data/guest-repository";
import { ApiRouteError } from "@/server/http/api-response";

export function guestPersistenceApiError(
  cause: unknown,
  context: "public" | "recovery",
) {
  if (!(cause instanceof GuestPersistenceError)) return cause;

  if (cause.databaseCode === "42501") {
    return context === "recovery"
      ? new ApiRouteError(
          401,
          "unauthenticated",
          "Your private guest session could not be recovered.",
        )
      : new ApiRouteError(
          403,
          "forbidden",
          "The referral link is invalid or expired.",
        );
  }

  if (cause.databaseCode === "23503") {
    return new ApiRouteError(404, "not_found", "The clinic was not found.");
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
    "The guest session could not be saved safely.",
  );
}
