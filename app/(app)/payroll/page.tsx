import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PayrollClient } from '@/components/payroll/payroll-client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { Database } from '@/lib/supabase/types'

type StaffRow = Database['public']['Tables']['staff']['Row']
type AttendanceRow = Database['public']['Tables']['attendance']['Row']
type StaffPerformanceRow = Database['public']['Tables']['staff_performance']['Row']
type DailySummaryRow = Database['public']['Tables']['daily_summary']['Row']

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // オーナー権限チェック
  const { data: currentStaff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!currentStaff || currentStaff.role !== 'owner') {
    redirect('/dashboard')
  }

  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

  // 全クエリを並列実行
  const [staffRes, attendanceRes, summaryRes] = await Promise.all([
    supabase
      .from('staff')
      .select('id, name, hourly_rate, is_active')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('attendance')
      .select('*')
      .gte('target_date', monthStart)
      .lte('target_date', monthEnd),
    supabase
      .from('daily_summary')
      .select('id, date, status')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .eq('status', 'approved'),
  ])

  const staffList = (staffRes.data ?? []) as Pick<StaffRow, 'id' | 'name' | 'hourly_rate' | 'is_active'>[]
  const attendanceList = (attendanceRes.data ?? []) as AttendanceRow[]
  const approvedSummaries = (summaryRes.data ?? []) as Pick<DailySummaryRow, 'id' | 'date' | 'status'>[]

  // 承認済みサマリーのスタッフ実績を取得
  const summaryIds = approvedSummaries.map((s) => s.id)
  const { data: perfData } = summaryIds.length > 0
    ? await supabase
        .from('staff_performance')
        .select('*')
        .in('daily_summary_id', summaryIds)
    : { data: [] as StaffPerformanceRow[] }

  const staffPerformances = (perfData ?? []) as StaffPerformanceRow[]

  return (
    <PayrollClient
      staffList={staffList}
      attendanceList={attendanceList}
      staffPerformances={staffPerformances}
      initialMonth={format(today, 'yyyy-MM')}
    />
  )
}
