// src/server/services/channelRules.ts
import { ChannelSource, IdentityLevel } from '../../contracts';

export interface RuleKey {
  channel: ChannelSource;
  identity_level: IdentityLevel;
  is_after_hours: boolean;
}

export interface OpeningStrategy {
  welcome_message: string;
  collect_email_immediately: boolean;
  prefill_topic?: string;
  call_to_action: string;
}

// Declarative Rule Table (No scattered IF statements)
const CHANNEL_RULE_MATRIX: Record<string, OpeningStrategy> = {
  // Staff Referral: High trust, pre-loaded context
  'staff_referral:anonymous:false': {
    welcome_message: 'Welcome! Your care team member pre-loaded your topic so we can pick up right where you left off.',
    collect_email_immediately: false,
    call_to_action: 'Ask any initial questions below',
  },
  'staff_referral:anonymous:true': {
    welcome_message: 'Welcome! Our clinic is currently closed, but your care team pre-loaded your inquiry. Leave a message and we will review it first thing in the morning.',
    collect_email_immediately: false,
    call_to_action: 'Leave a note for the clinic',
  },

  // Social Comment: Public DM response, light touch
  'social_comment:anonymous:false': {
    welcome_message: 'Hi there! Thanks for reaching out on social media. How can we help you today?',
    collect_email_immediately: false,
    call_to_action: 'Explore options privately',
  },
  'social_comment:anonymous:true': {
    welcome_message: 'Hi! Our clinic team is away for the evening, but Nightingale AI is here to help answer general questions.',
    collect_email_immediately: false,
    call_to_action: 'Ask a question',
  },

  // Lead Form: Already provided email
  'lead_form:identified:false': {
    welcome_message: 'Welcome back! We received your form request. What specific details can we clarify for you?',
    collect_email_immediately: false, // Never ask for what they already provided
    call_to_action: 'Continue your inquiry',
  },

  // Default fallback rule
  'default': {
    welcome_message: 'Welcome to Nightingale. How can we assist with your health journey today?',
    collect_email_immediately: false,
    call_to_action: 'Start conversation',
  },
};

/**
 * Resolves opening strategy declaratively based on channel, identity, and time of day
 */
export function getOpeningStrategy(
  channel: ChannelSource,
  identityLevel: IdentityLevel,
  hourOfDay: number = new Date().getHours()
): OpeningStrategy {
  const isAfterHours = hourOfDay < 8 || hourOfDay >= 18; // After hours: before 8 AM or after 6 PM
  const key = `${channel}:${identityLevel}:${isAfterHours}`;

  return CHANNEL_RULE_MATRIX[key] || CHANNEL_RULE_MATRIX['default'];
}