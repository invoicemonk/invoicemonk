import { describe, expect, it } from 'vitest';
import { PRODUCT_REGISTRY, INTENT_OPTIONS, areaForPath } from './product-registry';

describe('product registry', () => {
  it('has unique areas with activation events and workflows', () => {
    const areas = PRODUCT_REGISTRY.map((p) => p.area);
    expect(new Set(areas).size).toBe(areas.length);
    for (const p of PRODUCT_REGISTRY) {
      expect(p.activation).toBeTruthy();
      expect(p.workflows.length).toBeGreaterThan(0);
    }
  });

  it('never treats the discovery prompt area as a product journey', () => {
    expect(PRODUCT_REGISTRY.some((p) => (p.area as string) === 'discovery')).toBe(false);
  });

  it('maps every intent to known product areas', () => {
    const known = new Set(PRODUCT_REGISTRY.map((p) => p.area));
    for (const i of INTENT_OPTIONS) for (const a of i.areas) expect(known.has(a)).toBe(true);
  });

  it('resolves business-scoped paths', () => {
    expect(areaForPath('/b/00000000-0000-0000-0000-000000000000/accounting/tax-reports')?.area).toBe('tax_reports');
    expect(areaForPath('/b/x/invoices')).toBeNull();
  });
});

import { PRODUCT_JOBS } from './product-registry';
import { PRODUCT_JOBS as SERVER_JOBS } from '../../supabase/functions/_shared/product-tip-email';

describe('product jobs', () => {
  it('matches the server-side job definitions exactly', () => {
    expect(PRODUCT_JOBS.map(({ id, area, label, workflows }) => ({ id, area, label, workflows })))
      .toEqual(SERVER_JOBS.map(({ id, area, label, workflows }) => ({ id, area, label, workflows })));
  });
  it('covers every registered workflow with a job', () => {
    for (const p of PRODUCT_REGISTRY) for (const w of p.workflows)
      expect(PRODUCT_JOBS.some((j) => j.area === p.area && j.workflows.includes(w))).toBe(true);
  });
});
