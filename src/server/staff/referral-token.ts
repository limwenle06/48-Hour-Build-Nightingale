import { createHash, randomBytes } from "node:crypto";

export function createStaffReferralCredential() {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    raw_token: rawToken,
    token_hash: createHash("sha256").update(rawToken, "utf8").digest("hex"),
  };
}

