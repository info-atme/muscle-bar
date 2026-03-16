'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type EventStatus = 'planning' | 'active' | 'done'

type ChecklistItem = {
  id: string
  label: string
  done: boolean
}

type Event = {
  id: string
  title: string
  event_date: string | null
  budget: number | null
  kpi: unknown
  checklist: unknown
  notify_recipients: unknown
  status: EventStatus
  is_template: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

type Props = {
  initialEvents: Event[]
  staffId: string
  role: string
}

const STATUS_OPTIONS: { value: EventStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'planning', label: '企画中' },
  { value: 'active', label: '進行中' },
  { value: 'done', label: '完了' },
]

function statusBadge(status: EventStatus) {
  const styles: Record<EventStatus, string> = {
    planning: 'bg-yellow-800 text-yellow-300',
    active: 'bg-green-800 text-green-300',
    done: 'bg-gray-700 text-gray-400',
  }
  const labels: Record<EventStatus, string> = {
    planning: '企画中',
    active: '進行中',
    done: '完了',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function parseChecklist(checklist: unknown): ChecklistItem[] {
  if (!Array.isArray(checklist)) return []
  return checklist.filter(
    (item): item is ChecklistItem =>
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'label' in item &&
      'done' in item
  )
}

export function EventsClient({ initialEvents, staffId, role }: Props) {
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [filter, setFilter] = useState<EventStatus | 'all'>('all')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // 追加フォーム
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newBudget, setNewBudget] = useState('')
  const [newStatus, setNewStatus] = useState<EventStatus>('planning')
  const [adding, setAdding] = useState(false)

  // 編集用
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [editStatus, setEditStatus] = useState<EventStatus>('planning')
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([])
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const canEdit = role === 'owner' || role === 'manager'

  const filteredEvents = filter === 'all'
    ? events
    : events.filter((e) => e.status === filter)

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null

  const openDetail = useCallback((event: Event) => {
    setSelectedEventId(event.id)
    setEditTitle(event.title)
    setEditDate(event.event_date ?? '')
    setEditBudget(event.budget != null ? String(event.budget) : '')
    setEditStatus(event.status)
    setEditChecklist(parseChecklist(event.checklist))
    setNewChecklistItem('')
  }, [])

  async function handleAdd() {
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: newTitle.trim(),
          event_date: newDate || null,
          budget: newBudget ? Number(newBudget) : null,
          status: newStatus,
          created_by: staffId,
        })
        .select('*')
        .single()

      if (error) throw error

      setEvents((prev) => [data as Event, ...prev])
      setNewTitle('')
      setNewDate('')
      setNewBudget('')
      setNewStatus('planning')
      setShowAddForm(false)
      router.refresh()
    } catch {
      alert('イベントの追加に失敗しました')
    } finally {
      setAdding(false)
    }
  }

  async function handleSave() {
    if (!selectedEvent || !editTitle.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('events')
        .update({
          title: editTitle.trim(),
          event_date: editDate || null,
          budget: editBudget ? Number(editBudget) : null,
          status: editStatus,
          checklist: editChecklist as unknown as import('@/lib/supabase/types').Json,
        })
        .eq('id', selectedEvent.id)

      if (error) throw error

      setEvents((prev) =>
        prev.map((e) =>
          e.id === selectedEvent.id
            ? {
                ...e,
                title: editTitle.trim(),
                event_date: editDate || null,
                budget: editBudget ? Number(editBudget) : null,
                status: editStatus,
                checklist: editChecklist,
              }
            : e
        )
      )
      router.refresh()
    } catch {
      alert('イベントの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  function handleAddChecklistItem() {
    if (!newChecklistItem.trim()) return
    const item: ChecklistItem = {
      id: crypto.randomUUID(),
      label: newChecklistItem.trim(),
      done: false,
    }
    setEditChecklist((prev) => [...prev, item])
    setNewChecklistItem('')
  }

  function handleToggleChecklistItem(id: string) {
    setEditChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    )
  }

  function handleRemoveChecklistItem(id: string) {
    setEditChecklist((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleDelete() {
    if (!selectedEvent) return
    if (!confirm('このイベントを削除しますか？')) return
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', selectedEvent.id)

      if (error) throw error

      setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id))
      setSelectedEventId(null)
      router.refresh()
    } catch {
      alert('イベントの削除に失敗しました')
    }
  }

  // 詳細画面
  if (selectedEvent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedEventId(null)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            &larr; 一覧に戻る
          </button>
          {canEdit && (
            <button
              onClick={handleDelete}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              削除
            </button>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400">イベント情報</h2>

          {canEdit ? (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">タイトル</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">開催日</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">予算</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none text-right"
                  />
                  <span className="text-gray-400 text-sm flex-shrink-0">円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">ステータス</label>
                <div className="flex gap-2">
                  {(['planning', 'active', 'done'] as EventStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setEditStatus(s)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        editStatus === s
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {s === 'planning' ? '企画中' : s === 'active' ? '進行中' : '完了'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{selectedEvent.title}</span>
                {statusBadge(selectedEvent.status)}
              </div>
              {selectedEvent.event_date && (
                <p className="text-sm text-gray-400">開催日: {selectedEvent.event_date}</p>
              )}
              {selectedEvent.budget != null && (
                <p className="text-sm text-gray-400">予算: {selectedEvent.budget.toLocaleString()}円</p>
              )}
            </div>
          )}
        </div>

        {/* チェックリスト */}
        <div className="bg-gray-800 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400">チェックリスト</h2>

          {editChecklist.length > 0 ? (
            <div className="space-y-2">
              {editChecklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0"
                >
                  <button
                    onClick={() => handleToggleChecklistItem(item.id)}
                    className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      item.done
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {item.done && <span className="text-xs">&#10003;</span>}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      item.done ? 'line-through text-gray-500' : ''
                    }`}
                  >
                    {item.label}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveChecklistItem(item.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">チェック項目がありません</p>
          )}

          {canEdit && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddChecklistItem()
                  }
                }}
                placeholder="項目を追加..."
                className="flex-1 px-4 py-2 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
              />
              <button
                onClick={handleAddChecklistItem}
                className="px-4 py-2 bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                追加
              </button>
            </div>
          )}
        </div>

        {/* 保存ボタン */}
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-blue-600 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        )}
      </div>
    )
  }

  // 一覧画面
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">イベント管理</h1>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showAddForm ? 'キャンセル' : '+ 新規作成'}
          </button>
        )}
      </div>

      {/* 追加フォーム */}
      {showAddForm && canEdit && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400">新規イベント</h2>
          <div>
            <label className="block text-sm text-gray-400 mb-1">タイトル</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="イベント名を入力"
              className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">開催日</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">予算</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none text-right"
              />
              <span className="text-gray-400 text-sm flex-shrink-0">円</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">ステータス</label>
            <div className="flex gap-2">
              {(['planning', 'active', 'done'] as EventStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newStatus === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {s === 'planning' ? '企画中' : s === 'active' ? '進行中' : '完了'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="w-full py-4 bg-green-600 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? '作成中...' : '作成する'}
          </button>
        </div>
      )}

      {/* ステータスフィルター */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* イベント一覧 */}
      <div className="space-y-3">
        {filteredEvents.map((event) => (
          <button
            key={event.id}
            onClick={() => openDetail(event)}
            className="w-full text-left bg-gray-800 rounded-xl p-4 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold">{event.title}</span>
              {statusBadge(event.status)}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {event.event_date && <span>{event.event_date}</span>}
              {event.budget != null && (
                <span>予算: {event.budget.toLocaleString()}円</span>
              )}
              {Array.isArray(event.checklist) && event.checklist.length > 0 && (
                <span>
                  チェック: {(event.checklist as ChecklistItem[]).filter((c) => c.done).length}/{event.checklist.length}
                </span>
              )}
            </div>
          </button>
        ))}
        {filteredEvents.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">イベントがありません</p>
        )}
      </div>
    </div>
  )
}
