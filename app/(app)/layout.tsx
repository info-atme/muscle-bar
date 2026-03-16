import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/ui/app-nav'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // RLSバイパスでスタッフ情報を取得
  let staff: { id: string; name: string; role: 'owner' | 'manager' | 'staff' } | null = null

  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('staff')
      .select('id, name, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    staff = data
  } catch {
    // SERVICE_ROLE_KEY未設定時はanon keyでフォールバック
    const { data } = await supabase
      .from('staff')
      .select('id, name, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    staff = data
  }

  if (!staff) {
    redirect('/setup')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <AppNav staffName={staff.name} role={staff.role} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
