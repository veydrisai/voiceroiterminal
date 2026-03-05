/**
 * Maps raw Vapi ended-reason / outcome strings to clean, professional display labels.
 */
const OUTCOME_MAP: Record<string, string> = {
  'customer-ended-call': 'Completed Call',
  'assistant-ended-call': 'Completed',
  'voicemail': 'Voicemail',
  'exceeded-max-duration': 'Max Duration Reached',
  'no-answer': 'No Answer',
  'silence-timed-out': 'No Response',
  'dial-failed': 'Call Failed',
  'call-start-error-timed-out': 'Failed to Start',
  'twilio-failed-to-connect-call': 'Connection Failed',
  'pipeline-no-available-model': 'System Error',
  'error': 'Error',
  'unknown': 'Uncategorized',
  'assistant-forwarded-call': 'Forwarded',
  'assistant-request-failed': 'Assistant Error',
  'assistant-request-returned-error': 'Assistant Error',
  'assistant-request-returned-forwarddestination': 'Forwarded',
  'assistant-request-returned-invalid-assistant-id': 'Config Error',
  'assistant-request-returned-no-assistant': 'Config Error',
  'assistant-said-end-call-phrase': 'Completed',
  'human-hangup': 'Completed Call',
  'twilio-completed': 'Completed',
}

const INTENT_MAP: Record<string, string> = {
  'unknown': 'General Inquiry',
  'booking': 'Booking',
  'schedule': 'Scheduling',
  'inquiry': 'Inquiry',
  'callback': 'Callback Request',
  'information': 'Information Request',
  'complaint': 'Complaint',
  'cancellation': 'Cancellation',
  'rescheduling': 'Rescheduling',
  'pricing': 'Pricing Inquiry',
  'support': 'Support',
  'sales': 'Sales',
}

export function labelOutcome(raw: string | null | undefined): string {
  if (!raw) return 'Uncategorized'
  const key = raw.trim().toLowerCase()
  return OUTCOME_MAP[key] ?? toTitleCase(raw)
}

export function labelIntent(raw: string | null | undefined): string {
  if (!raw) return 'General Inquiry'
  const key = raw.trim().toLowerCase()
  if (INTENT_MAP[key]) return INTENT_MAP[key]
  // For AI-generated summaries (long strings), truncate and title-case
  if (raw.length > 60) return toTitleCase(raw.slice(0, 57)) + '…'
  return toTitleCase(raw)
}

function toTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
