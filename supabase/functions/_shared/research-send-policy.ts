/** Pure suppression rules shared by manual research sends and focused tests. */
export function manualResearchSuppressionReason(input: {
  email: string
  testMode: boolean
  allowedRecipients: string[]
  optedOut: boolean
  duplicateOrCooldown: boolean
  underDeliveryCap: boolean
}): string | null {
  if (input.optedOut) return 'unsubscribed'
  const email = input.email.trim().toLowerCase()
  if (input.testMode && !input.allowedRecipients.map((item) => item.trim().toLowerCase()).includes(email)) {
    return 'test_mode_not_allowlisted'
  }
  if (input.duplicateOrCooldown) return 'cooldown_or_duplicate'
  if (!input.underDeliveryCap) return 'email_cap_reached'
  return null
}