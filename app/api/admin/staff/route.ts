import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createServiceClient()
  const { data } = await admin
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!data || data.role !== 'owner') return null
  return { userId: user.id, staffId: data.id, admin }
}

// スタッフ一覧取得
export async function GET() {
  try {
    const owner = await getOwner()
    if (!owner) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { data } = await owner.admin
      .from('staff')
      .select('*')
      .order('created_at', { ascending: true })

    return NextResponse.json(data ?? [])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// スタッフ追加
export async function POST(request: NextRequest) {
  try {
    const owner = await getOwner()
    if (!owner) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const body = await request.json()
    const { data, error } = await owner.admin
      .from('staff')
      .insert(body)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// スタッフ更新
export async function PUT(request: NextRequest) {
  try {
    const owner = await getOwner()
    if (!owner) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const { id, ...body } = await request.json()
    if (!id) return NextResponse.json({ error: 'idが必要です' }, { status: 400 })

    const { error } = await owner.admin
      .from('staff')
      .update(body)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
