import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import type { Database } from '@/lib/supabase/types'

type DailySummaryRow = Database['public']['Tables']['daily_summary']['Row']
type StaffPerformanceRow = Database['public']['Tables']['staff_performance']['Row']

export default async function DashboardPage() {
  const supabase = await createClient()
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

  // 直近7日間の日次サマリー
  const weekAgo = format(subDays(today, 7), 'yyyy-MM-dd')
  const { data: recentData } = await supabase
    .from('daily_summary')
    .select('*')
    .gte('date', weekAgo)
    .order('date', { ascending: true })

  const recentSummaries = (recentData ?? []) as DailySummaryRow[]

  // 今月のスタッフ実績（ランキング用）— joinは避けて別々に取得
  const summaryIds = monthlySummaries.map((s) => s.id)
  const { data: perfData } = summaryIds.length > 0
    ? await supabase
        .from('staff_performance')
        .select('*')
        .in('daily_summary_id', summaryIds)
    : { data: [] as StaffPerformanceRow[] }

  const staffPerformances = (perfData ?? []) as StaffPerformanceRow[]

  // スタッフ名取得
  const { data: staffData } = await supabase
    .from('staff')
    .select('id, name')
    .eq('is_active', true)

  const staffList = (staffData ?? []) as { id: string; name: string }[]

  // 未承認件数
  const { count: pendingCount } = await supabase
    .from('daily_summary')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  return (
    <DashboardClient
      monthlySummaries={monthlySummaries}
      recentSummaries={recentSummaries}
      staffPerformances={staffPerformances}
      staffList={staffList}
      pendingCount={pendingCount ?? 0}
    />
  )
}
