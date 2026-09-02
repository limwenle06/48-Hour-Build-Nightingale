// src/server/audit/auditLogger.ts
import { SupabaseClient } from '@supabase/supabase-js';

type Role = 'guest' | 'patient' | 'staff' | 'nurse' | 'clinician';

interface AuditLogInput {
  clinicId?: string | null;
  actorUserId?: string | null;
  actorRole: Role;
  eventType: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: 'success' | 'denied' | 'failed';
  requestId: string;
  metadata?: Record<string, string | number | boolean | null>;
}

const FORBIDDEN_METADATA_KEYS = [
  'content',
  'message',
  'name',
  'email',
  'phone',
  'ic',
  'id_number',
  'password',
  'token',
  'recovery_token',
  'auth_token',
  'prompt',
  'response',
];

export async function logAuditEvent(
  supabase: SupabaseClient,
  input: AuditLogInput
): Promise<void> {
  const sanitizedMetadata: Record<string, string | number | boolean | null> = {};

  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      const lowerKey = key.toLowerCase();
      const isForbidden = FORBIDDEN_METADATA_KEYS.some((forbidden) =>
        lowerKey.includes(forbidden)
      );

      if (!isForbidden) {
        sanitizedMetadata[key] = value;
      }
    }
  }

  await supabase.from('audit_logs').insert({
    clinic_id: input.clinicId || null,
    actor_user_id: input.actorUserId || null,
    actor_role: input.actorRole,
    event_type: input.eventType,
    resource_type: input.resourceType,
    resource_id: input.resourceId || null,
    outcome: input.outcome,
    request_id: input.requestId,
    metadata: sanitizedMetadata,
    created_at: new Date().toISOString(),
  });
}