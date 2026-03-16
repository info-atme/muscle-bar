'use client'

import { useState } from 'react'
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

export function DailyDetailClient({ summary, performances, role, staffId }: Props) {
  const [approving, setApproving] = useState(false)
  const [status, setStatus] = useState(summary.status)
  const supabase = createClient()
  const router = useRouter()

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
    </div>
  )
}
