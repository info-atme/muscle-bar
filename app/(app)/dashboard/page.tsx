import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import type { Database } from '@/lib/supabase/types'

type DailySummaryRow = Database['public']['Tables']['daily_summary']['Row']
type StaffPerformanceRow = Database['public']['Tables']['staff_performance']['Row']

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date()
  // Fetch from last month start to cover all period tabs
  const lastMonthStart = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')

  const weekAgo = format(subDays(today, 7), 'yyyy-MM-dd')

  // 全クエリを並列実行
  const [monthlyRes, recentRes, staffRes, pendingRes, firstPendingRes] = await Promise.all([
    // Fetch from last month start to support period switching
    supabase
      .from('daily_summary')
      .select('*')
      .gte('date', lastMonthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: true }),
    supabase
      .from('daily_summary')
      .select('*')
      .gte('date', weekAgo)
      .order('date', { ascending: true }),
    supabase
      .from('staff')
      .select('id, name')
      .eq('is_active', true),
    supabase
      .from('daily_summary')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    // Get first pending record date
    supabase
      .from('daily_summary')
      .select('date')
      .eq('status', 'draft')
      .order('date', { ascending: true })
      .limit(1),
  ])

  const monthlySummaries = (monthlyRes.data ?? []) as DailySummaryRow[]
  const recentSummaries = (recentRes.data ?? []) as DailySummaryRow[]
  const staffList = (staffRes.data ?? []) as { id: string; name: string }[]
  const pendingCount = pendingRes.count
  const firstPendingDate = firstPendingRes.data?.[0]?.date ?? null

  // スタッフ実績（月次データ依存）
  const summaryIds = monthlySummaries
    .filter((s) => s.date >= monthStart)
    .map((s) => s.id)
  const { data: perfData } = summaryIds.length > 0
    ? await supabase
        .from('staff_performance')
        .select('*')
        .in('daily_summary_id', summaryIds)
    : { data: [] as StaffPerformanceRow[] }

  const staffPerformances = (perfData ?? []) as StaffPerformanceRow[]

  return (
    <DashboardClient
      monthlySummaries={monthlySummaries}
      recentSummaries={recentSummaries}
      staffPerformances={staffPerformances}
      staffList={staffList}
      pendingCount={pendingCount ?? 0}
      firstPendingDate={firstPendingDate}
    />
  )
}
