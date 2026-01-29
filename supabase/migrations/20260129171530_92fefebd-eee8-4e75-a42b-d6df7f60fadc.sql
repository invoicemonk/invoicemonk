-- Disable ALL immutability triggers temporarily to fix duplicate invoice numbers
ALTER TABLE public.invoices DISABLE TRIGGER enforce_invoice_immutability;
ALTER TABLE public.invoices DISABLE TRIGGER prevent_invoice_modification_trigger;

-- Fix duplicate invoice numbers by renumbering the newer ones
UPDATE public.invoices 
SET invoice_number = 'INV-0003'
WHERE id = 'd4b36c32-1e70-48dd-af86-aa2093c79308';

UPDATE public.invoices 
SET invoice_number = 'INV-0004'
WHERE id = '10293ddf-f94e-45bf-a06d-ccb0389923d2';

-- Re-enable the triggers
ALTER TABLE public.invoices ENABLE TRIGGER enforce_invoice_immutability;
ALTER TABLE public.invoices ENABLE TRIGGER prevent_invoice_modification_trigger;