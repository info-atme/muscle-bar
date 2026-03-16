import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/ui/app-nav'

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

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, role')
    .eq('auth_user_id', user.id)
    .single()

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
