UPDATE public.invoices
SET template_id = '93033737-a1d9-4993-8944-cde633c8d7ea'::uuid,
    updated_at = now()
WHERE id = '7a9b67fc-8f89-4815-8e6c-78379e3bf330'::uuid
  AND status = 'draft'
  AND template_id = 'f87a8cab-8482-4a17-84b1-39ec47924ceb'::uuid;