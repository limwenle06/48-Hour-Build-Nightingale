// tests/unit/backend/backendCore.test.ts
import { describe, it, expect } from 'vitest'; // or 'jest' depending on setup
import { createLeadSession, convertToPatientSession } from '../../../src/server/data/sessionRepository';
import { getOpeningStrategy } from '../../../src/server/services/channelRules';
import { logAuditEvent } from '../../../src/server/audit/auditLogger';

describe('Kash Backend Core Micro-Tests', () => {

  // Test 1: Channel Rules Differentiation
  it('returns channel-appropriate opening strategies without asking identified leads for emails', () => {
    const guestStrategy = getOpeningStrategy('staff_referral', 'anonymous', 10);
    const identifiedStrategy = getOpeningStrategy('lead_form', 'identified', 10);

    expect(guestStrategy.welcome_message).toContain('care team member pre-loaded your topic');
    expect(identifiedStrategy.collect_email_immediately).toBe(false);
  });

  // Test 2: Guest to Patient Conversion & Provenance
  it('converts LeadSession to PatientSession while maintaining session ID and attribution', async () => {
    const lead = await createLeadSession({
      clinic_id: 'clinic_01',
      source_channel: 'social_comment',
      campaign_id: 'ivf_over40',
    });

    const patient = await convertToPatientSession(lead.id, {
      patient_id: 'usr_12345',
      verified_email: 'patient@example.com',
      verified_phone: '+60123456789',
      marketing_consent: true,
    });

    expect(patient.id).toBe(lead.id); // Session ID preserved
    expect(patient.source_channel).toBe('social_comment'); // Attribution retained
    expect(patient.is_authenticated).toBe(true);
  });

  // Test 3: PHI Redaction in Audit Logs
  it('strips raw PHI and message contents from structured audit logs', async () => {
    const rawMetadata = {
      message_content: 'I have crushing chest pain',
      patient_name: 'John Doe',
      action: 'escalation_triggered',
    };

    const auditEntry = await logAuditEvent('escalation_sent', 'clinic_01', 'sess_123', 'hash_456', rawMetadata);

    expect(auditEntry.metadata).not.toHaveProperty('message_content');
    expect(auditEntry.metadata).not.toHaveProperty('patient_name');
    expect(auditEntry.metadata).toHaveProperty('action', 'escalation_triggered');
  });

});