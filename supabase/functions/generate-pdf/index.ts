import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateUUIDStr as validateUUID, getCorsHeaders, checkRateLimit, rateLimitResponse, escapeHtml, stripUrls } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

// ── Inline QR Code Generator ──
// Generates a QR code matrix (boolean[][]) from a string input.
// Implements QR Code Model 2, Version auto-select, Error Correction Level M.
// This avoids any external dependency so the PDF HTML is fully self-contained.

function createQR(data: string): boolean[][] {
  // Use qrcode-generator via esm.sh (Deno-compatible)
  // Inline a minimal QR encoder to avoid network dependency at runtime.
  // We encode in byte mode with EC level M, auto-selecting the smallest version that fits.

  const EC_LEVEL = 1 // 0=L,1=M,2=Q,3=H

  // Data capacity for byte mode at EC level M (versions 1-10)
  const CAPACITIES = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213]

  // Find smallest version
  let version = 1
  for (let v = 1; v <= 10; v++) {
    if (CAPACITIES[v] >= data.length) { version = v; break }
    if (v === 10) version = 10
  }

  const size = version * 4 + 17
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null))
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  // Place finder patterns
  const placeFinderPattern = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r, mc = col + c
        if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue
        const inOuter = r === 0 || r === 6 || c === 0 || c === 6
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4
        const inBorder = r === -1 || r === 7 || c === -1 || c === 7
        modules[mr][mc] = !inBorder && (inOuter || inInner)
        isFunction[mr][mc] = true
      }
    }
  }
  placeFinderPattern(0, 0)
  placeFinderPattern(0, size - 7)
  placeFinderPattern(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0; isFunction[6][i] = true
    modules[i][6] = i % 2 === 0; isFunction[i][6] = true
  }

  // Dark module
  modules[size - 8][8] = true; isFunction[size - 8][8] = true

  // Alignment patterns for version >= 2
  if (version >= 2) {
    const alignPos = getAlignmentPositions(version)
    for (const r of alignPos) {
      for (const c of alignPos) {
        if (isFunction[r][c]) continue
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const mr = r + dr, mc = c + dc
            modules[mr][mc] = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)
            isFunction[mr][mc] = true
          }
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (i < size) { isFunction[8][i] = true; isFunction[i][8] = true }
    const ri = size - 1 - i
    if (i < 8) { isFunction[8][size - 1 - i] = true; isFunction[size - 1 - i][8] = true }
  }
  // Reserve version info for version >= 7 (not needed for <=10 but let's be safe)

  // Encode data
  const dataBytes = encodeDataBytes(data, version, EC_LEVEL)

  // Place data bits
  let bitIndex = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j
        const upward = ((right + 1) & 2) === 0
        const row = upward ? size - 1 - vert : vert
        if (row < 0 || row >= size || col < 0 || col >= size) continue
        if (isFunction[row][col]) continue
        if (bitIndex < dataBytes.length * 8) {
          const byteIdx = bitIndex >>> 3
          const bitIdx = 7 - (bitIndex & 7)
          modules[row][col] = ((dataBytes[byteIdx] >>> bitIdx) & 1) === 1
        } else {
          modules[row][col] = false
        }
        bitIndex++
      }
    }
  }

  // Apply mask (mask 0: (row + col) % 2 === 0)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c]) {
        modules[r][c] = (modules[r][c] as boolean) !== ((r + c) % 2 === 0)
      }
    }
  }

  // Place format info (EC level M = 0, mask 0)
  const formatBits = getFormatBits(EC_LEVEL, 0)
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >>> (14 - i)) & 1) === 1
    // Around top-left finder
    if (i < 6) modules[8][i] = bit
    else if (i < 8) modules[8][i + 1] = bit
    else modules[14 - i][8] = bit
    // Other copy
    if (i < 8) modules[size - 1 - i][8] = bit
    else modules[8][size - 15 + i] = bit
  }

  return modules.map(row => row.map(m => m === true))
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return []
  const last = version * 4 + 10
  const count = Math.floor(version / 7) + 2
  const step = count === 2 ? 0 : Math.ceil((last - 6) / (count - 1) / 2) * 2
  const positions = [6]
  for (let i = 1; i < count; i++) positions.push(last - (count - 1 - i) * step)
  return positions
}

function getFormatBits(ecLevel: number, mask: number): number {
  let data = (ecLevel << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const bits = ((data << 10) | rem) ^ 0x5412
  return bits
}

function encodeDataBytes(text: string, version: number, ecLevel: number): number[] {
  const totalCodewords = getNumDataAndEcCodewords(version, ecLevel)
  const numDataCodewords = totalCodewords.data
  const numEcCodewords = totalCodewords.ec

  // Byte mode encoding
  const bits: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }

  pushBits(0b0100, 4) // Byte mode indicator
  const charCountBits = version <= 9 ? 8 : 16
  const textBytes = new TextEncoder().encode(text)
  pushBits(textBytes.length, charCountBits)
  for (const b of textBytes) pushBits(b, 8)

  // Terminator
  const capacity = numDataCodewords * 8
  const terminatorLen = Math.min(4, capacity - bits.length)
  pushBits(0, terminatorLen)

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0)

  // Pad bytes
  const padBytes = [0xEC, 0x11]
  let padIdx = 0
  while (bits.length < capacity) {
    pushBits(padBytes[padIdx % 2], 8)
    padIdx++
  }

  // Convert to bytes
  const dataCodewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0)
    dataCodewords.push(byte)
  }

  // Generate EC codewords using Reed-Solomon
  const ecCodewords = generateECCodewords(dataCodewords.slice(0, numDataCodewords), numEcCodewords)

  return [...dataCodewords.slice(0, numDataCodewords), ...ecCodewords]
}

function getNumDataAndEcCodewords(version: number, ecLevel: number): { data: number; ec: number } {
  // Total codewords for each version
  const totalCW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
  // EC codewords per block for EC level M
  const ecCWPerBlock: number[][] = [
    [], // L
    [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], // M
    [], // Q
    []  // H
  ]
  const numBlocks: number[][] = [
    [],
    [0, 1, 1, 1, 2, 2, 4, 4, 4, 4, 6], // M
    [],
    []
  ]
  const total = totalCW[version]
  const blocks = numBlocks[ecLevel][version]
  const ecPerBlock = ecCWPerBlock[ecLevel][version]
  const ecTotal = blocks * ecPerBlock
  return { data: total - ecTotal, ec: ecTotal }
}

function generateECCodewords(data: number[], numEC: number): number[] {
  // GF(256) with primitive polynomial 0x11d
  const gfExp = new Uint8Array(512)
  const gfLog = new Uint8Array(256)
  let x = 1
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x; gfLog[x] = i
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0)
  }
  for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255]

  // Generator polynomial
  let gen = [1]
  for (let i = 0; i < numEC; i++) {
    const newGen = new Array(gen.length + 1).fill(0)
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j]
      newGen[j + 1] ^= gfExp[(gfLog[gen[j]] + i) % 255]
    }
    gen = newGen
  }

  // Polynomial division
  const result = new Array(numEC).fill(0)
  for (const byte of data) {
    const factor = byte ^ result[0]
    result.shift(); result.push(0)
    if (factor === 0) continue
    const logFactor = gfLog[factor]
    for (let i = 0; i < result.length; i++) {
      result[i] ^= gfExp[(gfLog[gen[i + 1]] + logFactor) % 255]
    }
  }
  return result
}

interface GeneratePdfRequest {
  invoice_id?: string
  verification_id?: string // For public access via verification page
  app_url?: string // Optional: client-provided base URL for verification links
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  tax_rate: number
  tax_amount: number
  tax_label: string | null
  discount_percent: number
}

interface IssuerSnapshot {
  legal_name?: string
  name?: string
  tax_id?: string
  cac_number?: string
  vat_registration_number?: string
  is_vat_registered?: boolean
  jurisdiction?: string
  address?: Record<string, unknown>
  contact_email?: string
  contact_phone?: string
  logo_url?: string
}

interface RecipientSnapshot {
  name?: string
  email?: string
  tax_id?: string
  cac_number?: string
  client_type?: string
  contact_person?: string
  address?: Record<string, unknown>
  phone?: string
}

interface TemplateSnapshot {
  id?: string
  name?: string
  watermark_required?: boolean
  supports_branding?: boolean
  tier_required?: string
  layout?: {
    header_style?: string
    show_logo?: boolean
    show_terms?: boolean
    show_notes?: boolean
    show_verification_qr?: boolean
    show_bank_details?: boolean
  }
  styles?: {
    primary_color?: string
    font_family?: string
    font_size?: string
  }
}

Deno.serve(async (req) => {
  // Check for verification_id in query params to determine access type
  const url = new URL(req.url)
  const verificationIdParam = url.searchParams.get('verification_id')
  const isPublicAccess = !!verificationIdParam
  
  const corsHeaders = getCorsHeaders(req, isPublicAccess);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    let invoice: Record<string, unknown> | null = null
    let userId: string | null = null

    if (verificationIdParam) {
      // Validate verification_id format
      const verificationError = validateUUID(verificationIdParam, 'verification_id');
      if (verificationError) {
        return new Response(
          JSON.stringify({ success: false, error: verificationError }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Public access via verification_id - use service role
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
      
      const { data: invoiceData, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .select(`
          *,
          clients (*),
          invoice_items (*)
        `)
        .eq('verification_id', verificationIdParam)
        .single()

      if (invoiceError || !invoiceData) {
        console.error('Invoice fetch error:', invoiceError)
        return new Response(
          JSON.stringify({ success: false, error: 'Invoice not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Only allow public access to issued invoices
      if (invoiceData.status === 'draft') {
        return new Response(
          JSON.stringify({ success: false, error: 'This invoice is not yet issued' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      invoice = invoiceData
      userId = invoiceData.user_id
    } else {
      // Authenticated access via invoice_id
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })

      // Verify user token
      const token = authHeader.replace('Bearer ', '')
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
      
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const userId_raw = claimsData.claims.sub as string

      userId = userId_raw

      // Parse request body
      const body: GeneratePdfRequest = await req.json()
      
      // Validate invoice_id format
      const invoiceIdError = validateUUID(body.invoice_id, 'invoice_id');
      if (invoiceIdError) {
        return new Response(
          JSON.stringify({ success: false, error: invoiceIdError }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch invoice with all related data
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (*),
          invoice_items (*)
        `)
        .eq('id', body.invoice_id)
        .single()

      if (invoiceError || !invoiceData) {
        console.error('Invoice fetch error:', invoiceError)
        return new Response(
          JSON.stringify({ success: false, error: 'Invoice not found or access denied' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if invoice is issued (only issued invoices can be downloaded as PDF)
      if (invoiceData.status === 'draft') {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot generate PDF for draft invoices. Please issue the invoice first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      invoice = invoiceData

      // Check for cached HTML in storage before regenerating
      // Include template header_style in cache key so each template layout gets its own cache entry
      const tplSnapshot = invoiceData.template_snapshot as Record<string, unknown> | null
      const tplLayout = tplSnapshot?.layout as Record<string, unknown> | null
      const cacheHeaderStyle = (tplLayout?.header_style as string) || 'standard'
      const cachePath = `${invoiceData.business_id || 'personal'}/${invoiceData.id}_${cacheHeaderStyle}_v4.html`
      const supabaseAdminForCache = createClient(supabaseUrl, supabaseServiceKey)
      const { data: cachedFile } = await supabaseAdminForCache.storage
        .from('invoice-pdfs')
        .download(cachePath)
      
      if (cachedFile) {
        const cachedHtml = await cachedFile.text()
        if (cachedHtml && cachedHtml.length > 100) {
          return new Response(cachedHtml, {
            status: 200,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'text/html; charset=utf-8',
              'X-Invoice-Number': invoiceData.invoice_number,
              'X-Cache': 'HIT'
            }
          })
        }
      }
    }

    // At this point invoice is guaranteed to not be null
    if (!invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cast invoice to proper typed object to avoid TS errors
    const inv = invoice as {
      id: string
      invoice_number: string
      status: string
      currency: string
      total_amount: number
      amount_paid: number
      subtotal: number
      tax_amount: number
      discount_amount: number
      issue_date: string | null
      due_date: string | null
      notes: string | null
      terms: string | null
      summary: string | null
      verification_id: string | null
      invoice_hash: string | null
      business_id: string | null
      user_id: string | null
      issuer_snapshot: IssuerSnapshot | null
      recipient_snapshot: RecipientSnapshot | null
      template_snapshot: TemplateSnapshot | null
      payment_method_snapshot: { provider_type?: string; display_name?: string; instructions?: Record<string, string> } | null
      clients?: { name?: string; email?: string; address?: Record<string, unknown> } | null
      invoice_items?: InvoiceItem[]
      kind?: string
      parent_invoice_id?: string | null
      deposit_percent?: number | null
    }

    // Create a service client for tier checks
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get user's subscription tier
    const { data: tierResult, error: tierError } = await supabaseAdmin.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'remove_watermark'
    })

    if (tierError) {
      console.error('Tier check error:', tierError)
    }

    // Parse tier result
    const tierData = typeof tierResult === 'object' && tierResult !== null ? tierResult : { allowed: false, tier: 'starter' }
    const userTier = tierData.tier || 'starter'
    const canRemoveWatermark = tierData.allowed === true

    // Parse snapshots (use snapshots for issued invoices, not live data)
    const issuerSnapshot = inv.issuer_snapshot
    const recipientSnapshot = inv.recipient_snapshot
    const templateSnapshot = inv.template_snapshot

    // Determine if this is a Nigerian VAT invoice
    const isNigerianInvoice = issuerSnapshot?.jurisdiction === 'NG'
    const isNigerianVatRegistered = isNigerianInvoice && issuerSnapshot?.is_vat_registered === true

    // Template layout and styles
    const tplLayout = templateSnapshot?.layout || {}
    const tplStyles = templateSnapshot?.styles || {}
    const tplPrimaryColor = tplStyles.primary_color || '#1a1a1a'
    const tplHeaderStyle = tplLayout.header_style || 'standard'
    const showLogo = tplLayout.show_logo !== false
    const showTerms = tplLayout.show_terms !== false
    const showNotes = tplLayout.show_notes !== false
    const showQr = tplLayout.show_verification_qr !== false

    // Determine if watermark should be applied
    const templateRequiresWatermark = templateSnapshot?.watermark_required !== false
    const showWatermark = templateRequiresWatermark && !canRemoveWatermark

    // Check branding permission
    const { data: brandingResult } = await supabaseAdmin.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'custom_branding'
    })
    const brandingData = typeof brandingResult === 'object' && brandingResult !== null ? brandingResult : { allowed: false }
    const canUseBranding = brandingData.allowed === true && templateSnapshot?.supports_branding !== false

    // Format currency with proper locale based on currency - uses invoice currency, no fallback to NGN
    const formatCurrency = (amount: number, currency: string) => {
      const localeMap: Record<string, string> = {
        'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB',
        'INR': 'en-IN', 'CAD': 'en-CA', 'AUD': 'en-AU', 'ZAR': 'en-ZA',
        'KES': 'en-KE', 'GHS': 'en-GH', 'EGP': 'en-EG', 'AED': 'ar-AE'
      }
      const locale = localeMap[currency] || 'en-US'
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
    }

    // Format date compactly
    const formatDate = (date: string | null | undefined) => {
      if (!date) return '—'
      try {
        return new Date(date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })
      } catch {
        return '—'
      }
    }

    // Format address as compact single line
    const formatAddressCompact = (address: Record<string, unknown> | null | undefined): string => {
      if (!address) return ''
      const parts = [
        address.line1 as string || address.street as string,
        address.city as string,
        address.state as string,
        address.country as string
      ].filter(Boolean)
      return parts.join(', ')
    }

    // Get issuer and recipient data from snapshots
    const issuerName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk User'
    const issuerTaxId = issuerSnapshot?.tax_id || ''
    const issuerCacNumber = issuerSnapshot?.cac_number || ''
    const issuerVatRegNumber = issuerSnapshot?.vat_registration_number || ''
    const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
    const issuerEmail = issuerSnapshot?.contact_email || ''
    const issuerPhone = issuerSnapshot?.contact_phone || ''
    
    const recipientName = recipientSnapshot?.name || inv.clients?.name || 'Client'
    const recipientEmail = recipientSnapshot?.email || inv.clients?.email || ''
    const recipientTaxId = recipientSnapshot?.tax_id || ''
    const recipientCacNumber = recipientSnapshot?.cac_number || ''
    const recipientAddress = formatAddressCompact(recipientSnapshot?.address || inv.clients?.address)
    
    // Helper to get CAC display label based on jurisdiction
    const getCacLabel = (jurisdiction: string | undefined): string => {
      switch (jurisdiction) {
        case 'NG': return 'CAC'
        case 'GB': return 'Co. No'
        case 'DE': return 'HRB'
        case 'FR': return 'SIRET'
        default: return 'Reg No'
      }
    }
    const issuerCacLabel = getCacLabel(issuerSnapshot?.jurisdiction)

    // Detect reverse charge and multi-country VAT
    const isReverseCharge = (inv as Record<string, unknown>).is_reverse_charge === true

    // Generate compact line items HTML with VAT-specific labels for Nigerian invoices
    const items = (inv.invoice_items || []) as InvoiceItem[]

    // Build grouped tax breakdown
    const taxGroupMap: Record<string, { label: string; rate: number; amount: number }> = {}
    items.forEach(item => {
      if (item.tax_rate > 0) {
        const label = item.tax_label || (isNigerianVatRegistered ? 'VAT' : 'Tax')
        const key = `${label}@${item.tax_rate}`
        if (!taxGroupMap[key]) {
          taxGroupMap[key] = { label, rate: item.tax_rate, amount: 0 }
        }
        taxGroupMap[key].amount += item.tax_amount
      }
    })
    const taxGroups = Object.values(taxGroupMap)
    const hasMultipleTaxGroups = taxGroups.length > 1

    // Split heading + multi-line description (stored as "heading\ndescription")
    const escapeHtmlMin = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const itemsHtml = items.map(item => {
      const raw = item.description || ''
      const nl = raw.indexOf('\n')
      const heading = nl === -1 ? raw : raw.slice(0, nl)
      const longDesc = nl === -1 ? '' : raw.slice(nl + 1)
      const headingHtml = `<strong>${escapeHtmlMin(heading)}</strong>`
      const descHtml = longDesc
        ? `<div style="font-size:9px;color:#555;white-space:pre-line;margin-top:2px;">${escapeHtmlMin(longDesc)}</div>`
        : ''
      const taxHtml = !isNigerianVatRegistered && item.tax_label && item.tax_rate > 0
        ? `<br><span style="font-size:8px;color:#888;">${item.tax_label}: ${item.tax_rate}%</span>`
        : ''
      return `
      <tr>
        <td>${headingHtml}${descHtml}${taxHtml}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatCurrency(item.unit_price, inv.currency)}</td>
        ${isNigerianVatRegistered ? `<td class="right">${item.tax_rate === 0 ? 'Exempt' : item.tax_rate + '%'}</td>` : ''}
        <td class="right">${formatCurrency(item.amount, inv.currency)}</td>
      </tr>
    `
    }).join('')

    // Status color mapping
    const statusColors: Record<string, { bg: string; color: string }> = {
      'issued': { bg: '#dbeafe', color: '#1d4ed8' },
      'sent': { bg: '#e0e7ff', color: '#4338ca' },
      'viewed': { bg: '#fef3c7', color: '#d97706' },
      'paid': { bg: '#d1fae5', color: '#059669' },
      'voided': { bg: '#fee2e2', color: '#dc2626' },
      'credited': { bg: '#fce7f3', color: '#db2777' }
    }
    const statusStyle = statusColors[inv.status] || statusColors['issued']

    // ── Deposit / Final invoice metadata ──
    const invoiceKind = (inv.kind as string) || 'standard'
    const isDepositInvoice = invoiceKind === 'deposit'
    const isFinalInvoice = invoiceKind === 'final'
    const depositPercent = inv.deposit_percent ?? null
    type ParentDeposit = { invoice_number: string; amount_paid: number; total_amount: number; deposit_percent: number | null; currency: string }
    let parentDeposit: ParentDeposit | null = null
    if (isFinalInvoice && inv.parent_invoice_id) {
      const supabaseAdminForParent = createClient(supabaseUrl, supabaseServiceKey)
      const { data: parent } = await supabaseAdminForParent
        .from('invoices')
        .select('invoice_number, amount_paid, total_amount, deposit_percent, currency')
        .eq('id', inv.parent_invoice_id)
        .maybeSingle()
      if (parent) parentDeposit = parent as unknown as ParentDeposit
    }
    const depositCreditAmount = parentDeposit ? Number(parentDeposit.amount_paid || 0) : 0

    // Calculate balance due, accounting for deposit credit on final invoices
    const effectiveCredits = (inv.amount_paid || 0) + (isFinalInvoice ? depositCreditAmount : 0)
    const balanceDue = Math.max(0, inv.total_amount - effectiveCredits)

    // Kind badge HTML (inserted next to invoice number in headers) — high-contrast for visibility
    const kindBadgeHtml = (isDepositInvoice || isFinalInvoice)
      ? `<span style="display:inline-block;padding:3px 10px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:${isDepositInvoice ? '#0369a1' : '#7c3aed'};color:#ffffff;margin-left:8px;vertical-align:middle;">${isDepositInvoice ? `Deposit${depositPercent ? ` · ${depositPercent}%` : ''}` : 'Final Invoice'}</span>`
      : ''

    // Prominent deposit/final info banner shown above items table
    const depositBannerHtml = isDepositInvoice
      ? `<div style="padding: 8px 12px; margin-bottom: 10px; background: #eff6ff; border-left: 4px solid #0369a1; border-radius: 3px; font-size: 10px; color: #0c4a6e;">
          <strong style="text-transform:uppercase;letter-spacing:0.5px;font-size:9px;">Deposit Invoice${depositPercent ? ` · ${depositPercent}% advance` : ''}</strong>
          <div style="margin-top:2px;">This is an advance/down-payment invoice. A separate final invoice will be issued and will credit any amount paid here.</div>
        </div>`
      : (isFinalInvoice && parentDeposit
        ? `<div style="padding: 8px 12px; margin-bottom: 10px; background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 3px; font-size: 10px; color: #4c1d95;">
            <strong style="text-transform:uppercase;letter-spacing:0.5px;font-size:9px;">Final Invoice</strong>
            <div style="margin-top:2px;">Linked to deposit invoice <strong>${parentDeposit.invoice_number}</strong>${depositCreditAmount > 0 ? ` — ${formatCurrency(depositCreditAmount, inv.currency)} already paid is credited below.` : '.'}</div>
          </div>`
        : '')

    // Subtle footer branding - no aggressive watermark
    // Free/Starter users get professional-looking invoices with subtle footer badge
    // Professional+ users get completely clean invoices

    // QR Code generation - SVG-based for better quality
    // Prefer env, then fallback
    const appUrl = Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'
    const verificationUrl = inv.verification_id 
      ? `${appUrl}/verify/invoice/${inv.verification_id}` 
      : null
    
    // ALWAYS show business logo if available (regardless of tier)
    // Branding tier only affects watermark and "Powered by InvoiceMonk" text
    let issuerLogoUrl = issuerSnapshot?.logo_url || null

    // Defensive fallback: If no logo in snapshot, try to fetch from business table
    if (!issuerLogoUrl && inv.business_id) {
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('logo_url')
        .eq('id', inv.business_id)
        .single()
      issuerLogoUrl = business?.logo_url || null
      if (issuerLogoUrl) {
        console.log('Logo fetched from business table as fallback')
      }
    }

    // Inline QR code generator — produces a self-contained SVG string
    // so the PDF HTML has no external image dependencies.
    const generateQRCodeSVG = (data: string, size: number = 60): string => {
      // Simple QR code generator using qrcode-generator algorithm
      // Alphanumeric mode, error correction level M
      const qr = createQR(data)
      const moduleCount = qr.length
      const cellSize = size / moduleCount
      let paths = ''
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr[row][col]) {
            paths += `<rect x="${(col * cellSize).toFixed(2)}" y="${(row * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}"/>`
          }
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;"><rect width="${size}" height="${size}" fill="white"/><g fill="black">${paths}</g></svg>`
    }

    const qrCodeHtml = verificationUrl ? generateQRCodeSVG(verificationUrl, 50) : ''

    // Compact footer line
    const verificationLine = inv.verification_id 
      ? `Verification: ${inv.verification_id.substring(0, 8)}...` 
      : ''
    const hashLine = inv.invoice_hash 
      ? `Hash: ${inv.invoice_hash.substring(0, 12)}...` 
      : ''

    // Shared CSS used across all templates
    const pageCss = tplHeaderStyle === 'modern'
      ? '@page { size: A4; margin: 0; }'
      : '@page { size: A4; margin: 12mm 15mm; }';
    const sharedCss = `
      ${pageCss}
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-break { page-break-inside: avoid; }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        color: #1a1a1a; 
        font-size: 11px; 
        line-height: 1.35; 
      }
      .container { max-width: 100%; padding: 0; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
      th { background: #f8f9fa; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; color: #666; border-bottom: 1px solid #d1d5db; }
      td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
      th.right, td.right { text-align: right; }
      tr:last-child td { border-bottom: 1px solid #d1d5db; }
      .footer-branding { text-align: center; font-size: 8px; color: #aaa; padding: 10px 0 0; margin-top: 16px; border-top: 1px solid #eee; }
      .footer-branding a { color: #888; text-decoration: none; }
    `

    // Items table HTML
    const itemsTableHtml = `
      ${depositBannerHtml}
      <table class="no-break">
        <thead><tr>
          <th style="width: ${isNigerianVatRegistered ? '45%' : '55%'};">Description</th>
          <th class="right" style="width: 10%;">Qty</th>
          <th class="right" style="width: 17%;">Rate</th>
          ${isNigerianVatRegistered ? '<th class="right" style="width: 10%;">VAT</th>' : ''}
          <th class="right" style="width: 18%;">Amount</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    `

    // Totals HTML with grouped VAT breakdown
    const taxLinesHtml = hasMultipleTaxGroups
      ? taxGroups.map(g => `<div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #444;">
            <span>${g.label} @ ${g.rate}%</span>
            <span>${formatCurrency(g.amount, inv.currency)}</span>
          </div>`).join('')
      : (inv.tax_amount > 0 ? `<div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #444;">
            <span>${isNigerianVatRegistered ? 'VAT @ 7.5%' : taxGroups.length === 1 ? `${taxGroups[0].label} @ ${taxGroups[0].rate}%` : 'Tax'}</span>
            <span>${formatCurrency(inv.tax_amount, inv.currency)}</span>
          </div>` : '')

    const reverseChargeHtml = isReverseCharge
      ? `<div style="text-align: center; padding: 4px 8px; margin-bottom: 6px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 3px; font-size: 9px; font-weight: 600; color: #92400e;">REVERSE CHARGE — Recipient liable for VAT</div>`
      : ''

    const totalsHtml = `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;" class="no-break">
        <div style="width: 240px;">
          ${reverseChargeHtml}
          <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #444;">
            <span>${isNigerianVatRegistered ? 'Subtotal (excl. VAT)' : 'Subtotal'}</span>
            <span>${formatCurrency(inv.subtotal, inv.currency)}</span>
          </div>
          ${taxLinesHtml}
          ${inv.discount_amount > 0 ? `<div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #444;">
            <span>Discount</span><span>-${formatCurrency(inv.discount_amount, inv.currency)}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #1a1a1a; border-top: 2px solid #1a1a1a; padding-top: 6px; margin-top: 4px;">
            <span>${isNigerianVatRegistered ? 'Total (incl. VAT)' : 'Total'}</span>
            <span>${formatCurrency(inv.total_amount, inv.currency)}</span>
          </div>
          ${isFinalInvoice && parentDeposit && depositCreditAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #0369a1;">
            <span>Less: Deposit (${parentDeposit.invoice_number})</span><span>-${formatCurrency(depositCreditAmount, inv.currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #1a1a1a; border-top: 1px solid #d1d5db; padding-top: 4px; margin-top: 2px;">
            <span>Net Due After Deposit</span><span>${formatCurrency(Math.max(0, inv.total_amount - depositCreditAmount), inv.currency)}</span>
          </div>` : ''}
          ${inv.amount_paid > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #059669;">
            <span>Paid</span><span>-${formatCurrency(inv.amount_paid, inv.currency)}</span>
          </div>` : ''}
          ${(inv.amount_paid > 0 || (isFinalInvoice && depositCreditAmount > 0)) ? `
          <div style="display: flex; justify-content: space-between; font-weight: 600; background: #fef3c7; padding: 4px 6px; margin: 4px -6px 0; border-radius: 3px;">
            <span>Balance Due</span><span>${formatCurrency(balanceDue, inv.currency)}</span>
          </div>` : ''}
        </div>
      </div>
    `

    // Notes/Terms HTML
    const notesTermsHtml = ((showNotes && inv.notes) || (showTerms && inv.terms)) ? `
      <div style="margin-bottom: 12px; padding: 8px 10px; background: #fafafa; border-radius: 4px;" class="no-break">
        ${showNotes && inv.notes ? `<div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 3px;">Notes</div><div style="font-size: 10px; color: #444;">${inv.notes}</div>` : ''}
        ${(showNotes && inv.notes) && (showTerms && inv.terms) ? '<div style="height: 8px;"></div>' : ''}
        ${showTerms && inv.terms ? `<div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 3px;">Terms</div><div style="font-size: 10px; color: #444;">${inv.terms}</div>` : ''}
      </div>
    ` : ''

    // Payment method HTML
    const paymentMethodHtml = (() => {
      const pm = inv.payment_method_snapshot
      if (!pm) return ''
      const instructions = (pm as Record<string, unknown>).instructions as Record<string, string> || {}
      const displayName = (pm as Record<string, unknown>).display_name as string || (pm as Record<string, unknown>).provider_type as string || 'Payment Method'
      const instructionRows = Object.entries(instructions)
        .filter(([, v]) => v)
        .map(([k, v]) => `<div style="display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0;"><span style="color: #666; text-transform: capitalize;">${String(k).replace(/_/g, ' ')}</span><span style="font-family: monospace; font-size: 10px;">${String(v)}</span></div>`).join('')
      return `<div class="no-break" style="margin-bottom: 12px; padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px;">
        <div style="font-size: 9px; font-weight: 600; color: #166534; text-transform: uppercase; margin-bottom: 6px;">Payment Instructions</div>
        <div style="font-size: 10px; color: #333; margin-bottom: 4px;"><strong>${displayName}</strong></div>
        ${instructionRows}
        <div style="margin-top: 6px; font-size: 9px; color: #666; border-top: 1px solid #dcfce7; padding-top: 4px;">Reference: <strong>${inv.invoice_number}</strong></div>
      </div>`
    })()

    // Footer HTML
    const footerHtml = `
      <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #888; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${showQr && verificationUrl && qrCodeHtml ? `<div style="display: flex; align-items: center; gap: 6px;">${qrCodeHtml}<span style="font-size: 7px; max-width: 80px;">Scan to verify invoice authenticity</span></div>` : ''}
        </div>
        <div style="text-align: right;">
          ${issuerName}${issuerEmail ? ` • ${issuerEmail}` : ''}<br>
          ${verificationLine}${verificationLine && hashLine ? ' • ' : ''}${hashLine}
        </div>
      </div>
      ${showWatermark ? `<div class="footer-branding">Generated with <a href="https://invoicemonk.com">Invoicemonk</a> – Smart invoicing for modern businesses</div>` : ''}
    `

    // Generate template-specific body HTML
    let bodyHtml = ''

    if (tplHeaderStyle === 'minimal') {
      // ── MINIMAL (Basic) ──
      bodyHtml = `
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; margin-bottom: 16px;">
            <div>
              <div style="font-size: 18px; font-weight: 700; color: #4b5563;">INVOICE</div>
              <div style="font-size: 11px; color: #9ca3af;">${inv.invoice_number}${kindBadgeHtml}</div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #6b7280;">
              <div>Issued: ${formatDate(inv.issue_date)}</div>
              ${inv.due_date ? `<div>Due: ${formatDate(inv.due_date)}</div>` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 24px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <div style="font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-bottom: 4px;">From</div>
              <div style="font-size: 12px; font-weight: 600;">${issuerName}</div>
              ${issuerEmail ? `<div style="font-size: 10px; color: #666;">${issuerEmail}</div>` : ''}
            </div>
            <div style="flex: 1;">
              <div style="font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-bottom: 4px;">To</div>
              <div style="font-size: 12px; font-weight: 600;">${recipientName}</div>
              ${recipientEmail ? `<div style="font-size: 10px; color: #666;">${recipientEmail}</div>` : ''}
            </div>
          </div>
          ${itemsTableHtml}
          ${totalsHtml}
          ${paymentMethodHtml}
          <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #aaa; text-align: right;">
            ${issuerName}${issuerEmail ? ` • ${issuerEmail}` : ''}
          </div>
          ${showWatermark ? `<div class="footer-branding">Generated with <a href="https://invoicemonk.com">Invoicemonk</a></div>` : ''}
        </div>
      `
    } else if (tplHeaderStyle === 'modern') {
      // ── MODERN ──
      bodyHtml = `
          <div style="background: ${tplPrimaryColor}; color: white; padding: 12mm 15mm 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 12px;">
                ${showLogo && issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="Logo" style="height: 40px; max-width: 80px; object-fit: contain; background: rgba(255,255,255,0.9); border-radius: 4px; padding: 4px;" />` : ''}
                <div>
                  <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">INVOICE</div>
                  <div style="font-size: 11px; opacity: 0.8;">${inv.invoice_number}${kindBadgeHtml}</div>
                </div>
              </div>
              <div style="text-align: right; font-size: 10px; opacity: 0.9;">
                <div>Issue: ${formatDate(inv.issue_date)}</div>
                ${inv.due_date ? `<div>Due: ${formatDate(inv.due_date)}</div>` : ''}
                <div style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; margin-top: 4px; background: rgba(255,255,255,0.2);">${inv.status.toUpperCase()}</div>
              </div>
            </div>
          </div>
          <div style="padding: 16px 15mm 12mm;">
          <div style="display: flex; gap: 16px; margin-bottom: 16px;">
            <div style="flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa;">
              <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; margin-bottom: 4px;">From</div>
              <div style="font-size: 12px; font-weight: 600;">${issuerName}</div>
              ${issuerAddress ? `<div style="font-size: 10px; color: #666;">${issuerAddress}</div>` : ''}
              ${issuerTaxId ? `<div style="font-size: 10px; color: #444; font-weight: 500;">TIN: ${issuerTaxId}</div>` : ''}
              ${issuerEmail ? `<div style="font-size: 10px; color: #666;">${issuerEmail}</div>` : ''}
            </div>
            <div style="flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa;">
              <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; margin-bottom: 4px;">Bill To</div>
              <div style="font-size: 12px; font-weight: 600;">${recipientName}</div>
              ${recipientAddress ? `<div style="font-size: 10px; color: #666;">${recipientAddress}</div>` : ''}
              ${recipientTaxId ? `<div style="font-size: 10px; color: #444; font-weight: 500;">TIN: ${recipientTaxId}</div>` : ''}
              ${recipientEmail ? `<div style="font-size: 10px; color: #666;">${recipientEmail}</div>` : ''}
            </div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
            ${itemsTableHtml}
          </div>
          <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
            <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa;">
              ${totalsHtml}
            </div>
          </div>
          ${paymentMethodHtml}
          ${notesTermsHtml}
          ${footerHtml}
          </div>
      `
    } else if (tplHeaderStyle === 'enterprise') {
      // ── ENTERPRISE ──
      bodyHtml = `
        <div class="container">
          <div style="text-align: center; padding: 16px 0; border-top: 2px solid ${tplPrimaryColor}; border-bottom: 2px solid ${tplPrimaryColor}; margin-bottom: 16px;">
            ${showLogo && issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="Logo" style="height: 45px; max-width: 120px; object-fit: contain; margin: 0 auto 8px;" />` : ''}
            <div style="font-size: 16px; font-weight: 700; text-transform: uppercase;">${issuerName}</div>
            ${issuerTaxId ? `<div style="font-size: 9px; color: #666;">TIN: ${issuerTaxId}</div>` : ''}
            ${issuerVatRegNumber ? `<div style="font-size: 9px; color: #666;">VAT Reg: ${issuerVatRegNumber}</div>` : ''}
            ${issuerAddress ? `<div style="font-size: 9px; color: #666;">${issuerAddress}</div>` : ''}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid ${tplPrimaryColor}30;">
            <div><div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase;">Invoice No</div><div style="font-weight: 600; font-family: monospace;">${inv.invoice_number}${kindBadgeHtml}</div></div>
            <div><div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase;">Date</div><div style="font-weight: 500;">${formatDate(inv.issue_date)}</div></div>
            <div><div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase;">Due Date</div><div style="font-weight: 500;">${formatDate(inv.due_date)}</div></div>
            <div><div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase;">Status</div><div style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; background: ${statusStyle.bg}; color: ${statusStyle.color};">${inv.status.toUpperCase()}</div></div>
          </div>
          <div style="display: flex; gap: 24px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid ${tplPrimaryColor}30;">
            <div style="flex: 1;">
              <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Issuer</div>
              <div style="font-size: 12px; font-weight: 600;">${issuerName}</div>
              ${issuerAddress ? `<div style="font-size: 10px; color: #444;">${issuerAddress}</div>` : ''}
              ${issuerEmail ? `<div style="font-size: 10px; color: #444;">${issuerEmail}</div>` : ''}
              ${issuerPhone ? `<div style="font-size: 10px; color: #444;">${issuerPhone}</div>` : ''}
            </div>
            <div style="flex: 1;">
              <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Recipient</div>
              <div style="font-size: 12px; font-weight: 600;">${recipientName}</div>
              ${recipientAddress ? `<div style="font-size: 10px; color: #444;">${recipientAddress}</div>` : ''}
              ${recipientEmail ? `<div style="font-size: 10px; color: #444;">${recipientEmail}</div>` : ''}
              ${recipientTaxId ? `<div style="font-size: 10px; color: #333; font-weight: 500;">TIN: ${recipientTaxId}</div>` : ''}
            </div>
          </div>
          ${inv.summary ? `<div style="background: #f8f9fa; border: 1px solid ${tplPrimaryColor}30; border-radius: 4px; padding: 10px 12px; margin-bottom: 12px;">
            <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Summary / Description</div>
            <div style="font-size: 10px; color: #444; line-height: 1.5;">${escapeHtml(stripUrls(String(inv.summary)))}</div>
          </div>` : ''}
          <div style="border: 1px solid ${tplPrimaryColor}30; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
            ${itemsTableHtml}
          </div>
          ${totalsHtml}
          ${paymentMethodHtml}
          ${notesTermsHtml}
          <div style="border-top: 2px solid ${tplPrimaryColor}; border-bottom: 2px solid ${tplPrimaryColor}; padding: 8px 0; margin-top: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #888;">
              <div>
                ${showQr && verificationUrl && qrCodeHtml ? `<div style="display: flex; align-items: center; gap: 6px;">${qrCodeHtml}<span style="font-size: 7px; max-width: 80px;">Scan to verify</span></div>` : ''}
              </div>
              <div style="text-align: right;">
                ${verificationLine}${verificationLine && hashLine ? ' • ' : ''}${hashLine}<br>
                ${issuerName}${issuerEmail ? ` • ${issuerEmail}` : ''}
              </div>
            </div>
          </div>
          ${showWatermark ? `<div class="footer-branding">Generated with <a href="https://invoicemonk.com">Invoicemonk</a> – Smart invoicing for modern businesses</div>` : ''}
        </div>
      `
    } else {
      // ── STANDARD (Professional) — default ──
      bodyHtml = `
        <div class="container">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid ${tplPrimaryColor}; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${showLogo && issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="Logo" style="height: 40px; max-width: 100px; object-fit: contain;" />` : ''}
              <div>
                <div style="font-size: 18px; font-weight: 700; color: ${tplPrimaryColor};">${issuerName}</div>
                ${!canUseBranding ? '<div style="font-size: 9px; color: #666; margin-top: 2px;">Powered by Invoicemonk</div>' : ''}
                ${issuerAddress ? `<div style="font-size: 9px; color: #666; margin-top: 2px;">${issuerAddress}</div>` : ''}
                ${issuerTaxId ? `<div style="font-size: 9px; color: #444; margin-top: 2px; font-weight: 500;">TIN: ${issuerTaxId}</div>` : ''}
                ${issuerCacNumber ? `<div style="font-size: 9px; color: #444; font-weight: 500;">${issuerCacLabel}: ${issuerCacNumber}</div>` : ''}
                ${issuerVatRegNumber ? `<div style="font-size: 9px; color: #444; font-weight: 500;">VAT Reg: ${issuerVatRegNumber}</div>` : ''}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: #1a1a1a;">INVOICE</div>
              <div style="font-size: 12px; color: #666; margin-top: 2px;">${inv.invoice_number}${kindBadgeHtml}</div>
              <div style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; margin-top: 4px; background: ${statusStyle.bg}; color: ${statusStyle.color};">${inv.status.toUpperCase()}</div>
            </div>
          </div>
          <div style="display: flex; gap: 24px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor === '#1a1a1a' ? '#666' : tplPrimaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bill To</div>
              <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">${recipientName}</div>
              <div style="font-size: 10px; color: #444; line-height: 1.4;">
                ${recipientAddress ? `${recipientAddress}<br>` : ''}
                ${recipientEmail ? `${recipientEmail}` : ''}
              </div>
              ${recipientTaxId ? `<div style="font-size: 10px; color: #333; font-weight: 500; margin-top: 4px;">TIN: ${recipientTaxId}</div>` : ''}
              ${recipientCacNumber ? `<div style="font-size: 10px; color: #333; font-weight: 500;">CAC: ${recipientCacNumber}</div>` : ''}
            </div>
            <div style="flex: 1;">
              <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Invoice Date</span><span>${formatDate(inv.issue_date)}</span></div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Due Date</span><span>${formatDate(inv.due_date)}</span></div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Currency</span><span>${inv.currency}</span></div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: #1a1a1a; padding-top: 6px; margin-top: 4px; border-top: 1px solid #e5e7eb;"><span>Amount Due</span><span>${formatCurrency(balanceDue, inv.currency)}</span></div>
              </div>
            </div>
          </div>
          ${inv.summary ? `<div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px 12px; margin-bottom: 12px;">
            <div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Summary / Description</div>
            <div style="font-size: 10px; color: #444; line-height: 1.5;">${escapeHtml(stripUrls(String(inv.summary)))}</div>
          </div>` : ''}
          ${itemsTableHtml}
          <div class="no-break" style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px;">
            <div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 6px;">Invoice Summary</div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Total Items</span><span>${items.length}</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Subtotal</span><span>${formatCurrency(inv.subtotal, inv.currency)}</span></div>
            ${inv.tax_amount > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>${isNigerianVatRegistered ? 'VAT' : 'Tax'}</span><span>${formatCurrency(inv.tax_amount, inv.currency)}</span></div>` : ''}
            ${inv.discount_amount > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Discount</span><span>-${formatCurrency(inv.discount_amount, inv.currency)}</span></div>` : ''}
            <div style="display: flex; justify-content: space-between; font-weight: 600; padding-top: 4px; border-top: 1px solid #e5e7eb; margin-top: 4px; font-size: 10px;"><span>Grand Total</span><span>${formatCurrency(inv.total_amount, inv.currency)}</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: #1a1a1a; padding-top: 6px; margin-top: 4px; border-top: 1px solid #e5e7eb;"><span>Amount Due</span><span>${formatCurrency(balanceDue, inv.currency)}</span></div>
          </div>
          ${notesTermsHtml}
          ${paymentMethodHtml}
          ${footerHtml}
        </div>
      `
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${inv.invoice_number}</title>
  <style>${sharedCss}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`

    // Cache the generated HTML to storage for subsequent requests (fire-and-forget)
    // Only cache for issued/paid/voided invoices (stable states)
    if (['issued', 'sent', 'viewed', 'paid', 'voided', 'credited'].includes(inv.status)) {
      const cachePath = `${inv.business_id || 'personal'}/${inv.id}_${tplHeaderStyle}_v4.html`
      supabaseAdmin.storage
        .from('invoice-pdfs')
        .upload(cachePath, new Blob([html], { type: 'text/html' }), { upsert: true })
        .then(({ error: cacheErr }) => {
          if (cacheErr) console.error('PDF cache write error (non-blocking):', cacheErr)
        })
    }

    // Log PDF export event for compliance (skip for public access to avoid permission issues)
    // Fire-and-forget: never block the response
    if (!isPublicAccess) {
      supabaseAdmin.rpc('log_audit_event', {
        _event_type: 'DATA_EXPORTED',
        _entity_type: 'invoice',
        _entity_id: inv.id,
        _user_id: userId,
        _business_id: inv.business_id,
        _metadata: { 
          export_type: 'pdf',
          invoice_number: inv.invoice_number,
          tier: userTier,
          watermark_shown: showWatermark,
          branding_used: canUseBranding
        }
      }).then(({ error: auditErr }) => {
        if (auditErr) console.error('PDF audit log error (non-blocking):', auditErr)
      })
    }

    // Return HTML (frontend will use browser print/PDF functionality)
    return new Response(html, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8',
        'X-Invoice-Number': inv.invoice_number,
        'X-Watermark-Applied': showWatermark.toString(),
        'X-User-Tier': userTier
      }
    })

  } catch (error) {
    console.error('Generate PDF error:', error)
    captureException(error, { function_name: 'generate-pdf' })
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred while generating the PDF' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
