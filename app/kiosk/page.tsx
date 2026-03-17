'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type StaffAttendance = {
  id: string
  name: string
  hasPin: boolean
  attendance: {
    id: string
    clockIn: string | null
    clockOut: string | null
    status: 'working' | 'completed' | 'absent' | 'late'
  } | null
}

type KioskData = {
  staff: StaffAttendance[]
  date: string
}

type GeoLocation = {
  lat: number
  lng: number
} | null

export default function KioskPage() {
  const [data, setData] = useState<KioskData | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // GPS
  const [geoLocation, setGeoLocation] = useState<GeoLocation>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(true)

  // PIN入力モーダル
  const [selectedStaff, setSelectedStaff] = useState<StaffAttendance | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // 確認モーダル（PIN不要のスタッフ用）
  const [confirmStaff, setConfirmStaff] = useState<StaffAttendance | null>(null)

  // カメラモーダル
  const [cameraStaff, setCameraStaff] = useState<StaffAttendance | null>(null)
  const [cameraPendingPin, setCameraPendingPin] = useState<string | undefined>(undefined)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // フィードバック表示
  const [feedback, setFeedback] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  // ── GPS取得 ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('このデバイスでは位置情報を利用できません')
      setGeoLoading(false)
      return
    }

    // 初回取得
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError(null)
        setGeoLoading(false)
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError('位置情報の許可が必要です。ブラウザの設定を確認してください。')
            break
          case err.POSITION_UNAVAILABLE:
            setGeoError('位置情報を取得できません')
            break
          case err.TIMEOUT:
            setGeoError('位置情報の取得がタイムアウトしました')
            break
          default:
            setGeoError('位置情報の取得に失敗しました')
        }
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )

    // 継続的に位置を更新
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError(null)
      },
      () => {
        // watchPosition のエラーは静かに無視（初回で既にエラー表示済み）
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/kiosk')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '取得に失敗しました')
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // 初回読み込み & 30秒ごとの自動更新
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // 時計の更新（毎秒）
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // フィードバック自動消去
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  function getAction(staff: StaffAttendance): 'clock_in' | 'clock_out' {
    if (staff.attendance && staff.attendance.status === 'working') {
      return 'clock_out'
    }
    return 'clock_in'
  }

  // ── 最新のGPS座標を取得 ──
  async function getFreshLocation(): Promise<GeoLocation> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(geoLocation)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setGeoLocation(loc)
          setGeoError(null)
          resolve(loc)
        },
        () => {
          // フォールバック: キャッシュされた位置を使用
          resolve(geoLocation)
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      )
    })
  }

  function handleStaffTap(staff: StaffAttendance) {
    if (geoError || geoLoading) {
      setFeedback({
        message: geoError || '位置情報を取得中です...',
        type: 'error',
      })
      return
    }
    if (staff.hasPin) {
      setSelectedStaff(staff)
      setPinInput('')
      setPinError(null)
    } else {
      setConfirmStaff(staff)
    }
  }

  // ── カメラ開始 ──
  async function openCamera(staff: StaffAttendance, pin?: string) {
    // PIN/確認モーダルを閉じる
    setSelectedStaff(null)
    setConfirmStaff(null)
    setPinInput('')
    setPinError(null)
    setCapturedPhoto(null)

    setCameraStaff(staff)
    setCameraPendingPin(pin)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      setCameraStream(stream)

      // videoRef にストリームを設定（次のレンダリング後）
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 100)
    } catch {
      setFeedback({
        message: 'カメラを起動できません。カメラの許可を確認してください。',
        type: 'error',
      })
      setCameraStaff(null)
      setCameraPendingPin(undefined)
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    setCapturedPhoto(dataUrl)
  }

  function retakePhoto() {
    setCapturedPhoto(null)
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
    setCameraStaff(null)
    setCameraPendingPin(undefined)
    setCapturedPhoto(null)
  }

  async function confirmPhotoAndSubmit() {
    if (!cameraStaff || !capturedPhoto) return

    // カメラストリームを停止
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }

    await submitAction(cameraStaff.id, cameraPendingPin, capturedPhoto)

    setCameraStaff(null)
    setCameraPendingPin(undefined)
    setCapturedPhoto(null)
  }

  async function submitAction(staffId: string, pin?: string, photo?: string) {
    const staff = data?.staff.find((s) => s.id === staffId)
    if (!staff) return

    setProcessing(true)
    try {
      // 最新のGPS座標を取得
      const loc = await getFreshLocation()

      const action = getAction(staff)
      const res = await fetch('/api/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          pin,
          action,
          lat: loc?.lat,
          lng: loc?.lng,
          photo: photo || null,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          setPinError(json.error || 'PINが正しくありません')
          setProcessing(false)
          return
        }
        throw new Error(json.error || '処理に失敗しました')
      }

      const actionLabel = action === 'clock_in' ? '出勤' : '退勤'
      setFeedback({
        message: `${staff.name}さん ${actionLabel}しました`,
        type: 'success',
      })

      // モーダルを閉じる
      setSelectedStaff(null)
      setConfirmStaff(null)
      setPinInput('')
      setPinError(null)

      // データを再取得
      await fetchData()
    } catch (e) {
      setFeedback({
        message: e instanceof Error ? e.message : '処理に失敗しました',
        type: 'error',
      })
      setSelectedStaff(null)
      setConfirmStaff(null)
    } finally {
      setProcessing(false)
    }
  }

  function handlePinComplete(newPin: string) {
    if (!selectedStaff) return
    openCamera(selectedStaff, newPin)
  }

  function handleConfirm() {
    if (!confirmStaff) return
    openCamera(confirmStaff)
  }

  function formatTime(isoString: string): string {
    const d = new Date(isoString)
    return d.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    })
  }

  function getCardStyle(staff: StaffAttendance): string {
    if (staff.attendance?.status === 'working') {
      return 'border-green-500 bg-green-950/40'
    }
    if (staff.attendance?.status === 'completed') {
      return 'border-blue-500 bg-blue-950/40'
    }
    return 'border-gray-600 bg-gray-800'
  }

  function getStatusLabel(staff: StaffAttendance): string {
    if (staff.attendance?.status === 'working') return '出勤中'
    if (staff.attendance?.status === 'completed') return '退勤済み'
    return '未出勤'
  }

  function getStatusColor(staff: StaffAttendance): string {
    if (staff.attendance?.status === 'working') return 'text-green-400'
    if (staff.attendance?.status === 'completed') return 'text-blue-400'
    return 'text-gray-500'
  }

  // 日本時間でフォーマット
  const timeString = currentTime.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo',
  })

  const dateString = currentTime.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Tokyo',
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl text-gray-400">読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-2xl text-red-400">エラーが発生しました</div>
        <div className="text-gray-400">{error}</div>
        <button
          onClick={fetchData}
          className="px-6 py-3 bg-gray-700 rounded-lg text-lg hover:bg-gray-600 transition-colors"
        >
          再読み込み
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 select-none">
      {/* ヘッダー: 時計 */}
      <header className="text-center mb-8">
        <div className="text-7xl font-mono font-bold tracking-wider mb-2">
          {timeString}
        </div>
        <div className="text-2xl text-gray-400">{dateString}</div>
        <div className="text-lg text-gray-500 mt-1">
          スタッフをタップして出退勤
        </div>
        {/* GPS ステータス表示 */}
        {geoLoading && (
          <div className="text-sm text-yellow-400 mt-2">
            位置情報を取得中...
          </div>
        )}
        {geoError && (
          <div className="text-sm text-red-400 mt-2">{geoError}</div>
        )}
        {geoLocation && !geoError && (
          <div className="text-sm text-green-600 mt-2">
            GPS OK
          </div>
        )}
      </header>

      {/* スタッフグリッド */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {data?.staff.map((staff) => (
          <button
            key={staff.id}
            onClick={() => handleStaffTap(staff)}
            className={`rounded-2xl border-3 p-6 transition-all duration-200 active:scale-95 hover:brightness-110 ${getCardStyle(staff)}`}
            style={{ borderWidth: '3px' }}
          >
            <div className="text-3xl font-bold mb-2">{staff.name}</div>
            <div className={`text-lg font-medium ${getStatusColor(staff)}`}>
              {getStatusLabel(staff)}
            </div>
            {staff.attendance?.clockIn && (
              <div className="text-sm text-gray-400 mt-2">
                出勤: {formatTime(staff.attendance.clockIn)}
              </div>
            )}
            {staff.attendance?.clockOut && (
              <div className="text-sm text-gray-400">
                退勤: {formatTime(staff.attendance.clockOut)}
              </div>
            )}
            <div className="mt-3 text-sm text-gray-500">
              {getAction(staff) === 'clock_in' ? 'タップで出勤' : 'タップで退勤'}
            </div>
          </button>
        ))}
      </div>

      {/* フィードバック */}
      {feedback && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl text-2xl font-bold shadow-2xl z-50 transition-opacity ${
            feedback.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* PIN入力モーダル */}
      {selectedStaff && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-40"
          onClick={() => {
            setSelectedStaff(null)
            setPinInput('')
            setPinError(null)
          }}
        >
          <div
            className="bg-gray-800 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="text-3xl font-bold mb-2">
                {selectedStaff.name}
              </div>
              <div className="text-xl text-gray-400">
                {getAction(selectedStaff) === 'clock_in' ? '出勤' : '退勤'}
              </div>
            </div>

            <div className="text-center mb-4">
              <div className="text-lg text-gray-400 mb-3">PINを入力</div>
              <div className="flex justify-center gap-3 mb-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded-full border-2 ${
                      pinInput.length > i
                        ? 'bg-white border-white'
                        : 'border-gray-500'
                    }`}
                  />
                ))}
              </div>
              {pinError && (
                <div className="text-red-400 text-sm mb-2">{pinError}</div>
              )}
            </div>

            {/* テンキー */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    if (pinInput.length < 4) {
                      const newPin = pinInput + num
                      setPinInput(newPin)
                      setPinError(null)
                      if (newPin.length === 4) {
                        // 4桁入力でカメラへ進む
                        setTimeout(() => {
                          handlePinComplete(newPin)
                        }, 150)
                      }
                    }
                  }}
                  disabled={processing}
                  className="h-16 text-2xl font-bold bg-gray-700 rounded-xl hover:bg-gray-600 active:bg-gray-500 transition-colors disabled:opacity-50"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedStaff(null)
                  setPinInput('')
                  setPinError(null)
                }}
                className="h-16 text-lg font-bold bg-gray-700 rounded-xl hover:bg-gray-600 active:bg-gray-500 transition-colors text-red-400"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (pinInput.length < 4) {
                    const newPin = pinInput + '0'
                    setPinInput(newPin)
                    setPinError(null)
                    if (newPin.length === 4) {
                      setTimeout(() => {
                        handlePinComplete(newPin)
                      }, 150)
                    }
                  }
                }}
                disabled={processing}
                className="h-16 text-2xl font-bold bg-gray-700 rounded-xl hover:bg-gray-600 active:bg-gray-500 transition-colors disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={() => {
                  setPinInput(pinInput.slice(0, -1))
                  setPinError(null)
                }}
                disabled={processing}
                className="h-16 text-lg font-bold bg-gray-700 rounded-xl hover:bg-gray-600 active:bg-gray-500 transition-colors disabled:opacity-50"
              >
                削除
              </button>
            </div>

            {processing && (
              <div className="text-center mt-4 text-gray-400">処理中...</div>
            )}
          </div>
        </div>
      )}

      {/* 確認モーダル（PIN不要のスタッフ用） */}
      {confirmStaff && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-40"
          onClick={() => setConfirmStaff(null)}
        >
          <div
            className="bg-gray-800 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-8">
              <div className="text-3xl font-bold mb-3">
                {confirmStaff.name}
              </div>
              <div className="text-2xl text-gray-300">
                {getAction(confirmStaff) === 'clock_in'
                  ? '出勤しますか？'
                  : '退勤しますか？'}
              </div>
              {/* PIN未設定の警告 */}
              <div className="text-sm text-yellow-400 mt-3">
                PINが未設定です
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setConfirmStaff(null)}
                className="flex-1 py-4 text-xl font-bold bg-gray-700 rounded-2xl hover:bg-gray-600 active:bg-gray-500 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={processing}
                className={`flex-1 py-4 text-xl font-bold rounded-2xl transition-colors disabled:opacity-50 ${
                  getAction(confirmStaff) === 'clock_in'
                    ? 'bg-green-600 hover:bg-green-500 active:bg-green-400'
                    : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-400'
                }`}
              >
                {processing
                  ? '処理中...'
                  : getAction(confirmStaff) === 'clock_in'
                    ? '出勤'
                    : '退勤'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カメラモーダル（フルスクリーン風） */}
      {cameraStaff && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-900">
            <div className="text-xl font-bold">
              {cameraStaff.name} -{' '}
              {getAction(cameraStaff) === 'clock_in' ? '出勤' : '退勤'}
            </div>
            <button
              onClick={closeCamera}
              className="px-4 py-2 text-lg bg-gray-700 rounded-xl hover:bg-gray-600 active:bg-gray-500 transition-colors text-red-400"
            >
              取消
            </button>
          </div>

          {/* カメラプレビュー / 撮影済み画像 */}
          <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
            {!capturedPhoto ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <img
                src={capturedPhoto}
                alt="撮影済み"
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}
          </div>

          {/* 撮影ボタン / 確認ボタン */}
          <div className="px-6 py-6 bg-gray-900">
            {!capturedPhoto ? (
              <div className="flex items-center justify-center">
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full bg-white border-4 border-gray-400 active:bg-gray-300 transition-colors flex items-center justify-center"
                >
                  <div className="w-16 h-16 rounded-full border-2 border-gray-400" />
                </button>
                <div className="absolute left-6 text-gray-400 text-sm">
                  顔が映るように撮影してください
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                <button
                  onClick={retakePhoto}
                  className="flex-1 py-4 text-xl font-bold bg-gray-700 rounded-2xl hover:bg-gray-600 active:bg-gray-500 transition-colors"
                >
                  撮り直す
                </button>
                <button
                  onClick={confirmPhotoAndSubmit}
                  disabled={processing}
                  className={`flex-1 py-4 text-xl font-bold rounded-2xl transition-colors disabled:opacity-50 ${
                    getAction(cameraStaff) === 'clock_in'
                      ? 'bg-green-600 hover:bg-green-500 active:bg-green-400'
                      : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-400'
                  }`}
                >
                  {processing
                    ? '処理中...'
                    : getAction(cameraStaff) === 'clock_in'
                      ? '出勤する'
                      : '退勤する'}
                </button>
              </div>
            )}
          </div>

          {/* 非表示のcanvas（撮影用） */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  )
}
