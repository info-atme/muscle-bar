import type { Database } from '@/lib/supabase/types'

type Staff = Database['public']['Tables']['staff']['Row']
type StaffPerformance = Database['public']['Tables']['staff_performance']['Row']

/**
 * バック額を計算する
 * 承認時点のバック率で計算し、back_totalに保存する
 */
export function calculateBack(
  performance: Pick<StaffPerformance, 'op_count' | 'kanpai_count' | 'tip_amount' | 'champagne_amount' | 'orichan_amount'>,
  staff: Pick<Staff, 'back_op' | 'back_kanpai' | 'back_tip' | 'back_champagne' | 'back_orichan'>,
  /** OP単価（デフォルト: 1000円） */
  opUnitPrice: number = 1000,
  /** 乾杯単価（デフォルト: 600円） */
  kanpaiUnitPrice: number = 600
): number {
  const opBack = performance.op_count * opUnitPrice * Number(staff.back_op)
  const kanpaiBack = performance.kanpai_count * kanpaiUnitPrice * Number(staff.back_kanpai)
  const tipBack = performance.tip_amount * Number(staff.back_tip)
  const champagneBack = performance.champagne_amount * Number(staff.back_champagne)
  const orichanBack = performance.orichan_amount * Number(staff.back_orichan)

  return Math.floor(opBack + kanpaiBack + tipBack + champagneBack + orichanBack)
}
