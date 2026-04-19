INSERT INTO public.compliance_validation_rules (jurisdiction, rule_key, rule_type, severity, rule_definition, is_active)
VALUES
  ('FR', 'fr_issuer_siret_required', 'required_field', 'block',
    jsonb_build_object(
      'field', 'issuer.cac_number',
      'min_length', 14,
      'max_length', 14,
      'description', 'French issuers must include a 14-digit SIRET on every invoice (Code de commerce art. L441-9).'
    ), true),
  ('FR', 'fr_invoice_currency_eur', 'required_field', 'warn',
    jsonb_build_object(
      'field', 'invoice.currency',
      'expected_value', 'EUR',
      'description', 'French invoices are normally denominated in EUR; cross-border B2B may use another currency with explicit FX rate.'
    ), true),
  ('FR', 'fr_b2b_tva_on_issuer', 'vat_required', 'warn',
    jsonb_build_object(
      'field', 'issuer.vat_registration_number',
      'pattern', '^FR[0-9A-Z]{2}[0-9]{9}$',
      'description', 'TVA intracommunautaire number is required for VAT-registered French issuers on B2B invoices.'
    ), true),
  ('FR', 'fr_siret_format', 'tax_id_format', 'warn',
    jsonb_build_object(
      'field', 'issuer.cac_number',
      'pattern', '^[0-9]{14}$',
      'luhn', true,
      'description', 'SIRET must be 14 digits and pass the Luhn checksum.'
    ), true)
ON CONFLICT DO NOTHING;