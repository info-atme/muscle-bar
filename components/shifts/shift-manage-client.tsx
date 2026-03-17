'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Phone } from 'lucide-react'

type Staff = { id: string; name: string }

type Preference = {
  id: string
  staff_id: string
  target_date: string
  preference: 'available' | 'preferred' | 'unavailable'
}

type Assignment = {
  id: string
  staff_id: string
  target_date: string
  status: 'assigned' | 'called_in' | 'cancelled'
  assigned_by: string | null
}

type Props = {
  currentStaffId: string
  staffList: Staff[]
  preferences: Preference[]
  assignments: Assignment[]
  weekDates: string[]
}

const PREF_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  preferred: 'bg-blue-500',
  unavailable: 'bg-red-500',
}

const PREF_LABELS: Record<string, string> = {
  available: '可',
  preferred: '希望',
  unavailable: '不可',
}

const PREF_BADGE_LABELS: Record<string, string> = {
  available: '出勤可',
  preferred: '希望',
  unavailable: '不可',
}

export function ShiftManageClient({
  currentStaffId,
  staffList,
  preferences: initialPrefs,
  assignments: initialAssignments,
  weekDates: initialWeekDates,
}: Props) {
  const supabase = createClient()
  const [weekDates, setWeekDates] = useState(initialWeekDates)
  const [preferences, setPreferences] = useState(initialPrefs)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [loading, setLoading] = useState(false)
  // Mobile: index of the currently viewed day (0-6)
  const [mobileDayIndex, setMobileDayIndex] = useState(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const idx = initialWeekDates.indexOf(todayStr)
    return idx >= 0 ? idx : 0
  })

  // 週送り
  const navigateWeek = useCallback(async (direction: 'prev' | 'next') => {
    setLoading(true)
    const baseDate = parseISO(weekDates[0])
    const newStart = direction === 'next' ? addDays(baseDate, 7) : subDays(baseDate, 7)
    const newDates: string[] = []
    for (let i = 0; i < 7; i++) {
      newDates.push(format(addDays(newStart, i), 'yyyy-MM-dd'))
    }

    const [prefRes, assignRes] = await Promise.all([
      supabase
        .from('shift_preferences')
        .select('*')
        .gte('target_date', newDates[0])
        .lte('target_date', newDates[6]),
      supabase
        .from('shift_assignments')
        .select('*')
        .gte('target_date', newDates[0])
        .lte('target_date', newDates[6]),
    ])

    setWeekDates(newDates)
    setPreferences((prefRes.data ?? []) as Preference[])
    setAssignments((assignRes.data ?? []) as Assignment[])
    setMobileDayIndex(0)
    setLoading(false)
  }, [weekDates, supabase])

  // シフト割り当てトグル
  const toggleAssignment = useCallback(async (staffId: string, date: string) => {
    const existing = assignments.find(
      (a) => a.staff_id === staffId && a.target_date === date && a.status !== 'cancelled'
    )

    if (existing) {
      await supabase
        .from('shift_assignments')
        .update({ status: 'cancelled' as const })
        .eq('id', existing.id)
      setAssignments((prev) =>
        prev.map((a) => (a.id === existing.id ? { ...a, status: 'cancelled' as const } : a))
      )
    } else {
      const { data } = await supabase
        .from('shift_assignments')
        .insert({
          staff_id: staffId,
          target_date: date,
          status: 'assigned' as const,
          assigned_by: currentStaffId,
        })
        .select()
        .single()
      if (data) {
        setAssignments((prev) => [...prev, data as Assignment])
      }
    }
  }, [assignments, currentStaffId, supabase])

  // 当日呼出
  const callIn = useCallback(async (staffId: string, date: string) => {
    const { data } = await supabase
      .from('shift_assignments')
      .insert({
        staff_id: staffId,
        target_date: date,
        status: 'called_in' as const,
        assigned_by: currentStaffId,
      })
      .select()
      .single()
    if (data) {
      setAssignments((prev) => [...prev, data as Assignment])
    }
  }, [currentStaffId, supabase])

  // 全員割当 (available or preferred staff for a given day)
  const assignAllAvailable = useCallback(async (date: string) => {
    setLoading(true)
    const availableStaffIds = staffList
      .filter((staff) => {
        const pref = preferences.find((p) => p.staff_id === staff.id && p.target_date === date)
        if (!pref) return false
        return pref.preference === 'available' || pref.preference === 'preferred'
      })
      .map((s) => s.id)

    for (const staffId of availableStaffIds) {
      const existing = assignments.find(
        (a) => a.staff_id === staffId && a.target_date === date && a.status !== 'cancelled'
      )
      if (!existing) {
        const { data } = await supabase
          .from('shift_assignments')
          .insert({
            staff_id: staffId,
            target_date: date,
            status: 'assigned' as const,
            assigned_by: currentStaffId,
          })
          .select()
          .single()
        if (data) {
          setAssignments((prev) => [...prev, data as Assignment])
        }
      }
    }
    setLoading(false)
  }, [staffList, preferences, assignments, currentStaffId, supabase])

  // クリア (remove all assignments for a given day)
  const clearDay = useCallback(async (date: string) => {
    setLoading(true)
    const dayAssignments = assignments.filter(
      (a) => a.target_date === date && a.status !== 'cancelled'
    )
    for (const a of dayAssignments) {
      await supabase
        .from('shift_assignments')
        .update({ status: 'cancelled' as const })
        .eq('id', a.id)
    }
    setAssignments((prev) =>
      prev.map((a) =>
        a.target_date === date && a.status !== 'cancelled'
          ? { ...a, status: 'cancelled' as const }
          : a
      )
    )
    setLoading(false)
  }, [assignments, supabase])

  const getPreference = (staffId: string, date: string) =>
    preferences.find((p) => p.staff_id === staffId && p.target_date === date)

  const getAssignment = (staffId: string, date: string) =>
    assignments.find(
      (a) => a.staff_id === staffId && a.target_date === date && a.status !== 'cancelled'
    )

  const getAssignedCount = (date: string) =>
    assignments.filter((a) => a.target_date === date && a.status !== 'cancelled').length

  const today = format(new Date(), 'yyyy-MM-dd')
  const weekLabel = `${format(parseISO(weekDates[0]), 'M/d', { locale: ja })} - ${format(parseISO(weekDates[6]), 'M/d', { locale: ja })}`
  const dayLabels = ['月', '火', '水', '木', '金', '土', '日']

  // Mobile: current day data
  const mobileDate = weekDates[mobileDayIndex]
  const mobileDateLabel = format(parseISO(mobileDate), 'M/d (E)', { locale: ja })
  const mobileIsToday = mobileDate === today
  const mobileAssignedCount = getAssignedCount(mobileDate)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">シフト管理</h1>
        <Link
          href="/shifts/attendance"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          勤怠管理
        </Link>
      </div>

      {/* 凡例 */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-green-500" />
          <span className="text-xs text-gray-400">出勤可</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-400">出勤希望</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-red-500" />
          <span className="text-xs text-gray-400">出勤不可</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded bg-purple-600 text-xs flex items-center justify-center">済</span>
          <span className="text-xs text-gray-400">割当済</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded bg-yellow-600 text-xs flex items-center justify-center">呼</span>
          <span className="text-xs text-gray-400">当日呼出</span>
        </div>
      </div>

      {/* 週ナビ */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateWeek('prev')}
          disabled={loading}
          className="px-3 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          前週
        </button>
        <h2 className="text-lg font-semibold">{weekLabel}</h2>
        <button
          onClick={() => navigateWeek('next')}
          disabled={loading}
          className="px-3 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          翌週
        </button>
      </div>

      {/* ===== Mobile view: one day at a time ===== */}
      <div className="md:hidden space-y-4">
        {/* Day navigation */}
        <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
          <button
            onClick={() => setMobileDayIndex(Math.max(0, mobileDayIndex - 1))}
            disabled={mobileDayIndex === 0}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <div className={`text-lg font-bold ${mobileIsToday ? 'text-blue-400' : ''}`}>
              {mobileDateLabel}
            </div>
            <div className="text-sm text-gray-400">
              {mobileAssignedCount}名割当 / {staffList.length}名中
            </div>
          </div>
          <button
            onClick={() => setMobileDayIndex(Math.min(6, mobileDayIndex + 1))}
            disabled={mobileDayIndex === 6}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Batch operations */}
        <div className="flex gap-2">
          <button
            onClick={() => assignAllAvailable(mobileDate)}
            disabled={loading}
            className="flex-1 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            全員割当
          </button>
          <button
            onClick={() => clearDay(mobileDate)}
            disabled={loading}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            クリア
          </button>
        </div>

        {/* Staff cards */}
        <div className="space-y-2">
          {staffList.map((staff) => {
            const pref = getPreference(staff.id, mobileDate)
            const assignment = getAssignment(staff.id, mobileDate)

            return (
              <div
                key={staff.id}
                className="bg-gray-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{staff.name}</span>
                  <div className="flex items-center gap-2">
                    {/* Preference badge */}
                    {pref ? (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${PREF_COLORS[pref.preference]} text-white`}
                      >
                        {PREF_BADGE_LABELS[pref.preference]}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-500">
                        未回答
                      </span>
                    )}
                    {/* Assignment status badge */}
                    {assignment && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          assignment.status === 'called_in'
                            ? 'bg-yellow-600 text-yellow-100'
                            : 'bg-purple-600 text-purple-100'
                        }`}
                      >
                        {assignment.status === 'called_in' ? '呼出済' : '割当済'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Toggle ON/OFF button */}
                  <button
                    onClick={() => toggleAssignment(staff.id, mobileDate)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                      assignment
                        ? 'bg-purple-600 text-white hover:bg-purple-500'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {assignment ? 'ON - 割当中' : 'OFF - 未割当'}
                  </button>

                  {/* Call-in button for today */}
                  {mobileIsToday && !assignment && (
                    <button
                      onClick={() => callIn(staff.id, mobileDate)}
                      className="px-4 py-3 rounded-xl bg-yellow-700 text-yellow-200 hover:bg-yellow-600 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Phone className="w-4 h-4" />
                      <span className="text-sm font-bold">呼出</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ===== Desktop view: weekly grid table ===== */}
      <div className="hidden md:block bg-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-sm text-gray-400 p-3 w-24">スタッフ</th>
              {weekDates.map((date, i) => {
                const isToday = date === today
                return (
                  <th
                    key={date}
                    className={`text-center text-sm p-2 ${isToday ? 'text-blue-400' : 'text-gray-400'}`}
                  >
                    <div>{dayLabels[i]}</div>
                    <div className="text-xs">{format(parseISO(date), 'M/d')}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {getAssignedCount(date)}名
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => (
              <tr key={staff.id} className="border-b border-gray-700/50 last:border-0">
                <td className="p-3 text-sm font-medium whitespace-nowrap">{staff.name}</td>
                {weekDates.map((date) => {
                  const pref = getPreference(staff.id, date)
                  const assignment = getAssignment(staff.id, date)
                  const isToday = date === today

                  return (
                    <td key={date} className="p-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {/* 希望表示 */}
                        {pref && (
                          <span
                            className={`w-6 h-6 rounded-full ${PREF_COLORS[pref.preference]} flex items-center justify-center text-[10px] font-bold`}
                          >
                            {PREF_LABELS[pref.preference]}
                          </span>
                        )}

                        {/* 割り当て状態 */}
                        {assignment && (
                          <span
                            className={`text-xs px-2 py-1 rounded font-medium ${
                              assignment.status === 'called_in'
                                ? 'bg-yellow-600 text-yellow-100'
                                : 'bg-purple-600 text-purple-100'
                            }`}
                          >
                            {assignment.status === 'called_in' ? '呼出' : '割当'}
                          </span>
                        )}

                        {/* 操作ボタン */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleAssignment(staff.id, date)}
                            className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                              assignment
                                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                          >
                            {assignment ? '解除' : '割当'}
                          </button>
                          {isToday && !assignment && (
                            <button
                              onClick={() => callIn(staff.id, date)}
                              className="text-sm px-3 py-2 rounded-lg bg-yellow-700 text-yellow-200 hover:bg-yellow-600 transition-colors"
                            >
                              呼出
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {staffList.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">スタッフがいません</p>
      )}
    </div>
  )
}
