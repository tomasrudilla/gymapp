import { useState, useEffect } from 'react'
import { suscribirPush, pushSoportado, obtenerSuscripcionPush } from '../lib/push'

async function tienePushActivo(perfilId) {
  const enDb = await obtenerSuscripcionPush(perfilId)
  if (enDb) return true
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

export default function PushEnableBanner({ perfilId }) {
  const [activo, setActivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [soportado, setSoportado] = useState(false)
  const [permisoDenegado, setPermisoDenegado] = useState(false)

  useEffect(() => {
    setSoportado(pushSoportado())
    setPermisoDenegado(typeof Notification !== 'undefined' && Notification.permission === 'denied')
    if (perfilId) {
      tienePushActivo(perfilId).then(setActivo)
    } else {
      setActivo(false)
    }
  }, [perfilId])

  if (!soportado || !perfilId || activo === null || activo) return null

  const activar = async () => {
    setLoading(true)
    setMsg(null)
    const r = await suscribirPush(perfilId)
    if (r.ok) {
      setActivo(true)
    } else {
      setMsg({ ok: false, text: r.error })
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setPermisoDenegado(true)
      }
    }
    setLoading(false)
  }

  return (
    <div
      role="alert"
      className="mb-4 sticky top-[calc(5.5rem+env(safe-area-inset-top))] md:top-4 z-[70] bg-red-600 border-2 border-red-400 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-[0_0_24px_rgba(220,38,38,0.55)] animate-pulse"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
          ⚠ Atención · Notificaciones push
        </p>
        <p className="text-[10px] font-bold text-red-100 uppercase tracking-widest mt-1.5">
          {permisoDenegado
            ? 'Bloqueadas — habilitálas en Ajustes del celular para recibir alertas del master'
            : 'Obligatorio: activá push para recibir alertas del master en el celular'}
        </p>
        {msg && (
          <p className="text-[9px] font-black uppercase mt-2 text-red-100">{msg.text}</p>
        )}
      </div>
      {!permisoDenegado && (
        <button
          type="button"
          onClick={activar}
          disabled={loading}
          className="shrink-0 px-6 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 disabled:opacity-50 bg-white text-red-600 hover:bg-red-50 shadow-lg"
        >
          {loading ? '...' : 'Activar push'}
        </button>
      )}
    </div>
  )
}
