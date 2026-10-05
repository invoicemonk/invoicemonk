export interface IssuerNameSnapshot {
  legal_name?: string | null;
  business_name?: string | null;
  name?: string | null;
}

export function resolveIssuerName(
  snapshot: IssuerNameSnapshot | null | undefined,
  fallback = 'Business',
): string {
  const candidates = [snapshot?.legal_name, snapshot?.business_name, snapshot?.name];
  return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)?.trim() || fallback;
}