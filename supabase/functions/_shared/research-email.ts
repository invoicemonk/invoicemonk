// Dormant-user RESEARCH emails (not reactivation). Plain, personal, reply-first.
// Segments: A active→inactive, B never activated, C cancelled with a reason,
// D excluded (fraud/suspended/closed), E unsubscribed. D/E never receive email.

export const RESEARCH_CAMPAIGN_PREFIX = 'research-v1'
export const RESEARCH_SENDER_NAME = 'Yinka'
export const RESEARCH_REPLY_TO = 'yinka@invoicemonk.com'
export const RESEARCH_DORMANT_DAYS = 21
export const RESEARCH_STEP_GAPS_DAYS = { 2: 7, 3: 14 } as const
export type ResearchSegment = 'A' | 'B' | 'C' | 'D' | 'E'
export type ResearchStep = 1 | 2 | 3
export const researchCampaignKey = (step: ResearchStep) => `${RESEARCH_CAMPAIGN_PREFIX}:${step}`

export type ResearchCandidate = {
  segment: ResearchSegment; research_sent_count: number; last_research_at: string | null
  responded_at: string | null; has_open_abandonment: boolean; excluded_reason?: string | null
}
export type ResearchDecision = { send: true; step: ResearchStep } | { send: false; reason: string }

/** Pure sequencing rules: max 3 emails, gaps of 7 then 14 days, stop on reply, never overlap abandonment. */
export function nextResearchStep(c: ResearchCandidate, now = new Date()): ResearchDecision {
  if (c.segment === 'D') return { send: false, reason: 'account_excluded' }
  if (c.segment === 'E') return { send: false, reason: 'unsubscribed' }
  if (c.responded_at) return { send: false, reason: 'responded' }
  if (c.research_sent_count >= 3) return { send: false, reason: 'sequence_complete' }
  if (c.has_open_abandonment) return { send: false, reason: 'abandonment_active' }
  const step = (c.research_sent_count + 1) as ResearchStep
  if (step > 1) {
    const gap = RESEARCH_STEP_GAPS_DAYS[step as 2 | 3]
    if (!c.last_research_at || now.getTime() - new Date(c.last_research_at).getTime() < gap * 86400000) return { send: false, reason: 'waiting_for_next_step' }
  }
  return { send: true, step }
}

const CANCEL_REASONS: Record<string, string> = {
  too_expensive: 'Invoicemonk was too expensive for you right now',
  missing_features: 'Invoicemonk was missing features you needed',
  not_using_enough: 'you weren’t using Invoicemonk enough',
  switching_competitor: 'you were switching to a different tool',
  business_changed: 'your business situation changed',
}

export type ResearchEmailInput = { name?: string | null; segment: ResearchSegment; step: ResearchStep; cancellationReason?: string | null; cancellationDetails?: string | null; hasUsageHistory?: boolean }
export type ResearchEmail = { campaignKey: string; subject: string; text: string; html: string }

/** Known reason in the customer's own framing; free-text details win when present. */
function knownReason(reason?: string | null, details?: string | null) {
  const d = details?.trim()
  if (d && d.length <= 200) return `you told us: “${d}”`
  return reason ? CANCEL_REASONS[reason] ?? null : null
}

export function renderResearchEmail(i: ResearchEmailInput): ResearchEmail | null {
  if (i.segment === 'D' || i.segment === 'E') return null
  const first = i.name?.trim().split(/\s+/)[0]
  const hi = first ? `Hi ${first},` : 'Hi,'
  let subject: string, lines: string[]
  if (i.step === 1) {
    if (i.segment === 'C') {
      const r = knownReason(i.cancellationReason, i.cancellationDetails)
      if (!r) return renderResearchEmail({ ...i, segment: 'A' })
      subject = 'One quick question'
      lines = [`Thanks for letting us know that ${r}.`, 'Before we close the loop, I’d love to learn one thing:', 'Was there anything you wished Invoicemonk did better before you made that change?', 'You can simply reply to this email. A sentence or two is enough.']
    } else if (i.segment === 'B') {
      subject = 'Quick question about Invoicemonk'
      lines = ['You signed up for Invoicemonk a while ago, and I’d like to understand what you were hoping to get done.', 'What did you originally come to Invoicemonk to do — and did you end up finding another way to do it?', 'Just reply to this email. Even a one-line answer would be useful.']
    } else {
      subject = 'Quick question about Invoicemonk'
      lines = ['I noticed you haven’t been using Invoicemonk recently, and I’d genuinely like to understand why.', 'When you first started using Invoicemonk, what were you hoping it would help you with — and what changed?', 'Just reply to this email. Even a one-line answer would be useful.']
    }
  } else if (i.step === 2) {
    if (i.segment === 'A' && i.hasUsageHistory) {
      subject = 'What did you end up using instead?'
      lines = ['One quick follow-up.', 'If you stopped using Invoicemonk because you found another way to handle what you originally came here to do, what are you using now?', 'I’d genuinely value the answer — we’re trying to understand what people need from Invoicemonk.', 'Just reply to this email.']
    } else if (i.segment === 'C') {
      subject = 'A follow-up question'
      lines = ['One quick follow-up.', 'Looking back, was there a moment when Invoicemonk stopped being the right fit for you?', 'Just reply to this email — whatever comes to mind is helpful.']
    } else {
      subject = 'What got in the way?'
      lines = ['One quick follow-up.', 'Was there anything in Invoicemonk that was confusing, missing or slower than you expected when you tried it?', 'Just reply to this email — a sentence is plenty.']
    }
  } else {
    subject = 'One last question'
    lines = ['I’ll keep this short.', 'If you could change one thing about Invoicemonk based on your experience with it, what would it be?', 'Just reply with whatever comes to mind.', 'Thanks for helping us improve.']
  }
  const sign = ['Thanks,', 'Yinka', 'Invoicemonk']
  const text = [hi, ...lines, sign.join('\n')].join('\n\n')
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c))
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222"><div style="max-width:560px;padding:24px">${[hi, ...lines].map((l) => `<p style="margin:0 0 14px">${esc(l)}</p>`).join('')}<p style="margin:18px 0 0">${sign.map(esc).join('<br>')}</p></div></body></html>`
  return { campaignKey: researchCampaignKey(i.step), subject, text, html }
}
