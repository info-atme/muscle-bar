import { createClient, createServiceClient } from '@/lib/supabase/server'
import { EventsClient } from '@/components/events/events-client'
import type { Database } from '@/lib/supabase/types'

type EventRow = Database['public']['Tables']['events']['Row']

export default async function EventsPage() {
  const supabase = await createClient()

  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .eq('is_template', false)
    .order('event_date', { ascending: false })

  const events = (eventsData ?? []) as EventRow[]

  // 現在のスタッフ情報を取得（RLSバイパス）
  const { data: { user } } = await supabase.auth.getUser()
  let staff: { id: string; role: string } | null = null

  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('staff')
      .select('id, role')
      .eq('auth_user_id', user!.id)
      .maybeSingle()
    staff = data
  } catch {
    // SERVICE_ROLE_KEY未設定時はanon keyでフォールバック
    const { data } = await supabase
      .from('staff')
      .select('id, role')
      .eq('auth_user_id', user!.id)
      .maybeSingle()
    staff = data
  }

  return (
    <EventsClient
      initialEvents={events}
      staffId={staff?.id ?? ''}
      role={staff?.role ?? 'staff'}
    />
  )
}
