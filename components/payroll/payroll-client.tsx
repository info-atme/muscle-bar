'use client'

import { useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, parse, addMonths, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

type Staff = {
  id: string
  name: string
  hourly_rate: number
  is_active: boolean
}

type Attendance = {
  id: string
  staff_id: string
  target_date: string
  clock_in: string | null
  clock_out: string | null
  status: 'working' | 'completed' | 'absent' | 'late'
  approved: boolean
}

type StaffPerformance = {
  staff_id: string
  back_total: number
}

type Props = {
  staffList: Staff[]
  attendanceList: Attendance[]
  staffPerformances: StaffPerformance[]
  initialMonth: string
}

function calcHours(clockIn: string | null, clockOut: string | null): number {
  if (!clockIn || !clockOut) return 0
  const start = new Date(clockIn)
  const end = new Date(clockOut)
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  return diff > 0 ? diff : 0
}

export function PayrollClient({
  staffList,
  attendanceList,
  staffPerformances,
  initialMonth,
}: Props) {
  const [month, setMonth] = useState(initialMonth)
  const router = useRouter()

  const handlePrev = useCallback(() => {
    const d = parse(month, 'yyyy-MM', new Date())
    const prev = format(subMonths(d, 1), 'yyyy-MM')
    setMonth(prev)
    router.push(`/payroll?month=${prev}`)
    router.refresh()
  }, [month, router])

  const handleNext = useCallback(() => {
    const d = parse(month, 'yyyy-MM', new Date())
    const next = format(addMonths(d, 1), 'yyyy-MM')
    setMonth(next)
    router.push(`/payroll?month=${next}`)
    router.refresh()
  }, [month, router])

  const displayMonth = useMemo(() => {
    const d = parse(month, 'yyyy-MM', new Date())
    return format(d, 'yyyy年M月', { locale: ja })
  }, [month])

  // 未承認レコードの有無
  const hasUnapproved = useMemo(() => {
    return attendanceList.some((a) => !a.approved)
  }, [attendanceList])

  // スタッフ別集計
  const payrollData = useMemo(() => {
    return staffList.map((staff) => {
      // 出勤データ（承認済 かつ absent以外）
      const staffAttendance = attendanceList.filter(
        (a) => a.staff_id === staff.id && a.status !== 'absent' && a.approved
      )

      const workDays = staffAttendance.length

      const totalHours = staffAttendance.reduce((sum, a) => {
        return sum + calcHours(a.clock_in, a.clock_out)
      }, 0)

      const basePay = Math.floor(totalHours * staff.hourly_rate)

      // バック合計（承認済みのみ）
      const backTotal = staffPerformances
        .filter((p) => p.staff_id === staff.id)
        .reduce((sum, p) => sum + p.back_total, 0)

      const totalPay = basePay + backTotal

      return {
        id: staff.id,
        name: staff.name,
        workDays,
        totalHours,
        hourlyRate: staff.hourly_rate,
        basePay,
        backTotal,
        totalPay,
      }
    })
  }, [staffList, attendanceList, staffPerformances])

  // 合計行
  const totals = useMemo(() => {
    return payrollData.reduce(
      (acc, row) => ({
        workDays: acc.workDays + row.workDays,
        totalHours: acc.totalHours + row.totalHours,
        basePay: acc.basePay + row.basePay,
        backTotal: acc.backTotal + row.backTotal,
        totalPay: acc.totalPay + row.totalPay,
      }),
      { workDays: 0, totalHours: 0, basePay: 0, backTotal: 0, totalPay: 0 }
    )
  }, [payrollData])

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">給与計算</h1>
      </div>

      {/* 月選択 */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrev}
          className="px-3 py-2 bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          &lt;
        </button>
        <span className="text-lg font-semibold min-w-[140px] text-center">{displayMonth}</span>
        <button
          onClick={handleNext}
          className="px-3 py-2 bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          &gt;
        </button>
      </div>

      {/* 未承認警告 */}
      {hasUnapproved && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-4 py-3">
          <p className="text-yellow-400 text-sm">
            未承認の勤怠は含まれていません
          </p>
        </div>
      )}

      {/* テーブル */}
      <div className="bg-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">名前</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">出勤日数</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">勤務時間</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">時給</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">基本給</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">バック合計</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">総支給額</th>
            </tr>
          </thead>
          <tbody>
            {payrollData.map((row) => (
              <tr key={row.id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 text-right">{row.workDays}<span className="text-gray-500 ml-0.5">日</span></td>
                <td className="px-4 py-3 text-right">{row.totalHours.toFixed(1)}<span className="text-gray-500 ml-0.5">h</span></td>
                <td className="px-4 py-3 text-right">{row.hourlyRate.toLocaleString()}<span className="text-gray-500 ml-0.5">円</span></td>
                <td className="px-4 py-3 text-right">{row.basePay.toLocaleString()}<span className="text-gray-500 ml-0.5">円</span></td>
                <td className="px-4 py-3 text-right">{row.backTotal.toLocaleString()}<span className="text-gray-500 ml-0.5">円</span></td>
                <td className="px-4 py-3 text-right font-semibold text-blue-400">{row.totalPay.toLocaleString()}<span className="text-gray-500 ml-0.5">円</span></td>
              </tr>
            ))}
            {payrollData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
          {payrollData.length > 0 && (
            <tfoot>
              <tr className="bg-gray-700/50 font-semibold">
                <td className="px-4 py-3">合計</td>
                <td className="px-4 py-3 text-right">{totals.workDays}<span className="text-gray-500 ml-0.5">日</span></td>
                <td className="px-4 py-3 text-right">{totals.totalHours.toFixed(1)}<span className="text-gray-500 ml-0.5">h</span></td>
                <td className="px-4 py-3 text-right">-</td>
                <td className="px-4 py-3 text-right">{totals.basePay.toLocaleString()}<span className="text-gray-500 ml-0.5">円</span></td>
                <td className="px-4 py-3 text-right">{totals.backTotal.toLocaleString()}<span className="text-gray-500 ml-0.5">円</span></td>
                <td className="px-4 py-3 text-right text-blue-400">{totals.totalPay.toLocaleString()}<span className="text-gray-500 ml-0.5">円</span></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
