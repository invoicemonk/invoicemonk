-- Phase C: tax_report_mappings table + seed for US, UK, EU, NG/Generic

CREATE TABLE public.tax_report_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction text NOT NULL,           -- ISO-3166 alpha-2, or 'EU', 'XX' (generic)
  expense_category text NOT NULL,       -- matches EXPENSE_CATEGORIES values
  report_line_code text NOT NULL,       -- e.g. 'sch_c_8' (US line 8), 'sa103_18'
  report_line_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  deductible_percent numeric NOT NULL DEFAULT 100,  -- e.g. 50 for US meals
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, expense_category)
);

GRANT SELECT ON public.tax_report_mappings TO anon, authenticated;
GRANT ALL ON public.tax_report_mappings TO service_role;

ALTER TABLE public.tax_report_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tax report mappings"
  ON public.tax_report_mappings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Platform admins can manage tax report mappings"
  ON public.tax_report_mappings FOR ALL
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE INDEX idx_tax_report_mappings_jurisdiction ON public.tax_report_mappings(jurisdiction);

-- ============ SEED DATA ============

-- US — Schedule C line items
INSERT INTO public.tax_report_mappings (jurisdiction, expense_category, report_line_code, report_line_label, sort_order, deductible_percent) VALUES
  ('US', 'marketing',    'sch_c_8',  'Line 8 — Advertising',                  10, 100),
  ('US', 'travel',       'sch_c_24a','Line 24a — Travel',                     20, 100),
  ('US', 'meals',        'sch_c_24b','Line 24b — Deductible meals (50%)',     30, 50),
  ('US', 'insurance',    'sch_c_15', 'Line 15 — Insurance (other than health)',40, 100),
  ('US', 'professional', 'sch_c_17', 'Line 17 — Legal & professional services',50, 100),
  ('US', 'office',       'sch_c_18', 'Line 18 — Office expense',              60, 100),
  ('US', 'rent',         'sch_c_20b','Line 20b — Rent or lease (other)',      70, 100),
  ('US', 'equipment',    'sch_c_22', 'Line 22 — Supplies / equipment',        80, 100),
  ('US', 'taxes',        'sch_c_23', 'Line 23 — Taxes & licenses',            90, 100),
  ('US', 'utilities',    'sch_c_25', 'Line 25 — Utilities',                  100, 100),
  ('US', 'payroll',      'sch_c_26', 'Line 26 — Wages',                      110, 100),
  ('US', 'software',     'sch_c_27a','Line 27a — Other (software & tools)',  120, 100),
  ('US', 'other',        'sch_c_27a_other','Line 27a — Other expenses',      130, 100);

-- UK — Self-Assessment SA103F-style
INSERT INTO public.tax_report_mappings (jurisdiction, expense_category, report_line_code, report_line_label, sort_order, deductible_percent) VALUES
  ('GB', 'equipment',    'sa103_17', 'Box 17 — Cost of goods / materials',    10, 100),
  ('GB', 'payroll',      'sa103_18', 'Box 18 — Wages, salaries & staff costs',20, 100),
  ('GB', 'rent',         'sa103_19', 'Box 19 — Rent, rates, power & insurance',30, 100),
  ('GB', 'office',       'sa103_20', 'Box 20 — Repairs & renewals',           40, 100),
  ('GB', 'travel',       'sa103_21', 'Box 21 — Car, van & travel expenses',   50, 100),
  ('GB', 'marketing',    'sa103_22', 'Box 22 — Advertising & business entertainment',60, 100),
  ('GB', 'professional', 'sa103_23', 'Box 23 — Accountancy, legal & professional fees',70, 100),
  ('GB', 'insurance',    'sa103_24', 'Box 24 — Insurance',                    80, 100),
  ('GB', 'utilities',    'sa103_25', 'Box 25 — Phone, fax, stationery & other office costs',90, 100),
  ('GB', 'software',     'sa103_25_sw','Box 25 — Software & subscriptions',  100, 100),
  ('GB', 'meals',        'sa103_30', 'Box 30 — Subsistence (business meals)', 110, 100),
  ('GB', 'taxes',        'sa103_31', 'Box 31 — Other business expenses (taxes & licenses)',120, 100),
  ('GB', 'other',        'sa103_31_other','Box 31 — Other business expenses',130, 100);

-- EU — generic VAT-aware fallback (input VAT bucketed by category)
INSERT INTO public.tax_report_mappings (jurisdiction, expense_category, report_line_code, report_line_label, sort_order, deductible_percent) VALUES
  ('EU', 'equipment',    'eu_goods',     'Purchases of goods',                10, 100),
  ('EU', 'software',     'eu_services',  'Services received',                 20, 100),
  ('EU', 'professional', 'eu_services',  'Services received',                 21, 100),
  ('EU', 'marketing',    'eu_services',  'Services received',                 22, 100),
  ('EU', 'rent',         'eu_overheads', 'Overheads (rent, utilities, insurance)',30, 100),
  ('EU', 'utilities',    'eu_overheads', 'Overheads (rent, utilities, insurance)',31, 100),
  ('EU', 'insurance',    'eu_overheads', 'Overheads (rent, utilities, insurance)',32, 100),
  ('EU', 'office',       'eu_overheads', 'Overheads (rent, utilities, insurance)',33, 100),
  ('EU', 'travel',       'eu_travel',    'Travel & subsistence',              40, 100),
  ('EU', 'meals',        'eu_travel',    'Travel & subsistence',              41, 100),
  ('EU', 'payroll',      'eu_payroll',   'Payroll (no VAT)',                  50, 100),
  ('EU', 'taxes',        'eu_taxes',     'Taxes & licenses (no VAT)',         60, 100),
  ('EU', 'other',        'eu_other',     'Other',                             70, 100);

-- Nigeria — deductible/admin buckets
INSERT INTO public.tax_report_mappings (jurisdiction, expense_category, report_line_code, report_line_label, sort_order, deductible_percent) VALUES
  ('NG', 'payroll',      'ng_staff',     'Staff costs (salaries, pensions)',  10, 100),
  ('NG', 'rent',         'ng_premises',  'Rent & premises',                   20, 100),
  ('NG', 'utilities',    'ng_premises',  'Rent & premises',                   21, 100),
  ('NG', 'professional', 'ng_admin',     'Admin & professional fees',         30, 100),
  ('NG', 'marketing',    'ng_admin',     'Admin & professional fees',         31, 100),
  ('NG', 'office',       'ng_admin',     'Admin & professional fees',         32, 100),
  ('NG', 'software',     'ng_admin',     'Admin & professional fees',         33, 100),
  ('NG', 'travel',       'ng_travel',    'Travel & motor',                    40, 100),
  ('NG', 'meals',        'ng_travel',    'Travel & motor',                    41, 100),
  ('NG', 'equipment',    'ng_repairs',   'Repairs, equipment & supplies',     50, 100),
  ('NG', 'insurance',    'ng_insurance', 'Insurance',                         60, 100),
  ('NG', 'taxes',        'ng_taxes',     'Taxes & levies',                    70, 100),
  ('NG', 'other',        'ng_other',     'Other deductible',                  80, 100);

-- XX — Generic fallback for any other jurisdiction
INSERT INTO public.tax_report_mappings (jurisdiction, expense_category, report_line_code, report_line_label, sort_order, deductible_percent) VALUES
  ('XX', 'payroll',      'gx_staff',     'Staff costs',                       10, 100),
  ('XX', 'rent',         'gx_premises',  'Premises (rent, utilities)',        20, 100),
  ('XX', 'utilities',    'gx_premises',  'Premises (rent, utilities)',        21, 100),
  ('XX', 'professional', 'gx_admin',     'Admin & professional',              30, 100),
  ('XX', 'marketing',    'gx_admin',     'Admin & professional',              31, 100),
  ('XX', 'office',       'gx_admin',     'Admin & professional',              32, 100),
  ('XX', 'software',     'gx_admin',     'Admin & professional',              33, 100),
  ('XX', 'travel',       'gx_travel',    'Travel',                            40, 100),
  ('XX', 'meals',        'gx_travel',    'Travel',                            41, 100),
  ('XX', 'equipment',    'gx_supplies',  'Supplies & equipment',              50, 100),
  ('XX', 'insurance',    'gx_insurance', 'Insurance',                         60, 100),
  ('XX', 'taxes',        'gx_taxes',     'Taxes & licenses',                  70, 100),
  ('XX', 'other',        'gx_other',     'Other',                             80, 100);