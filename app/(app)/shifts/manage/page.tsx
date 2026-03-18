import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShiftManageClient } from '@/components/shifts/shift-manage-client'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default async function ShiftManagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let currentStaff: { id: string; role: string } | null = null
  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('staff')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    currentStaff = data
  } catch {
    const { data } = await supabase
      .from('staff')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    currentStaff = data
  }

  if (!currentStaff || currentStaff.role === 'staff') {
    redirect('/shifts/preferences')
  }

  // 今月のデータを取得
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const startStr = format(monthStart, 'yyyy-MM-dd')
  const endStr = format(monthEnd, 'yyyy-MM-dd')

  // スタッフ一覧を取得
  let staffList: { id: string; name: string }[] = []
  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('staff')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    staffList = data ?? []
  } catch {
    const { data } = await supabase
      .from('staff')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    staffList = data ?? []
  }

  // シフト希望・割り当てを月単位で並列取得
  const [prefRes, assignRes] = await Promise.all([
    supabase
      .from('shift_preferences')
      .select('*')
      .gte('target_date', startStr)
      .lte('target_date', endStr),
    supabase
      .from('shift_assignments')
      .select('*')
      .gte('target_date', startStr)
      .lte('target_date', endStr),
  ])

  return (
    <ShiftManageClient
      currentStaffId={currentStaff.id}
      staffList={staffList}
      preferences={(prefRes.data ?? []) as { id: string; staff_id: string; target_date: string; preference: 'available' | 'preferred' | 'unavailable' }[]}
      assignments={(assignRes.data ?? []) as { id: string; staff_id: string; target_date: string; status: 'assigned' | 'called_in' | 'cancelled'; assigned_by: string | null }[]}
      monthStart={startStr}
      monthEnd={endStr}
    />
  )
}
