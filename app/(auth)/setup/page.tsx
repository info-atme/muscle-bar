'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type UnlinkedStaff = {
  id: string
  name: string
  role: string
}

const roleLabel: Record<string, string> = {
  owner: 'オーナー',
  manager: 'マネージャー',
  staff: 'スタッフ',
}

type LinkedStaff = {
  name: string
  role: string
}

export default function SetupPage() {
  const [step, setStep] = useState<'loading' | 'linked' | 'select' | 'create'>('loading')
  const [linkedStaff, setLinkedStaff] = useState<LinkedStaff | null>(null)
  const [unlinkedStaff, setUnlinkedStaff] = useState<UnlinkedStaff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'owner' | 'manager' | 'staff'>('staff')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const res = await fetch('/api/setup')
      const data = await res.json()

      if (data.linked) {
        setLinkedStaff(data.me)
        setStep('linked')
        return
      }

      setUnlinkedStaff(data.staff ?? [])
      setStep('select')
    }
    check()
  }, [supabase, router])

  async function handleLink() {
    if (!selectedStaffId) return
    setSaving(true)
    setError('')

    const res = await fetch('/api/setup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: selectedStaffId }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || '紐付けに失敗しました')
      setSaving(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setSaving(true)
    setError('')

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), role: newRole }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || '登録に失敗しました')
      setSaving(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-center text-white mb-2">初期設定</h1>
          <p className="text-center text-gray-400 text-sm">アカウントをスタッフ情報に紐付けます</p>
        </div>

        {step === 'linked' && linkedStaff && (
          <div className="bg-gray-800 rounded-xl p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto">
              {linkedStaff.name.charAt(0)}
            </div>
            <div>
              <p className="text-lg font-bold">{linkedStaff.name}</p>
              <p className="text-sm text-gray-400">{roleLabel[linkedStaff.role]}</p>
            </div>
            <p className="text-sm text-green-400">設定済みです</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
            >
              ダッシュボードへ
            </button>
          </div>
        )}

        {step === 'select' && (
          <>
            {unlinkedStaff.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-400">既存スタッフから選択</h2>
                <div className="space-y-2">
                  {unlinkedStaff.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStaffId(s.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedStaffId === s.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-sm ml-2 opacity-70">{roleLabel[s.role]}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleLink}
                  disabled={saving || !selectedStaffId}
                  className="w-full py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '設定中...' : 'この名前で始める'}
                </button>
              </div>
            )}

            {unlinkedStaff.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-gray-500 text-sm">または</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>
            )}

            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-400">
                {unlinkedStaff.length > 0 ? '新しくスタッフを登録' : 'スタッフ情報を登録してください'}
              </h2>
              <button
                onClick={() => setStep('create')}
                className="w-full py-3 rounded-lg bg-gray-700 text-gray-300 font-medium hover:bg-gray-600 transition-colors"
              >
                新規スタッフとして登録
              </button>
            </div>
          </>
        )}

        {step === 'create' && (
          <div className="bg-gray-800 rounded-xl p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-400">スタッフ情報</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">名前</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
                placeholder="表示名を入力"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">ロール</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as typeof newRole)}
                className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="staff">スタッフ</option>
                <option value="manager">マネージャー</option>
                <option value="owner">オーナー</option>
              </select>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('select'); setError('') }}
                className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 font-medium hover:bg-gray-600 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '登録中...' : '登録する'}
              </button>
            </div>
          </div>
        )}

        {error && step === 'select' && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
