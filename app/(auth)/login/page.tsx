'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // サインアップ後、自動ログインしてセットアップへ
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
      setMessage('確認メールを送信しました。メールのリンクをクリック後、ログインしてください。')
      setLoading(false)
      return
    }

    router.push('/setup')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          Muscle Bar Sofcho
        </h1>
        <p className="text-center text-gray-400 mb-8">店舗管理システム</p>

        {/* タブ切り替え */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => { setMode('login'); setError(''); setMessage('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            ログイン
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setMessage('') }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-gray-300 mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none text-lg"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-gray-300 mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none text-lg"
              placeholder={mode === 'signup' ? '6文字以上' : ''}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-green-400 text-sm">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? (mode === 'login' ? 'ログイン中...' : '登録中...')
              : (mode === 'login' ? 'ログイン' : '新規登録')
            }
          </button>
        </form>
      </div>
    </div>
  )
}
