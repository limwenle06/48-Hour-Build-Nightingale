// src/server/audit/auditLogger.ts
import { AuditEvent, AuditEventType } from '../../contracts';

/**
 * Sanitizes metadata to strictly remove raw message content or potential PHI fields
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const { message_content, raw_text, patient_name, phone, email, ...safeMetadata } = metadata;
  return safeMetadata;
}

/**
 * Creates a structured PHI-free JSON audit log entry
 */
export async function logAuditEvent(
  eventType: AuditEventType,
  clinicId: string,
  sessionId?: string,
  userHash?: string,
  metadata: Record<string, unknown> = {}
): Promise<AuditEvent> {
  const auditEntry: AuditEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    event_type: eventType,
    clinic_id: clinicId,
    session_id: sessionId,
    user_id_hash: userHash,
    metadata: sanitizeMetadata(metadata),
  };

  // Output structured JSON for system log collectors (Datadog, Supabase, CloudWatch)
  console.log(JSON.stringify(auditEntry));

  // Optional: Persist to Supabase audit_logs table if configured
  // await supabase.from('audit_logs').insert(auditEntry);

  return auditEntry;
}