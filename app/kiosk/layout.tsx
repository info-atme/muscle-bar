import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '出退勤キオスク - Muscle Bar',
}

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {children}
    </div>
  )
}
