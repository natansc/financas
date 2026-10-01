import { NextResponse } from 'next/server'
import { checkToken } from '@/lib/supabase-admin'
import { createPluggyConnectToken } from '@/lib/pluggy'

export async function POST(req: Request) {
  if (!checkToken(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const accessToken = await createPluggyConnectToken()
    return NextResponse.json({ accessToken })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar conexão Pluggy'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}