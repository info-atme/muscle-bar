'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Staff = {
  id: string
  auth_user_id: string | null
  name: string
  role: 'owner' | 'manager' | 'staff'
  back_op: number
  back_kanpai: number
  back_tip: number
  back_champagne: number
  back_orichan: number
  hourly_rate: number
  pin: string | null
  line_user_id: string | null
  is_active: boolean
  created_at: string
}

type FormData = {
  name: string
  role: 'owner' | 'manager' | 'staff'
  back_op: number
  back_kanpai: number
  back_tip: number
  back_champagne: number
  back_orichan: number
  hourly_rate: number
  pin: string
  is_active: boolean
}

const defaultForm: FormData = {
  name: '',
  role: 'staff',
  back_op: 0.30,
  back_kanpai: 0.30,
  back_tip: 0.40,
  back_champagne: 0.20,
  back_orichan: 0.30,
  hourly_rate: 1200,
  pin: '',
  is_active: true,
}

const roleLabel: Record<string, string> = {
  owner: 'オーナー',
  manager: 'マネージャー',
  staff: 'スタッフ',
}

type Props = {
  staffList: Staff[]
}

export function StaffManagementClient({ staffList: initialList }: Props) {
  const [staffList, setStaffList] = useState(initialList)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function openEdit(staff: Staff) {
    setEditing(staff.id)
    setAdding(false)
    setForm({
      name: staff.name,
      role: staff.role,
      back_op: staff.back_op,
      back_kanpai: staff.back_kanpai,
      back_tip: staff.back_tip,
      back_champagne: staff.back_champagne,
      back_orichan: staff.back_orichan,
      hourly_rate: staff.hourly_rate,
      pin: staff.pin ?? '',
      is_active: staff.is_active,
    })
  }

  function openAdd() {
    setEditing(null)
    setAdding(true)
    setForm(defaultForm)
  }

  function close() {
    setEditing(null)
    setAdding(false)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      ...form,
      pin: form.pin.trim() || null,
    }
    if (adding) {
      const { data } = await supabase
        .from('staff')
        .insert(payload)
        .select()
        .single()
      if (data) {
        setStaffList([...staffList, data as Staff])
      }
    } else if (editing) {
      await supabase
        .from('staff')
        .update(payload)
        .eq('id', editing)
      setStaffList(staffList.map((s) => s.id === editing ? { ...s, ...payload } : s))
    }
    setSaving(false)
    close()
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">スタッフ管理</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          追加
        </button>
      </div>

      {/* スタッフ一覧 */}
      <div className="space-y-3">
        {staffList.map((staff) => (
          <div
            key={staff.id}
            onClick={() => openEdit(staff)}
            className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  staff.is_active ? 'bg-blue-600' : 'bg-gray-600'
                }`}>
                  {staff.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{staff.name}</p>
                  <p className="text-sm text-gray-400">{roleLabel[staff.role]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!staff.is_active && (
                  <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">無効</span>
                )}
                <span className="text-gray-500 text-sm">→</span>
              </div>
            </div>
            <div className="mt-2 flex gap-2 text-xs text-gray-500">
              <span>OP {(staff.back_op * 100).toFixed(0)}%</span>
              <span>乾杯 {(staff.back_kanpai * 100).toFixed(0)}%</span>
              <span>チップ {(staff.back_tip * 100).toFixed(0)}%</span>
              <span>シャンパン {(staff.back_champagne * 100).toFixed(0)}%</span>
              <span>オリシャン {(staff.back_orichan * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* モーダル */}
      {(adding || editing) && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">
              {adding ? 'スタッフ追加' : 'スタッフ編集'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">名前</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">ロール</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as FormData['role'] })}
                  className="w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="staff">スタッフ</option>
                  <option value="manager">マネージャー</option>
                  <option value="owner">オーナー</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400">時給</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-400 flex-shrink-0">円</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">PIN（4桁・任意）</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]*"
                  placeholder="1234"
                  value={form.pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                    setForm({ ...form, pin: v })
                  }}
                  className="w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">バック率</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {([
                    ['back_op', 'OP'],
                    ['back_kanpai', '乾杯'],
                    ['back_tip', 'チップ'],
                    ['back_champagne', 'シャンパン'],
                    ['back_orichan', 'オリシャン'],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-400 w-20">{label}</span>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
                        className="flex-1 bg-transparent text-right outline-none text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {editing && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-400">有効</label>
                  <button
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      form.is_active ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      form.is_active ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={close}
                className="flex-1 px-4 py-2 bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
