import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPENSE_CATEGORIES = [
  "software", "equipment", "travel", "meals", "office", "marketing",
  "professional", "utilities", "rent", "insurance", "taxes", "payroll", "other",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storage_path, business_currency, business_jurisdiction } = await req.json();

    if (!storage_path) {
      return new Response(
        JSON.stringify({ error: "storage_path is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create service-role client to download from storage
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Download the receipt file
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("expense-receipts")
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download receipt from storage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    // Determine MIME type
    const ext = storage_path.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      webp: "image/webp", pdf: "application/pdf",
    };
    const mimeType = mimeMap[ext] || "image/jpeg";

    // Build the AI request with tool-calling for structured output
    const systemPrompt = `You are a professional bookkeeper and receipt analyst. You analyze receipt and invoice images with extreme precision. Extract ALL financial data visible on the receipt.

Guidelines:
- Extract the vendor/store name exactly as printed
- Parse dates into ISO format (YYYY-MM-DD)
- Extract the total amount as a number (no currency symbols)
- Extract tax amounts and compute tax rate if visible
- Detect currency from symbols (₦=NGN, $=USD, £=GBP, €=EUR, etc.) or context
- The business operates in ${business_jurisdiction || "unknown"} jurisdiction with primary currency ${business_currency || "USD"}
- Categorize the expense into one of these categories: ${EXPENSE_CATEGORIES.join(", ")}
- If you cannot determine a field with confidence, omit it
- Return a confidence score from 0 to 1 indicating overall extraction quality`;

    const userContent = [
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      },
      {
        type: "text",
        text: "Analyze this receipt image and extract all financial data. Call the extract_receipt_data function with the extracted information.",
      },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_receipt_data",
          description: "Extract structured data from a receipt or invoice image",
          parameters: {
            type: "object",
            properties: {
              vendor_name: { type: "string", description: "Name of the vendor/store/business" },
              date: { type: "string", description: "Transaction date in YYYY-MM-DD format" },
              total_amount: { type: "number", description: "Total amount paid" },
              subtotal: { type: "number", description: "Subtotal before tax" },
              tax_amount: { type: "number", description: "Tax amount" },
              tax_rate: { type: "number", description: "Tax rate as a percentage (e.g. 7.5 for 7.5%)" },
              currency: { type: "string", description: "ISO 4217 currency code (e.g. NGN, USD, GBP)" },
              category: {
                type: "string",
                enum: EXPENSE_CATEGORIES,
                description: "Expense category",
              },
              description: { type: "string", description: "Brief summary of the purchase" },
              line_items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    quantity: { type: "number" },
                    unit_price: { type: "number" },
                    amount: { type: "number" },
                  },
                  required: ["description", "amount"],
                },
                description: "Individual line items on the receipt",
              },
              confidence: {
                type: "number",
                description: "Confidence score from 0 to 1 for the overall extraction quality",
              },
            },
            required: ["vendor_name", "total_amount", "confidence"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extract_receipt_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service is temporarily busy. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to analyze receipt. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ error: "Could not extract data from this receipt. Please enter details manually." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted;
    try {
      extracted = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      console.error("Failed to parse tool call arguments:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: "Failed to parse extracted data." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate category
    if (extracted.category && !EXPENSE_CATEGORIES.includes(extracted.category)) {
      extracted.category = "other";
    }

    // Add currency mismatch flag
    const currency_mismatch =
      extracted.currency && business_currency && extracted.currency !== business_currency;

    return new Response(
      JSON.stringify({
        ...extracted,
        currency_mismatch,
        business_currency: business_currency || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("scan-receipt error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
