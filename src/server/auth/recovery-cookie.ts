import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { ApiRouteError } from "@/server/http/api-response";

export const LEAD_RECOVERY_COOKIE = "nightingale_lead_recovery";
export const LEAD_RECOVERY_SECONDS = 7 * 24 * 60 * 60;

function isValidRawRecoveryToken(value: string | undefined): value is string {
  return Boolean(value && value.length >= 32 && value.length <= 500);
}

export function hashRecoveryToken(rawToken: string) {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function createLeadRecoveryCredential() {
  const rawToken = randomBytes(32).toString("base64url");
  return { raw_token: rawToken, token_hash: hashRecoveryToken(rawToken) };
}

export async function getLeadRecoveryTokenHash() {
  const rawToken = (await cookies()).get(LEAD_RECOVERY_COOKIE)?.value;
  return isValidRawRecoveryToken(rawToken)
    ? hashRecoveryToken(rawToken)
    : null;
}

export async function setLeadRecoveryCookie(rawToken: string) {
  if (!isValidRawRecoveryToken(rawToken)) {
    throw new Error("A valid guest recovery credential is required.");
  }

  (await cookies()).set(LEAD_RECOVERY_COOKIE, rawToken, {
    httpOnly: true,
    maxAge: LEAD_RECOVERY_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function refreshLeadRecoveryCookie() {
  const rawToken = (await cookies()).get(LEAD_RECOVERY_COOKIE)?.value;
  if (!isValidRawRecoveryToken(rawToken)) return false;
  await setLeadRecoveryCookie(rawToken);
  return true;
}

export async function requireLeadRecoveryTokenHash() {
  const tokenHash = await getLeadRecoveryTokenHash();

  if (!tokenHash) {
    throw new ApiRouteError(
      401,
      "unauthenticated",
      "Your private guest session could not be recovered.",
    );
  }

  return tokenHash;
}
