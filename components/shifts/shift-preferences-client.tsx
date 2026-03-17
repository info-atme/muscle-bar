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

type Preference = {
  id: string
  staff_id: string
  target_date: string
  preference: 'available' | 'preferred' | 'unavailable'
}

type Props = {
  staffId: string
  staffName: string
  preferences: Preference[]
}

const PREFERENCE_CYCLE: ('available' | 'preferred' | 'unavailable' | null)[] = [
  'available',
  'preferred',
  'unavailable',
  null,
]

const PREFERENCE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  available: { label: '出勤可', bg: 'bg-green-600', text: 'text-green-300' },
  preferred: { label: '出勤希望', bg: 'bg-blue-600', text: 'text-blue-300' },
  unavailable: { label: '出勤不可', bg: 'bg-red-600', text: 'text-red-300' },
}

export function ShiftPreferencesClient({ staffId, staffName, preferences: initialPrefs }: Props) {
  const supabase = createClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [preferences, setPreferences] = useState<Map<string, Preference>>(
    new Map(initialPrefs.map((p) => [p.target_date, p]))
  )
  const [saving, setSaving] = useState(false)

  // カレンダーの日付グリッド生成
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: Date[] = []
    let day = calStart
    while (day <= calEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  const handleDateTap = useCallback(async (date: Date) => {
    if (!isSameMonth(date, currentMonth)) return

    const dateStr = format(date, 'yyyy-MM-dd')
    const current = preferences.get(dateStr)
    const currentPref = current?.preference ?? null
    const currentIdx = PREFERENCE_CYCLE.indexOf(currentPref)
    const nextPref = PREFERENCE_CYCLE[(currentIdx + 1) % PREFERENCE_CYCLE.length]

    setSaving(true)

    if (nextPref === null) {
      // 削除
      if (current) {
        await supabase.from('shift_preferences').delete().eq('id', current.id)
        setPreferences((prev) => {
          const next = new Map(prev)
          next.delete(dateStr)
          return next
        })
      }
    } else if (current) {
      // 更新
      const { data } = await supabase
        .from('shift_preferences')
        .update({ preference: nextPref, updated_at: new Date().toISOString() })
        .eq('id', current.id)
        .select()
        .single()
      if (data) {
        setPreferences((prev) => new Map(prev).set(dateStr, data as Preference))
      }
    } else {
      // 新規作成
      const { data } = await supabase
        .from('shift_preferences')
        .insert({ staff_id: staffId, target_date: dateStr, preference: nextPref })
        .select()
        .single()
      if (data) {
        setPreferences((prev) => new Map(prev).set(dateStr, data as Preference))
      }
    }

    setSaving(false)
  }, [currentMonth, preferences, staffId, supabase])

  const weekDays = ['月', '火', '水', '木', '金', '土', '日']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">シフト希望</h1>
        <span className="text-sm text-gray-400">{staffName}</span>
      </div>

      {/* 凡例 */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(PREFERENCE_LABELS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${val.bg}`} />
            <span className="text-xs text-gray-400">{val.label}</span>
          </div>
        ))}
      </div>

      {/* 月ナビ */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="px-3 py-1 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 transition-colors"
        >
          前月
        </button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'yyyy年M月', { locale: ja })}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="px-3 py-1 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 transition-colors"
        >
          翌月
        </button>
      </div>

      {/* カレンダーグリッド */}
      <div className="bg-gray-800 rounded-xl p-3">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((d) => (
            <div key={d} className="text-center text-xs text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* 日付 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const pref = preferences.get(dateStr)
            const isCurrentMonth = isSameMonth(date, currentMonth)
            const isToday = isSameDay(date, new Date())
            const prefStyle = pref ? PREFERENCE_LABELS[pref.preference] : null

            return (
              <button
                key={dateStr}
                onClick={() => handleDateTap(date)}
                disabled={!isCurrentMonth || saving}
                className={`
                  aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-colors
                  ${!isCurrentMonth ? 'text-gray-700 cursor-default' : 'hover:bg-gray-700 active:bg-gray-600'}
                  ${isToday ? 'ring-1 ring-blue-500' : ''}
                  ${prefStyle ? prefStyle.bg + '/20' : ''}
                `}
              >
                <span className={isCurrentMonth ? 'text-white' : 'text-gray-700'}>
                  {format(date, 'd')}
                </span>
                {prefStyle && isCurrentMonth && (
                  <span className={`text-[10px] leading-none ${prefStyle.text}`}>
                    {prefStyle.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 操作説明 */}
      <p className="text-xs text-gray-500 text-center">
        日付をタップして希望を切り替えます
      </p>
    </div>
  )
}
