'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'

type Staff = {
  id: string
  name: string
  role: 'owner' | 'manager' | 'staff'
  back_op: number
  back_kanpai: number
  back_tip: number
  back_champagne: number
  back_orichan: number
}

type Performance = {
  id: string
  daily_summary_id: string
  op_count: number
  kanpai_count: number
  tip_amount: number
  champagne_amount: number
  orichan_amount: number
  back_total: number
}

type Props = {
  staff: Staff
  performances: Performance[]
  summaryDateMap: Record<string, string>
}

const roleLabel: Record<string, string> = {
  owner: 'オーナー',
  manager: 'マネージャー',
  staff: 'スタッフ',
}

export function MyPageClient({ staff, performances, summaryDateMap }: Props) {
  const monthlyTotals = useMemo(() => {
    return performances.reduce(
      (acc, p) => ({
        op: acc.op + p.op_count,
        kanpai: acc.kanpai + p.kanpai_count,
        tip: acc.tip + p.tip_amount,
        champagne: acc.champagne + p.champagne_amount,
        orichan: acc.orichan + p.orichan_amount,
        back: acc.back + p.back_total,
      }),
      { op: 0, kanpai: 0, tip: 0, champagne: 0, orichan: 0, back: 0 }
    )
  }, [performances])

  const recentPerformances = useMemo(() => {
    return performances
      .map((p) => ({
        ...p,
        date: summaryDateMap[p.daily_summary_id] ?? '',
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
  }, [performances, summaryDateMap])

  return (
    <div className="space-y-6">
      {/* プロフィール */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-lg font-bold">
            {staff.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold">{staff.name}</h1>
            <span className="text-sm text-gray-400">{roleLabel[staff.role]}</span>
          </div>
        </div>
      </div>

      {/* バック率 */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">バック率</h2>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-gray-700 rounded-lg p-2">
            <p className="text-gray-400">OP</p>
            <p className="font-bold">{(staff.back_op * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-2">
            <p className="text-gray-400">乾杯</p>
            <p className="font-bold">{(staff.back_kanpai * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-2">
            <p className="text-gray-400">チップ</p>
            <p className="font-bold">{(staff.back_tip * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-2">
            <p className="text-gray-400">シャンパン</p>
            <p className="font-bold">{(staff.back_champagne * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-2">
            <p className="text-gray-400">オリシャン</p>
            <p className="font-bold">{(staff.back_orichan * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* 今月の成績 */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">今月の成績</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-400">OP</p>
            <p className="text-xl font-bold">{monthlyTotals.op}<span className="text-sm text-gray-400">回</span></p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-400">乾杯</p>
            <p className="text-xl font-bold">{monthlyTotals.kanpai}<span className="text-sm text-gray-400">回</span></p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-400">チップ</p>
            <p className="text-xl font-bold">{monthlyTotals.tip.toLocaleString()}<span className="text-sm text-gray-400">円</span></p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-400">シャンパン</p>
            <p className="text-xl font-bold">{monthlyTotals.champagne.toLocaleString()}<span className="text-sm text-gray-400">円</span></p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-400">オリシャン</p>
            <p className="text-xl font-bold">{monthlyTotals.orichan.toLocaleString()}<span className="text-sm text-gray-400">円</span></p>
          </div>
          <div className="bg-blue-900 rounded-lg p-3">
            <p className="text-sm text-blue-300">バック合計</p>
            <p className="text-xl font-bold text-blue-300">{monthlyTotals.back.toLocaleString()}<span className="text-sm">円</span></p>
          </div>
        </div>
      </div>

      {/* 直近の実績 */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">直近の実績</h2>
        <div className="space-y-2">
          {recentPerformances.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
            >
              <span className="text-sm">{p.date ? format(parseISO(p.date), 'M/d') : '-'}</span>
              <div className="flex gap-3 text-sm text-gray-400">
                <span>OP {p.op_count}</span>
                <span>乾杯 {p.kanpai_count}</span>
                <span className="text-white font-medium">{p.back_total.toLocaleString()}円</span>
              </div>
            </div>
          ))}
          {recentPerformances.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">データがありません</p>
          )}
        </div>
      </div>
    </div>
  )
}
