import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendLineMessage } from '@/lib/line/notify'
import { format, subDays } from 'date-fns'
import type { Database } from '@/lib/supabase/types'

type NotificationRule = Database['public']['Tables']['notification_rules']['Row']
type DailySummaryRow = Database['public']['Tables']['daily_summary']['Row']

export async function GET(request: NextRequest) {
  // Vercel Cronの認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 通知ルール取得
  const { data: rulesData } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('is_active', true)

  const rules = (rulesData ?? []) as NotificationRule[]

  if (rules.length === 0) {
    return NextResponse.json({ message: 'No rules found' })
  }

  const results: string[] = []

  for (const rule of rules) {
    try {
      if (rule.trigger_type === 'daily_summary') {
        await handleDailySummaryNotification(supabase, rule)
        results.push(`daily_summary: sent`)
      }

      if (rule.trigger_type === 'missing_input') {
        await handleMissingInputNotification(supabase, rule)
        results.push(`missing_input: checked`)
      }
    } catch (err) {
      results.push(`${rule.trigger_type}: error - ${err}`)
    }
  }

  return NextResponse.json({ results })
}

async function handleDailySummaryNotification(
  supabase: ReturnType<typeof createServiceClient>,
  rule: NotificationRule
) {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const { data: summaryData } = await supabase
    .from('daily_summary')
    .select('*')
    .eq('date', yesterday)
    .single()

  const summary = summaryData as DailySummaryRow | null
  if (!summary) return

  // ownerのLINE IDを取得
  const { data: ownersData } = await supabase
    .from('staff')
    .select('line_user_id')
    .eq('role', 'owner')
    .not('line_user_id', 'is', null)

  const owners = (ownersData ?? []) as { line_user_id: string | null }[]
  if (owners.length === 0) return

  const message = rule.message_template
    .replace('{{date}}', summary.date)
    .replace('{{total}}', summary.total_amount.toLocaleString())
    .replace('{{cash}}', summary.cash_amount.toLocaleString())
    .replace('{{card}}', summary.card_amount.toLocaleString())
    .replace('{{guests}}', String(summary.guest_count))
    .replace('{{groups}}', String(summary.group_count))

  for (const owner of owners) {
    if (owner.line_user_id) {
      await sendLineMessage({ to: owner.line_user_id, message })
    }
  }
}

async function handleMissingInputNotification(
  supabase: ReturnType<typeof createServiceClient>,
  rule: NotificationRule
) {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const { data: summaryData } = await supabase
    .from('daily_summary')
    .select('id')
    .eq('date', yesterday)
    .single()

  // 入力済みならスキップ
  if (summaryData) return

  // managerのLINE IDを取得
  const { data: managersData } = await supabase
    .from('staff')
    .select('line_user_id')
    .eq('role', 'manager')
    .not('line_user_id', 'is', null)

  const managers = (managersData ?? []) as { line_user_id: string | null }[]
  if (managers.length === 0) return

  const message = rule.message_template.replace('{{date}}', yesterday)

  for (const manager of managers) {
    if (manager.line_user_id) {
      await sendLineMessage({ to: manager.line_user_id, message })
    }
  }
}
