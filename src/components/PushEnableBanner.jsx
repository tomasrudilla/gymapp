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
    <div className="mb-4 bg-red-950/80 border-2 border-red-600 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-lg shadow-red-600/10">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">
          ⚠ Activá las notificaciones
        </p>
        <p className="text-[10px] font-bold text-red-200/90 uppercase tracking-widest mt-1">
          {permisoDenegado
            ? 'Están bloqueadas — habilitálas en Ajustes del navegador o del celular'
            : 'Obligatorio para recibir alertas del gym en tu celular'}
        </p>
        {msg && (
          <p className="text-[9px] font-black uppercase mt-2 text-red-300">{msg.text}</p>
        )}
      </div>
      {!permisoDenegado && (
        <button
          type="button"
          onClick={activar}
          disabled={loading}
          className="shrink-0 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50 bg-red-600 text-white hover:bg-red-500"
        >
          {loading ? '...' : 'Activar push'}
        </button>
      )}
    </div>
  )
}
