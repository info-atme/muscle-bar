'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

type Staff = {
  id: string
  name: string
}

type StaffInput = {
  staff_id: string
  name: string
  op_count: number
  kanpai_count: number
  tip_amount: number
  champagne_amount: number
  orichan_amount: number
}

type SummaryData = {
  date: string
  cash_amount: number
  card_amount: number
  group_count: number
  guest_count: number
  male_count: number
  female_count: number
  new_count: number
  repeat_count: number
}

type StaffAttendanceInfo = {
  hasAttendance: boolean
  hasShiftAssignment: boolean
}

const STORAGE_KEY = 'daily-input-draft'

function NumberInput({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none text-xl text-right"
        />
        {suffix && <span className="text-gray-400 text-sm flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

export default function DailyInputPage() {
  const [step, setStep] = useState(1)
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [staffInputs, setStaffInputs] = useState<StaffInput[]>([])
  const [currentStaffIndex, setCurrentStaffIndex] = useState(0)
  const [staffAttendanceMap, setStaffAttendanceMap] = useState<Record<string, StaffAttendanceInfo>>({})
  const [attendanceLoaded, setAttendanceLoaded] = useState(false)
  const [summary, setSummary] = useState<SummaryData>({
    date: format(new Date(), 'yyyy-MM-dd'),
    cash_amount: 0,
    card_amount: 0,
    group_count: 0,
    guest_count: 0,
    male_count: 0,
    female_count: 0,
    new_count: 0,
    repeat_count: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()
  const router = useRouter()

  // スタッフ一覧を取得
  useEffect(() => {
    async function fetchStaff() {
      const { data } = await supabase
        .from('staff')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (data) setStaffList(data)
    }
    fetchStaff()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 選択日の出勤・シフト情報を取得
  const fetchAttendanceInfo = useCallback(async (date: string) => {
    setAttendanceLoaded(false)
    const [{ data: shiftData }, { data: attendanceData }] = await Promise.all([
      supabase
        .from('shift_assignments')
        .select('staff_id')
        .eq('target_date', date)
        .in('status', ['assigned', 'called_in']),
      supabase
        .from('attendance')
        .select('staff_id')
        .eq('target_date', date),
    ])

    const map: Record<string, StaffAttendanceInfo> = {}

    if (shiftData) {
      for (const row of shiftData) {
        if (!map[row.staff_id]) map[row.staff_id] = { hasAttendance: false, hasShiftAssignment: false }
        map[row.staff_id].hasShiftAssignment = true
      }
    }
    if (attendanceData) {
      for (const row of attendanceData) {
        if (!map[row.staff_id]) map[row.staff_id] = { hasAttendance: false, hasShiftAssignment: false }
        map[row.staff_id].hasAttendance = true
      }
    }

    setStaffAttendanceMap(map)
    setAttendanceLoaded(true)
    return map
  }, [supabase])

  // localStorageから下書き復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.summary) setSummary(draft.summary)
        if (draft.selectedStaffIds) setSelectedStaffIds(draft.selectedStaffIds)
        if (draft.staffInputs) setStaffInputs(draft.staffInputs)
        if (draft.step) setStep(draft.step)
      }
    } catch {
      // 復元失敗は無視
    }
  }, [])

  // 下書き保存
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        summary,
        selectedStaffIds,
        staffInputs,
        step,
      }))
    } catch {
      // 保存失敗は無視
    }
  }, [summary, selectedStaffIds, staffInputs, step])

  useEffect(() => {
    saveDraft()
  }, [saveDraft])

  function updateSummary(field: keyof SummaryData, value: number | string) {
    setSummary((prev) => ({ ...prev, [field]: value }))
  }

  function toggleStaff(id: string, name: string) {
    setSelectedStaffIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((s) => s !== id)
      }
      return [...prev, id]
    })

    setStaffInputs((prev) => {
      if (prev.find((s) => s.staff_id === id)) {
        return prev.filter((s) => s.staff_id !== id)
      }
      return [...prev, {
        staff_id: id,
        name,
        op_count: 0,
        kanpai_count: 0,
        tip_amount: 0,
        champagne_amount: 0,
        orichan_amount: 0,
      }]
    })
  }

  // 日付確定時にシフト・出勤情報を取得し、自動選択する
  async function handleDateConfirm() {
    const map = await fetchAttendanceInfo(summary.date)

    // 出勤記録またはシフトがあるスタッフを自動選択（既存の選択がなければ）
    if (selectedStaffIds.length === 0 && staffList.length > 0) {
      const autoIds: string[] = []
      const autoInputs: StaffInput[] = []

      for (const staff of staffList) {
        const info = map[staff.id]
        if (info && (info.hasAttendance || info.hasShiftAssignment)) {
          autoIds.push(staff.id)
          autoInputs.push({
            staff_id: staff.id,
            name: staff.name,
            op_count: 0,
            kanpai_count: 0,
            tip_amount: 0,
            champagne_amount: 0,
            orichan_amount: 0,
          })
        }
      }

      if (autoIds.length > 0) {
        setSelectedStaffIds(autoIds)
        setStaffInputs(autoInputs)
      }
    }

    setStep(2)
  }

  function updateStaffInput(index: number, field: keyof StaffInput, value: number) {
    setStaffInputs((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  // スタッフリストをソート: シフト・出勤ありを上、なしを下
  function getSortedStaffList() {
    return [...staffList].sort((a, b) => {
      const aInfo = staffAttendanceMap[a.id]
      const bInfo = staffAttendanceMap[b.id]
      const aHas = aInfo ? (aInfo.hasAttendance || aInfo.hasShiftAssignment) : false
      const bHas = bInfo ? (bInfo.hasAttendance || bInfo.hasShiftAssignment) : false
      if (aHas && !bHas) return -1
      if (!aHas && bHas) return 1
      return 0
    })
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')

    try {
      // 1. daily_summary を作成
      const { data: dailySummary, error: summaryError } = await supabase
        .from('daily_summary')
        .insert({
          date: summary.date,
          cash_amount: summary.cash_amount,
          card_amount: summary.card_amount,
          group_count: summary.group_count,
          guest_count: summary.guest_count,
          male_count: summary.male_count,
          female_count: summary.female_count,
          new_count: summary.new_count,
          repeat_count: summary.repeat_count,
        })
        .select('id')
        .single()

      if (summaryError) throw summaryError

      // 2. staff_performance を作成
      if (staffInputs.length > 0) {
        const performances = staffInputs.map((input) => ({
          daily_summary_id: dailySummary.id,
          staff_id: input.staff_id,
          op_count: input.op_count,
          kanpai_count: input.kanpai_count,
          tip_amount: input.tip_amount,
          champagne_amount: input.champagne_amount,
          orichan_amount: input.orichan_amount,
        }))

        const { error: perfError } = await supabase
          .from('staff_performance')
          .insert(performances)

        if (perfError) throw perfError
      }

      // 下書き削除
      localStorage.removeItem(STORAGE_KEY)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-4">&#10003;</div>
        <h2 className="text-xl font-bold mb-2">送信完了</h2>
        <p className="text-gray-400 mb-6">{summary.date} の日次データを送信しました</p>
        <button
          onClick={() => {
            setSubmitted(false)
            setStep(1)
            setSummary({
              date: format(new Date(), 'yyyy-MM-dd'),
              cash_amount: 0,
              card_amount: 0,
              group_count: 0,
              guest_count: 0,
              male_count: 0,
              female_count: 0,
              new_count: 0,
              repeat_count: 0,
            })
            setSelectedStaffIds([])
            setStaffInputs([])
            setStaffAttendanceMap({})
            setAttendanceLoaded(false)
          }}
          className="px-6 py-3 bg-blue-600 rounded-lg font-bold hover:bg-blue-700 transition-colors"
        >
          続けて入力
        </button>
      </div>
    )
  }

  const sortedStaffList = getSortedStaffList()

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">日次入力</h1>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full ${
              s <= step ? 'bg-blue-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* ステップ1: 営業日確認 */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">営業日を確認</h2>
          <input
            type="date"
            value={summary.date}
            onChange={(e) => updateSummary('date', e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none text-lg"
          />
          <button
            onClick={handleDateConfirm}
            className="w-full py-4 bg-blue-600 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors"
          >
            次へ
          </button>
        </div>
      )}

      {/* ステップ2: 売上サマリー入力 */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">売上サマリー</h2>
          <NumberInput label="現金合計" value={summary.cash_amount} onChange={(v) => updateSummary('cash_amount', v)} suffix="円" />
          <NumberInput label="クレカ合計" value={summary.card_amount} onChange={(v) => updateSummary('card_amount', v)} suffix="円" />
          <div className="border-t border-gray-700 pt-2">
            <p className="text-sm text-gray-400">合計: <span className="text-white text-lg font-bold">{(summary.cash_amount + summary.card_amount).toLocaleString()}円</span></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="組数" value={summary.group_count} onChange={(v) => updateSummary('group_count', v)} suffix="組" />
            <NumberInput label="客数" value={summary.guest_count} onChange={(v) => updateSummary('guest_count', v)} suffix="名" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="男性" value={summary.male_count} onChange={(v) => updateSummary('male_count', v)} suffix="名" />
            <NumberInput label="女性" value={summary.female_count} onChange={(v) => updateSummary('female_count', v)} suffix="名" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput label="新規" value={summary.new_count} onChange={(v) => updateSummary('new_count', v)} suffix="名" />
            <NumberInput label="リピーター" value={summary.repeat_count} onChange={(v) => updateSummary('repeat_count', v)} suffix="名" />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={() => setStep(1)} className="flex-1 py-4 bg-gray-700 rounded-lg font-bold text-lg hover:bg-gray-600 transition-colors">
              戻る
            </button>
            <button onClick={() => setStep(3)} className="flex-1 py-4 bg-blue-600 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors">
              次へ
            </button>
          </div>
        </div>
      )}

      {/* ステップ3: スタッフ別OP入力 */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">スタッフ別OP実績</h2>

          {/* スタッフ選択 */}
          <div>
            <p className="text-sm text-gray-400 mb-2">出勤スタッフを選択</p>
            <div className="flex flex-wrap gap-2">
              {sortedStaffList.map((s) => {
                const info = staffAttendanceMap[s.id]
                const hasRecord = info && (info.hasAttendance || info.hasShiftAssignment)
                const isSelected = selectedStaffIds.includes(s.id)

                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStaff(s.id, s.name)}
                    className={`px-4 py-2 rounded-lg font-medium text-base transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : hasRecord
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                    }`}
                  >
                    {s.name}
                    {attendanceLoaded && info?.hasAttendance && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-800 text-green-300 font-normal">
                        出勤済
                      </span>
                    )}
                    {attendanceLoaded && info?.hasShiftAssignment && !info?.hasAttendance && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-800 text-blue-300 font-normal">
                        シフト
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 選択したスタッフのOP入力 */}
          {staffInputs.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {staffInputs.map((input, i) => (
                  <button
                    key={input.staff_id}
                    onClick={() => setCurrentStaffIndex(i)}
                    className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      i === currentStaffIndex
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {input.name}
                  </button>
                ))}
              </div>

              {staffInputs[currentStaffIndex] && (
                <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-lg">{staffInputs[currentStaffIndex].name}</h3>
                  <NumberInput
                    label="OP回数"
                    value={staffInputs[currentStaffIndex].op_count}
                    onChange={(v) => updateStaffInput(currentStaffIndex, 'op_count', v)}
                    suffix="回"
                  />
                  <NumberInput
                    label="乾杯回数"
                    value={staffInputs[currentStaffIndex].kanpai_count}
                    onChange={(v) => updateStaffInput(currentStaffIndex, 'kanpai_count', v)}
                    suffix="回"
                  />
                  <NumberInput
                    label="チップ額"
                    value={staffInputs[currentStaffIndex].tip_amount}
                    onChange={(v) => updateStaffInput(currentStaffIndex, 'tip_amount', v)}
                    suffix="円"
                  />
                  <NumberInput
                    label="シャンパン額"
                    value={staffInputs[currentStaffIndex].champagne_amount}
                    onChange={(v) => updateStaffInput(currentStaffIndex, 'champagne_amount', v)}
                    suffix="円"
                  />
                  <NumberInput
                    label="オリシャン額"
                    value={staffInputs[currentStaffIndex].orichan_amount}
                    onChange={(v) => updateStaffInput(currentStaffIndex, 'orichan_amount', v)}
                    suffix="円"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button onClick={() => setStep(2)} className="flex-1 py-4 bg-gray-700 rounded-lg font-bold text-lg hover:bg-gray-600 transition-colors">
              戻る
            </button>
            <button onClick={() => setStep(4)} className="flex-1 py-4 bg-blue-600 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors">
              確認へ
            </button>
          </div>
        </div>
      )}

      {/* ステップ4: 確認画面 */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">入力内容の確認</h2>

          <div className="bg-gray-800 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-blue-400">売上サマリー — {summary.date}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-400">現金</span><span className="text-right">{summary.cash_amount.toLocaleString()}円</span>
              <span className="text-gray-400">クレカ</span><span className="text-right">{summary.card_amount.toLocaleString()}円</span>
              <span className="text-gray-400 font-bold">合計</span><span className="text-right font-bold">{(summary.cash_amount + summary.card_amount).toLocaleString()}円</span>
              <span className="text-gray-400">組数</span><span className="text-right">{summary.group_count}組</span>
              <span className="text-gray-400">客数</span><span className="text-right">{summary.guest_count}名</span>
              <span className="text-gray-400">男性/女性</span><span className="text-right">{summary.male_count}名 / {summary.female_count}名</span>
              <span className="text-gray-400">新規/リピ</span><span className="text-right">{summary.new_count}名 / {summary.repeat_count}名</span>
            </div>
          </div>

          {staffInputs.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-blue-400">スタッフOP実績</h3>
              {staffInputs.map((input) => (
                <div key={input.staff_id} className="bg-gray-800 rounded-xl p-4">
                  <h4 className="font-bold mb-2">{input.name}</h4>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    {input.op_count > 0 && <><span className="text-gray-400">OP</span><span className="text-right">{input.op_count}回</span></>}
                    {input.kanpai_count > 0 && <><span className="text-gray-400">乾杯</span><span className="text-right">{input.kanpai_count}回</span></>}
                    {input.tip_amount > 0 && <><span className="text-gray-400">チップ</span><span className="text-right">{input.tip_amount.toLocaleString()}円</span></>}
                    {input.champagne_amount > 0 && <><span className="text-gray-400">シャンパン</span><span className="text-right">{input.champagne_amount.toLocaleString()}円</span></>}
                    {input.orichan_amount > 0 && <><span className="text-gray-400">オリシャン</span><span className="text-right">{input.orichan_amount.toLocaleString()}円</span></>}
                    {input.op_count === 0 && input.kanpai_count === 0 && input.tip_amount === 0 && input.champagne_amount === 0 && input.orichan_amount === 0 && (
                      <span className="text-gray-500 col-span-2">入力なし</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3 pt-4">
            <button onClick={() => setStep(3)} className="flex-1 py-4 bg-gray-700 rounded-lg font-bold text-lg hover:bg-gray-600 transition-colors">
              修正する
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-4 bg-green-600 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '送信中...' : '送信'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
