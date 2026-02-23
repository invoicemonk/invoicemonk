import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Compliance adapter configs (mirrors src/lib/compliance-adapters.ts)
const COMPLIANCE_ADAPTERS: Record<string, { regulatorCode: string; countryCode: string; supportedArtifacts: string[]; regulatorName: string }> = {
  'NGA-NRS': {
    regulatorCode: 'NGA-NRS',
    countryCode: 'NG',
    supportedArtifacts: ['IRN', 'UBL_3_0', 'CRYPTO_STAMP'],
    regulatorName: 'National Revenue Service',
  },
  'GBR-HMRC': {
    regulatorCode: 'GBR-HMRC',
    countryCode: 'GB',
    supportedArtifacts: ['MTD_VAT'],
    regulatorName: 'HM Revenue & Customs',
  },
  'DEU-BFINV': {
    regulatorCode: 'DEU-BFINV',
    countryCode: 'DE',
    supportedArtifacts: ['XRECHNUNG', 'ZUGFERD'],
    regulatorName: 'Bundesfinanzministerium',
  },
}

function getAdapterByCountry(countryCode: string) {
  return Object.values(COMPLIANCE_ADAPTERS).find(a => a.countryCode === countryCode) || null
}

interface ArtifactBuilderInput {
  invoice: Record<string, unknown>
  issuerSnapshot: Record<string, unknown>
  recipientSnapshot: Record<string, unknown>
  taxSchemaSnapshot: Record<string, unknown> | null
  items: Record<string, unknown>[]
}

function buildIRNArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'IRN',
    version: '1.0',
    invoice_reference: input.invoice.invoice_number,
    invoice_id: input.invoice.id,
    issue_date: input.invoice.issue_date,
    due_date: input.invoice.due_date,
    currency: input.invoice.currency,
    supplier: {
      name: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
      tax_id: input.issuerSnapshot.tax_id,
      address: input.issuerSnapshot.address,
    },
    buyer: {
      name: input.recipientSnapshot.name,
      tax_id: input.recipientSnapshot.tax_id,
      address: input.recipientSnapshot.address,
    },
    totals: {
      subtotal: input.invoice.subtotal,
      tax_amount: input.invoice.tax_amount,
      total: input.invoice.total_amount,
    },
    line_items: input.items.map((item, idx) => ({
      line_number: idx + 1,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      tax_amount: item.tax_amount,
      amount: item.amount,
    })),
    generated_at: new Date().toISOString(),
  }
}

function buildUBLArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'UBL_3_0',
    version: '3.0',
    CustomizationID: 'urn:cen.eu:en16931:2017',
    ID: input.invoice.invoice_number,
    IssueDate: input.invoice.issue_date,
    DueDate: input.invoice.due_date,
    InvoiceTypeCode: '380',
    DocumentCurrencyCode: input.invoice.currency,
    AccountingSupplierParty: {
      Party: {
        PartyName: { Name: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name },
        PartyTaxScheme: { CompanyID: input.issuerSnapshot.tax_id },
        PostalAddress: input.issuerSnapshot.address,
      },
    },
    AccountingCustomerParty: {
      Party: {
        PartyName: { Name: input.recipientSnapshot.name },
        PartyTaxScheme: { CompanyID: input.recipientSnapshot.tax_id },
        PostalAddress: input.recipientSnapshot.address,
      },
    },
    LegalMonetaryTotal: {
      LineExtensionAmount: input.invoice.subtotal,
      TaxExclusiveAmount: input.invoice.subtotal,
      TaxInclusiveAmount: input.invoice.total_amount,
      PayableAmount: input.invoice.total_amount,
    },
    TaxTotal: {
      TaxAmount: input.invoice.tax_amount,
    },
    InvoiceLine: input.items.map((item, idx) => ({
      ID: String(idx + 1),
      InvoicedQuantity: item.quantity,
      LineExtensionAmount: item.amount,
      Item: { Name: item.description },
      Price: { PriceAmount: item.unit_price },
      TaxTotal: { TaxAmount: item.tax_amount },
    })),
    generated_at: new Date().toISOString(),
  }
}

function buildXRechnungArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  const ubl = buildUBLArtifact(input)
  return {
    ...ubl,
    schema: 'XRECHNUNG',
    CustomizationID: 'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0',
    ProfileID: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
    BuyerReference: input.recipientSnapshot.tax_id || 'UNKNOWN',
  }
}

function buildMTDVATArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'MTD_VAT',
    version: '1.0',
    periodKey: input.invoice.issue_date ? (input.invoice.issue_date as string).substring(0, 7) : null,
    vatDueSales: input.invoice.tax_amount,
    totalValueSalesExVAT: input.invoice.subtotal,
    totalValueGoodsSuppliedExVAT: input.invoice.subtotal,
    totalAcquisitionsExVAT: 0,
    invoice_reference: input.invoice.invoice_number,
    supplier_vrn: input.issuerSnapshot.vat_registration_number,
    generated_at: new Date().toISOString(),
  }
}

function buildZugferdArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'ZUGFERD',
    version: '2.2',
    profile: 'EXTENDED',
    ExchangedDocument: {
      ID: input.invoice.invoice_number,
      IssueDateTime: input.invoice.issue_date,
      TypeCode: '380',
    },
    SupplyChainTradeTransaction: {
      ApplicableHeaderTradeAgreement: {
        SellerTradeParty: {
          Name: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
          TaxRegistration: { ID: input.issuerSnapshot.tax_id },
        },
        BuyerTradeParty: {
          Name: input.recipientSnapshot.name,
          TaxRegistration: { ID: input.recipientSnapshot.tax_id },
        },
      },
      ApplicableHeaderTradeSettlement: {
        InvoiceCurrencyCode: input.invoice.currency,
        SpecifiedTradeSettlementHeaderMonetarySummation: {
          LineTotalAmount: input.invoice.subtotal,
          TaxTotalAmount: input.invoice.tax_amount,
          GrandTotalAmount: input.invoice.total_amount,
          DuePayableAmount: input.invoice.total_amount,
        },
      },
    },
    generated_at: new Date().toISOString(),
  }
}

function buildCryptoStampArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'CRYPTO_STAMP',
    version: '1.0',
    invoice_id: input.invoice.id,
    invoice_number: input.invoice.invoice_number,
    invoice_hash: input.invoice.invoice_hash,
    verification_id: input.invoice.verification_id,
    total_amount: input.invoice.total_amount,
    currency: input.invoice.currency,
    issued_at: input.invoice.issued_at,
    issuer_tax_id: input.issuerSnapshot.tax_id,
    generated_at: new Date().toISOString(),
  }
}

function buildArtifact(type: string, input: ArtifactBuilderInput): Record<string, unknown> | null {
  switch (type) {
    case 'IRN': return buildIRNArtifact(input)
    case 'UBL_3_0': return buildUBLArtifact(input)
    case 'XRECHNUNG': return buildXRechnungArtifact(input)
    case 'MTD_VAT': return buildMTDVATArtifact(input)
    case 'ZUGFERD': return buildZugferdArtifact(input)
    case 'CRYPTO_STAMP': return buildCryptoStampArtifact(input)
    default: return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = userData.user.id
    const { invoice_id } = await req.json()

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: 'invoice_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Load invoice with items
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoice_id)
      .single()

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (invoice.status === 'draft') {
      return new Response(
        JSON.stringify({ error: 'Cannot generate artifacts for draft invoices' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for existing artifacts
    const { data: existing } = await supabase
      .from('compliance_artifacts')
      .select('artifact_type')
      .eq('invoice_id', invoice_id)

    const existingTypes = new Set((existing || []).map((a: { artifact_type: string }) => a.artifact_type))

    // Determine jurisdiction and required artifact types
    const issuerSnapshot = (invoice.issuer_snapshot || {}) as Record<string, unknown>
    const recipientSnapshot = (invoice.recipient_snapshot || {}) as Record<string, unknown>
    const taxSchemaSnapshot = (invoice.tax_schema_snapshot || null) as Record<string, unknown> | null
    const jurisdiction = (issuerSnapshot.jurisdiction as string) || ''

    const adapter = getAdapterByCountry(jurisdiction)
    if (!adapter) {
      return new Response(
        JSON.stringify({ error: `No compliance adapter for jurisdiction: ${jurisdiction}`, artifacts: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const artifactTypes = adapter.supportedArtifacts.filter(t => !existingTypes.has(t))

    if (artifactTypes.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All artifacts already generated', artifacts: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const input: ArtifactBuilderInput = {
      invoice,
      issuerSnapshot,
      recipientSnapshot,
      taxSchemaSnapshot,
      items: invoice.invoice_items || [],
    }

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const createdArtifacts = []

    for (const artifactType of artifactTypes) {
      const artifactData = buildArtifact(artifactType, input)
      if (!artifactData) continue

      // Compute hash via canonical JSON string
      const canonicalStr = JSON.stringify(artifactData, Object.keys(artifactData).sort())
      const encoder = new TextEncoder()
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalStr))
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const artifactHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const { data: artifact, error: insertError } = await serviceClient
        .from('compliance_artifacts')
        .insert({
          invoice_id,
          business_id: invoice.business_id,
          artifact_type: artifactType,
          artifact_data: artifactData,
          artifact_hash: artifactHash,
          created_by: userId,
        })
        .select()
        .single()

      if (insertError) {
        console.error(`Failed to insert artifact ${artifactType}:`, insertError)
        continue
      }

      createdArtifacts.push(artifact)
    }

    // Update analytics artifact count
    if (createdArtifacts.length > 0) {
      try {
        await serviceClient.rpc('update_compliance_analytics_artifact_count', {
          p_business_id: invoice.business_id,
          p_count: createdArtifacts.length,
        })
      } catch {
        // Non-critical, ignore if function doesn't exist yet
      }
    }

    return new Response(
      JSON.stringify({ success: true, artifacts: createdArtifacts }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Generate artifacts error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
