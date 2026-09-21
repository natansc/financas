import { NextResponse } from 'next/server'
import { supabaseAdmin, checkToken } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rows = await req.json()

  // upsert ignorando duplicatas pela chave única
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .upsert(rows, {
      onConflict: 'purchase_date,description,amount_brl,card_last_four',
      ignoreDuplicates: true,
    })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    inserted: data?.length ?? 0,
    duplicates: rows.length - (data?.length ?? 0),
  })
}