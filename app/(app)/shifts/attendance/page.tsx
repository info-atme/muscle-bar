import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AttendanceClient } from '@/components/shifts/attendance-client'
import { format } from 'date-fns'

type AttendanceRecord = {
  id: string
  staff_id: string
  target_date: string
  clock_in: string | null
  clock_out: string | null
  status: 'working' | 'completed' | 'absent' | 'late'
  approved: boolean
  approved_by: string | null
  photo_url: string | null
  note: string | null
}

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let currentStaff: { id: string; name: string; role: 'owner' | 'manager' | 'staff' } | null = null
  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('staff')
      .select('id, name, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    currentStaff = data
  } catch {
    const { data } = await supabase
      .from('staff')
      .select('id, name, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    currentStaff = data
  }

  if (!currentStaff) redirect('/login')

  const today = format(new Date(), 'yyyy-MM-dd')
  const isManager = currentStaff.role === 'owner' || currentStaff.role === 'manager'

  // スタッフ一覧（マネージャー用）
  let staffList: { id: string; name: string }[] = []
  if (isManager) {
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
  }

  // 今日の勤怠データ（approved, approved_by, photo_url, note を含む）
  const { data: attendanceData } = isManager
    ? await supabase
        .from('attendance')
        .select('id, staff_id, target_date, clock_in, clock_out, status, approved, approved_by, photo_url, note')
        .eq('target_date', today)
    : await supabase
        .from('attendance')
        .select('id, staff_id, target_date, clock_in, clock_out, status, approved, approved_by, photo_url, note')
        .eq('staff_id', currentStaff.id)
        .eq('target_date', today)

  return (
    <AttendanceClient
      currentStaff={currentStaff}
      staffList={staffList}
      attendanceData={(attendanceData ?? []) as AttendanceRecord[]}
      today={today}
    />
  )
}
