
-- Seed tax_schemas for 31 countries missing them
-- Using ON CONFLICT DO NOTHING pattern via checking existence first

-- Africa
INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'EG', '1.0', 'Egypt VAT', '{"vat": 14}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'EG');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'RW', '1.0', 'Rwanda VAT', '{"vat": 18}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'RW');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'TZ', '1.0', 'Tanzania VAT', '{"vat": 18}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'TZ');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'UG', '1.0', 'Uganda VAT', '{"vat": 18}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'UG');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'SN', '1.0', 'Senegal VAT', '{"vat": 18}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'SN');

-- Americas
INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'MX', '1.0', 'Mexico IVA', '{"iva": 16}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'MX');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'BR', '1.0', 'Brazil ICMS/ISS', '{"icms_avg": 18, "iss_avg": 5, "pis": 1.65, "cofins": 7.6}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'BR');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'AR', '1.0', 'Argentina IVA', '{"iva": 21}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'AR');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'CL', '1.0', 'Chile IVA', '{"iva": 19}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'CL');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'CO', '1.0', 'Colombia IVA', '{"iva": 19}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'CO');

-- Europe
INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'NL', '1.0', 'Netherlands BTW', '{"btw_standard": 21, "btw_reduced": 9}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'NL');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'ES', '1.0', 'Spain IVA', '{"iva_standard": 21, "iva_reduced": 10, "iva_super_reduced": 4}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'ES');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'IT', '1.0', 'Italy IVA', '{"iva_standard": 22, "iva_reduced": 10, "iva_super_reduced": 4}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'IT');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'PL', '1.0', 'Poland VAT', '{"vat_standard": 23, "vat_reduced": 8, "vat_super_reduced": 5}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'PL');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'SE', '1.0', 'Sweden Moms', '{"moms_standard": 25, "moms_reduced": 12, "moms_super_reduced": 6}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'SE');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'IE', '1.0', 'Ireland VAT', '{"vat_standard": 23, "vat_reduced": 13.5, "vat_second_reduced": 9}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'IE');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'BE', '1.0', 'Belgium TVA/BTW', '{"tva_standard": 21, "tva_reduced": 12, "tva_super_reduced": 6}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'BE');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'CH', '1.0', 'Switzerland MWST', '{"mwst_standard": 8.1, "mwst_reduced": 2.6, "mwst_special": 3.8}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'CH');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'BG', '1.0', 'Bulgaria DDC', '{"dds_standard": 20, "dds_reduced": 9}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'BG');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'RO', '1.0', 'Romania TVA', '{"tva_standard": 19, "tva_reduced": 9, "tva_super_reduced": 5}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'RO');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'HU', '1.0', 'Hungary ÁFA', '{"afa_standard": 27, "afa_reduced": 18, "afa_super_reduced": 5}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'HU');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'RS', '1.0', 'Serbia PDV', '{"pdv_standard": 20, "pdv_reduced": 10}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'RS');

-- Asia-Pacific
INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'IN', '1.0', 'India GST', '{"gst_standard": 18, "gst_reduced": 12, "gst_low": 5, "gst_high": 28}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'IN');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'JP', '1.0', 'Japan Consumption Tax', '{"consumption_standard": 10, "consumption_reduced": 8}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'JP');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'SG', '1.0', 'Singapore GST', '{"gst": 9}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'SG');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'AE', '1.0', 'UAE VAT', '{"vat": 5}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'AE');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'SA', '1.0', 'Saudi Arabia VAT', '{"vat": 15}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'SA');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'MY', '1.0', 'Malaysia SST', '{"sst_sales": 10, "sst_service": 8}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'MY');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'ID', '1.0', 'Indonesia PPN', '{"ppn": 11}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'ID');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'PH', '1.0', 'Philippines VAT', '{"vat": 12}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'PH');

INSERT INTO tax_schemas (jurisdiction, version, name, rates, rules, effective_from, is_active)
SELECT 'NZ', '1.0', 'New Zealand GST', '{"gst": 15}'::jsonb, '{}'::jsonb, '2024-01-01', true
WHERE NOT EXISTS (SELECT 1 FROM tax_schemas WHERE jurisdiction = 'NZ');

-- Seed retention_policies for countries missing them
-- Africa
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'EG', 5, 'Egyptian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'EG' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'EG', 5, 'Egyptian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'EG' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'GH', 6, 'GRA requirements - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'GH' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'GH', 6, 'GRA requirements - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'GH' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'KE', 7, 'KRA requirements - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'KE' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'KE', 7, 'KRA requirements - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'KE' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'ZA', 5, 'SARS requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'ZA' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'ZA', 5, 'SARS requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'ZA' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'RW', 5, 'RRA requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'RW' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'RW', 5, 'RRA requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'RW' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'TZ', 5, 'TRA requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'TZ' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'TZ', 5, 'TRA requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'TZ' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'UG', 5, 'URA requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'UG' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'UG', 5, 'URA requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'UG' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'SN', 10, 'OHADA Uniform Act - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'SN' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'SN', 10, 'OHADA Uniform Act - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'SN' AND entity_type = 'receipt');

-- Americas
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'MX', 5, 'SAT/CFF requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'MX' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'MX', 5, 'SAT/CFF requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'MX' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'BR', 5, 'Brazilian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'BR' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'BR', 5, 'Brazilian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'BR' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'AR', 10, 'AFIP requirements - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'AR' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'AR', 10, 'AFIP requirements - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'AR' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'CL', 6, 'SII requirements - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'CL' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'CL', 6, 'SII requirements - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'CL' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'CO', 5, 'DIAN requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'CO' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'CO', 5, 'DIAN requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'CO' AND entity_type = 'receipt');

-- Europe
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'NL', 7, 'Dutch tax law (AWR) - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'NL' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'NL', 7, 'Dutch tax law - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'NL' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'ES', 6, 'Spanish tax law - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'ES' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'ES', 6, 'Spanish tax law - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'ES' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'IT', 10, 'Italian civil code - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'IT' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'IT', 10, 'Italian civil code - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'IT' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'PL', 5, 'Polish tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'PL' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'PL', 5, 'Polish tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'PL' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'SE', 7, 'Swedish bookkeeping law - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'SE' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'SE', 7, 'Swedish bookkeeping law - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'SE' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'IE', 6, 'Irish Revenue requirements - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'IE' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'IE', 6, 'Irish Revenue requirements - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'IE' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'BE', 7, 'Belgian tax law - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'BE' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'BE', 7, 'Belgian tax law - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'BE' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'CH', 10, 'Swiss tax law (OR) - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'CH' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'CH', 10, 'Swiss tax law - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'CH' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'BG', 5, 'Bulgarian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'BG' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'BG', 5, 'Bulgarian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'BG' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'RO', 10, 'Romanian fiscal code - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'RO' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'RO', 10, 'Romanian fiscal code - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'RO' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'HU', 8, 'Hungarian accounting law - 8 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'HU' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'HU', 8, 'Hungarian accounting law - 8 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'HU' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'RS', 5, 'Serbian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'RS' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'RS', 5, 'Serbian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'RS' AND entity_type = 'receipt');

-- Asia-Pacific
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'IN', 8, 'Indian Income Tax Act - 8 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'IN' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'IN', 8, 'Indian Income Tax Act - 8 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'IN' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'JP', 7, 'Japanese tax law - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'JP' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'JP', 7, 'Japanese tax law - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'JP' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'SG', 5, 'IRAS requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'SG' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'SG', 5, 'IRAS requirements - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'SG' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'AE', 5, 'UAE Federal Tax Authority - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'AE' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'AE', 5, 'UAE Federal Tax Authority - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'AE' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'SA', 6, 'ZATCA requirements - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'SA' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'SA', 6, 'ZATCA requirements - 6 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'SA' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'MY', 7, 'Malaysian tax law (LHDN) - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'MY' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'MY', 7, 'Malaysian tax law - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'MY' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'ID', 5, 'Indonesian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'ID' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'ID', 5, 'Indonesian tax law - 5 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'ID' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'PH', 10, 'BIR requirements - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'PH' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'PH', 10, 'BIR requirements - 10 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'PH' AND entity_type = 'receipt');

INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'NZ', 7, 'NZ IRD requirements - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'NZ' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'NZ', 7, 'NZ IRD requirements - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'NZ' AND entity_type = 'receipt');

-- HK has no VAT but still needs retention
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'invoice', 'HK', 7, 'Hong Kong IRD - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'HK' AND entity_type = 'invoice');
INSERT INTO retention_policies (entity_type, jurisdiction, retention_years, legal_basis)
SELECT 'receipt', 'HK', 7, 'Hong Kong IRD - 7 years'
WHERE NOT EXISTS (SELECT 1 FROM retention_policies WHERE jurisdiction = 'HK' AND entity_type = 'receipt');
