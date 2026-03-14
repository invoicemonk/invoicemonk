import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'

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
  'BGR-NRA': {
    regulatorCode: 'BGR-NRA',
    countryCode: 'BG',
    supportedArtifacts: ['EN_16931', 'SAF_T'],
    regulatorName: 'National Revenue Agency (НАП)',
  },
  'ROU-ANAF': {
    regulatorCode: 'ROU-ANAF',
    countryCode: 'RO',
    supportedArtifacts: ['E_FACTURA'],
    regulatorName: 'ANAF',
  },
  'HUN-NAV': {
    regulatorCode: 'HUN-NAV',
    countryCode: 'HU',
    supportedArtifacts: ['ONLINE_SZAMLA'],
    regulatorName: 'NAV',
  },
  'SRB-SEF': {
    regulatorCode: 'SRB-SEF',
    countryCode: 'RS',
    supportedArtifacts: ['SEF_INVOICE'],
    regulatorName: 'SEF',
  },
  'FRA-DGFIP': {
    regulatorCode: 'FRA-DGFIP',
    countryCode: 'FR',
    supportedArtifacts: ['FACTUR_X', 'CHORUS_PRO'],
    regulatorName: 'DGFiP',
  },
  'ITA-SDI': {
    regulatorCode: 'ITA-SDI',
    countryCode: 'IT',
    supportedArtifacts: ['FE_SDI'],
    regulatorName: 'Sistema di Interscambio',
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

// ---- Existing artifact builders ----

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

// ---- New EU artifact builders ----

function buildEN16931Artifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'EN_16931',
    version: '1.0.0',
    standard: 'EN 16931-1:2017',
    InvoiceNumber: input.invoice.invoice_number,
    IssueDate: input.invoice.issue_date,
    DueDate: input.invoice.due_date,
    InvoiceTypeCode: '380',
    DocumentCurrencyCode: input.invoice.currency,
    Seller: {
      Name: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
      TradingName: input.issuerSnapshot.business_name,
      VATIdentifier: input.issuerSnapshot.vat_registration_number || input.issuerSnapshot.tax_id,
      Address: input.issuerSnapshot.address,
      CountryCode: 'BG',
    },
    Buyer: {
      Name: input.recipientSnapshot.name,
      VATIdentifier: input.recipientSnapshot.tax_id,
      Address: input.recipientSnapshot.address,
    },
    MonetaryTotals: {
      LineExtensionAmount: input.invoice.subtotal,
      TaxExclusiveAmount: input.invoice.subtotal,
      TaxInclusiveAmount: input.invoice.total_amount,
      PayableAmount: input.invoice.total_amount,
    },
    TaxBreakdown: {
      TaxableAmount: input.invoice.subtotal,
      TaxAmount: input.invoice.tax_amount,
      TaxCategoryCode: 'S',
      TaxRate: 20,
    },
    InvoiceLines: input.items.map((item, idx) => ({
      ID: String(idx + 1),
      Quantity: item.quantity,
      NetAmount: item.amount,
      ItemName: item.description,
      UnitPrice: item.unit_price,
      TaxRate: item.tax_rate,
      TaxAmount: item.tax_amount,
    })),
    generated_at: new Date().toISOString(),
  }
}

function buildSAFTArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'SAF_T',
    version: '2.0',
    standard: 'SAF-T (BG)',
    Header: {
      AuditFileVersion: '2.0',
      AuditFileCountry: 'BG',
      AuditFileDateCreated: new Date().toISOString().split('T')[0],
      SoftwareCompanyName: 'InvoiceMonk',
      SoftwareID: 'InvoiceMonk',
      SoftwareVersion: '1.0',
      Company: {
        Name: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
        TaxRegistrationNumber: input.issuerSnapshot.tax_id,
        Address: input.issuerSnapshot.address,
      },
      DefaultCurrencyCode: input.invoice.currency,
      SelectionCriteria: {
        SelectionStartDate: input.invoice.issue_date,
        SelectionEndDate: input.invoice.issue_date,
      },
    },
    SourceDocuments: {
      SalesInvoices: [{
        InvoiceNo: input.invoice.invoice_number,
        InvoiceDate: input.invoice.issue_date,
        CustomerID: input.recipientSnapshot.tax_id,
        CustomerName: input.recipientSnapshot.name,
        GrossTotal: input.invoice.total_amount,
        NetTotal: input.invoice.subtotal,
        TaxTotal: input.invoice.tax_amount,
        Lines: input.items.map((item, idx) => ({
          LineNumber: idx + 1,
          Description: item.description,
          Quantity: item.quantity,
          UnitPrice: item.unit_price,
          TaxRate: item.tax_rate,
          Amount: item.amount,
        })),
      }],
    },
    generated_at: new Date().toISOString(),
  }
}

function buildEFacturaArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'E_FACTURA',
    version: '1.0',
    standard: 'RO e-Factura (ANAF)',
    CustomizationID: 'urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1',
    ID: input.invoice.invoice_number,
    IssueDate: input.invoice.issue_date,
    DueDate: input.invoice.due_date,
    InvoiceTypeCode: '380',
    DocumentCurrencyCode: input.invoice.currency,
    AccountingSupplierParty: {
      RegistrationName: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
      CompanyID: input.issuerSnapshot.tax_id,
      TaxScheme: { CompanyID: input.issuerSnapshot.vat_registration_number || input.issuerSnapshot.tax_id },
      PostalAddress: input.issuerSnapshot.address,
      CountryCode: 'RO',
    },
    AccountingCustomerParty: {
      RegistrationName: input.recipientSnapshot.name,
      CompanyID: input.recipientSnapshot.tax_id,
      PostalAddress: input.recipientSnapshot.address,
    },
    LegalMonetaryTotal: {
      LineExtensionAmount: input.invoice.subtotal,
      TaxExclusiveAmount: input.invoice.subtotal,
      TaxInclusiveAmount: input.invoice.total_amount,
      PayableAmount: input.invoice.total_amount,
    },
    TaxTotal: { TaxAmount: input.invoice.tax_amount },
    InvoiceLine: input.items.map((item, idx) => ({
      ID: String(idx + 1),
      InvoicedQuantity: item.quantity,
      LineExtensionAmount: item.amount,
      Item: { Name: item.description },
      Price: { PriceAmount: item.unit_price },
      TaxTotal: { TaxAmount: item.tax_amount, TaxRate: item.tax_rate },
    })),
    generated_at: new Date().toISOString(),
  }
}

function buildOnlineSzamlaArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'ONLINE_SZAMLA',
    version: '3.0',
    standard: 'NAV Online Számla v3.0',
    invoiceNumber: input.invoice.invoice_number,
    invoiceIssueDate: input.invoice.issue_date,
    completenessIndicator: false,
    invoiceCategory: 'NORMAL',
    paymentDate: input.invoice.due_date,
    currencyCode: input.invoice.currency,
    supplierInfo: {
      supplierTaxNumber: {
        taxpayerId: input.issuerSnapshot.tax_id,
        vatCode: (input.issuerSnapshot.vat_registration_number as string)?.replace('HU', '') || '',
      },
      supplierName: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
      supplierAddress: input.issuerSnapshot.address,
      groupMemberTaxNumber: null,
    },
    customerInfo: {
      customerTaxNumber: input.recipientSnapshot.tax_id,
      customerName: input.recipientSnapshot.name,
      customerAddress: input.recipientSnapshot.address,
    },
    invoiceSummary: {
      invoiceNetAmount: input.invoice.subtotal,
      invoiceVatAmount: input.invoice.tax_amount,
      invoiceGrossAmount: input.invoice.total_amount,
      summaryByVatRate: [{
        vatRateNetData: { vatRateNetAmount: input.invoice.subtotal },
        vatRateVatData: { vatRateVatAmount: input.invoice.tax_amount },
        vatPercentage: 27,
      }],
    },
    invoiceLines: input.items.map((item, idx) => ({
      lineNumber: idx + 1,
      lineDescription: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineNetAmount: item.amount,
      lineVatRate: item.tax_rate,
      lineVatAmount: item.tax_amount,
    })),
    generated_at: new Date().toISOString(),
  }
}

function buildSEFArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'SEF_INVOICE',
    version: '1.0',
    standard: 'Serbian SEF (Sistem Elektronskih Faktura)',
    CustomizationID: 'urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.rs:sef:1.0',
    ID: input.invoice.invoice_number,
    IssueDate: input.invoice.issue_date,
    DueDate: input.invoice.due_date,
    InvoiceTypeCode: '380',
    DocumentCurrencyCode: input.invoice.currency,
    Seller: {
      Name: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
      PIB: input.issuerSnapshot.tax_id,
      MaticniBroj: input.issuerSnapshot.cac_number,
      Address: input.issuerSnapshot.address,
      CountryCode: 'RS',
    },
    Buyer: {
      Name: input.recipientSnapshot.name,
      PIB: input.recipientSnapshot.tax_id,
      Address: input.recipientSnapshot.address,
    },
    MonetaryTotals: {
      LineExtensionAmount: input.invoice.subtotal,
      TaxExclusiveAmount: input.invoice.subtotal,
      TaxInclusiveAmount: input.invoice.total_amount,
      PayableAmount: input.invoice.total_amount,
    },
    TaxTotal: { TaxAmount: input.invoice.tax_amount },
    InvoiceLines: input.items.map((item, idx) => ({
      ID: String(idx + 1),
      Quantity: item.quantity,
      NetAmount: item.amount,
      ItemName: item.description,
      UnitPrice: item.unit_price,
      TaxRate: item.tax_rate,
      TaxAmount: item.tax_amount,
    })),
    generated_at: new Date().toISOString(),
  }
}

function buildFacturXArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'FACTUR_X',
    version: '1.0',
    standard: 'Factur-X / ZUGFeRD (French profile)',
    profile: 'EN16931',
    ExchangedDocument: {
      ID: input.invoice.invoice_number,
      IssueDateTime: input.invoice.issue_date,
      TypeCode: '380',
    },
    SupplyChainTradeTransaction: {
      ApplicableHeaderTradeAgreement: {
        SellerTradeParty: {
          Name: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
          SIREN: input.issuerSnapshot.tax_id,
          SIRET: input.issuerSnapshot.cac_number,
          TaxRegistration: { ID: input.issuerSnapshot.vat_registration_number },
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

function buildChorusProArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  const facturX = buildFacturXArtifact(input)
  return {
    ...facturX,
    schema: 'CHORUS_PRO',
    standard: 'Chorus Pro (French B2G)',
    ChorusMetadata: {
      ServiceCode: null,
      EngagementNumber: null,
      ContractNumber: null,
    },
  }
}

function buildFatturaElettronicaArtifact(input: ArtifactBuilderInput): Record<string, unknown> {
  return {
    schema: 'FE_SDI',
    version: '1.2.2',
    standard: 'FatturaPA (SDI)',
    FatturaElettronicaHeader: {
      DatiTrasmissione: {
        FormatoTrasmissione: 'FPR12',
        CodiceDestinatario: '0000000',
      },
      CedentePrestatore: {
        DatiAnagrafici: {
          IdFiscaleIVA: {
            IdPaese: 'IT',
            IdCodice: input.issuerSnapshot.vat_registration_number || input.issuerSnapshot.tax_id,
          },
          CodiceFiscale: input.issuerSnapshot.tax_id,
          Anagrafica: {
            Denominazione: input.issuerSnapshot.legal_name || input.issuerSnapshot.business_name,
          },
        },
        Sede: input.issuerSnapshot.address,
      },
      CessionarioCommittente: {
        DatiAnagrafici: {
          CodiceFiscale: input.recipientSnapshot.tax_id,
          Anagrafica: {
            Denominazione: input.recipientSnapshot.name,
          },
        },
        Sede: input.recipientSnapshot.address,
      },
    },
    FatturaElettronicaBody: {
      DatiGenerali: {
        DatiGeneraliDocumento: {
          TipoDocumento: 'TD01',
          Divisa: input.invoice.currency,
          Data: input.invoice.issue_date,
          Numero: input.invoice.invoice_number,
          ImportoTotaleDocumento: input.invoice.total_amount,
        },
      },
      DatiBeniServizi: {
        DettaglioLinee: input.items.map((item, idx) => ({
          NumeroLinea: idx + 1,
          Descrizione: item.description,
          Quantita: item.quantity,
          PrezzoUnitario: item.unit_price,
          PrezzoTotale: item.amount,
          AliquotaIVA: item.tax_rate,
        })),
        DatiRiepilogo: [{
          AliquotaIVA: 22,
          ImponibileImporto: input.invoice.subtotal,
          Imposta: input.invoice.tax_amount,
        }],
      },
      DatiPagamento: {
        CondizioniPagamento: 'TP02',
        DettaglioPagamento: {
          ModalitaPagamento: 'MP05',
          DataScadenzaPagamento: input.invoice.due_date,
          ImportoPagamento: input.invoice.total_amount,
        },
      },
    },
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
    case 'EN_16931': return buildEN16931Artifact(input)
    case 'SAF_T': return buildSAFTArtifact(input)
    case 'E_FACTURA': return buildEFacturaArtifact(input)
    case 'ONLINE_SZAMLA': return buildOnlineSzamlaArtifact(input)
    case 'SEF_INVOICE': return buildSEFArtifact(input)
    case 'FACTUR_X': return buildFacturXArtifact(input)
    case 'CHORUS_PRO': return buildChorusProArtifact(input)
    case 'FE_SDI': return buildFatturaElettronicaArtifact(input)
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
