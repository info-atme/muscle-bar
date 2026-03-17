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
      // 監査ログ
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

    // 再取得
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
            {/* 承認ステータス */}
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

          <div className="space-y-2">
            {staffList.map((staff) => {
              const record = attendance.find(
                (a) => a.staff_id === staff.id && a.target_date === selectedDate
              )

              return (
                <div
                  key={staff.id}
                  className="py-3 border-b border-gray-700 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{staff.name}</span>
                      {record && (
                        record.approved ? (
                          <span className="text-green-400 text-xs" title="承認済">&#10003;</span>
                        ) : (
                          <span className="text-yellow-400 text-xs" title="未承認">&#9679;</span>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {record ? (
                        <>
                          {record.photo_url && (
                            <button
                              onClick={() => setPhotoModal(record.photo_url)}
                              className="w-8 h-8 rounded overflow-hidden border border-gray-600 flex-shrink-0"
                              title="写真を表示"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={record.photo_url}
                                alt="出勤写真"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          )}
                          <span className="text-xs text-gray-400 font-mono">
                            {formatTime(record.clock_in)} - {formatTime(record.clock_out)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${STATUS_LABELS[record.status]?.color ?? 'bg-gray-600'}`}>
                            {STATUS_LABELS[record.status]?.label ?? record.status}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-600">未打刻</span>
                      )}
                    </div>
                  </div>
                  {/* アクションボタン（レコードがある場合のみ） */}
                  {record && (
                    <div className="flex flex-wrap gap-2 mt-2 ml-4">
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
                      {record.note && (
                        <span className="text-xs text-gray-500 ml-2 self-center">{record.note}</span>
                      )}
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
