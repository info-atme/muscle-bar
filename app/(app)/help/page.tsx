'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

type Section = {
  title: string
  items: { q: string; a: string }[]
}

const managerSections: Section[] = [
  {
    title: '売上ダッシュボード',
    items: [
      {
        q: 'ダッシュボードの見方',
        a: 'ホーム画面で日次・週次・月次の売上サマリーを確認できます。画面上部の期間フィルターで表示期間を切り替えてください。',
      },
      {
        q: '期間フィルターの使い方',
        a: '「日次」「週次」「月次」ボタンで切り替え、矢印で前後の期間に移動できます。特定の日付をタップすると日次詳細に遷移します。',
      },
    ],
  },
  {
    title: '日次入力',
    items: [
      {
        q: '3ステップの入力フロー',
        a: '1. 日付を選択 → 2. 売上・経費などの数値を入力 → 3. 確認して保存。出勤スタッフは自動的に選択されます。',
      },
      {
        q: 'スタッフ自動選択',
        a: 'シフトに割り当てられたスタッフ、または出退勤打刻があるスタッフが自動で選択されます。手動で追加・削除も可能です。',
      },
    ],
  },
  {
    title: '承認',
    items: [
      {
        q: '日次詳細での承認・差し戻し・削除',
        a: 'ダッシュボードから日付をタップして日次詳細画面を開きます。内容を確認して「承認」「差し戻し」「削除」を実行できます。',
      },
    ],
  },
  {
    title: 'シフト管理',
    items: [
      {
        q: 'スタッフ割当の方法',
        a: 'シフト管理画面で各スタッフの「割当」ボタンをタップします。スマホでは1日ずつ表示され、ON/OFFスイッチで切り替えられます。「全員割当」で出勤可・希望のスタッフを一括割当できます。',
      },
      {
        q: '当日呼出',
        a: '当日のみ「呼出」ボタンが表示されます。急なシフト追加が必要な場合に使います。',
      },
    ],
  },
  {
    title: '出退勤',
    items: [
      {
        q: '承認フロー',
        a: 'スタッフの打刻後、管理者が「承認」ボタンで確定します。「一括承認」で全員分をまとめて承認できます。承認済みの勤怠のみ給与計算に反映されます。',
      },
      {
        q: '手動編集',
        a: '各スタッフの「編集」ボタンから出勤・退勤時刻を修正できます。編集履歴は監査ログに記録されます。',
      },
    ],
  },
  {
    title: 'スタッフ管理',
    items: [
      {
        q: '追加・編集・PIN/時給設定',
        a: 'スタッフ一覧画面から新規追加、既存スタッフの編集ができます。キオスク用のPINコード（4桁）と時給を設定してください。',
      },
    ],
  },
  {
    title: '給与',
    items: [
      {
        q: '月次集計の見方',
        a: '給与画面で月を選択すると、各スタッフの勤務時間と給与が一覧表示されます。承認済みの勤怠データのみが集計対象です。',
      },
      {
        q: 'CSV出力',
        a: 'CSV出力ボタンから、月次の給与データをCSVファイルとしてダウンロードできます。',
      },
    ],
  },
  {
    title: 'キオスク',
    items: [
      {
        q: 'タブレット設置方法',
        a: '/kiosk にアクセスすると、タブレット向けの打刻画面が表示されます。ブラウザを全画面モードにして店舗に設置してください。',
      },
    ],
  },
]

const staffSections: Section[] = [
  {
    title: 'マイページ',
    items: [
      {
        q: '成績・出退勤確認',
        a: 'マイページでは自分の売上成績や出退勤記録を確認できます。月ごとの実績推移も表示されます。',
      },
    ],
  },
  {
    title: '出退勤',
    items: [
      {
        q: '出勤/退勤ボタンの使い方',
        a: '出退勤画面で「出勤」ボタンをタップして打刻します。勤務終了時に「退勤」ボタンをタップしてください。現在時刻がリアルタイムで表示されます。',
      },
    ],
  },
  {
    title: 'シフト希望',
    items: [
      {
        q: 'カレンダーでの登録方法',
        a: 'カレンダーの日付をタップすると、出勤可（緑）→ 出勤希望（青）→ 出勤不可（赤）→ 未設定 の順に切り替わります。「今週すべて出勤可」ボタンで一括設定も可能です。',
      },
    ],
  },
  {
    title: 'タスク',
    items: [
      {
        q: '確認・ステータス変更',
        a: 'タスク一覧から自分に割り当てられたタスクを確認できます。タスクをタップしてステータスを変更してください。',
      },
    ],
  },
  {
    title: 'キオスク',
    items: [
      {
        q: '打刻の流れ',
        a: 'キオスク画面で自分の名前をタップ → PINコード（4桁）を入力 → カメラで顔写真を撮影して出勤完了です。',
      },
    ],
  },
]

function Accordion({ section }: { section: Section }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <h3 className="text-sm font-bold text-gray-300 px-4 py-3 bg-gray-800 border-b border-gray-700">
        {section.title}
      </h3>
      {section.items.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={i} className="border-b border-gray-700/50 last:border-0">
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-700/50 transition-colors"
            >
              <span className="text-sm text-white">{item.q}</span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-3">
                <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<'manager' | 'staff'>('manager')

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ヘルプ・ガイド</h1>

      {/* Tab switcher */}
      <div className="flex bg-gray-800 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('manager')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'manager'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          管理者向け
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'staff'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          スタッフ向け
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {(activeTab === 'manager' ? managerSections : staffSections).map((section, i) => (
          <Accordion key={i} section={section} />
        ))}
      </div>
    </div>
  )
}
