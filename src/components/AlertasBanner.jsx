import { useState, useEffect } from 'react'
import { fetchAlertasParaUsuario, marcarAlertaLeida, marcarTodasLeidas } from '../lib/alertas'
import { formatFecha } from '../lib/auth'

export default function AlertasBanner({ perfilId }) {
  const [alertas, setAlertas] = useState([])
  const [abierta, setAbierta] = useState(null)

  const cargar = async () => {
    if (!perfilId) return
    const data = await fetchAlertasParaUsuario(perfilId)
    setAlertas(data)
  }

  useEffect(() => {
    cargar()
  }, [perfilId])

  if (!alertas.length) return null

  const cerrarUna = async (id) => {
    await marcarAlertaLeida(id, perfilId)
    setAlertas((prev) => prev.filter((a) => a.id !== id))
    setAbierta(null)
  }

  const cerrarTodas = async () => {
    await marcarTodasLeidas(perfilId, alertas.map((a) => a.id))
    setAlertas([])
    setAbierta(null)
  }

  const actual = alertas.find((a) => a.id === abierta) || alertas[0]

  return (
    <div className="mb-6 space-y-3">
      <div className="bg-red-600/10 border border-red-500/40 rounded-[1.5rem] p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">
              {alertas.length} alerta{alertas.length > 1 ? 's' : ''} del gym
            </p>
            <button
              type="button"
              onClick={() => setAbierta(actual.id)}
              className="text-left w-full"
            >
              <p className="font-black uppercase italic text-white text-sm md:text-base truncate">{actual.titulo}</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1">{formatFecha(actual.created_at)}</p>
            </button>
          </div>
          <button
            type="button"
            onClick={cerrarTodas}
            className="shrink-0 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-white px-2 py-1"
          >
            Cerrar todas
          </button>
        </div>
        {alertas.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
            {alertas.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAbierta(a.id)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${abierta === a.id || (!abierta && a.id === actual.id) ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500'}`}
              >
                {a.titulo.slice(0, 20)}
              </button>
            ))}
          </div>
        )}
      </div>

      {abierta && (
        <div className="fixed inset-0 z-[450] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setAbierta(null)} />
          <div className="relative w-full max-w-lg bg-zinc-950 border border-red-500/30 rounded-[2rem] p-6 md:p-8 animate-in slide-in-from-bottom duration-300">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Mensaje del gym</p>
            <h3 className="text-2xl font-black uppercase italic text-white mb-4">{actual.titulo}</h3>
            <p className="text-sm font-bold text-zinc-300 leading-relaxed whitespace-pre-wrap">{actual.mensaje}</p>
            <p className="text-[10px] font-black text-zinc-600 uppercase mt-4">{formatFecha(actual.created_at)}</p>
            <button
              type="button"
              onClick={() => cerrarUna(actual.id)}
              className="w-full mt-6 bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
