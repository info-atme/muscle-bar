'use client'

import { useCallback } from 'react'
import { X } from 'lucide-react'

type Props = {
  value: number
  onChange: (value: number) => void
  label?: string
}

const quickAddAmounts = [1_000, 5_000, 10_000, 50_000]

function formatCurrency(v: number): string {
  return v.toLocaleString('ja-JP')
}

export function CurrencyInput({ value, onChange, label }: Props) {
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, '')
      onChange(raw === '' ? 0 : parseInt(raw, 10))
    },
    [onChange],
  )

  const handleQuickAdd = useCallback(
    (amount: number) => {
      onChange(value + amount)
    },
    [value, onChange],
  )

  const handleClear = useCallback(() => {
    onChange(0)
  }, [onChange])

  return (
    <div>
      {label && (
        <label className="block text-sm text-gray-400 mb-2">{label}</label>
      )}

      {/* Input field with clear button */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
          ¥
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={value === 0 ? '' : formatCurrency(value)}
          onChange={handleInputChange}
          placeholder="0"
          className="w-full h-12 pl-8 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg text-right focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        {value > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick-add buttons */}
      <div className="flex gap-2 mt-2">
        {quickAddAmounts.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => handleQuickAdd(amount)}
            className="flex-1 h-10 rounded-lg bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 active:bg-gray-500 transition-colors"
          >
            +{formatCurrency(amount)}
          </button>
        ))}
      </div>
    </div>
  )
}
