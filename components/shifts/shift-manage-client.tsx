'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Phone, ArrowLeftRight, X, Users } from 'lucide-react'

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
  monthStart: string
  monthEnd: string
}

const PREF_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  preferred: 'bg-blue-500',
  unavailable: 'bg-red-500',
}

const PREF_LABELS: Record<string, string> = {
  available: '出勤可',
  preferred: '希望',
  unavailable: '不可',
}

const PREF_TEXT_COLORS: Record<string, string> = {
  available: 'text-green-400',
  preferred: 'text-blue-400',
  unavailable: 'text-red-400',
}

// Stable color palette for staff initials on calendar cells
const STAFF_COLORS = [
  'bg-blue-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-yellow-600',
  'bg-pink-600',
  'bg-teal-600',
  'bg-orange-600',
  'bg-indigo-600',
  'bg-rose-600',
  'bg-cyan-600',
]

export function ShiftManageClient({
  currentStaffId,
  staffList,
  preferences: initialPrefs,
  assignments: initialAssignments,
  monthStart,
  monthEnd,
}: Props) {
  const supabase = createClient()
  const [currentMonth, setCurrentMonth] = useState(() => parseISO(monthStart))
  const [preferences, setPreferences] = useState(initialPrefs)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [swapStaffId, setSwapStaffId] = useState<string | null>(null)

  // Staff color map (stable by index)
  const staffColorMap = useMemo(() => {
    const map = new Map<string, string>()
    staffList.forEach((s, i) => {
      map.set(s.id, STAFF_COLORS[i % STAFF_COLORS.length])
    })
    return map
  }, [staffList])

  // Staff name map
  const staffNameMap = useMemo(() => {
    const map = new Map<string, string>()
    staffList.forEach((s) => map.set(s.id, s.name))
    return map
  }, [staffList])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthS = startOfMonth(currentMonth)
    const monthE = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthS, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthE, { weekStartsOn: 1 })
    const days: Date[] = []
    let day = calStart
    while (day <= calEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  // Navigate month
  const navigateMonth = useCallback(async (direction: 'prev' | 'next') => {
    setLoading(true)
    const newMonth = direction === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1)
    const newStart = format(startOfMonth(newMonth), 'yyyy-MM-dd')
    const newEnd = format(endOfMonth(newMonth), 'yyyy-MM-dd')

    const [prefRes, assignRes] = await Promise.all([
      supabase
        .from('shift_preferences')
        .select('*')
        .gte('target_date', newStart)
        .lte('target_date', newEnd),
      supabase
        .from('shift_assignments')
        .select('*')
        .gte('target_date', newStart)
        .lte('target_date', newEnd),
    ])

    setCurrentMonth(newMonth)
    setPreferences((prefRes.data ?? []) as Preference[])
    setAssignments((assignRes.data ?? []) as Assignment[])
    setSelectedDate(null)
    setSwapStaffId(null)
    setLoading(false)
  }, [currentMonth, supabase])

  // Toggle assignment
  const toggleAssignment = useCallback(async (staffId: string, date: string) => {
    const existing = assignments.find(
      (a) => a.staff_id === staffId && a.target_date === date && a.status !== 'cancelled'
    )

    if (existing) {
      // Optimistic
      setAssignments((prev) =>
        prev.map((a) => (a.id === existing.id ? { ...a, status: 'cancelled' as const } : a))
      )
      await supabase
        .from('shift_assignments')
        .update({ status: 'cancelled' as const })
        .eq('id', existing.id)
    } else {
      const optimisticId = `optimistic-${Date.now()}-${staffId}`
      const optimistic: Assignment = {
        id: optimisticId,
        staff_id: staffId,
        target_date: date,
        status: 'assigned',
        assigned_by: currentStaffId,
      }
      setAssignments((prev) => [...prev, optimistic])

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
        setAssignments((prev) =>
          prev.map((a) => (a.id === optimisticId ? (data as Assignment) : a))
        )
      }
    }
  }, [assignments, currentStaffId, supabase])

  // Call in
  const callIn = useCallback(async (staffId: string, date: string) => {
    const optimisticId = `optimistic-callin-${Date.now()}-${staffId}`
    const optimistic: Assignment = {
      id: optimisticId,
      staff_id: staffId,
      target_date: date,
      status: 'called_in',
      assigned_by: currentStaffId,
    }
    setAssignments((prev) => [...prev, optimistic])

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
      setAssignments((prev) =>
        prev.map((a) => (a.id === optimisticId ? (data as Assignment) : a))
      )
    }
  }, [currentStaffId, supabase])

  // Assign all available
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

  // Clear day
  const clearDay = useCallback(async (date: string) => {
    setLoading(true)
    const dayAssignments = assignments.filter(
      (a) => a.target_date === date && a.status !== 'cancelled'
    )
    // Optimistic
    setAssignments((prev) =>
      prev.map((a) =>
        a.target_date === date && a.status !== 'cancelled'
          ? { ...a, status: 'cancelled' as const }
          : a
      )
    )
    for (const a of dayAssignments) {
      await supabase
        .from('shift_assignments')
        .update({ status: 'cancelled' as const })
        .eq('id', a.id)
    }
    setLoading(false)
  }, [assignments, supabase])

  // Swap staff
  const swapStaff = useCallback(async (originalStaffId: string, newStaffId: string, date: string) => {
    // Cancel original
    const original = assignments.find(
      (a) => a.staff_id === originalStaffId && a.target_date === date && a.status !== 'cancelled'
    )
    if (original) {
      setAssignments((prev) =>
        prev.map((a) => (a.id === original.id ? { ...a, status: 'cancelled' as const } : a))
      )
      await supabase
        .from('shift_assignments')
        .update({ status: 'cancelled' as const })
        .eq('id', original.id)
    }
    // Assign new
    const { data } = await supabase
      .from('shift_assignments')
      .insert({
        staff_id: newStaffId,
        target_date: date,
        status: 'assigned' as const,
        assigned_by: currentStaffId,
      })
      .select()
      .single()
    if (data) {
      setAssignments((prev) => [...prev, data as Assignment])
    }
    setSwapStaffId(null)
  }, [assignments, currentStaffId, supabase])

  // Helpers
  const getPreference = (staffId: string, date: string) =>
    preferences.find((p) => p.staff_id === staffId && p.target_date === date)

  const getAssignment = (staffId: string, date: string) =>
    assignments.find(
      (a) => a.staff_id === staffId && a.target_date === date && a.status !== 'cancelled'
    )

  const getAssignedStaff = (date: string) =>
    assignments
      .filter((a) => a.target_date === date && a.status !== 'cancelled')
      .map((a) => a.staff_id)

  const getAssignedCount = (date: string) =>
    assignments.filter((a) => a.target_date === date && a.status !== 'cancelled').length

  const today = format(new Date(), 'yyyy-MM-dd')
  const weekDays = ['月', '火', '水', '木', '金', '土', '日']

  // Selected date details
  const selectedDateObj = selectedDate ? parseISO(selectedDate) : null
  const selectedDateLabel = selectedDateObj
    ? format(selectedDateObj, 'M月d日 (E)', { locale: ja })
    : ''
  const isSelectedToday = selectedDate === today

  // Sort staff for selected date: available/preferred first, unavailable last
  const sortedStaffForDate = useMemo(() => {
    if (!selectedDate) return staffList
    return [...staffList].sort((a, b) => {
      const prefA = getPreference(a.id, selectedDate)
      const prefB = getPreference(b.id, selectedDate)
      const order = (p: Preference | undefined) => {
        if (!p) return 2
        if (p.preference === 'preferred') return 0
        if (p.preference === 'available') return 1
        return 3
      }
      return order(prefA) - order(prefB)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, staffList, preferences])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">シフト管理</h1>
        <Link
          href="/shifts/attendance"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          勤怠管理
        </Link>
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-400">出勤可</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-gray-400">希望</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-400">不可</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-purple-600" />
          <span className="text-gray-400">割当済</span>
        </div>
      </div>

      {/* Layout: Calendar + Detail panel */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigateMonth('prev')}
              disabled={loading}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">
              {format(currentMonth, 'yyyy年M月', { locale: ja })}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              disabled={loading}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="bg-gray-800 rounded-xl p-2">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-0.5">
              {weekDays.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-xs py-1 font-medium ${
                    i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-gray-500'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd')
                const isCurrentMonth = isSameMonth(date, currentMonth)
                const isToday = isSameDay(date, new Date())
                const isSelected = selectedDate === dateStr
                const assignedIds = getAssignedStaff(dateStr)
                const assignedCount = assignedIds.length

                return (
                  <button
                    key={dateStr}
                    onClick={() => {
                      if (isCurrentMonth) {
                        setSelectedDate(dateStr)
                        setSwapStaffId(null)
                      }
                    }}
                    disabled={!isCurrentMonth}
                    className={`
                      min-h-[52px] md:min-h-[64px] rounded-lg flex flex-col items-center py-1 px-0.5 transition-all relative
                      ${!isCurrentMonth ? 'opacity-20 cursor-default' : 'hover:bg-gray-700/50 cursor-pointer'}
                      ${isToday ? 'ring-2 ring-blue-500' : ''}
                      ${isSelected ? 'bg-gray-700 ring-2 ring-purple-500' : ''}
                    `}
                  >
                    {/* Date number */}
                    <span
                      className={`text-xs font-medium leading-none ${
                        isToday ? 'text-blue-400 font-bold' : isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      {format(date, 'd')}
                    </span>

                    {/* Staff initials */}
                    {isCurrentMonth && assignedCount > 0 && (
                      <div className="flex flex-wrap justify-center gap-[2px] mt-1 max-w-full">
                        {assignedIds.slice(0, 4).map((sid) => {
                          const name = staffNameMap.get(sid) ?? '?'
                          const color = staffColorMap.get(sid) ?? 'bg-gray-600'
                          return (
                            <span
                              key={sid}
                              className={`w-5 h-5 md:w-[18px] md:h-[18px] rounded-full ${color} text-[9px] font-bold flex items-center justify-center text-white leading-none`}
                              title={name}
                            >
                              {name.charAt(0)}
                            </span>
                          )
                        })}
                        {assignedCount > 4 && (
                          <span className="text-[9px] text-gray-400 leading-none self-center">
                            +{assignedCount - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Count badge */}
                    {isCurrentMonth && assignedCount > 0 && (
                      <span className="text-[9px] text-gray-500 mt-0.5 leading-none">
                        {assignedCount}名
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Day Detail Panel - Side panel on desktop */}
        {selectedDate && (
          <div className="hidden md:block w-80 flex-shrink-0">
            <DayDetailPanel
              date={selectedDate}
              dateLabel={selectedDateLabel}
              isToday={isSelectedToday}
              staffList={sortedStaffForDate}
              getPreference={getPreference}
              getAssignment={getAssignment}
              getAssignedCount={getAssignedCount}
              toggleAssignment={toggleAssignment}
              callIn={callIn}
              assignAllAvailable={assignAllAvailable}
              clearDay={clearDay}
              swapStaffId={swapStaffId}
              setSwapStaffId={setSwapStaffId}
              swapStaff={swapStaff}
              staffNameMap={staffNameMap}
              staffColorMap={staffColorMap}
              assignments={assignments}
              loading={loading}
              onClose={() => {
                setSelectedDate(null)
                setSwapStaffId(null)
              }}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {selectedDate && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setSelectedDate(null)
              setSwapStaffId(null)
            }}
          />
          {/* Sheet */}
          <div className="relative bg-gray-900 rounded-t-2xl max-h-[80vh] flex flex-col animate-slide-up">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            <div className="overflow-y-auto p-4">
              <DayDetailPanel
                date={selectedDate}
                dateLabel={selectedDateLabel}
                isToday={isSelectedToday}
                staffList={sortedStaffForDate}
                getPreference={getPreference}
                getAssignment={getAssignment}
                getAssignedCount={getAssignedCount}
                toggleAssignment={toggleAssignment}
                callIn={callIn}
                assignAllAvailable={assignAllAvailable}
                clearDay={clearDay}
                swapStaffId={swapStaffId}
                setSwapStaffId={setSwapStaffId}
                swapStaff={swapStaff}
                staffNameMap={staffNameMap}
                staffColorMap={staffColorMap}
                assignments={assignments}
                loading={loading}
                onClose={() => {
                  setSelectedDate(null)
                  setSwapStaffId(null)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {staffList.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">スタッフがいません</p>
      )}
    </div>
  )
}

// Day Detail Panel component
function DayDetailPanel({
  date,
  dateLabel,
  isToday,
  staffList,
  getPreference,
  getAssignment,
  getAssignedCount,
  toggleAssignment,
  callIn,
  assignAllAvailable,
  clearDay,
  swapStaffId,
  setSwapStaffId,
  swapStaff,
  staffNameMap,
  staffColorMap,
  assignments,
  loading,
  onClose,
}: {
  date: string
  dateLabel: string
  isToday: boolean
  staffList: Staff[]
  getPreference: (staffId: string, date: string) => Preference | undefined
  getAssignment: (staffId: string, date: string) => Assignment | undefined
  getAssignedCount: (date: string) => number
  toggleAssignment: (staffId: string, date: string) => Promise<void>
  callIn: (staffId: string, date: string) => Promise<void>
  assignAllAvailable: (date: string) => Promise<void>
  clearDay: (date: string) => Promise<void>
  swapStaffId: string | null
  setSwapStaffId: (id: string | null) => void
  swapStaff: (originalStaffId: string, newStaffId: string, date: string) => Promise<void>
  staffNameMap: Map<string, string>
  staffColorMap: Map<string, string>
  assignments: Assignment[]
  loading: boolean
  onClose: () => void
}) {
  const assignedCount = getAssignedCount(date)

  // Staff available for swap (not currently assigned)
  const swapCandidates = staffList.filter((s) => {
    const a = getAssignment(s.id, date)
    return !a // not currently assigned
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-bold ${isToday ? 'text-blue-400' : ''}`}>
            {dateLabel}
          </h3>
          <p className="text-sm text-gray-400">
            {assignedCount}名割当 / {staffList.length}名中
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Batch operations */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium">一括操作</p>
        <div className="flex gap-2">
          <button
            onClick={() => assignAllAvailable(date)}
            disabled={loading}
            className="flex-1 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            <Users className="w-4 h-4" />
            希望者を全員割当
          </button>
          <button
            onClick={() => clearDay(date)}
            disabled={loading}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            クリア
          </button>
        </div>
        {isToday && (
          <p className="text-xs text-yellow-500 flex items-center gap-1">
            <Phone className="w-3 h-3" />
            本日 - 当日呼出が可能です
          </p>
        )}
      </div>

      {/* Swap picker (shown when swap is active) */}
      {swapStaffId && (
        <div className="bg-gray-800 rounded-xl p-3 border border-yellow-600/50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-yellow-400">
              入替先を選択: {staffNameMap.get(swapStaffId)}
            </p>
            <button
              onClick={() => setSwapStaffId(null)}
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              キャンセル
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {swapCandidates.length === 0 ? (
              <p className="text-xs text-gray-500 py-2 text-center">候補なし</p>
            ) : (
              swapCandidates.map((s) => {
                const pref = getPreference(s.id, date)
                return (
                  <button
                    key={s.id}
                    onClick={() => swapStaff(swapStaffId, s.id, date)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <span className="text-sm">{s.name}</span>
                    {pref ? (
                      <span className={`text-xs ${PREF_TEXT_COLORS[pref.preference]}`}>
                        {PREF_LABELS[pref.preference]}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">未回答</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Preference overview */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium">希望状況</p>
        <div className="flex flex-wrap gap-1">
          {staffList.map((staff) => {
            const pref = getPreference(staff.id, date)
            let dotColor = 'bg-gray-600'
            let label = '未回答'
            if (pref) {
              dotColor = PREF_COLORS[pref.preference]
              label = PREF_LABELS[pref.preference]
            }
            return (
              <div
                key={staff.id}
                className="flex items-center gap-1 bg-gray-800 rounded-full px-2 py-1"
                title={`${staff.name}: ${label}`}
              >
                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                <span className="text-xs text-gray-300">{staff.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Shift assignment toggles */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium">シフト割当</p>
        <div className="space-y-1.5">
          {staffList.map((staff) => {
            const pref = getPreference(staff.id, date)
            const assignment = getAssignment(staff.id, date)
            const isUnavailable = pref?.preference === 'unavailable'

            return (
              <div
                key={staff.id}
                className={`flex items-center gap-2 p-2.5 rounded-xl transition-colors ${
                  isUnavailable && !assignment ? 'bg-gray-800/50 opacity-60' : 'bg-gray-800'
                }`}
              >
                {/* Staff name + preference */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{staff.name}</span>
                    {pref ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PREF_COLORS[pref.preference]} text-white flex-shrink-0`}
                      >
                        {PREF_LABELS[pref.preference]}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-500 flex-shrink-0">
                        未回答
                      </span>
                    )}
                    {assignment?.status === 'called_in' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-600 text-yellow-100 flex-shrink-0">
                        呼出
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Swap button (only for assigned staff) */}
                  {assignment && (
                    <button
                      onClick={() => setSwapStaffId(staff.id)}
                      className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                      title="入替"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-yellow-400" />
                    </button>
                  )}

                  {/* Toggle */}
                  <button
                    onClick={() => toggleAssignment(staff.id, date)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      assignment ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        assignment ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  {/* Call-in (today only, unassigned) */}
                  {isToday && !assignment && (
                    <button
                      onClick={() => callIn(staff.id, date)}
                      className="p-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 transition-colors"
                      title="当日呼出"
                    >
                      <Phone className="w-3.5 h-3.5 text-yellow-200" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
