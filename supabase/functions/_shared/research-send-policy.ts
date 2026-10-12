/**
 * Pure suppression rules for admin-initiated dormant-research sends.
 * Manual sends deliver to the real recipient (no test mode / allowlist);
 * opt-outs, duplicates and the rolling delivery cap still apply.
 */
export function manualResearchSuppressionReason(input: {
  optedOut: boolean
  duplicateOrCooldown: boolean
  underDeliveryCap: boolean
}): string | null {
  if (input.optedOut) return 'unsubscribed'
  if (input.duplicateOrCooldown) return 'already_received'
  if (!input.underDeliveryCap) return 'email_cap_reached'
  return null
}
