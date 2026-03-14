-- Seed compliance validation rules for Bulgaria, Romania, Hungary, Serbia, Italy, France

-- Bulgaria (BG)
INSERT INTO public.compliance_validation_rules (jurisdiction, rule_key, rule_type, severity, is_active, rule_definition)
VALUES
  ('BG', 'bg_vat_required', 'required_field', 'block', true, 
   '{"field": "tax_id", "message": "VAT number (EIK/БУЛСТАТ) is required on all Bulgarian invoices", "description": "Bulgarian NRA requires a valid EIK or БУЛСТАТ on every invoice"}'::jsonb),
  ('BG', 'bg_invoice_number_10_digits', 'required_field', 'block', true,
   '{"field": "invoice_number", "min_length": 10, "message": "Bulgarian invoices require sequential 10-digit invoice numbers", "description": "NRA mandates 10-digit sequential numbering"}'::jsonb),
  ('BG', 'bg_tax_rate_mismatch', 'tax_rate_mismatch', 'warn', true,
   '{"expected_rate": 20, "message": "Standard Bulgarian VAT rate is 20%", "description": "Line item tax rate does not match the standard 20% ДДС rate"}'::jsonb),

-- Romania (RO)
  ('RO', 'ro_cui_required', 'required_field', 'block', true,
   '{"field": "tax_id", "message": "CUI (Cod Unic de Înregistrare) is required for e-Factura", "description": "ANAF requires CUI on all e-Factura submissions"}'::jsonb),
  ('RO', 'ro_tax_rate_mismatch', 'tax_rate_mismatch', 'warn', true,
   '{"expected_rate": 19, "message": "Standard Romanian TVA rate is 19%", "description": "Line item tax rate does not match the standard 19% TVA rate"}'::jsonb),

-- Hungary (HU)
  ('HU', 'hu_tax_number_required', 'required_field', 'block', true,
   '{"field": "tax_id", "message": "Adószám is required for Online Számla reporting", "description": "NAV requires a valid Adószám for real-time invoice reporting"}'::jsonb),
  ('HU', 'hu_tax_rate_mismatch', 'tax_rate_mismatch', 'warn', true,
   '{"expected_rate": 27, "message": "Standard Hungarian ÁFA rate is 27%", "description": "Line item tax rate does not match the standard 27% ÁFA rate"}'::jsonb),

-- Serbia (RS)
  ('RS', 'rs_pib_required', 'required_field', 'block', true,
   '{"field": "tax_id", "message": "PIB is required for SEF e-invoicing", "description": "Serbian SEF requires a valid PIB (Poreski Identifikacioni Broj)"}'::jsonb),
  ('RS', 'rs_tax_rate_mismatch', 'tax_rate_mismatch', 'warn', true,
   '{"expected_rate": 20, "message": "Standard Serbian PDV rate is 20%", "description": "Line item tax rate does not match the standard 20% PDV rate"}'::jsonb),

-- Italy (IT)
  ('IT', 'it_codice_destinatario', 'required_field', 'warn', true,
   '{"field": "codice_destinatario", "message": "Codice Destinatario recommended for SDI submission", "description": "SDI requires a 7-character recipient code (Codice Destinatario) for electronic delivery"}'::jsonb),

-- France (FR)
  ('FR', 'fr_tax_rate_mismatch', 'tax_rate_mismatch', 'warn', true,
   '{"expected_rate": 20, "message": "Standard French TVA rate is 20%", "description": "Line item tax rate does not match the standard 20% TVA rate"}'::jsonb)

ON CONFLICT DO NOTHING;