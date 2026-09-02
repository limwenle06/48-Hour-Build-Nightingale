export interface WarmLeadMetrics {
  last_activity_at: string;
  source_channel: string;
  identity_level: string;
  funnel_stage: string;
}

/**
 * Calculates a transparent, non-clinical warm lead score based purely on:
 * - recency; source channel; identity level; funnel stage.
 * Clinical risk and symptoms are strictly excluded per contract section 13.
 */
export function calculateWarmLeadScore(metrics: WarmLeadMetrics): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Recency calculation
  const hoursSinceActivity = (Date.now() - new Date(metrics.last_activity_at).getTime()) / (1000 * 60 * 60);
  if (hoursSinceActivity <= 24) {
    score += 40;
    reasons.push('High recency (active within 24 hours)');
  } else if (hoursSinceActivity <= 72) {
    score += 20;
    reasons.push('Moderate recency (active within 3 days)');
  }

  // Source channel weight
  if (metrics.source_channel === 'staff_referral') {
    score += 30;
    reasons.push('Sourced via staff referral');
  } else {
    score += 10;
  }

  // Identity level maturity
  if (metrics.identity_level === 'verified' || metrics.identity_level === 'contact_provided') {
    score += 20;
    reasons.push('Identity contact information provided');
  }

  // Funnel progression stage
  if (metrics.funnel_stage === 'consented' || metrics.funnel_stage === 'patient_created') {
    score += 10;
    reasons.push('Advanced funnel stage reached');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reasons,
  };
}