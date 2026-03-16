import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MyPageClient } from '@/components/me/my-page-client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { Database } from '@/lib/supabase/types'

type StaffRow = Database['public']['Tables']['staff']['Row']
type StaffPerformanceRow = Database['public']['Tables']['staff_performance']['Row']
type DailySummaryRow = Database['public']['Tables']['daily_summary']['Row']

export default async function MyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: staffData } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!staffData) redirect('/login')

  const staff = staffData as StaffRow

  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

  // 今月の日次サマリー
  const { data: monthlyData } = await supabase
    .from('daily_summary')
    .select('*')
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .order('date', { ascending: true })

  const monthlySummaries = (monthlyData ?? []) as DailySummaryRow[]
  const summaryIds = monthlySummaries.map((s) => s.id)

  // 自分の今月パフォーマンス
  const { data: perfData } = summaryIds.length > 0
    ? await supabase
        .from('staff_performance')
        .select('*')
        .eq('staff_id', staff.id)
        .in('daily_summary_id', summaryIds)
    : { data: [] as StaffPerformanceRow[] }

  const performances = (perfData ?? []) as StaffPerformanceRow[]

  // 日付マッピング
  const summaryDateMap = Object.fromEntries(
    monthlySummaries.map((s) => [s.id, s.date])
  )

  return (
    <MyPageClient
      staff={staff}
      performances={performances}
      summaryDateMap={summaryDateMap}
    />
  )
}
