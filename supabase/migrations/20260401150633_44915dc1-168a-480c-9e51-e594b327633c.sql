
-- Create recurring_expenses table
CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  currency_account_id UUID REFERENCES public.currency_accounts(id),
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  vendor TEXT,
  notes TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  next_expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  product_service_id UUID REFERENCES public.products_services(id),
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies matching expenses pattern
CREATE POLICY "Users can view their recurring expenses"
  ON public.recurring_expenses FOR SELECT
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR is_business_member(auth.uid(), business_id)));

CREATE POLICY "Users can create recurring expenses"
  ON public.recurring_expenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR is_business_member(auth.uid(), business_id)));

CREATE POLICY "Users can update their recurring expenses"
  ON public.recurring_expenses FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR is_business_member(auth.uid(), business_id)));

CREATE POLICY "Users can delete their recurring expenses"
  ON public.recurring_expenses FOR DELETE
  USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR has_business_role(auth.uid(), business_id, 'owner'::business_role)));

-- Updated_at trigger
CREATE TRIGGER set_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for processing
CREATE INDEX idx_recurring_expenses_next_date ON public.recurring_expenses(next_expense_date) WHERE is_active = true;
CREATE INDEX idx_recurring_expenses_business ON public.recurring_expenses(business_id);
