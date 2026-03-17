'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import {
  BarChart3,
  PenSquare,
  Calendar,
  CheckSquare,
  User,
  Clock,
  MoreHorizontal,
  PartyPopper,
  Users,
  Wallet,
  LogOut,
} from 'lucide-react'

type Role = 'owner' | 'manager' | 'staff'

type Props = {
  staffName: string
  role: Role
}

type TabItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type SheetItem = {
  href?: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  action?: () => void
  danger?: boolean
}

function getTabsForRole(role: Role): TabItem[] {
  if (role === 'staff') {
    return [
      { href: '/me', label: 'マイページ', icon: User },
      { href: '/shifts/attendance', label: '出退勤', icon: Clock },
      { href: '/tasks', label: 'タスク', icon: CheckSquare },
      { href: '/shifts/preferences', label: 'シフト', icon: Calendar },
    ]
  }
  // manager & owner share the same tabs
  return [
    { href: '/dashboard', label: '売上', icon: BarChart3 },
    { href: '/daily/input', label: '入力', icon: PenSquare },
    { href: '/shifts/manage', label: 'シフト', icon: Calendar },
    { href: '/tasks', label: 'タスク', icon: CheckSquare },
  ]
}

function getSheetItemsForRole(role: Role, onLogout: () => void): SheetItem[] {
  if (role === 'staff') {
    return [
      { href: '/events', label: 'イベント', icon: PartyPopper },
      { label: 'ログアウト', icon: LogOut, action: onLogout, danger: true },
    ]
  }
  const items: SheetItem[] = [
    { href: '/shifts/attendance', label: '出退勤', icon: Clock },
    { href: '/events', label: 'イベント', icon: PartyPopper },
  ]
  if (role === 'owner') {
    items.push(
      { href: '/staff', label: 'スタッフ', icon: Users },
      { href: '/payroll', label: '給与', icon: Wallet },
    )
  }
  items.push({ label: 'ログアウト', icon: LogOut, action: onLogout, danger: true })
  return items
}

function isTabActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function AppNav({ staffName, role }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  // Close sheet on route change
  useEffect(() => {
    setSheetOpen(false)
  }, [pathname])

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sheetOpen])

  const tabs = getTabsForRole(role)
  const sheetItems = getSheetItemsForRole(role, handleLogout)

  // Check if any sheet link is active (to highlight "More" tab)
  const moreActive = sheetItems.some(
    (item) => item.href && isTabActive(pathname, item.href)
  )

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-gray-800 border-t border-gray-700"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch justify-around max-w-lg mx-auto">
          {tabs.map((tab) => {
            const active = isTabActive(pathname, tab.href)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1.5 transition-colors ${
                  active ? 'text-blue-400' : 'text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-0.5 leading-tight">{tab.label}</span>
              </Link>
            )
          })}

          {/* More tab */}
          <button
            onClick={() => setSheetOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1.5 transition-colors ${
              moreActive || sheetOpen ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 leading-tight">その他</span>
          </button>
        </div>
      </nav>

      {/* Bottom sheet overlay */}
      {sheetOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-gray-800 rounded-t-2xl p-4 animate-slide-up"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle indicator */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>

            {/* Staff name header */}
            <div className="px-2 pb-3 mb-2 border-b border-gray-700">
              <span className="text-sm text-gray-400">{staffName}</span>
            </div>

            {/* Sheet items */}
            <div className="space-y-1">
              {sheetItems.map((item) => {
                const Icon = item.icon
                const baseClass = `flex items-center gap-3 w-full min-h-[48px] px-3 py-3 rounded-lg transition-colors text-left ${
                  item.danger
                    ? 'text-red-400 hover:bg-red-400/10'
                    : item.href && isTabActive(pathname, item.href)
                      ? 'text-blue-400 bg-gray-700/50'
                      : 'text-gray-200 hover:bg-gray-700'
                }`

                if (item.action) {
                  return (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className={baseClass}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href!}
                    className={baseClass}
                    onClick={() => setSheetOpen(false)}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
