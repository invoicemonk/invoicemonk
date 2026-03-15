-- Add tax_label to invoice_items for multi-country VAT labeling
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS tax_label text;

-- Add is_reverse_charge flag to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_reverse_charge boolean NOT NULL DEFAULT false;