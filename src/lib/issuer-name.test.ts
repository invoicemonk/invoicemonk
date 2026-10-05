import { describe, expect, it } from 'vitest';
import { resolveIssuerName } from './issuer-name';

describe('resolveIssuerName', () => {
  it('prefers the legal name', () => {
    expect(resolveIssuerName({ legal_name: 'Legal Entity', business_name: 'Trading Name' })).toBe('Legal Entity');
  });

  it('uses business name when legal name is blank', () => {
    expect(resolveIssuerName({ legal_name: '  ', business_name: 'Trading Name' })).toBe('Trading Name');
  });

  it('supports legacy name snapshots', () => {
    expect(resolveIssuerName({ legal_name: '', business_name: '', name: 'Legacy Issuer' })).toBe('Legacy Issuer');
  });

  it('uses a neutral fallback when the snapshot has no name', () => {
    expect(resolveIssuerName({ legal_name: ' ', business_name: null, name: '' })).toBe('Business');
    expect(resolveIssuerName(null, 'Invoice issuer')).toBe('Invoice issuer');
  });
});