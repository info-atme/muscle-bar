'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { format, parseISO, startOfWeek, endOfWeek, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ja } from 'date-fns/locale'
import { PenSquare, AlertCircle, ChevronDown, Settings2 } from 'lucide-react'

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
  firstPendingDate?: string | null
}

type SortKey = 'date' | 'revenue' | 'guests'
type PeriodKey = 'this_week' | 'this_month' | 'last_month' | 'custom'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: '日付順' },
  { key: 'revenue', label: '売上順' },
  { key: 'guests', label: '客数順' },
]

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'this_week', label: '今週' },
  { key: 'this_month', label: '今月' },
  { key: 'last_month', label: '先月' },
  { key: 'custom', label: 'カスタム' },
]

type ColumnKey = 'cash' | 'card' | 'guests' | 'groups' | 'status'
const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: 'cash', label: '現金' },
  { key: 'card', label: 'カード' },
  { key: 'guests', label: '客数' },
  { key: 'groups', label: '組数' },
  { key: 'status', label: 'ステータス' },
]
const DEFAULT_COLUMNS: ColumnKey[] = ['cash', 'card', 'guests', 'status']

function loadColumnPrefs(): ColumnKey[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS
  try {
    const saved = localStorage.getItem('dashboard_columns')
    if (saved) return JSON.parse(saved) as ColumnKey[]
  } catch { /* ignore */ }
  return DEFAULT_COLUMNS
}

function saveColumnPrefs(cols: ColumnKey[]) {
  try {
    localStorage.setItem('dashboard_columns', JSON.stringify(cols))
  } catch { /* ignore */ }
}

export function DashboardClient({
  monthlySummaries,
  recentSummaries,
  staffPerformances,
  staffList,
  pendingCount,
  firstPendingDate,
}: Props) {
  const router = useRouter()
  const today = new Date()

  // --- Period selector ---
  const [period, setPeriod] = useState<PeriodKey>('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // --- Sort ---
  const [sortKey, setSortKey] = useState<SortKey>('date')

  // --- Column toggle ---
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [showColSettings, setShowColSettings] = useState(false)

  useEffect(() => {
    setVisibleCols(loadColumnPrefs())
  }, [])

  const toggleColumn = useCallback((col: ColumnKey) => {
    setVisibleCols((prev) => {
      const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
      saveColumnPrefs(next)
      return next
    })
  }, [])

  // --- Filter data by period ---
  const filteredSummaries = useMemo(() => {
    let from: string
    let to: string

    switch (period) {
      case 'this_week': {
        const ws = startOfWeek(today, { weekStartsOn: 1 })
        const we = endOfWeek(today, { weekStartsOn: 1 })
        from = format(ws, 'yyyy-MM-dd')
        to = format(we, 'yyyy-MM-dd')
        break
      }
      case 'this_month':
        from = format(startOfMonth(today), 'yyyy-MM-dd')
        to = format(endOfMonth(today), 'yyyy-MM-dd')
        break
      case 'last_month': {
        const lm = subMonths(today, 1)
        from = format(startOfMonth(lm), 'yyyy-MM-dd')
        to = format(endOfMonth(lm), 'yyyy-MM-dd')
        break
      }
      case 'custom':
        from = customFrom || '2000-01-01'
        to = customTo || '2099-12-31'
        break
      default:
        from = format(startOfMonth(today), 'yyyy-MM-dd')
        to = format(endOfMonth(today), 'yyyy-MM-dd')
    }

    return monthlySummaries.filter((s) => s.date >= from && s.date <= to)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlySummaries, period, customFrom, customTo])

  // --- Totals ---
  const monthlyTotal = useMemo(() => {
    return filteredSummaries.reduce(
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
  }, [filteredSummaries])

  // --- Chart data (uses recent summaries or filtered) ---
  const chartData = useMemo(() => {
    const source = period === 'this_month' ? recentSummaries : filteredSummaries.slice(-14)
    return source.map((s) => ({
      date: format(parseISO(s.date), 'M/d'),
      rawDate: s.date,
      売上: s.total_amount,
      現金: s.cash_amount,
      カード: s.card_amount,
    }))
  }, [recentSummaries, filteredSummaries, period])

  // --- Sorted recent list ---
  const sortedRecent = useMemo(() => {
    const list = [...filteredSummaries]
    switch (sortKey) {
      case 'date':
        list.sort((a, b) => b.date.localeCompare(a.date))
        break
      case 'revenue':
        list.sort((a, b) => b.total_amount - a.total_amount)
        break
      case 'guests':
        list.sort((a, b) => b.guest_count - a.guest_count)
        break
    }
    return list
  }, [filteredSummaries, sortKey])

  // --- Staff ranking ---
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

  const todayStr = format(today, 'yyyy-MM-dd')

  // Chart click handler
  const handleChartClick = useCallback((data: { rawDate?: string }) => {
    if (data?.rawDate) {
      router.push(`/daily/${data.rawDate}`)
    }
  }, [router])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ダッシュボード</h1>
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/daily/input?date=${todayStr}`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          <PenSquare className="w-4 h-4" />
          今日の入力
        </Link>
        {pendingCount > 0 && (
          <Link
            href={firstPendingDate ? `/daily/${firstPendingDate}` : '/dashboard'}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-medium transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            未承認 {pendingCount}件
          </Link>
        )}
      </div>

      {/* Period selector */}
      <div className="space-y-2">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key)}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === tab.key
                  ? 'bg-gray-700 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
            />
            <span className="text-gray-400 text-sm">〜</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
            />
          </div>
        )}
      </div>

      {/* 月次サマリーカード */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/daily/${todayStr}`}
          className="bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition-colors cursor-pointer"
        >
          <p className="text-sm text-gray-400">売上合計</p>
          <p className="text-2xl font-bold">{monthlyTotal.total.toLocaleString()}<span className="text-sm text-gray-400">円</span></p>
        </Link>
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
          <h2 className="text-sm font-semibold text-gray-400 mb-3">
            {period === 'this_month' ? '直近7日間の売上' : '期間内の売上推移'}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              onClick={(state: Record<string, unknown> | null) => {
                const payload = state?.activePayload as Array<{ payload: { rawDate?: string } }> | undefined
                if (payload?.[0]?.payload) {
                  handleChartClick(payload[0].payload)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#9CA3AF' }}
                formatter={(value) => [`${Number(value).toLocaleString()}円`]}
              />
              <Bar dataKey="現金" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cash-${index}`} cursor="pointer" />
                ))}
              </Bar>
              <Bar dataKey="カード" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`card-${index}`} cursor="pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2 text-center">バーをタップで詳細へ</p>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">売上一覧</h2>
          <div className="flex items-center gap-2">
            {/* Column settings toggle */}
            <button
              onClick={() => setShowColSettings((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                showColSettings ? 'bg-gray-700 text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="表示列設定"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-300 appearance-none pr-6 cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Column toggle checkboxes */}
        {showColSettings && (
          <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-700">
            {COLUMN_OPTIONS.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleCols.includes(col.key)}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 w-3.5 h-3.5"
                />
                {col.label}
              </label>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {sortedRecent.map((s) => (
            <Link
              key={s.id}
              href={`/daily/${s.date}`}
              className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0 hover:bg-gray-700 -mx-2 px-2 rounded transition-colors"
            >
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm">{format(parseISO(s.date), 'M/d')}</span>
                {visibleCols.includes('status') && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.status === 'approved' ? 'bg-green-800 text-green-300' : 'bg-yellow-800 text-yellow-300'
                  }`}>
                    {s.status === 'approved' ? '承認済' : '未承認'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-right flex-wrap justify-end">
                <span className="font-medium">{s.total_amount.toLocaleString()}円</span>
                {visibleCols.includes('cash') && (
                  <span className="text-xs text-blue-400">現金{s.cash_amount.toLocaleString()}</span>
                )}
                {visibleCols.includes('card') && (
                  <span className="text-xs text-purple-400">カード{s.card_amount.toLocaleString()}</span>
                )}
                {visibleCols.includes('guests') && (
                  <span className="text-sm text-gray-400">{s.guest_count}名</span>
                )}
                {visibleCols.includes('groups') && (
                  <span className="text-sm text-gray-500">{s.group_count}組</span>
                )}
              </div>
            </Link>
          ))}
          {sortedRecent.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">データがありません</p>
          )}
        </div>
      </div>
    </div>
  )
}
