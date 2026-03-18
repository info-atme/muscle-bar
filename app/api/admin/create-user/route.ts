import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未認証' }, { status: 401 })
    }

    // オーナー権限チェック
    const admin = createServiceClient()
    const { data: currentStaff } = await admin
      .from('staff')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!currentStaff || currentStaff.role !== 'owner') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { email, password, staffId } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'メールとパスワードが必要です' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'パスワードは6文字以上必要です' }, { status: 400 })
    }

    // Admin APIでユーザー作成（メール確認スキップ）
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // staffIdが指定されていればauth_user_idを紐付け
    if (staffId && newUser.user) {
      await admin
        .from('staff')
        .update({ auth_user_id: newUser.user.id })
        .eq('id', staffId)
    }

    return NextResponse.json({ ok: true, userId: newUser.user?.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
