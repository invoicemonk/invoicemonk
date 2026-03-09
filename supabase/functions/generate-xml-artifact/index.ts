import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'

function jsonToUblXml(data: Record<string, unknown>): string {
  const ns = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
  const cacNs = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
  const cbcNs = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'

  const supplier = (data.AccountingSupplierParty as any)?.Party || {}
  const customer = (data.AccountingCustomerParty as any)?.Party || {}
  const totals = (data.LegalMonetaryTotal as any) || {}
  const taxTotal = (data.TaxTotal as any) || {}
  const lines = (data.InvoiceLine as any[]) || []

  const escXml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const linesXml = lines.map(l => `
    <cac:InvoiceLine>
      <cbc:ID>${escXml(l.ID)}</cbc:ID>
      <cbc:InvoicedQuantity>${escXml(l.InvoicedQuantity)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(l.LineExtensionAmount)}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Name>${escXml(l.Item?.Name)}</cbc:Name></cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(l.Price?.PriceAmount)}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${ns}" xmlns:cac="${cacNs}" xmlns:cbc="${cbcNs}">
  <cbc:CustomizationID>${escXml(data.CustomizationID)}</cbc:CustomizationID>
  ${data.ProfileID ? `<cbc:ProfileID>${escXml(data.ProfileID)}</cbc:ProfileID>` : ''}
  <cbc:ID>${escXml(data.ID)}</cbc:ID>
  <cbc:IssueDate>${escXml(data.IssueDate)}</cbc:IssueDate>
  ${data.DueDate ? `<cbc:DueDate>${escXml(data.DueDate)}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>${escXml(data.InvoiceTypeCode)}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escXml(data.DocumentCurrencyCode)}</cbc:DocumentCurrencyCode>
  ${data.BuyerReference ? `<cbc:BuyerReference>${escXml(data.BuyerReference)}</cbc:BuyerReference>` : ''}
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escXml(supplier.PartyName?.Name)}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme><cbc:CompanyID>${escXml(supplier.PartyTaxScheme?.CompanyID)}</cbc:CompanyID></cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escXml(customer.PartyName?.Name)}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme><cbc:CompanyID>${escXml(customer.PartyTaxScheme?.CompanyID)}</cbc:CompanyID></cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(taxTotal.TaxAmount)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(totals.LineExtensionAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(totals.TaxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(totals.TaxInclusiveAmount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(totals.PayableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linesXml}
</Invoice>`
}

function jsonToZugferdXml(data: Record<string, unknown>): string {
  const ns = 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100'
  const doc = (data.ExchangedDocument as any) || {}
  const trade = (data.SupplyChainTradeTransaction as any) || {}
  const agreement = trade.ApplicableHeaderTradeAgreement || {}
  const settlement = trade.ApplicableHeaderTradeSettlement || {}
  const totals = settlement.SpecifiedTradeSettlementHeaderMonetarySummation || {}
  const escXml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="${ns}">
  <rsm:ExchangedDocument>
    <ram:ID>${escXml(doc.ID)}</ram:ID>
    <ram:IssueDateTime>${escXml(doc.IssueDateTime)}</ram:IssueDateTime>
    <ram:TypeCode>${escXml(doc.TypeCode)}</ram:TypeCode>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escXml(agreement.SellerTradeParty?.Name)}</ram:Name>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escXml(agreement.BuyerTradeParty?.Name)}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${escXml(settlement.InvoiceCurrencyCode)}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${escXml(totals.LineTotalAmount)}</ram:LineTotalAmount>
        <ram:TaxTotalAmount>${escXml(totals.TaxTotalAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${escXml(totals.GrandTotalAmount)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${escXml(totals.DuePayableAmount)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}

function jsonToEnvelopeXml(data: Record<string, unknown>, schema: string): string {
  const escXml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const entries = Object.entries(data)
    .filter(([k]) => k !== 'generated_at')
    .map(([k, v]) => `  <${k}>${escXml(typeof v === 'object' ? JSON.stringify(v) : v)}</${k}>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<${schema} generatedAt="${escXml(data.generated_at)}">
${entries}
</${schema}>`
}

function transformToXml(artifactType: string, artifactData: Record<string, unknown>): { xml: string; schemaVersion: string } {
  switch (artifactType) {
    case 'UBL_3_0':
      return { xml: jsonToUblXml(artifactData), schemaVersion: 'UBL-2.1' }
    case 'XRECHNUNG':
      return { xml: jsonToUblXml(artifactData), schemaVersion: 'XRechnung-3.0' }
    case 'ZUGFERD':
      return { xml: jsonToZugferdXml(artifactData), schemaVersion: 'ZUGFeRD-2.2' }
    case 'IRN':
      return { xml: jsonToEnvelopeXml(artifactData, 'InvoiceReferenceNumber'), schemaVersion: 'IRN-1.0' }
    case 'CRYPTO_STAMP':
      return { xml: jsonToEnvelopeXml(artifactData, 'CryptographicStamp'), schemaVersion: 'CRYPTO_STAMP-1.0' }
    case 'MTD_VAT':
      return { xml: jsonToEnvelopeXml(artifactData, 'MTDVATReturn'), schemaVersion: 'MTD-VAT-1.0' }
    default:
      return { xml: jsonToEnvelopeXml(artifactData, artifactType), schemaVersion: `${artifactType}-1.0` }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { artifact_id } = await req.json()
    if (!artifact_id) {
      return new Response(JSON.stringify({ error: 'artifact_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch artifact (RLS ensures business membership)
    const { data: artifact, error: artError } = await supabase
      .from('compliance_artifacts')
      .select('*')
      .eq('id', artifact_id)
      .single()

    if (artError || !artifact) {
      return new Response(JSON.stringify({ error: 'Artifact not found or access denied' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (artifact.xml_content) {
      return new Response(JSON.stringify({ error: 'XML already generated for this artifact', artifact_id, xml_hash: artifact.xml_hash, schema_version: artifact.schema_version }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Transform JSONB to XML
    const { xml, schemaVersion } = transformToXml(artifact.artifact_type, artifact.artifact_data as Record<string, unknown>)

    // Compute SHA-256
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(xml))
    const xmlHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    // Update artifact using service role (smarter trigger allows one-time xml_content write)
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error: updateError } = await serviceClient
      .from('compliance_artifacts')
      .update({
        xml_content: xml,
        xml_hash: xmlHash,
        xml_generated_at: new Date().toISOString(),
        schema_version: schemaVersion,
      })
      .eq('id', artifact_id)

    if (updateError) {
      console.error('Failed to update artifact with XML:', updateError)
      return new Response(JSON.stringify({ error: `Failed to save XML: ${updateError.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Log audit event
    try {
      await serviceClient.from('audit_logs').insert({
        event_type: 'XML_ARTIFACT_GENERATED',
        entity_type: 'compliance_artifact',
        entity_id: artifact_id,
        business_id: artifact.business_id,
        user_id: userData.user.id,
        actor_id: userData.user.id,
        metadata: { artifact_type: artifact.artifact_type, schema_version: schemaVersion, xml_hash: xmlHash },
      })
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({ artifact_id, xml_hash: xmlHash, schema_version: schemaVersion }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('generate-xml-artifact error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
