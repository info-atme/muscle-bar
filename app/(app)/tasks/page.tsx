import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TasksClient } from '@/components/tasks/tasks-client'
import type { Database } from '@/lib/supabase/types'

type TaskRow = Database['public']['Tables']['tasks']['Row']

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // RLSバイパスでスタッフ情報を取得
  let staff: { id: string; role: string } | null = null

  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('staff')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    staff = data
  } catch {
    // SERVICE_ROLE_KEY未設定時はanon keyでフォールバック
    const { data } = await supabase
      .from('staff')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    staff = data
  }

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
