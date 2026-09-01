import { describe, expect, it } from "vitest";

import {
  REDACTION_PLACEHOLDER,
  redactPhi,
  type RedactionAuditEvent,
} from "../../../src/server/safety/redaction";

describe("redactPhi", () => {
  it("redacts a name, Malaysian IC, and phone number", () => {
    const name = "Amelia Tan";
    const nationalId = "900101-14-5678";
    const phone = "+60 12-345 6789";
    const input = `My name is ${name}. My IC is ${nationalId} and my phone is ${phone}.`;

    const result = redactPhi(input);

    expect(result.status).toBe("success");
    expect(result.redacted_text).toContain(REDACTION_PLACEHOLDER);
    expect(result.redacted_text).not.toContain(name);
    expect(result.redacted_text).not.toContain(nationalId);
    expect(result.redacted_text).not.toContain(phone);
    expect(result.detected_types).toEqual([
      "national_id",
      "phone",
      "name",
    ]);
    expect(result.replacement_count).toBe(3);
  });

  it("redacts compact Malaysian IC and phone formats", () => {
    const result = redactPhi(
      "Name: Nur Aisyah, IC 010203040506, phone 0123456789.",
    );

    expect(result.status).toBe("success");
    expect(result.redacted_text).not.toContain("Nur Aisyah");
    expect(result.redacted_text).not.toContain("010203040506");
    expect(result.redacted_text).not.toContain("0123456789");
    expect(result.replacement_count).toBe(3);
  });

  it("redacts a name introduced with an honorific", () => {
    const result = redactPhi("Please contact Dr Sarah Lim about my question.");

    expect(result.status).toBe("success");
    expect(result.redacted_text).toBe(
      `Please contact ${REDACTION_PLACEHOLDER} about my question.`,
    );
    expect(result.detected_types).toEqual(["name"]);
  });

  it("leaves text unchanged when no required identifier is detected", () => {
    const input = "I have had a mild headache since this morning.";

    const result = redactPhi(input);

    expect(result).toEqual({
      status: "success",
      redacted_text: input,
      detected_types: [],
      replacement_count: 0,
      failure_reason: null,
    });
  });

  it("emits structured audit metadata without raw values", () => {
    const name = "Daniel Wong";
    const nationalId = "880808-08-8888";
    const phone = "019-8765432";
    const events: RedactionAuditEvent[] = [];

    const result = redactPhi(
      `My name is ${name}. IC: ${nationalId}. Phone: ${phone}.`,
      { audit: (event) => events.push(event) },
    );

    const serializedEvents = JSON.stringify(events);
    expect(result.status).toBe("success");
    expect(events).toHaveLength(1);
    expect(serializedEvents).not.toContain(name);
    expect(serializedEvents).not.toContain(nationalId);
    expect(serializedEvents).not.toContain(phone);
    expect(serializedEvents).not.toContain("redacted_text");
  });

  it("fails closed when input is invalid", () => {
    const result = redactPhi(null);

    expect(result).toEqual({
      status: "failed",
      redacted_text: null,
      detected_types: [],
      replacement_count: 0,
      failure_reason: "invalid_redaction_input",
    });
  });

  it("fails closed when audit logging fails", () => {
    const result = redactPhi("My name is Aina Rahman.", {
      audit: () => {
        throw new Error("Synthetic audit failure");
      },
    });

    expect(result.status).toBe("failed");
    expect(result.redacted_text).toBeNull();
    expect(result.failure_reason).toBe("redaction_audit_failed");
  });
});
