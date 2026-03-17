'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

type Staff = { id: string; name: string; role: 'owner' | 'manager' | 'staff' }
type StaffBasic = { id: string; name: string }

type AttendanceRecord = {
  id: string
  staff_id: string
  target_date: string
  clock_in: string | null
  clock_out: string | null
  status: 'working' | 'completed' | 'absent' | 'late'
}

type Props = {
  currentStaff: Staff
  staffList: StaffBasic[]
  attendanceData: AttendanceRecord[]
  today: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  working: { label: '勤務中', color: 'bg-green-600 text-green-100' },
  completed: { label: '退勤済', color: 'bg-gray-600 text-gray-300' },
  absent: { label: '欠勤', color: 'bg-red-600 text-red-100' },
  late: { label: '遅刻', color: 'bg-yellow-600 text-yellow-100' },
}

export function AttendanceClient({ currentStaff, staffList, attendanceData: initialData, today }: Props) {
  const supabase = createClient()
  const isManager = currentStaff.role === 'owner' || currentStaff.role === 'manager'
  const [selectedDate, setSelectedDate] = useState(today)
  const [attendance, setAttendance] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const myAttendance = attendance.find(
    (a) => a.staff_id === currentStaff.id && a.target_date === selectedDate
  )

  // 日付変更時のデータ再取得
  const changeDate = useCallback(async (date: string) => {
    setSelectedDate(date)
    setLoading(true)

    const query = isManager
      ? supabase.from('attendance').select('*').eq('target_date', date)
      : supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', currentStaff.id)
          .eq('target_date', date)

    const { data } = await query
    setAttendance((data ?? []) as AttendanceRecord[])
    setLoading(false)
  }, [isManager, currentStaff.id, supabase])

  // 出勤打刻
  const clockIn = useCallback(async () => {
    setLoading(true)
    const now = new Date().toISOString()

    if (myAttendance) {
      const { data } = await supabase
        .from('attendance')
        .update({ clock_in: now, status: 'working' as const, updated_at: now })
        .eq('id', myAttendance.id)
        .select()
        .single()
      if (data) {
        setAttendance((prev) =>
          prev.map((a) => (a.id === myAttendance.id ? (data as AttendanceRecord) : a))
        )
      }
    } else {
      const { data } = await supabase
        .from('attendance')
        .insert({
          staff_id: currentStaff.id,
          target_date: selectedDate,
          clock_in: now,
          status: 'working' as const,
        })
        .select()
        .single()
      if (data) {
        setAttendance((prev) => [...prev, data as AttendanceRecord])
      }
    }
    setLoading(false)
  }, [myAttendance, currentStaff.id, selectedDate, supabase])

  // 退勤打刻
  const clockOut = useCallback(async () => {
    if (!myAttendance) return
    setLoading(true)
    const now = new Date().toISOString()

    const { data } = await supabase
      .from('attendance')
      .update({ clock_out: now, status: 'completed' as const, updated_at: now })
      .eq('id', myAttendance.id)
      .select()
      .single()
    if (data) {
      setAttendance((prev) =>
        prev.map((a) => (a.id === myAttendance.id ? (data as AttendanceRecord) : a))
      )
    }
    setLoading(false)
  }, [myAttendance, supabase])

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--'
    try {
      return format(parseISO(iso), 'HH:mm')
    } catch {
      return '--:--'
    }
  }

  const isToday = selectedDate === today

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">勤怠管理</h1>
        <span className="text-sm text-gray-400">{currentStaff.name}</span>
      </div>

      {/* 日付選択 */}
      <div className="bg-gray-800 rounded-xl p-4">
        <label className="block text-sm text-gray-400 mb-2">日付</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => changeDate(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* スタッフ自身の打刻ボタン */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">
          {isToday ? '本日の打刻' : format(parseISO(selectedDate), 'M月d日', { locale: ja }) + 'の勤怠'}
        </h2>

        {myAttendance && (
          <div className="flex items-center gap-4 mb-4">
            <div>
              <span className="text-xs text-gray-500">出勤</span>
              <p className="text-lg font-mono">{formatTime(myAttendance.clock_in)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">退勤</span>
              <p className="text-lg font-mono">{formatTime(myAttendance.clock_out)}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_LABELS[myAttendance.status]?.color ?? 'bg-gray-600'}`}>
              {STATUS_LABELS[myAttendance.status]?.label ?? myAttendance.status}
            </span>
          </div>
        )}

        {isToday && (
          <div className="flex gap-3">
            <button
              onClick={clockIn}
              disabled={loading || (myAttendance?.status === 'working') || (myAttendance?.status === 'completed')}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-lg font-bold transition-colors"
            >
              出勤
            </button>
            <button
              onClick={clockOut}
              disabled={loading || !myAttendance || myAttendance.status !== 'working'}
              className="flex-1 py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-lg font-bold transition-colors"
            >
              退勤
            </button>
          </div>
        )}

        {!isToday && !myAttendance && (
          <p className="text-gray-500 text-sm text-center py-2">記録がありません</p>
        )}
      </div>

      {/* マネージャー用：全スタッフ一覧 */}
      {isManager && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">
            スタッフ勤怠 ({format(parseISO(selectedDate), 'M/d', { locale: ja })})
          </h2>

          {loading && (
            <p className="text-gray-500 text-sm text-center py-4">読み込み中...</p>
          )}

          <div className="space-y-2">
            {staffList.map((staff) => {
              const record = attendance.find(
                (a) => a.staff_id === staff.id && a.target_date === selectedDate
              )

              return (
                <div
                  key={staff.id}
                  className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                >
                  <span className="text-sm font-medium">{staff.name}</span>
                  <div className="flex items-center gap-3">
                    {record ? (
                      <>
                        <span className="text-xs text-gray-400 font-mono">
                          {formatTime(record.clock_in)} - {formatTime(record.clock_out)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_LABELS[record.status]?.color ?? 'bg-gray-600'}`}>
                          {STATUS_LABELS[record.status]?.label ?? record.status}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-600">未打刻</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {staffList.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">スタッフがいません</p>
          )}
        </div>
      )}
    </div>
  )
}
