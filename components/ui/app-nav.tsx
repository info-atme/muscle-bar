'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  staffName: string
  role: 'owner' | 'manager' | 'staff'
}

export function AppNav({ staffName, role }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const links = [
    ...(role !== 'staff' ? [
      { href: '/dashboard', label: '売上' },
      { href: '/daily/input', label: '入力' },
    ] : []),
    ...(role === 'staff' ? [
      { href: '/me', label: 'マイページ' },
    ] : []),
    { href: '/tasks', label: 'タスク' },
    ...(role !== 'staff' ? [
      { href: '/shifts/manage', label: 'シフト' },
    ] : [
      { href: '/shifts/preferences', label: 'シフト' },
    ]),
    ...(role !== 'staff' ? [
      { href: '/events', label: 'イベント' },
    ] : []),
    ...(role === 'owner' ? [
      { href: '/staff', label: 'スタッフ' },
      { href: '/payroll', label: '給与' },
    ] : []),
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm text-gray-400">{staffName}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
