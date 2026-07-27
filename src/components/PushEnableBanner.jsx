import { useState, useEffect } from 'react'
import { suscribirPush, desuscribirPush, pushSoportado, obtenerSuscripcionPush } from '../lib/push'

export default function PushEnableBanner({ perfilId }) {
  const [activo, setActivo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [soportado, setSoportado] = useState(false)

  useEffect(() => {
    setSoportado(pushSoportado())
    if (perfilId) {
      obtenerSuscripcionPush(perfilId).then(setActivo)
    }
  }, [perfilId])

  if (!soportado || !perfilId) return null

  const toggle = async () => {
    setLoading(true)
    setMsg(null)
    if (activo) {
      await desuscribirPush(perfilId)
      setActivo(false)
      setMsg({ ok: true, text: 'Notificaciones desactivadas' })
    } else {
      const r = await suscribirPush(perfilId)
      if (r.ok) {
        setActivo(true)
        setMsg({ ok: true, text: '¡Listo! Vas a recibir push del gym' })
      } else {
        setMsg({ ok: false, text: r.error })
      }
    }
    setLoading(false)
    setTimeout(() => setMsg(null), 4000)
  }

  return (
    <div className="mb-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Notificaciones push</p>
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">
          {activo ? 'Activadas — alertas aunque no tengas la app abierta' : 'Recibí alertas del master en el celular'}
        </p>
        {msg && (
          <p className={`text-[9px] font-black uppercase mt-2 ${msg.ok ? 'text-emerald-500' : 'text-red-400'}`}>
            {msg.text}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`shrink-0 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50 ${activo ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' : 'bg-blue-600 text-white'}`}
      >
        {loading ? '...' : activo ? 'Desactivar' : 'Activar push'}
      </button>
    </div>
  )
}
