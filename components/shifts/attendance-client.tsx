'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react'

type Staff = { id: string; name: string; role: 'owner' | 'manager' | 'staff' }
type StaffBasic = { id: string; name: string }

type AttendanceRecord = {
  id: string
  staff_id: string
  target_date: string
  clock_in: string | null
  clock_out: string | null
  status: 'working' | 'completed' | 'absent' | 'late'
  approved: boolean
  approved_by: string | null
  photo_url: string | null
  note: string | null
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
  const [editModal, setEditModal] = useState<AttendanceRecord | null>(null)
  const [editClockIn, setEditClockIn] = useState('')
  const [editClockOut, setEditClockOut] = useState('')
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Live clock update every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const myAttendance = attendance.find(
    (a) => a.staff_id === currentStaff.id && a.target_date === selectedDate
  )

  // Navigate prev/next day
  const navigateDay = useCallback(async (direction: 'prev' | 'next') => {
    const current = parseISO(selectedDate)
    const newDate = direction === 'next' ? addDays(current, 1) : subDays(current, 1)
    const newDateStr = format(newDate, 'yyyy-MM-dd')
    setSelectedDate(newDateStr)
    setLoading(true)

    const query = isManager
      ? supabase.from('attendance').select('*').eq('target_date', newDateStr)
      : supabase
          .from('attendance')
          .select('*')
          .eq('staff_id', currentStaff.id)
          .eq('target_date', newDateStr)

    const { data } = await query
    setAttendance((data ?? []) as AttendanceRecord[])
    setLoading(false)
  }, [selectedDate, isManager, currentStaff.id, supabase])

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

  // 承認
  const approveRecord = useCallback(async (recordId: string) => {
    setLoading(true)
    const now = new Date().toISOString()

    const { data } = await supabase
      .from('attendance')
      .update({ approved: true, approved_by: currentStaff.id, updated_at: now })
      .eq('id', recordId)
      .select()
      .single()

    if (data) {
      await supabase.from('attendance_log').insert({
        attendance_id: recordId,
        action: 'approve',
        changed_by: currentStaff.id,
        old_values: { approved: false },
        new_values: { approved: true },
      })
      setAttendance((prev) =>
        prev.map((a) => (a.id === recordId ? (data as AttendanceRecord) : a))
      )
    }
    setLoading(false)
  }, [currentStaff.id, supabase])

  // 一括承認
  const approveAll = useCallback(async () => {
    setLoading(true)
    const now = new Date().toISOString()
    const unapproved = attendance.filter(
      (a) => a.target_date === selectedDate && !a.approved
    )

    for (const record of unapproved) {
      await supabase
        .from('attendance')
        .update({ approved: true, approved_by: currentStaff.id, updated_at: now })
        .eq('id', record.id)

      await supabase.from('attendance_log').insert({
        attendance_id: record.id,
        action: 'approve',
        changed_by: currentStaff.id,
        old_values: { approved: false },
        new_values: { approved: true },
      })
    }

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('target_date', selectedDate)
    setAttendance((data ?? []) as AttendanceRecord[])
    setLoading(false)
  }, [attendance, selectedDate, currentStaff.id, supabase])

  // 編集モーダルを開く
  const openEditModal = useCallback((record: AttendanceRecord) => {
    setEditModal(record)
    setEditClockIn(record.clock_in ? format(parseISO(record.clock_in), "yyyy-MM-dd'T'HH:mm") : '')
    setEditClockOut(record.clock_out ? format(parseISO(record.clock_out), "yyyy-MM-dd'T'HH:mm") : '')
  }, [])

  // 編集を保存
  const saveEdit = useCallback(async () => {
    if (!editModal) return
    setLoading(true)
    const now = new Date().toISOString()

    const oldValues = {
      clock_in: editModal.clock_in,
      clock_out: editModal.clock_out,
    }

    const newClockIn = editClockIn ? new Date(editClockIn).toISOString() : null
    const newClockOut = editClockOut ? new Date(editClockOut).toISOString() : null

    const { data } = await supabase
      .from('attendance')
      .update({
        clock_in: newClockIn,
        clock_out: newClockOut,
        updated_at: now,
      })
      .eq('id', editModal.id)
      .select()
      .single()

    if (data) {
      await supabase.from('attendance_log').insert({
        attendance_id: editModal.id,
        action: 'edit',
        changed_by: currentStaff.id,
        old_values: oldValues,
        new_values: { clock_in: newClockIn, clock_out: newClockOut },
      })
      setAttendance((prev) =>
        prev.map((a) => (a.id === editModal.id ? (data as AttendanceRecord) : a))
      )
    }
    setEditModal(null)
    setLoading(false)
  }, [editModal, editClockIn, editClockOut, currentStaff.id, supabase])

  // ステータス変更（欠勤・遅刻）
  const setStatus = useCallback(async (recordId: string, status: 'absent' | 'late') => {
    setLoading(true)
    const now = new Date().toISOString()
    const record = attendance.find((a) => a.id === recordId)

    const { data } = await supabase
      .from('attendance')
      .update({ status, updated_at: now })
      .eq('id', recordId)
      .select()
      .single()

    if (data) {
      await supabase.from('attendance_log').insert({
        attendance_id: recordId,
        action: 'edit',
        changed_by: currentStaff.id,
        old_values: { status: record?.status },
        new_values: { status },
      })
      setAttendance((prev) =>
        prev.map((a) => (a.id === recordId ? (data as AttendanceRecord) : a))
      )
    }
    setLoading(false)
  }, [attendance, currentStaff.id, supabase])

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--'
    try {
      return format(parseISO(iso), 'HH:mm')
    } catch {
      return '--:--'
    }
  }

  const isToday = selectedDate === today
  const hasUnapproved = attendance.some(
    (a) => a.target_date === selectedDate && !a.approved
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">勤怠管理</h1>
        <span className="text-sm text-gray-400">{currentStaff.name}</span>
      </div>

      {/* Live clock */}
      {isToday && (
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-4xl font-mono font-bold tracking-wider">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {format(currentTime, 'yyyy年M月d日 (E)', { locale: ja })}
          </div>
        </div>
      )}

      {/* 日付選択 with prev/next arrows */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigateDay('prev')}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => changeDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => navigateDay('next')}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
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
            {myAttendance.approved ? (
              <span className="text-green-400 text-sm" title="承認済">&#10003; 承認済</span>
            ) : (
              <span className="text-yellow-400 text-sm" title="未承認">&#9679; 未承認</span>
            )}
          </div>
        )}

        {isToday && (
          <div className="flex gap-3">
            <button
              onClick={clockIn}
              disabled={loading || (myAttendance?.status === 'working') || (myAttendance?.status === 'completed')}
              className="flex-1 py-6 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-6 h-6" />
              出勤
            </button>
            <button
              onClick={clockOut}
              disabled={loading || !myAttendance || myAttendance.status !== 'working'}
              className="flex-1 py-6 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-6 h-6" />
              退勤
            </button>
          </div>
        )}

        {!isToday && !myAttendance && (
          <p className="text-gray-500 text-sm text-center py-2">記録がありません</p>
        )}
      </div>

      {/* マネージャー用：全スタッフ カードレイアウト */}
      {isManager && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400">
              スタッフ勤怠 ({format(parseISO(selectedDate), 'M/d', { locale: ja })})
            </h2>
            {hasUnapproved && (
              <button
                onClick={approveAll}
                disabled={loading}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
              >
                一括承認
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 mb-3">
            ※ 承認済の勤怠のみ給与計算に反映されます
          </p>

          {loading && (
            <p className="text-gray-500 text-sm text-center py-4">読み込み中...</p>
          )}

          <div className="space-y-3">
            {staffList.map((staff) => {
              const record = attendance.find(
                (a) => a.staff_id === staff.id && a.target_date === selectedDate
              )

              return (
                <div
                  key={staff.id}
                  className="bg-gray-800 rounded-xl p-4 space-y-3"
                >
                  {/* Header: name + status badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Photo thumbnail */}
                      {record?.photo_url ? (
                        <button
                          onClick={() => setPhotoModal(record.photo_url)}
                          className="w-10 h-10 rounded-lg overflow-hidden border border-gray-600 flex-shrink-0"
                          title="写真を表示"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={record.photo_url}
                            alt="出勤写真"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-500 text-xs">No</span>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium">{staff.name}</span>
                        {record && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {record.approved ? (
                              <span className="text-green-400 text-[10px]">&#10003; 承認済</span>
                            ) : (
                              <span className="text-yellow-400 text-[10px]">&#9679; 未承認</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      {record ? (
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_LABELS[record.status]?.color ?? 'bg-gray-600'}`}>
                          {STATUS_LABELS[record.status]?.label ?? record.status}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-500">未打刻</span>
                      )}
                    </div>
                  </div>

                  {/* Clock-in / Clock-out times */}
                  {record && (
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-gray-500">出勤</span>
                        <span className="font-mono">{formatTime(record.clock_in)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-gray-500">退勤</span>
                        <span className="font-mono">{formatTime(record.clock_out)}</span>
                      </div>
                    </div>
                  )}

                  {record?.note && (
                    <p className="text-xs text-gray-500">{record.note}</p>
                  )}

                  {/* Action buttons */}
                  {record && (
                    <div className="flex flex-wrap gap-2">
                      {!record.approved && (
                        <button
                          onClick={() => approveRecord(record.id)}
                          disabled={loading}
                          className="px-3 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
                        >
                          承認
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(record)}
                        disabled={loading}
                        className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => setStatus(record.id, 'absent')}
                        disabled={loading || record.status === 'absent'}
                        className="px-3 py-2 bg-red-800 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm transition-colors"
                      >
                        欠勤
                      </button>
                      <button
                        onClick={() => setStatus(record.id, 'late')}
                        disabled={loading || record.status === 'late'}
                        className="px-3 py-2 bg-yellow-800 hover:bg-yellow-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm transition-colors"
                      >
                        遅刻
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {staffList.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">スタッフがいません</p>
          )}
        </div>
      )}

      {/* 編集モーダル */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold">勤怠編集</h3>
            <p className="text-sm text-gray-400">
              {staffList.find((s) => s.id === editModal.staff_id)?.name ?? '不明'} - {editModal.target_date}
            </p>

            <div>
              <label className="block text-sm text-gray-400 mb-1">出勤時刻</label>
              <input
                type="datetime-local"
                value={editClockIn}
                onChange={(e) => setEditClockIn(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">退勤時刻</label>
              <input
                type="datetime-local"
                value={editClockOut}
                onChange={(e) => setEditClockOut(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={saveEdit}
                disabled={loading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 写真プレビューモーダル */}
      {photoModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPhotoModal(null)}
        >
          <div className="max-w-lg w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoModal}
              alt="出勤写真"
              className="w-full rounded-xl"
            />
            <p className="text-center text-gray-400 text-sm mt-2">タップで閉じる</p>
          </div>
        </div>
      )}
    </div>
  )
}
