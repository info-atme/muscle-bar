import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TasksClient } from '@/components/tasks/tasks-client'
import type { Database } from '@/lib/supabase/types'

type TaskRow = Database['public']['Tables']['tasks']['Row']

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!staff) redirect('/login')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: staffList } = await supabase
    .from('staff')
    .select('id, name')
    .eq('is_active', true)

  return (
    <TasksClient
      tasks={(tasks ?? []) as TaskRow[]}
      staffList={(staffList ?? []) as { id: string; name: string }[]}
      currentStaffId={staff.id}
      role={staff.role as 'owner' | 'manager' | 'staff'}
    />
  )
}
