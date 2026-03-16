'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'

type Task = {
  id: string
  title: string
  assigned_to: string | null
  event_id: string | null
  due_date: string | null
  priority: 'urgent' | 'high' | 'normal'
  status: 'todo' | 'in_progress' | 'done'
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type Staff = { id: string; name: string }

type Props = {
  tasks: Task[]
  staffList: Staff[]
  currentStaffId: string
  role: 'owner' | 'manager' | 'staff'
}

type FormData = {
  title: string
  assigned_to: string
  due_date: string
  priority: 'urgent' | 'high' | 'normal'
  note: string
}

const defaultForm: FormData = {
  title: '',
  assigned_to: '',
  due_date: '',
  priority: 'normal',
  note: '',
}

const priorityStyle: Record<string, string> = {
  urgent: 'bg-red-800 text-red-300',
  high: 'bg-orange-800 text-orange-300',
  normal: 'bg-gray-700 text-gray-300',
}

const priorityLabel: Record<string, string> = {
  urgent: '緊急',
  high: '高',
  normal: '通常',
}

const statusLabel: Record<string, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
}

const statusStyle: Record<string, string> = {
  todo: 'bg-gray-700 text-gray-300',
  in_progress: 'bg-blue-800 text-blue-300',
  done: 'bg-green-800 text-green-300',
}

type FilterStatus = 'all' | 'todo' | 'in_progress' | 'done'

export function TasksClient({ tasks: initialTasks, staffList, currentStaffId, role }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const canEdit = role === 'owner' || role === 'manager'

  const filtered = tasks.filter((t) => filter === 'all' || t.status === filter)

  function staffName(id: string | null) {
    return staffList.find((s) => s.id === id)?.name ?? '-'
  }

  function openAdd() {
    setEditingId(null)
    setAdding(true)
    setForm(defaultForm)
  }

  function openEdit(task: Task) {
    setAdding(false)
    setEditingId(task.id)
    setForm({
      title: task.title,
      assigned_to: task.assigned_to ?? '',
      due_date: task.due_date ?? '',
      priority: task.priority,
      note: task.note ?? '',
    })
  }

  function close() {
    setAdding(false)
    setEditingId(null)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      title: form.title,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      priority: form.priority,
      note: form.note || null,
    }

    if (adding) {
      const { data } = await supabase
        .from('tasks')
        .insert({ ...payload, created_by: currentStaffId, status: 'todo' as const })
        .select()
        .single()
      if (data) setTasks([data as Task, ...tasks])
    } else if (editingId) {
      await supabase.from('tasks').update(payload).eq('id', editingId)
      setTasks(tasks.map((t) => t.id === editingId ? { ...t, ...payload } : t))
    }
    setSaving(false)
    close()
    router.refresh()
  }

  async function updateStatus(id: string, status: Task['status']) {
    await supabase.from('tasks').update({ status }).eq('id', id)
    setTasks(tasks.map((t) => t.id === id ? { ...t, status } : t))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">タスク</h1>
        {canEdit && (
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            追加
          </button>
        )}
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        {(['all', 'todo', 'in_progress', 'done'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s === 'all' ? 'すべて' : statusLabel[s]}
          </button>
        ))}
      </div>

      {/* タスク一覧 */}
      <div className="space-y-3">
        {filtered.map((task) => (
          <div
            key={task.id}
            className="bg-gray-800 rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1" onClick={() => canEdit && openEdit(task)}>
                <p className={`font-medium ${canEdit ? 'cursor-pointer' : ''}`}>{task.title}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${priorityStyle[task.priority]}`}>
                    {priorityLabel[task.priority]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle[task.status]}`}>
                    {statusLabel[task.status]}
                  </span>
                  <span className="text-xs text-gray-500">{staffName(task.assigned_to)}</span>
                  {task.due_date && (
                    <span className="text-xs text-gray-500">
                      期限: {format(parseISO(task.due_date), 'M/d')}
                    </span>
                  )}
                </div>
                {task.note && <p className="text-sm text-gray-500 mt-1">{task.note}</p>}
              </div>
              {/* ステータス変更ボタン */}
              <div className="flex flex-col gap-1">
                {task.status !== 'done' && (
                  <button
                    onClick={() => updateStatus(task.id, task.status === 'todo' ? 'in_progress' : 'done')}
                    className="text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                  >
                    {task.status === 'todo' ? '着手' : '完了'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">タスクがありません</p>
        )}
      </div>

      {/* モーダル */}
      {(adding || editingId) && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">
              {adding ? 'タスク追加' : 'タスク編集'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">タイトル</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">担当者</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">未割当</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400">期限</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">優先度</label>
                <div className="flex gap-2 mt-1">
                  {(['normal', 'high', 'urgent'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setForm({ ...form, priority: p })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                        form.priority === p ? priorityStyle[p] : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {priorityLabel[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">メモ</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={3}
                  className="w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
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
                disabled={saving || !form.title}
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
