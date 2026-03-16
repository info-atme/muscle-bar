import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffManagementClient } from '@/components/staff/staff-management-client'
import type { Database } from '@/lib/supabase/types'

type StaffRow = Database['public']['Tables']['staff']['Row']

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: currentStaff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentStaff || currentStaff.role !== 'owner') {
    redirect('/dashboard')
  }

  const { data: staffList } = await supabase
    .from('staff')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <StaffManagementClient staffList={(staffList ?? []) as StaffRow[]} />
  )
}
