import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// スタッフ紐付け（既存スタッフにauth_user_idをセット）
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 })
  }

  const { staffId } = await request.json()
  if (!staffId) {
    return NextResponse.json({ error: 'staffId が必要です' }, { status: 400 })
  }

  const service = createServiceClient()

  // 既に紐付け済みか確認
  const { data: existing } = await service
    .from('staff')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: '既に紐付け済みです' }, { status: 400 })
  }

  // 対象スタッフが未紐付けか確認
  const { data: target } = await service
    .from('staff')
    .select('id, auth_user_id')
    .eq('id', staffId)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 })
  }

  if (target.auth_user_id) {
    return NextResponse.json({ error: 'このスタッフは既に別アカウントに紐付けられています' }, { status: 400 })
  }

  const { error: updateError } = await service
    .from('staff')
    .update({ auth_user_id: user.id })
    .eq('id', staffId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// 新規スタッフ作成＋紐付け
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 })
  }

  const { name, role } = await request.json()
  if (!name || !role) {
    return NextResponse.json({ error: 'name と role が必要です' }, { status: 400 })
  }

  const service = createServiceClient()

  // 既に紐付け済みか確認
  const { data: existing } = await service
    .from('staff')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: '既に紐付け済みです' }, { status: 400 })
  }

  const { error: insertError } = await service
    .from('staff')
    .insert({
      name,
      role,
      auth_user_id: user.id,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// 未紐付けスタッフ一覧取得
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 })
  }

  const service = createServiceClient()

  // 既に紐付け済みならリダイレクト情報を返す
  const { data: existing } = await service
    .from('staff')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ linked: true })
  }

  const { data: staffList } = await service
    .from('staff')
    .select('id, name, role')
    .is('auth_user_id', null)
    .eq('is_active', true)

  return NextResponse.json({ linked: false, staff: staffList ?? [] })
}
