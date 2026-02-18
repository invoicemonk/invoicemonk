
-- 1. Create the product_service_type enum
CREATE TYPE product_service_type AS ENUM ('product', 'service');

-- 2. Create the products_services table
CREATE TABLE public.products_services (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                        text NOT NULL,
  description                 text,
  type                        product_service_type NOT NULL DEFAULT 'service',
  sku                         text,
  category                    text,
  default_price               numeric(15, 2) NOT NULL DEFAULT 0,
  currency                    text NOT NULL,
  tax_applicable              boolean NOT NULL DEFAULT false,
  tax_rate                    numeric(5, 2),
  track_inventory             boolean NOT NULL DEFAULT false,
  stock_quantity              integer,
  low_stock_threshold         integer,
  is_active                   boolean NOT NULL DEFAULT true,
  income_account_id           uuid,
  inventory_last_updated_at   timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT service_no_inventory_check CHECK (
    (type = 'service' AND track_inventory = false AND stock_quantity IS NULL AND low_stock_threshold IS NULL)
    OR
    (type = 'product')
  )
);

-- 3. SKU uniqueness per business (partial index - nulls excluded)
CREATE UNIQUE INDEX products_services_sku_business_unique
  ON public.products_services (business_id, sku)
  WHERE sku IS NOT NULL;

-- 4. updated_at trigger
CREATE TRIGGER set_products_services_updated_at
  BEFORE UPDATE ON public.products_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Enable RLS
ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;

-- SELECT: any business member
CREATE POLICY "Business members can view products_services"
  ON public.products_services FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

-- INSERT: owners and admins only
CREATE POLICY "Business owners/admins can insert products_services"
  ON public.products_services FOR INSERT
  WITH CHECK (
    has_business_role(auth.uid(), business_id, 'owner'::business_role)
    OR has_business_role(auth.uid(), business_id, 'admin'::business_role)
  );

-- UPDATE: owners and admins only
CREATE POLICY "Business owners/admins can update products_services"
  ON public.products_services FOR UPDATE
  USING (
    has_business_role(auth.uid(), business_id, 'owner'::business_role)
    OR has_business_role(auth.uid(), business_id, 'admin'::business_role)
  );

-- DELETE: owners only (soft-delete preferred)
CREATE POLICY "Business owners can delete products_services"
  ON public.products_services FOR DELETE
  USING (has_business_role(auth.uid(), business_id, 'owner'::business_role));

-- 6. Add nullable linkage column to invoice_items (backward-compatible)
ALTER TABLE public.invoice_items
  ADD COLUMN product_service_id uuid REFERENCES products_services(id) ON DELETE SET NULL;

-- 7. Add nullable linkage column to expenses (backward-compatible)
ALTER TABLE public.expenses
  ADD COLUMN product_service_id uuid REFERENCES products_services(id) ON DELETE SET NULL;
