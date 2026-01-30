-- Backfill logo_url for invoices that were issued before the logo fix
-- This is a data repair operation to add missing logo_url to issuer_snapshot
UPDATE invoices i
SET issuer_snapshot = issuer_snapshot || jsonb_build_object('logo_url', b.logo_url)
FROM businesses b
WHERE i.business_id = b.id
  AND i.status != 'draft'
  AND i.issuer_snapshot IS NOT NULL
  AND (i.issuer_snapshot->>'logo_url' IS NULL OR i.issuer_snapshot->>'logo_url' = '')
  AND b.logo_url IS NOT NULL;