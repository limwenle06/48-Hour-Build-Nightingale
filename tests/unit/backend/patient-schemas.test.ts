import { describe, expect, it } from "vitest";

import { patientMessageRequestSchema } from "@/server/patient/schemas";

describe("patient request schemas", () => {
  it("accepts a trimmed patient message", () => {
    expect(
      patientMessageRequestSchema.parse({
        patient_session_id: "11111111-1111-4111-8111-111111111111",
        content: "  I have a mild headache.  ",
      }),
    ).toEqual({
      patient_session_id: "11111111-1111-4111-8111-111111111111",
      content: "I have a mild headache.",
    });
  });

  it("rejects empty, oversized, malformed, and unknown fields", () => {
    const base = {
      patient_session_id: "11111111-1111-4111-8111-111111111111",
    };
    expect(patientMessageRequestSchema.safeParse({ ...base, content: " " }).success).toBe(false);
    expect(
      patientMessageRequestSchema.safeParse({
        ...base,
        content: "x".repeat(20_001),
      }).success,
    ).toBe(false);
    expect(
      patientMessageRequestSchema.safeParse({
        ...base,
        content: "Hello",
        patient_id: "not-client-controlled",
      }).success,
    ).toBe(false);
  });
});

