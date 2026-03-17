import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase/types'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return null
  }
  return createSupabaseClient<Database>(url, key)
}

function getTodayDate(): string {
  // 日本時間 (UTC+9) の日付を取得
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

// アクティブなスタッフ一覧と本日の出勤状況を取得
export async function GET() {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY が設定されていません' },
        { status: 500 }
      )
    }

    const today = getTodayDate()

    // アクティブなスタッフを取得
    const { data: staffList, error: staffError } = await admin
      .from('staff')
      .select('id, name, pin, is_active')
      .eq('is_active', true)
      .order('name')

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 })
    }

    // 本日の出勤記録を取得
    const { data: attendanceList, error: attError } = await admin
      .from('attendance')
      .select('id, staff_id, clock_in, clock_out, status')
      .eq('target_date', today)

    if (attError) {
      return NextResponse.json({ error: attError.message }, { status: 500 })
    }

    // スタッフ情報と出勤状況をマージ
    const result = (staffList ?? []).map((s) => {
      const att = (attendanceList ?? []).find((a) => a.staff_id === s.id)
      return {
        id: s.id,
        name: s.name,
        hasPin: !!s.pin,
        attendance: att
          ? {
              id: att.id,
              clockIn: att.clock_in,
              clockOut: att.clock_out,
              status: att.status,
            }
          : null,
      }
    })

    return NextResponse.json({ staff: result, date: today })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// 出勤・退勤処理
export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY が設定されていません' },
        { status: 500 }
      )
    }

    const { staffId, pin, action } = await request.json()

    if (!staffId || !action) {
      return NextResponse.json(
        { error: 'staffId と action が必要です' },
        { status: 400 }
      )
    }

    if (action !== 'clock_in' && action !== 'clock_out') {
      return NextResponse.json(
        { error: 'action は clock_in または clock_out を指定してください' },
        { status: 400 }
      )
    }

    // スタッフ情報を取得
    const { data: staff, error: staffError } = await admin
      .from('staff')
      .select('id, name, pin, is_active')
      .eq('id', staffId)
      .single()

    if (staffError || !staff) {
      return NextResponse.json(
        { error: 'スタッフが見つかりません' },
        { status: 404 }
      )
    }

    if (!staff.is_active) {
      return NextResponse.json(
        { error: 'このスタッフは無効です' },
        { status: 400 }
      )
    }

    // PIN確認（PINが設定されている場合のみ）
    if (staff.pin) {
      if (!pin) {
        return NextResponse.json(
          { error: 'PINを入力してください' },
          { status: 401 }
        )
      }
      if (staff.pin !== pin) {
        return NextResponse.json(
          { error: 'PINが正しくありません' },
          { status: 401 }
        )
      }
    }

    const today = getTodayDate()
    const now = new Date().toISOString()

    // 本日の出勤記録を確認
    const { data: existing } = await admin
      .from('attendance')
      .select('id, clock_in, clock_out, status')
      .eq('staff_id', staffId)
      .eq('target_date', today)
      .maybeSingle()

    if (action === 'clock_in') {
      if (existing && existing.status === 'working') {
        return NextResponse.json(
          { error: '既に出勤中です' },
          { status: 400 }
        )
      }

      if (existing) {
        // 既存レコードを更新（退勤済みから再出勤）
        const { error: updateError } = await admin
          .from('attendance')
          .update({
            clock_in: now,
            clock_out: null,
            status: 'working' as const,
            updated_at: now,
          })
          .eq('id', existing.id)

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
      } else {
        // 新規レコード作成
        const { error: insertError } = await admin
          .from('attendance')
          .insert({
            staff_id: staffId,
            target_date: today,
            clock_in: now,
            status: 'working' as const,
          })

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
      }

      return NextResponse.json({ ok: true, action: 'clock_in', time: now })
    }

    if (action === 'clock_out') {
      if (!existing || existing.status !== 'working') {
        return NextResponse.json(
          { error: '出勤していません' },
          { status: 400 }
        )
      }

      const { error: updateError } = await admin
        .from('attendance')
        .update({
          clock_out: now,
          status: 'completed' as const,
          updated_at: now,
        })
        .eq('id', existing.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, action: 'clock_out', time: now })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
