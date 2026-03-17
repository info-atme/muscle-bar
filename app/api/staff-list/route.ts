import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未認証' }, { status: 401 })
    }

    let staffList: { id: string; name: string }[] = []
    try {
      const admin = createServiceClient()
      const { data } = await admin
        .from('staff')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      staffList = data ?? []
    } catch {
      const { data } = await supabase
        .from('staff')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      staffList = data ?? []
    }

    return NextResponse.json(staffList)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
