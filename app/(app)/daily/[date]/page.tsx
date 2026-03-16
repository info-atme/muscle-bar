import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { DailyDetailClient } from '@/components/daily/daily-detail-client'
import type { Database } from '@/lib/supabase/types'

type Props = {
  params: Promise<{ date: string }>
}

type DailySummaryRow = Database['public']['Tables']['daily_summary']['Row']
type StaffPerformanceRow = Database['public']['Tables']['staff_performance']['Row']

export default async function DailyDetailPage({ params }: Props) {
  const { date } = await params
  const supabase = await createClient()

  // 日次サマリー取得
  const { data: summaryData } = await supabase
    .from('daily_summary')
    .select('*')
    .eq('date', date)
    .single()

  const summary = summaryData as DailySummaryRow | null
  if (!summary) notFound()

  // スタッフ実績取得
  const { data: perfData } = await supabase
    .from('staff_performance')
    .select('*')
    .eq('daily_summary_id', summary.id)

  const performances = (perfData ?? []) as StaffPerformanceRow[]

  // スタッフ名を取得
  const staffIds = performances.map((p) => p.staff_id).filter(Boolean)
  const { data: staffNameData } = staffIds.length > 0
    ? await supabase.from('staff').select('id, name').in('id', staffIds)
    : { data: [] as { id: string; name: string }[] }

  const staffNames = (staffNameData ?? []) as { id: string; name: string }[]

  const performancesWithNames = performances.map((p) => ({
    ...p,
    staff: staffNames.find((s) => s.id === p.staff_id) ?? null,
  }))

  // 現在のユーザーのロール
  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentStaffData } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user!.id)
    .single()

  const currentStaff = currentStaffData as { id: string; role: string } | null

  return (
    <DailyDetailClient
      summary={summary}
      performances={performancesWithNames}
      role={currentStaff?.role ?? 'staff'}
      staffId={currentStaff?.id ?? ''}
    />
  )
}
