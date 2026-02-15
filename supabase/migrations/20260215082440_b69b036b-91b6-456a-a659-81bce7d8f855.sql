-- Restrict pricing_regions to authenticated users
DROP POLICY "Pricing regions are viewable by everyone" ON pricing_regions;
CREATE POLICY "Authenticated users can view pricing regions"
  ON pricing_regions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Restrict tier_limits to authenticated users
DROP POLICY IF EXISTS "Anyone can view tier limits" ON tier_limits;
CREATE POLICY "Authenticated users can view tier limits"
  ON tier_limits FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Restrict invoice_templates to authenticated users
DROP POLICY "Anyone can view active templates" ON invoice_templates;
CREATE POLICY "Authenticated users can view active templates"
  ON invoice_templates FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);