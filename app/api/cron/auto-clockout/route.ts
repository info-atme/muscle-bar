import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { format, subHours } from 'date-fns'

export async function GET(request: NextRequest) {
  // Vercel Cronの認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 06:00 JST = 21:00 UTC (前日)
  // 05:00 JST をその日の営業終了とみなす
  // 現在は JST 06:00 なので、05:00 JST = 1時間前
  const autoClockOutTime = subHours(new Date(), 1).toISOString()

  // status = 'working' のレコード（clock_outがnull）を取得
  const { data: workingRecords, error: fetchError } = await supabase
    .from('attendance')
    .select('id, staff_id, clock_in, clock_out, status, target_date')
    .eq('status', 'working')
    .is('clock_out', null)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!workingRecords || workingRecords.length === 0) {
    return NextResponse.json({ message: 'No working records found', count: 0 })
  }

  const results: string[] = []

  for (const record of workingRecords) {
    const { error: updateError } = await supabase
      .from('attendance')
      .update({
        clock_out: autoClockOutTime,
        status: 'completed' as const,
        note: '自動退勤処理',
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)

    // 監査ログ
    await supabase.from('attendance_log').insert({
      attendance_id: record.id,
      action: 'auto_clockout',
      changed_by: null,
      old_values: { status: 'working', clock_out: null },
      new_values: { status: 'completed', clock_out: autoClockOutTime, note: '自動退勤処理' },
    })

    if (updateError) {
      results.push(`${record.id}: error - ${updateError.message}`)
    } else {
      results.push(`${record.id}: auto clock-out applied`)
    }
  }

  return NextResponse.json({
    message: 'Auto clock-out completed',
    count: workingRecords.length,
    results,
  })
}
