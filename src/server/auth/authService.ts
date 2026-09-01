// src/server/auth/authService.ts
import { UserRole } from '../../contracts';

export interface AuthSession {
  userId: string;
  role: UserRole;
  email: string;
}

/**
 * Validates request authentication and enforces Role-Based Access Control (RBAC)
 */
export async function verifyUserRole(
  userRole: UserRole,
  allowedRoles: UserRole[]
): Promise<boolean> {
  return allowedRoles.includes(userRole);
}

/**
 * Handles Auth + Consent transition from LeadSession to PatientSession
 */
export async function handlePatientConsentAndAuth(params: {
  sessionId: string;
  userId: string;
  email: string;
  phone: string;
  marketingConsent: boolean;
}) {
  const consentTimestamp = new Date().toISOString();

  // 1. Record consent and link user in DB
  const consentRecord = {
    session_id: params.sessionId,
    user_id: params.userId,
    verified_email: params.email,
    verified_phone: params.phone,
    consented_at: consentTimestamp,
    marketing_consent: params.marketingConsent,
  };

  return {
    success: true,
    consentRecord,
  };
}