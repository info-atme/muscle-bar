export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-40 bg-gray-800 rounded" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-xl p-4 h-20" />
        ))}
      </div>
      <div className="bg-gray-800 rounded-xl p-4 h-48" />
      <div className="bg-gray-800 rounded-xl p-4 h-32" />
    </div>
  )
}
