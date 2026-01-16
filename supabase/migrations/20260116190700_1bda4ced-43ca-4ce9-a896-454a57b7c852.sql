-- Fix argument order in invoice UPDATE policies
-- The is_business_member function expects (user_id, business_id) but these policies had them reversed

-- Drop the incorrectly configured policies
DROP POLICY IF EXISTS "Users can update draft invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update payment fields on issued invoices" ON invoices;

-- Recreate with correct argument order: is_business_member(auth.uid(), business_id)
CREATE POLICY "Users can update draft invoices"
ON invoices FOR UPDATE
USING (
  status = 'draft' AND 
  (user_id = auth.uid() OR is_business_member(auth.uid(), business_id))
);

CREATE POLICY "Users can update payment fields on issued invoices"
ON invoices FOR UPDATE
USING (
  status != 'draft' AND 
  (user_id = auth.uid() OR is_business_member(auth.uid(), business_id))
)
WITH CHECK (
  user_id = auth.uid() OR is_business_member(auth.uid(), business_id)
);