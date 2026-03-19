import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createServiceClient()
  const { data } = await admin
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!data) return null
  return { staffId: data.id, role: data.role, admin }
}

// シフト希望を保存（insert or update）
export async function POST(request: NextRequest) {
  try {
    const staff = await getStaff()
    if (!staff) return NextResponse.json({ error: '未認証' }, { status: 401 })

    const { staffId, targetDate, preference } = await request.json()

    // 自分のシフトか、管理者かチェック
    if (staffId !== staff.staffId && staff.role === 'staff') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const actualStaffId = staffId || staff.staffId

    // upsert
    const { data, error } = await staff.admin
      .from('shift_preferences')
      .upsert(
        { staff_id: actualStaffId, target_date: targetDate, preference },
        { onConflict: 'staff_id,target_date' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// シフト希望を削除
export async function DELETE(request: NextRequest) {
  try {
    const staff = await getStaff()
    if (!staff) return NextResponse.json({ error: '未認証' }, { status: 401 })

    const { id, staffId } = await request.json()

    if (staffId !== staff.staffId && staff.role === 'staff') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { error } = await staff.admin
      .from('shift_preferences')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
