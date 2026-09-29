// Upgrade emails (Starter / Starter paid -> Professional). Each email is tied to a
// limit or locked feature the person actually hit; claims only what tier_limits grants.
import { BANNED_PHRASES, brandedEmailShell } from './product-tip-email.ts'

export const UPGRADE_CAMPAIGN_PREFIX = 'upgrade-v1'
export const UPGRADE_COOLDOWN_DAYS = 14
export const UPGRADE_MAX_EMAILS = 3
const BILLING_URL = 'https://app.invoicemonk.com/billing'

export type UpgradeTrigger =
  | 'invoice_limit' | 'receipt_limit' | 'client_limit' | 'watermark'
  | 'reports_blocked' | 'exports_blocked' | 'audit_logs_blocked' | 'branding_blocked' | 'templates_blocked' | 'team_blocked'
export const upgradeCampaignKey = (t: UpgradeTrigger) => `${UPGRADE_CAMPAIGN_PREFIX}:${t}`

/** Priority: hard limits first (they block work), then locked features, then watermark. */
export const TRIGGER_PRIORITY: UpgradeTrigger[] = ['invoice_limit', 'client_limit', 'receipt_limit', 'team_blocked', 'reports_blocked', 'exports_blocked', 'audit_logs_blocked', 'branding_blocked', 'templates_blocked', 'watermark']
/** Limits paid Starter never has, so it must never be told about them. */
const FREE_ONLY: UpgradeTrigger[] = ['invoice_limit', 'client_limit', 'receipt_limit']

export type UpgradeCandidate = {
  tier: string; triggers: string[]; upgrade_sent_count: number; last_upgrade_at: string | null; sent_triggers: string[]
  excluded_reason: string | null; has_open_abandonment: boolean; research_active: boolean
}
export type UpgradeDecision = { send: true; trigger: UpgradeTrigger } | { send: false; reason: string }

export function nextUpgradeEmail(c: UpgradeCandidate, now = new Date()): UpgradeDecision {
  if (c.tier !== 'starter' && c.tier !== 'starter_paid') return { send: false, reason: 'not_starter' }
  if (c.excluded_reason) return { send: false, reason: c.excluded_reason }
  if (c.upgrade_sent_count >= UPGRADE_MAX_EMAILS) return { send: false, reason: 'max_reached' }
  if (c.last_upgrade_at && now.getTime() - new Date(c.last_upgrade_at).getTime() < UPGRADE_COOLDOWN_DAYS * 86400000) return { send: false, reason: 'cooldown' }
  if (c.has_open_abandonment) return { send: false, reason: 'abandonment_active' }
  if (c.research_active) return { send: false, reason: 'research_active' }
  const trigger = TRIGGER_PRIORITY.find((t) => c.triggers.includes(t) && !c.sent_triggers.includes(t) && !(c.tier === 'starter_paid' && FREE_ONLY.includes(t)))
  return trigger ? { send: true, trigger } : { send: false, reason: 'no_new_trigger' }
}

type Copy = { subject: string; heading: string; lead: string; detail: string }
const COPY: Record<UpgradeTrigger, Copy> = {
  invoice_limit: { subject: 'You’ve used all 3 invoices for this month', heading: 'Your monthly invoice limit is reached', lead: 'You’ve issued 3 invoices this month, which is the limit on the free Starter plan.', detail: 'On Professional there’s no monthly cap, so you can keep invoicing clients whenever work is done.' },
  client_limit: { subject: 'Adding another client needs an upgrade', heading: 'Your client limit is reached', lead: 'You tried to add another client, but the free Starter plan allows 1 client.', detail: 'Professional has no client limit, so every customer can have their own saved details.' },
  receipt_limit: { subject: 'You’ve reached 5 receipts on the free plan', heading: 'Your receipt limit is reached', lead: 'Your business has 5 payment receipts, which is the limit on the free Starter plan.', detail: 'Professional has no receipt limit, so every payment can get a receipt.' },
  team_blocked: { subject: 'Bringing your team into Invoicemonk', heading: 'Add your team', lead: 'You opened the Team page, but adding teammates isn’t included in your current plan.', detail: 'Professional lets up to 5 people work in the same business, each with their own role.' },
  reports_blocked: { subject: 'The reports you opened are on Professional', heading: 'Your business reports', lead: 'You opened Reports, which isn’t included in your current plan.', detail: 'Professional unlocks revenue and business reports built from the invoices and expenses you’ve already recorded.' },
  exports_blocked: { subject: 'Exporting your records', heading: 'Export your data', lead: 'You tried to export your records, which isn’t included in your current plan.', detail: 'Professional lets you download your data whenever you or your accountant need it.' },
  audit_logs_blocked: { subject: 'Your audit trail is on Professional', heading: 'See every change', lead: 'You opened the audit log, which isn’t included in your current plan.', detail: 'Professional shows the full record of who did what in your business, and when.' },
  branding_blocked: { subject: 'Putting your own branding on invoices', heading: 'Your brand on every invoice', lead: 'You looked at custom branding, which isn’t included in your current plan.', detail: 'Professional lets you use your own logo and brand colours on invoices, and removes the Invoicemonk watermark.' },
  templates_blocked: { subject: 'The invoice template you picked is on Professional', heading: 'Premium invoice templates', lead: 'You chose one of the premium invoice templates, which isn’t included in your current plan.', detail: 'Professional unlocks the Professional and Modern templates, without the Invoicemonk watermark.' },
  watermark: { subject: 'Removing the Invoicemonk watermark from your invoices', heading: 'Invoices with only your brand', lead: 'The invoices you’ve issued carry the Invoicemonk watermark, which is included on your current plan.', detail: 'On Professional, your invoices show only your business, with your own logo and colours.' },
}
const PAID_STARTER_EXTRAS = 'Professional also adds reports, data exports, the audit trail and up to 5 team members.'

export type UpgradeEmail = { campaignKey: string; trigger: UpgradeTrigger; subject: string; heading: string; html: string; text: string }
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c))

export function renderUpgradeEmail(i: { name?: string | null; tier: string; trigger: UpgradeTrigger }): UpgradeEmail | null {
  if (i.tier === 'starter_paid' && FREE_ONLY.includes(i.trigger)) return null
  const c = COPY[i.trigger]; if (!c) return null
  const first = i.name?.trim().split(/\s+/)[0]
  const paras = [first ? `Hi ${first},` : 'Hi,', c.lead, c.detail, ...(i.tier === 'starter_paid' && i.trigger !== 'team_blocked' ? [PAID_STARTER_EXTRAS] : [])]
  const text = [...paras, `See Professional: ${BILLING_URL}`, 'The Invoicemonk team'].join('\n\n')
  const body = paras.map((p) => `<p style="margin:0 0 14px">${esc(p)}</p>`).join('') +
    `<div style="text-align:center;margin:26px 0"><a href="${BILLING_URL}" style="display:inline-block;background:#1d6b5a;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">See Professional</a></div><p style="margin:0">The Invoicemonk team</p>`
  const email = { campaignKey: upgradeCampaignKey(i.trigger), trigger: i.trigger, subject: c.subject, heading: c.heading, html: brandedEmailShell(c.heading, body), text }
  const lower = (email.text + email.subject).toLowerCase()
  if (BANNED_PHRASES.some((p) => lower.includes(p))) return null
  return email
}

/** Maps the UpgradePrompt/UpgradeRequiredPage feature label to a tracked blocked event. */
export const ALL_UPGRADE_TRIGGERS = Object.keys(COPY) as UpgradeTrigger[]
