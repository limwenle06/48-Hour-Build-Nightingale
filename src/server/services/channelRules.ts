import { ChannelSource, IdentityLevel } from '../../contracts';

export interface OpeningStrategy {
  welcome_message: string;
  collect_email_immediately: boolean;
  prefill_topic?: string;
  call_to_action: string;
}

const MATRIX: Record<string, OpeningStrategy> = {
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
  'social_comment:anonymous:false': {
    welcome_message: 'Hi there! Thanks for reaching out on social media. How can we help you today?',
    collect_email_immediately: false,
    call_to_action: 'Explore options privately',
  },
  'lead_form:identified:false': {
    welcome_message: 'Welcome back! We received your form request. What specific details can we clarify for you?',
    collect_email_immediately: false,
    call_to_action: 'Continue your inquiry',
  },
  'default': {
    welcome_message: 'Welcome to Nightingale. How can we assist with your health journey today?',
    collect_email_immediately: false,
    call_to_action: 'Start conversation',
  },
};

export function getOpeningStrategy(
  channel: ChannelSource,
  identityLevel: IdentityLevel,
  hourOfDay: number = new Date().getHours()
): OpeningStrategy {
  const isAfterHours = hourOfDay < 8 || hourOfDay >= 18;
  const key = `${channel}:${identityLevel}:${isAfterHours}`;

  return MATRIX[key] || MATRIX['default'];
}