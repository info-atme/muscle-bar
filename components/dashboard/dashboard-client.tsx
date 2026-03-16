'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

type DailySummary = {
  id: string
  date: string
  cash_amount: number
  card_amount: number
  total_amount: number
  group_count: number
  guest_count: number
  status: 'draft' | 'approved'
}

type StaffPerformance = {
  staff_id: string
  op_count: number
  kanpai_count: number
  tip_amount: number
  champagne_amount: number
  orichan_amount: number
  back_total: number
}

type Staff = {
  id: string
  name: string
}

type Props = {
  monthlySummaries: DailySummary[]
  recentSummaries: DailySummary[]
  staffPerformances: StaffPerformance[]
  staffList: Staff[]
  pendingCount: number
}

export function DashboardClient({
  monthlySummaries,
  recentSummaries,
  staffPerformances,
  staffList,
  pendingCount,
}: Props) {
  // 月次合計
  const monthlyTotal = useMemo(() => {
    return monthlySummaries.reduce(
      (acc, s) => ({
        total: acc.total + s.total_amount,
        cash: acc.cash + s.cash_amount,
        card: acc.card + s.card_amount,
        guests: acc.guests + s.guest_count,
        groups: acc.groups + s.group_count,
        days: acc.days + 1,
      }),
      { total: 0, cash: 0, card: 0, guests: 0, groups: 0, days: 0 }
    )
  }, [monthlySummaries])

  // グラフ用データ
  const chartData = useMemo(() => {
    return recentSummaries.map((s) => ({
      date: format(parseISO(s.date), 'M/d'),
      売上: s.total_amount,
      現金: s.cash_amount,
      カード: s.card_amount,
    }))
  }, [recentSummaries])

  // スタッフランキング（OP数）
  const staffRanking = useMemo(() => {
    const totals = new Map<string, { op: number; kanpai: number }>()
    for (const p of staffPerformances) {
      const current = totals.get(p.staff_id) ?? { op: 0, kanpai: 0 }
      totals.set(p.staff_id, {
        op: current.op + p.op_count,
        kanpai: current.kanpai + p.kanpai_count,
      })
    }
    return Array.from(totals.entries())
      .map(([staffId, data]) => ({
        name: staffList.find((s) => s.id === staffId)?.name ?? '不明',
        ...data,
      }))
      .sort((a, b) => b.op - a.op)
  }, [staffPerformances, staffList])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ダッシュボード</h1>
        {pendingCount > 0 && (
          <span className="px-3 py-1 bg-yellow-600 rounded-full text-sm font-medium">
            未承認 {pendingCount}件
          </span>
        )}
      </div>

      {/* 月次サマリーカード */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">今月の売上</p>
          <p className="text-2xl font-bold">{monthlyTotal.total.toLocaleString()}<span className="text-sm text-gray-400">円</span></p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">営業日数</p>
          <p className="text-2xl font-bold">{monthlyTotal.days}<span className="text-sm text-gray-400">日</span></p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">来客数</p>
          <p className="text-2xl font-bold">{monthlyTotal.guests}<span className="text-sm text-gray-400">名</span></p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">日平均売上</p>
          <p className="text-2xl font-bold">
            {monthlyTotal.days > 0
              ? Math.floor(monthlyTotal.total / monthlyTotal.days).toLocaleString()
              : 0}
            <span className="text-sm text-gray-400">円</span>
          </p>
        </div>
      </div>

      {/* 売上推移グラフ */}
      {chartData.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">直近7日間の売上</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#9CA3AF' }}
                formatter={(value) => [`${Number(value).toLocaleString()}円`]}
              />
              <Bar dataKey="現金" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="カード" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* スタッフランキング */}
      {staffRanking.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">今月のOPランキング</h2>
          <div className="space-y-2">
            {staffRanking.map((staff, i) => (
              <div key={staff.name} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-yellow-500 text-black' :
                  i === 1 ? 'bg-gray-300 text-black' :
                  i === 2 ? 'bg-amber-700 text-white' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{staff.name}</span>
                <span className="text-sm text-gray-400">OP {staff.op}</span>
                <span className="text-sm text-gray-400">乾杯 {staff.kanpai}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 直近の日次サマリー */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">直近の売上</h2>
        <div className="space-y-2">
          {recentSummaries.slice().reverse().map((s) => (
            <Link
              key={s.id}
              href={`/daily/${s.date}`}
              className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0 hover:bg-gray-700 -mx-2 px-2 rounded transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{format(parseISO(s.date), 'M/d')}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.status === 'approved' ? 'bg-green-800 text-green-300' : 'bg-yellow-800 text-yellow-300'
                }`}>
                  {s.status === 'approved' ? '承認済' : '未承認'}
                </span>
              </div>
              <div className="text-right">
                <span className="font-medium">{s.total_amount.toLocaleString()}円</span>
                <span className="text-sm text-gray-400 ml-2">{s.guest_count}名</span>
              </div>
            </Link>
          ))}
          {recentSummaries.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">データがありません</p>
          )}
        </div>
      </div>
    </div>
  )
}
