-- Add business_type column to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_type text DEFAULT NULL;

COMMENT ON COLUMN public.businesses.business_type IS 
  'Business classification: freelancer, sme, agency, other';

-- Create accounting_preferences table (simplified - view preferences only)
CREATE TABLE public.accounting_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('individual', 'business')),
  user_id uuid NOT NULL,
  default_accounting_period text NOT NULL DEFAULT 'monthly' CHECK (default_accounting_period IN ('monthly', 'quarterly', 'yearly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, account_type)
);

-- Create expenses table
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text,
  receipt_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at triggers
CREATE TRIGGER update_accounting_preferences_updated_at
  BEFORE UPDATE ON public.accounting_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE public.accounting_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for accounting_preferences
CREATE POLICY "Users can view their own preferences"
  ON public.accounting_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.accounting_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.accounting_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON public.accounting_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for expenses (NO platform_admin access per spec)
CREATE POLICY "Users can view their own expenses"
  ON public.expenses FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      auth.uid() = user_id OR 
      is_business_member(auth.uid(), business_id)
    )
  );

CREATE POLICY "Users can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      auth.uid() = user_id OR 
      is_business_member(auth.uid(), business_id)
    )
  );

CREATE POLICY "Users can update their own expenses"
  ON public.expenses FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      auth.uid() = user_id OR 
      is_business_member(auth.uid(), business_id)
    )
  );

CREATE POLICY "Users can delete their own expenses"
  ON public.expenses FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      auth.uid() = user_id OR 
      has_business_role(auth.uid(), business_id, 'owner'::business_role)
    )
  );

-- Create indexes for performance
CREATE INDEX idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX idx_expenses_business_id ON public.expenses(business_id);
CREATE INDEX idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX idx_accounting_preferences_user_id ON public.accounting_preferences(user_id);