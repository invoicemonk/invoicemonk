import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()


function jsonToUblXml(data: Record<string, unknown>): string {
  const ns = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'
  const cacNs = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
  const cbcNs = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'

  const supplier = (data.AccountingSupplierParty as any)?.Party || {}
  const customer = (data.AccountingCustomerParty as any)?.Party || {}
  const totals = (data.LegalMonetaryTotal as any) || {}
  const taxTotal = (data.TaxTotal as any) || {}
  const lines = (data.InvoiceLine as any[]) || []
  const billingRef = (data.BillingReference as any) || null

  const escXml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // BillingReference links a final invoice to the deposit (TypeCode 386) it consumes.
  // EN 16931 BT-25 / BT-26 / cac:BillingReference > cac:InvoiceDocumentReference.
  const billingRefXml = billingRef?.InvoiceDocumentReference
    ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escXml(billingRef.InvoiceDocumentReference.ID)}</cbc:ID>
      ${billingRef.InvoiceDocumentReference.IssueDate ? `<cbc:IssueDate>${escXml(billingRef.InvoiceDocumentReference.IssueDate)}</cbc:IssueDate>` : ''}
      <cbc:DocumentTypeCode>${escXml(billingRef.InvoiceDocumentReference.DocumentTypeCode || '386')}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`
    : ''

  const linesXml = lines.map(l => `
    <cac:InvoiceLine>
      <cbc:ID>${escXml(l.ID)}</cbc:ID>
      <cbc:InvoicedQuantity>${escXml(l.InvoicedQuantity)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(l.LineExtensionAmount)}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Name>${escXml(l.Item?.Name)}</cbc:Name></cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(l.Price?.PriceAmount)}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`).join('')

  // PrepaidAmount appears when a deposit is being applied (BT-113).
  // PayableAmount must equal TaxInclusiveAmount - PrepaidAmount per EN 16931.
  const prepaidXml = totals.PrepaidAmount !== undefined && totals.PrepaidAmount !== null
    ? `<cbc:PrepaidAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(totals.PrepaidAmount)}</cbc:PrepaidAmount>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="${ns}" xmlns:cac="${cacNs}" xmlns:cbc="${cbcNs}">
  <cbc:CustomizationID>${escXml(data.CustomizationID)}</cbc:CustomizationID>
  ${data.ProfileID ? `<cbc:ProfileID>${escXml(data.ProfileID)}</cbc:ProfileID>` : ''}
  <cbc:ID>${escXml(data.ID)}</cbc:ID>
  <cbc:IssueDate>${escXml(data.IssueDate)}</cbc:IssueDate>
  ${data.DueDate ? `<cbc:DueDate>${escXml(data.DueDate)}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>${escXml(data.InvoiceTypeCode)}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${escXml(data.DocumentCurrencyCode)}</cbc:DocumentCurrencyCode>
  ${data.BuyerReference ? `<cbc:BuyerReference>${escXml(data.BuyerReference)}</cbc:BuyerReference>` : ''}${billingRefXml}
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
    ${prepaidXml}
    <cbc:PayableAmount currencyID="${escXml(data.DocumentCurrencyCode)}">${escXml(totals.PayableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linesXml}
</Invoice>`
}

function jsonToZugferdXml(data: Record<string, unknown>): string {
  const ns = 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100'
  const ramNs = 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100'
  const doc = (data.ExchangedDocument as any) || {}
  const trade = (data.SupplyChainTradeTransaction as any) || {}
  const agreement = trade.ApplicableHeaderTradeAgreement || {}
  const settlement = trade.ApplicableHeaderTradeSettlement || {}
  const totals = settlement.SpecifiedTradeSettlementHeaderMonetarySummation || {}
  const ref = settlement.InvoiceReferencedDocument || null
  const escXml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // CII InvoiceReferencedDocument links a final invoice (TypeCode 380) to the
  // deposit invoice (TypeCode 386) it consumes. TotalPrepaidAmount records
  // the deposit applied; DuePayableAmount = GrandTotal - TotalPrepaid.
  const refXml = ref
    ? `      <ram:InvoiceReferencedDocument>
        <ram:IssuerAssignedID>${escXml(ref.IssuerAssignedID)}</ram:IssuerAssignedID>
        ${ref.FormattedIssueDateTime ? `<ram:FormattedIssueDateTime><udt:DateTimeString format="102" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">${escXml(String(ref.FormattedIssueDateTime).replace(/-/g, '').slice(0, 8))}</udt:DateTimeString></ram:FormattedIssueDateTime>` : ''}
      </ram:InvoiceReferencedDocument>`
    : ''
  const prepaidXml = totals.TotalPrepaidAmount !== undefined && totals.TotalPrepaidAmount !== null
    ? `        <ram:TotalPrepaidAmount>${escXml(totals.TotalPrepaidAmount)}</ram:TotalPrepaidAmount>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="${ns}" xmlns:ram="${ramNs}">
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
${refXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${escXml(totals.LineTotalAmount)}</ram:LineTotalAmount>
        <ram:TaxTotalAmount>${escXml(totals.TaxTotalAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${escXml(totals.GrandTotalAmount)}</ram:GrandTotalAmount>
${prepaidXml}
        <ram:DuePayableAmount>${escXml(totals.DuePayableAmount)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}

/**
 * Factur-X / Chorus Pro CII XML — UN/CEFACT CrossIndustryInvoice EN 16931 profile.
 * Implements seller/buyer SIRET + TVA, line items, and a per-line VAT breakdown
 * compliant with the French CIUS (Customisation ID).
 */
function jsonToFacturXXml(data: Record<string, unknown>): string {
  const rsmNs = 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100'
  const ramNs = 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100'
  const udtNs = 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100'

  const doc = (data.ExchangedDocument as any) || {}
  const trade = (data.SupplyChainTradeTransaction as any) || {}
  const agreement = trade.ApplicableHeaderTradeAgreement || {}
  const settlement = trade.ApplicableHeaderTradeSettlement || {}
  const totals = settlement.SpecifiedTradeSettlementHeaderMonetarySummation || {}
  const seller = agreement.SellerTradeParty || {}
  const buyer = agreement.BuyerTradeParty || {}
  const lineItems: any[] = Array.isArray(trade.IncludedSupplyChainTradeLineItem)
    ? trade.IncludedSupplyChainTradeLineItem
    : []
  const profile = (data.profile as string) || 'EN 16931'
  const customizationId = profile === 'EN 16931'
    ? 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931'
    : `urn:factur-x.eu:1p0:${profile.toLowerCase()}`

  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const renderParty = (party: any, role: 'Seller' | 'Buyer') => {
    const siret = party.SIRET || party.SIREN
    const tva = party.TaxRegistration?.ID
    return `      <ram:${role}TradeParty>
        <ram:Name>${esc(party.Name)}</ram:Name>
        ${siret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(siret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        ${tva ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(tva)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:${role}TradeParty>`
  }

  const renderLine = (line: any, idx: number) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(line.Name || line.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${esc(line.UnitPrice ?? line.unit_price)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${esc(line.Quantity ?? line.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${esc(line.TaxRate ?? line.tax_rate ?? 20)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${esc(line.NetAmount ?? line.amount)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="${rsmNs}" xmlns:ram="${ramNs}" xmlns:udt="${udtNs}">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${customizationId}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(doc.ID)}</ram:ID>
    <ram:TypeCode>${esc(doc.TypeCode || '380')}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${esc(String(doc.IssueDateTime ?? '').replace(/-/g, '').slice(0, 8))}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lineItems.map(renderLine).join('')}
    <ram:ApplicableHeaderTradeAgreement>
${renderParty(seller, 'Seller')}
${renderParty(buyer, 'Buyer')}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery />
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${esc(settlement.InvoiceCurrencyCode || 'EUR')}</ram:InvoiceCurrencyCode>
${settlement.InvoiceReferencedDocument ? `      <ram:InvoiceReferencedDocument>
        <ram:IssuerAssignedID>${esc(settlement.InvoiceReferencedDocument.IssuerAssignedID)}</ram:IssuerAssignedID>
        ${settlement.InvoiceReferencedDocument.FormattedIssueDateTime ? `<ram:FormattedIssueDateTime><udt:DateTimeString format="102">${esc(String(settlement.InvoiceReferencedDocument.FormattedIssueDateTime).replace(/-/g, '').slice(0, 8))}</udt:DateTimeString></ram:FormattedIssueDateTime>` : ''}
      </ram:InvoiceReferencedDocument>` : ''}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${esc(totals.LineTotalAmount)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${esc(totals.LineTotalAmount)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${esc(settlement.InvoiceCurrencyCode || 'EUR')}">${esc(totals.TaxTotalAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${esc(totals.GrandTotalAmount)}</ram:GrandTotalAmount>
${totals.TotalPrepaidAmount !== undefined && totals.TotalPrepaidAmount !== null ? `        <ram:TotalPrepaidAmount>${esc(totals.TotalPrepaidAmount)}</ram:TotalPrepaidAmount>` : ''}
        <ram:DuePayableAmount>${esc(totals.DuePayableAmount)}</ram:DuePayableAmount>
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
    case 'FACTUR_X':
    case 'CHORUS_PRO':
      return { xml: jsonToFacturXXml(artifactData), schemaVersion: 'Factur-X-1.0.07-EN16931' }
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
    captureException(error, { function_name: 'generate-xml-artifact' })
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
