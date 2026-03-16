import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return null
  }
  return createBrowserClient(url, key)
}

// 未紐付けスタッフ一覧取得
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未認証' }, { status: 401 })
    }

    const admin = getAdminClient()
    const client = admin ?? supabase

    // 既に紐付け済みか
    const { data: existing } = await client
      .from('staff')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ linked: true })
    }

    const { data: staffList } = await client
      .from('staff')
      .select('id, name, role')
      .is('auth_user_id', null)
      .eq('is_active', true)

    return NextResponse.json({ linked: false, staff: staffList ?? [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// スタッフ紐付け（既存スタッフにauth_user_idをセット）
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未認証' }, { status: 401 })
    }

    const { staffId } = await request.json()
    if (!staffId) {
      return NextResponse.json({ error: 'staffId が必要です' }, { status: 400 })
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY が設定されていません' }, { status: 500 })
    }

    // 既に紐付け済みか確認
    const { data: existing } = await admin
      .from('staff')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '既に紐付け済みです' }, { status: 400 })
    }

    // 対象スタッフが未紐付けか確認
    const { data: target } = await admin
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

    const { error: updateError } = await admin
      .from('staff')
      .update({ auth_user_id: user.id })
      .eq('id', staffId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// 新規スタッフ作成＋紐付け
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未認証' }, { status: 401 })
    }

    const { name, role } = await request.json()
    if (!name || !role) {
      return NextResponse.json({ error: 'name と role が必要です' }, { status: 400 })
    }

    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY が設定されていません' }, { status: 500 })
    }

    // 既に紐付け済みか確認
    const { data: existing } = await admin
      .from('staff')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '既に紐付け済みです' }, { status: 400 })
    }

    const { error: insertError } = await admin
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
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
