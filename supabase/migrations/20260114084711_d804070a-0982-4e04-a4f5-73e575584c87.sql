-- Fix the issue_invoice function to generate proper UUID for verification_id
CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id uuid)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _invoice public.invoices;
    _business public.businesses;
    _client public.clients;
    _hash text;
    _verification_id uuid;
    _retention_years integer;
    _template public.invoice_templates;
BEGIN
    -- Get the invoice and verify it's in draft status
    SELECT * INTO _invoice FROM public.invoices WHERE id = _invoice_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;
    
    IF _invoice.status != 'draft' THEN
        RAISE EXCEPTION 'Invoice is not in draft status';
    END IF;
    
    -- Get business information for snapshot
    IF _invoice.business_id IS NOT NULL THEN
        SELECT * INTO _business FROM public.businesses WHERE id = _invoice.business_id;
    END IF;
    
    -- Get client information for snapshot
    SELECT * INTO _client FROM public.clients WHERE id = _invoice.client_id;
    
    -- Get template if specified
    IF _invoice.template_id IS NOT NULL THEN
        SELECT * INTO _template FROM public.invoice_templates WHERE id = _invoice.template_id;
    END IF;
    
    -- Generate verification ID (proper UUID)
    _verification_id := gen_random_uuid();
    
    -- Generate invoice hash for tamper detection
    _hash := encode(
        sha256(
            (_invoice.invoice_number || 
             _invoice.total_amount::text || 
             _invoice.client_id::text || 
             COALESCE(_invoice.business_id::text, '') ||
             _verification_id::text ||
             now()::text
            )::bytea
        ),
        'hex'
    );
    
    -- Get retention period from retention_policies (default to 7 years)
    SELECT COALESCE(retention_years, 7) INTO _retention_years
    FROM public.retention_policies
    WHERE entity_type = 'invoice' 
      AND jurisdiction = COALESCE(_business.jurisdiction, 'DEFAULT')
    LIMIT 1;
    
    IF _retention_years IS NULL THEN
        _retention_years := 7; -- Default retention period
    END IF;
    
    -- Update the invoice with immutable data
    UPDATE public.invoices SET
        status = 'issued',
        issued_at = now(),
        issued_by = auth.uid(),
        verification_id = _verification_id,
        invoice_hash = _hash,
        currency_locked_at = now(),
        retention_locked_until = now() + (_retention_years || ' years')::interval,
        issuer_snapshot = CASE 
            WHEN _business IS NOT NULL THEN jsonb_build_object(
                'name', _business.name,
                'legal_name', _business.legal_name,
                'tax_id', _business.tax_id,
                'address', _business.address,
                'contact_email', _business.contact_email,
                'contact_phone', _business.contact_phone,
                'jurisdiction', _business.jurisdiction
            )
            ELSE NULL
        END,
        recipient_snapshot = jsonb_build_object(
            'name', _client.name,
            'email', _client.email,
            'phone', _client.phone,
            'tax_id', _client.tax_id,
            'address', _client.address
        ),
        template_snapshot = CASE 
            WHEN _template IS NOT NULL THEN jsonb_build_object(
                'id', _template.id,
                'name', _template.name,
                'layout', _template.layout,
                'styles', _template.styles,
                'watermark_required', _template.watermark_required
            )
            ELSE NULL
        END
    WHERE id = _invoice_id
    RETURNING * INTO _invoice;
    
    -- Lock business currency if not already locked
    IF _invoice.business_id IS NOT NULL AND _business IS NOT NULL AND NOT COALESCE(_business.currency_locked, false) THEN
        UPDATE public.businesses SET
            currency_locked = true,
            currency_locked_at = now(),
            default_currency = _invoice.currency
        WHERE id = _invoice.business_id;
    END IF;
    
    -- Log audit event
    PERFORM public.log_audit_event(
        _event_type := 'INVOICE_ISSUED',
        _entity_type := 'invoice',
        _entity_id := _invoice_id,
        _user_id := auth.uid(),
        _business_id := _invoice.business_id,
        _new_state := to_jsonb(_invoice),
        _metadata := jsonb_build_object('verification_id', _verification_id, 'invoice_hash', _hash)
    );
    
    RETURN _invoice;
END;
$$;