-- Fix RLS policy that blocks payment recording on issued invoices
-- The existing policy "Users can update draft invoices only" blocks ALL updates to non-draft invoices

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can update draft invoices only" ON invoices;

-- Create policy for updating draft invoices (full access)
CREATE POLICY "Users can update draft invoices"
ON invoices FOR UPDATE
USING (
  status = 'draft' AND 
  (user_id = auth.uid() OR is_business_member(business_id, auth.uid()))
);

-- Create policy for updating payment-related fields on issued invoices
-- The trigger enforce_invoice_immutability will ensure only amount_paid/status can change
CREATE POLICY "Users can update payment fields on issued invoices"
ON invoices FOR UPDATE
USING (
  status != 'draft' AND 
  (user_id = auth.uid() OR is_business_member(business_id, auth.uid()))
)
WITH CHECK (
  (user_id = auth.uid() OR is_business_member(business_id, auth.uid()))
);