import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShiftPreferencesClient } from '@/components/shifts/shift-preferences-client'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export default async function ShiftPreferencesPage() {
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

  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

  // 自分の今月のシフト希望を取得
  const { data: preferences } = await supabase
    .from('shift_preferences')
    .select('*')
    .eq('staff_id', currentStaff.id)
    .gte('target_date', monthStart)
    .lte('target_date', monthEnd)

  return (
    <ShiftPreferencesClient
      staffId={currentStaff.id}
      staffName={currentStaff.name}
      preferences={(preferences ?? []) as { id: string; staff_id: string; target_date: string; preference: 'available' | 'preferred' | 'unavailable' }[]}
    />
  )
}
