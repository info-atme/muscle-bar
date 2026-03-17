'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Summary = {
  id: string
  date: string
  cash_amount: number
  card_amount: number
  total_amount: number
  group_count: number
  guest_count: number
  male_count: number
  female_count: number
  new_count: number
  repeat_count: number
  status: 'draft' | 'approved'
}

type Performance = {
  id: string
  staff_id: string
  op_count: number
  kanpai_count: number
  tip_amount: number
  champagne_amount: number
  orichan_amount: number
  back_total: number
  note: string | null
  staff: { name: string } | null
}

type Props = {
  summary: Summary
  performances: Performance[]
  role: string
  staffId: string
}

type EditSummary = {
  cash_amount: number
  card_amount: number
  group_count: number
  guest_count: number
  male_count: number
  female_count: number
  new_count: number
  repeat_count: number
}

type EditPerformance = {
  id: string
  staff_id: string
  staff_name: string
  op_count: number
  kanpai_count: number
  tip_amount: number
  champagne_amount: number
  orichan_amount: number
}

function EditNumberInput({
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

export function DailyDetailClient({ summary, performances, role, staffId }: Props) {
  const [approving, setApproving] = useState(false)
  const [status, setStatus] = useState(summary.status)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editSummary, setEditSummary] = useState<EditSummary>({
    cash_amount: summary.cash_amount,
    card_amount: summary.card_amount,
    group_count: summary.group_count,
    guest_count: summary.guest_count,
    male_count: summary.male_count,
    female_count: summary.female_count,
    new_count: summary.new_count,
    repeat_count: summary.repeat_count,
  })
  const [editPerformances, setEditPerformances] = useState<EditPerformance[]>(
    performances.map((p) => ({
      id: p.id,
      staff_id: p.staff_id,
      staff_name: p.staff?.name ?? '不明',
      op_count: p.op_count,
      kanpai_count: p.kanpai_count,
      tip_amount: p.tip_amount,
      champagne_amount: p.champagne_amount,
      orichan_amount: p.orichan_amount,
    }))
  )
  const [currentPerfIndex, setCurrentPerfIndex] = useState(0)
  const supabase = createClient()
  const router = useRouter()

  const canEdit = (role === 'owner' || role === 'manager') && status === 'draft'
  const canDelete = role === 'owner'
  const canReject = role === 'owner' && status === 'approved'

  function startEditing() {
    setEditSummary({
      cash_amount: summary.cash_amount,
      card_amount: summary.card_amount,
      group_count: summary.group_count,
      guest_count: summary.guest_count,
      male_count: summary.male_count,
      female_count: summary.female_count,
      new_count: summary.new_count,
      repeat_count: summary.repeat_count,
    })
    setEditPerformances(
      performances.map((p) => ({
        id: p.id,
        staff_id: p.staff_id,
        staff_name: p.staff?.name ?? '不明',
        op_count: p.op_count,
        kanpai_count: p.kanpai_count,
        tip_amount: p.tip_amount,
        champagne_amount: p.champagne_amount,
        orichan_amount: p.orichan_amount,
      }))
    )
    setCurrentPerfIndex(0)
    setIsEditing(true)
  }

  function updateEditPerf(index: number, field: keyof EditPerformance, value: number) {
    setEditPerformances((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Update daily_summary
      const { error: summaryError } = await supabase
        .from('daily_summary')
        .update({
          cash_amount: editSummary.cash_amount,
          card_amount: editSummary.card_amount,
          group_count: editSummary.group_count,
          guest_count: editSummary.guest_count,
          male_count: editSummary.male_count,
          female_count: editSummary.female_count,
          new_count: editSummary.new_count,
          repeat_count: editSummary.repeat_count,
        })
        .eq('id', summary.id)

      if (summaryError) throw summaryError

      // Update each staff_performance
      for (const perf of editPerformances) {
        const { error: perfError } = await supabase
          .from('staff_performance')
          .update({
            op_count: perf.op_count,
            kanpai_count: perf.kanpai_count,
            tip_amount: perf.tip_amount,
            champagne_amount: perf.champagne_amount,
            orichan_amount: perf.orichan_amount,
          })
          .eq('id', perf.id)

        if (perfError) throw perfError
      }

      setIsEditing(false)
      router.refresh()
    } catch {
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('daily_summary')
        .delete()
        .eq('id', summary.id)

      if (error) throw error

      router.push('/daily')
      router.refresh()
    } catch {
      alert('削除に失敗しました')
      setDeleting(false)
    }
  }

  async function handleReject() {
    if (!confirm('この日次データを差し戻しますか？バック額がリセットされます。')) return

    setRejecting(true)
    try {
      // Reset back_total on all staff_performance records
      for (const perf of performances) {
        await supabase
          .from('staff_performance')
          .update({ back_total: 0 })
          .eq('id', perf.id)
      }

      // Update daily_summary status back to draft
      const { error } = await supabase
        .from('daily_summary')
        .update({
          status: 'draft',
          approved_by: null,
          approved_at: null,
        })
        .eq('id', summary.id)

      if (error) throw error

      setStatus('draft')
      router.refresh()
    } catch {
      alert('差し戻しに失敗しました')
    } finally {
      setRejecting(false)
    }
  }

  async function handleApprove() {
    if (!confirm('この日次データを承認しますか？バック額が確定されます。')) return

    setApproving(true)
    try {
      // バック計算して staff_performance を更新
      // (承認時にバック率を取得して計算)
      for (const perf of performances) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('back_op, back_kanpai, back_tip, back_champagne, back_orichan')
          .eq('id', perf.staff_id)
          .single()

        if (staffData) {
          const opBack = perf.op_count * 1000 * Number(staffData.back_op)
          const kanpaiBack = perf.kanpai_count * 600 * Number(staffData.back_kanpai)
          const tipBack = perf.tip_amount * Number(staffData.back_tip)
          const champagneBack = perf.champagne_amount * Number(staffData.back_champagne)
          const orichanBack = perf.orichan_amount * Number(staffData.back_orichan)
          const backTotal = Math.floor(opBack + kanpaiBack + tipBack + champagneBack + orichanBack)

          await supabase
            .from('staff_performance')
            .update({ back_total: backTotal })
            .eq('id', perf.id)
        }
      }

      // daily_summary を approved に更新
      await supabase
        .from('daily_summary')
        .update({
          status: 'approved',
          approved_by: staffId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', summary.id)

      setStatus('approved')
      router.refresh()
    } catch {
      alert('承認に失敗しました')
    } finally {
      setApproving(false)
    }
  }

  // 編集モード
  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{summary.date} の編集</h1>
          <button
            onClick={() => setIsEditing(false)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            キャンセル
          </button>
        </div>

        {/* 売上サマリー編集 */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400">売上サマリー</h2>
          <EditNumberInput label="現金合計" value={editSummary.cash_amount} onChange={(v) => setEditSummary((p) => ({ ...p, cash_amount: v }))} suffix="円" />
          <EditNumberInput label="クレカ合計" value={editSummary.card_amount} onChange={(v) => setEditSummary((p) => ({ ...p, card_amount: v }))} suffix="円" />
          <div className="border-t border-gray-700 pt-2">
            <p className="text-sm text-gray-400">合計: <span className="text-white text-lg font-bold">{(editSummary.cash_amount + editSummary.card_amount).toLocaleString()}円</span></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EditNumberInput label="組数" value={editSummary.group_count} onChange={(v) => setEditSummary((p) => ({ ...p, group_count: v }))} suffix="組" />
            <EditNumberInput label="客数" value={editSummary.guest_count} onChange={(v) => setEditSummary((p) => ({ ...p, guest_count: v }))} suffix="名" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EditNumberInput label="男性" value={editSummary.male_count} onChange={(v) => setEditSummary((p) => ({ ...p, male_count: v }))} suffix="名" />
            <EditNumberInput label="女性" value={editSummary.female_count} onChange={(v) => setEditSummary((p) => ({ ...p, female_count: v }))} suffix="名" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EditNumberInput label="新規" value={editSummary.new_count} onChange={(v) => setEditSummary((p) => ({ ...p, new_count: v }))} suffix="名" />
            <EditNumberInput label="リピーター" value={editSummary.repeat_count} onChange={(v) => setEditSummary((p) => ({ ...p, repeat_count: v }))} suffix="名" />
          </div>
        </div>

        {/* スタッフ実績編集 */}
        {editPerformances.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-400">スタッフ実績</h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {editPerformances.map((perf, i) => (
                <button
                  key={perf.id}
                  onClick={() => setCurrentPerfIndex(i)}
                  className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    i === currentPerfIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {perf.staff_name}
                </button>
              ))}
            </div>

            {editPerformances[currentPerfIndex] && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-lg">{editPerformances[currentPerfIndex].staff_name}</h3>
                <EditNumberInput
                  label="OP回数"
                  value={editPerformances[currentPerfIndex].op_count}
                  onChange={(v) => updateEditPerf(currentPerfIndex, 'op_count', v)}
                  suffix="回"
                />
                <EditNumberInput
                  label="乾杯回数"
                  value={editPerformances[currentPerfIndex].kanpai_count}
                  onChange={(v) => updateEditPerf(currentPerfIndex, 'kanpai_count', v)}
                  suffix="回"
                />
                <EditNumberInput
                  label="チップ額"
                  value={editPerformances[currentPerfIndex].tip_amount}
                  onChange={(v) => updateEditPerf(currentPerfIndex, 'tip_amount', v)}
                  suffix="円"
                />
                <EditNumberInput
                  label="シャンパン額"
                  value={editPerformances[currentPerfIndex].champagne_amount}
                  onChange={(v) => updateEditPerf(currentPerfIndex, 'champagne_amount', v)}
                  suffix="円"
                />
                <EditNumberInput
                  label="オリシャン額"
                  value={editPerformances[currentPerfIndex].orichan_amount}
                  onChange={(v) => updateEditPerf(currentPerfIndex, 'orichan_amount', v)}
                  suffix="円"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={() => setIsEditing(false)}
            className="flex-1 py-4 bg-gray-700 rounded-lg font-bold text-lg hover:bg-gray-600 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 bg-blue-600 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    )
  }

  // 通常表示モード
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{summary.date} の日次データ</h1>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
          status === 'approved' ? 'bg-green-800 text-green-300' : 'bg-yellow-800 text-yellow-300'
        }`}>
          {status === 'approved' ? '承認済' : '未承認'}
        </span>
      </div>

      {/* 売上サマリー */}
      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-400">売上サマリー</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-gray-400">現金</span><span className="text-right">{summary.cash_amount.toLocaleString()}円</span>
          <span className="text-gray-400">クレカ</span><span className="text-right">{summary.card_amount.toLocaleString()}円</span>
          <span className="text-gray-400 font-bold">合計</span><span className="text-right font-bold text-lg">{summary.total_amount.toLocaleString()}円</span>
          <span className="text-gray-400">組数</span><span className="text-right">{summary.group_count}組</span>
          <span className="text-gray-400">客数</span><span className="text-right">{summary.guest_count}名</span>
          <span className="text-gray-400">男性/女性</span><span className="text-right">{summary.male_count}名 / {summary.female_count}名</span>
          <span className="text-gray-400">新規/リピ</span><span className="text-right">{summary.new_count}名 / {summary.repeat_count}名</span>
        </div>
      </div>

      {/* スタッフ実績 */}
      {performances.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400">スタッフ実績</h2>
          {performances.map((p) => (
            <div key={p.id} className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-2">{p.staff?.name ?? '不明'}</h3>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <span className="text-gray-400">OP</span><span className="text-right">{p.op_count}回</span>
                <span className="text-gray-400">乾杯</span><span className="text-right">{p.kanpai_count}回</span>
                {p.tip_amount > 0 && <><span className="text-gray-400">チップ</span><span className="text-right">{p.tip_amount.toLocaleString()}円</span></>}
                {p.champagne_amount > 0 && <><span className="text-gray-400">シャンパン</span><span className="text-right">{p.champagne_amount.toLocaleString()}円</span></>}
                {p.orichan_amount > 0 && <><span className="text-gray-400">オリシャン</span><span className="text-right">{p.orichan_amount.toLocaleString()}円</span></>}
                {role === 'owner' && status === 'approved' && (
                  <><span className="text-gray-400 font-bold">バック</span><span className="text-right font-bold text-green-400">{p.back_total.toLocaleString()}円</span></>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* アクションボタン群 */}
      <div className="space-y-3">
        {/* 承認ボタン（ownerのみ、未承認時のみ） */}
        {role === 'owner' && status === 'draft' && (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="w-full py-4 bg-green-600 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {approving ? '承認処理中...' : '承認する（バック確定）'}
          </button>
        )}

        {/* 編集ボタン（owner/managerのみ、draft時のみ） */}
        {canEdit && (
          <button
            onClick={startEditing}
            className="w-full py-4 bg-blue-600 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors"
          >
            編集
          </button>
        )}

        {/* 差し戻しボタン（ownerのみ、approved時のみ） */}
        {canReject && (
          <button
            onClick={handleReject}
            disabled={rejecting}
            className="w-full py-4 bg-yellow-600 rounded-lg font-bold text-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
          >
            {rejecting ? '処理中...' : '差し戻し（バックリセット）'}
          </button>
        )}

        {/* 削除ボタン（ownerのみ） */}
        {canDelete && (
          <>
            {showDeleteConfirm ? (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 space-y-3">
                <p className="text-red-300 text-sm font-medium">
                  この日次データを削除しますか？この操作は取り消せません。
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3 bg-gray-700 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-3 bg-red-600 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? '削除中...' : '削除する'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-4 bg-gray-700 text-red-400 rounded-lg font-bold text-lg hover:bg-gray-600 transition-colors"
              >
                削除
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
