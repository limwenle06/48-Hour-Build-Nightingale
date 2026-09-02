import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const ConvertSchema = z.object({
  lead_session_id: z.string().uuid(),
  health_consent_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const body = await req.json();
    const parsed = ConvertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'validation_error', message: 'Invalid payload' } }, { status: 400 });
    }

    const { lead_session_id, health_consent_id } = parsed.data;

    // TODO: Extract authenticated Supabase user ID from request headers/session middleware
    const authUserId = req.headers.get('x-auth-user-id'); 
    if (!authUserId) {
      return NextResponse.json({ error: { code: 'unauthenticated', message: 'Authentication required' } }, { status: 401 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock and validate LeadSession
      const leadSession = await tx.leadSession.findUnique({
        where: { lead_session_id },
      });

      if (!leadSession || leadSession.status === 'expired') {
        throw new Error('Lead session not found or expired.');
      }

      if (leadSession.status === 'converted') {
        // Idempotency: Return existing patient session linkage if already converted
        const existingSession = await tx.patientSession.findFirst({
          where: { source_lead_session_id: lead_session_id },
        });
        const existingPatient = await tx.patient.findUnique({
          where: { patient_id: existingSession?.patient_id },
        });
        return { patient: existingPatient, patient_session: existingSession, already_converted: true };
      }

      // 2. Resolve or Validate User and Patient Shell for this Clinic
      let user = await tx.user.findUnique({ where: { auth_user_id: authUserId } });
      if (!user) {
        throw new Error('User identity shell not found.');
      }

      let patient = await tx.patient.findUnique({ where: { user_id: user.user_id } });
      if (!patient) {
        patient = await tx.patient.create({
          data: {
            user_id: user.user_id,
            clinic_id: leadSession.clinic_id,
          },
        });
      }

      // 3. Validate Clinic-specific Healthcare Consent belongs to Patient and is granted
      const consent = await tx.consent.findUnique({
        where: { consent_id: health_consent_id },
      });

      if (!consent || consent.patient_id !== patient.patient_id || consent.consent_type !== 'health_data_sharing' || consent.status !== 'granted') {
        throw new Error('Valid healthcare consent is required for conversion.');
      }

      // 4. Create PatientSession linked to LeadSession
      const patientSession = await tx.patientSession.create({
        data: {
          patient_id: patient.patient_id,
          clinic_id: leadSession.clinic_id,
          source_lead_session_id: leadSession.lead_session_id,
          source_channel: leadSession.source_channel,
          source_platform: leadSession.source_platform,
          campaign_id: leadSession.campaign_id,
          creative: leadSession.creative,
          identity_level: leadSession.identity_level,
          landing_timestamp: leadSession.created_at,
        },
      });

      // 5. Mark LeadSession converted and store resulting IDs
      await tx.leadSession.update({
        where: { lead_session_id },
        data: {
          status: 'converted',
          converted_patient_id: patient.patient_id,
          converted_patient_session_id: patientSession.patient_session_id,
        },
      });

      // 6. Append 'patient_created' funnel event exactly once
      await tx.funnelEvent.create({
        data: {
          clinic_id: leadSession.clinic_id,
          event_name: 'patient_created',
          lead_session_id: leadSession.lead_session_id,
          patient_id: patient.patient_id,
          patient_session_id: patientSession.patient_session_id,
          source_channel: leadSession.source_channel,
          campaign_id: leadSession.campaign_id,
          metadata: {},
        },
      });

      // Fetch source message IDs for contract return
      const messages = await tx.message.findMany({
        where: { session_id: lead_session_id },
        select: { message_id: true },
      });

      return {
        patient,
        patient_session: patientSession,
        source_message_ids: messages.map((m) => m.message_id),
        attribution: {
          clinic_id: leadSession.clinic_id,
          source_channel: leadSession.source_channel,
          source_platform: leadSession.source_platform,
          campaign_id: leadSession.campaign_id,
          creative: leadSession.creative,
          identity_level: leadSession.identity_level,
          landing_timestamp: leadSession.created_at.toISOString(),
        },
      };
    });

    return NextResponse.json({ data: result, request_id: requestId }, { status: 200 });
  } catch (error: any) {
    const code = error.message.includes('consent') ? 'consent_required' : 'conflict';
    return NextResponse.json(
      { error: { code, message: error.message }, request_id: requestId },
      { status: code === 'consent_required' ? 403 : 409 }
    );
  }
}