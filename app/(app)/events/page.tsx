import { createClient } from '@/lib/supabase/server'
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

  // 現在のスタッフ情報を取得（created_by用）
  const { data: { user } } = await supabase.auth.getUser()
  const { data: staff } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_user_id', user!.id)
    .single()

  return (
    <EventsClient
      initialEvents={events}
      staffId={staff?.id ?? ''}
      role={staff?.role ?? 'staff'}
    />
  )
}
