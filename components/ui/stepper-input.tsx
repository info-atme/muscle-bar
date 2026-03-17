'use client'

import { useRef, useCallback } from 'react'
import { Minus, Plus } from 'lucide-react'

type Props = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label?: string
}

export function StepperInput({ value, onChange, min, max, label }: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clamp = useCallback(
    (v: number) => {
      if (min !== undefined && v < min) return min
      if (max !== undefined && v > max) return max
      return v
    },
    [min, max],
  )

  const increment = useCallback(() => {
    onChange(clamp(value + 1))
  }, [value, onChange, clamp])

  const decrement = useCallback(() => {
    onChange(clamp(value - 1))
  }, [value, onChange, clamp])

  const startRepeat = useCallback(
    (action: () => void) => {
      // Single fire first, then rapid after 400ms hold
      action()
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(action, 100)
      }, 400)
    },
    [],
  )

  const stopRepeat = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const canDecrement = min === undefined || value > min
  const canIncrement = max === undefined || value < max

  return (
    <div>
      {label && (
        <label className="block text-sm text-gray-400 mb-2">{label}</label>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!canDecrement}
          onPointerDown={() => canDecrement && startRepeat(decrement)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-700 text-white transition-colors hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:pointer-events-none select-none"
        >
          <Minus className="w-5 h-5" />
        </button>

        <span className="text-2xl font-bold text-white min-w-[3ch] text-center tabular-nums">
          {value}
        </span>

        <button
          type="button"
          disabled={!canIncrement}
          onPointerDown={() => canIncrement && startRepeat(increment)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-700 text-white transition-colors hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:pointer-events-none select-none"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
