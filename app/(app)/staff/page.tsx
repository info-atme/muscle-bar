import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffManagementClient } from '@/components/staff/staff-management-client'
import type { Database } from '@/lib/supabase/types'

type StaffRow = Database['public']['Tables']['staff']['Row']

export default async function StaffPage() {
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

  if (!currentStaff || currentStaff.role !== 'owner') {
    redirect('/dashboard')
  }

  let staffList: StaffRow[] = []
  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('staff')
      .select('*')
      .order('created_at', { ascending: true })
    staffList = (data ?? []) as StaffRow[]
  } catch {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: true })
    staffList = (data ?? []) as StaffRow[]
  }

  return (
    <StaffManagementClient staffList={staffList} />
  )
}
