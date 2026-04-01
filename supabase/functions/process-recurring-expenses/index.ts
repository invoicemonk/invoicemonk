import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const today = new Date().toISOString().split('T')[0]

    // Fetch active recurring expenses where next_expense_date <= today
    const { data: dueExpenses, error: fetchError } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('is_active', true)
      .lte('next_expense_date', today)

    if (fetchError) throw fetchError

    let created = 0
    let deactivated = 0

    for (const rec of dueExpenses || []) {
      // Check if past end_date
      if (rec.end_date && rec.end_date < today) {
        await supabase
          .from('recurring_expenses')
          .update({ is_active: false })
          .eq('id', rec.id)
        deactivated++
        continue
      }

      // Create the expense
      const { error: insertError } = await supabase
        .from('expenses')
        .insert({
          user_id: rec.user_id,
          business_id: rec.business_id,
          currency_account_id: rec.currency_account_id,
          category: rec.category,
          description: rec.description,
          amount: rec.amount,
          currency: rec.currency,
          expense_date: rec.next_expense_date,
          vendor: rec.vendor,
          notes: rec.notes ? `[Auto] ${rec.notes}` : '[Auto] Recurring expense',
          receipt_url: rec.receipt_url,
          product_service_id: rec.product_service_id,
        })

      if (insertError) {
        console.error(`Failed to create expense for recurring ${rec.id}:`, insertError)
        continue
      }

      // Calculate next date
      const nextDate = calculateNextDate(rec.next_expense_date, rec.frequency)

      // Deactivate if next date is past end_date
      const shouldDeactivate = rec.end_date && nextDate > rec.end_date

      await supabase
        .from('recurring_expenses')
        .update({
          next_expense_date: nextDate,
          last_generated_at: new Date().toISOString(),
          is_active: !shouldDeactivate,
        })
        .eq('id', rec.id)

      if (shouldDeactivate) deactivated++
      created++
    }

    return new Response(
      JSON.stringify({ success: true, created, deactivated, processed: dueExpenses?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing recurring expenses:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calculateNextDate(currentDate: string, frequency: string): string {
  const date = new Date(currentDate)
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'biweekly':
      date.setDate(date.getDate() + 14)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1)
      break
  }
  return date.toISOString().split('T')[0]
}
