// src/server/audit/logger.ts
import { SupabaseClient } from '@supabase/supabase-js';

interface AuditLogParams {
  supabase: SupabaseClient;
  clinicId: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export async function logAuditEvent({
  supabase,
  clinicId,
  actorUserId,
  action,
  resourceType,
  resourceId,
  metadata = {},
}: AuditLogParams) {
  try {
    // Redact sensitive PHI patterns or personal identifiers from metadata recursively if present
    const sanitizedMetadata = sanitizePhi(metadata);

    await supabase.from('audit_logs').insert({
      clinic_id: clinicId,
      actor_user_id: actorUserId || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId || null,
      metadata: sanitizedMetadata,
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

function sanitizePhi(obj: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'ssn', 'credit_card', 'phone', 'email', 'secret'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED_PHI]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizePhi(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}