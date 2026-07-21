import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function MasterAdminPanel() {
  const [tab, setTab] = useState('overview')
  const [usuarios, setUsuarios] = useState([])
  const [allSeries, setAllSeries] = useState([])
  const [ejerciciosPorUsuario, setEjerciciosPorUsuario] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    const [u, s, e] = await Promise.all([
      supabase.from('perfiles').select('id, username, role, created_at').order('username'),
      supabase.from('series').select('*, ejercicios(nombre), perfiles(username)').order('created_at', { ascending: false }),
      supabase.from('ejercicios').select('*, perfiles(username)').not('perfil_id', 'is', null).order('dia'),
    ])
    setUsuarios(u.data || [])
    setAllSeries(s.data || [])
    setEjerciciosPorUsuario(e.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const stats = useMemo(() => {
    const atletas = usuarios.filter((u) => u.role !== 'master')
    const volTotal = allSeries.reduce((a, s) => a + Number(s.peso) * Number(s.reps), 0)
    const porUsuario = {}
    allSeries.forEach((s) => {
      const name = s.perfiles?.username || s.perfil_id
      if (!porUsuario[name]) porUsuario[name] = { series: 0, vol: 0, last: s.created_at }
      porUsuario[name].series++
      porUsuario[name].vol += Number(s.peso) * Number(s.reps)
      if (s.created_at > porUsuario[name].last) porUsuario[name].last = s.created_at
    })
    return { atletas: atletas.length, totalSeries: allSeries.length, volTotal, porUsuario }
  }, [usuarios, allSeries])

  const seriesUsuario = useMemo(() => {
    if (!selectedUser) return []
    return allSeries.filter((s) => s.perfil_id === selectedUser.id)
  }, [selectedUser, allSeries])

  const actividadReciente = allSeries.slice(0, 50)

  const tabs = [
    { id: 'overview', label: 'Resumen' },
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'actividad', label: 'Actividad' },
    { id: 'ejercicios', label: 'Rutinas' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-zinc-600 font-black uppercase text-xs tracking-widest animate-pulse">Cargando panel master...</p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-10 pb-20">
      <header>
        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] italic mb-2">Master Admin</p>
        <h2 className="text-5xl md:text-8xl font-black italic uppercase tracking-tighter text-white leading-none">
          Control Total
        </h2>
        <p className="text-zinc-600 font-bold mt-4 uppercase text-xs tracking-[0.3em] italic">
          Visibilidad completa de todos los atletas
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedUser(null) }}
            className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${tab === t.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
          >
            {t.label}
          </button>
        ))}
        <button onClick={fetchAll} className="ml-auto px-5 py-3 rounded-2xl font-black text-[10px] uppercase bg-zinc-900 text-zinc-500 border border-zinc-800">
          ↻ Actualizar
        </button>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Atletas</p>
            <p className="text-6xl font-black italic text-white">{stats.atletas}</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Series registradas</p>
            <p className="text-6xl font-black italic text-white">{stats.totalSeries}</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Volumen total</p>
            <p className="text-6xl font-black italic text-red-500">{stats.volTotal.toLocaleString()}<span className="text-2xl ml-1">KG</span></p>
          </div>
          <div className="md:col-span-3 bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-6">Ranking por volumen</p>
            <div className="space-y-3">
              {Object.entries(stats.porUsuario)
                .sort((a, b) => b[1].vol - a[1].vol)
                .slice(0, 10)
                .map(([name, d], i) => (
                  <div key={name} className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-zinc-900">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-black italic text-zinc-700 w-8">0{i + 1}</span>
                      <span className="font-black uppercase italic text-white">{name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-red-500">{d.vol.toLocaleString()} KG</p>
                      <p className="text-[10px] font-black text-zinc-600 uppercase">{d.series} series</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'usuarios' && !selectedUser && (
        <div className="space-y-4">
          {usuarios.filter((u) => u.role !== 'master').map((u) => {
            const data = stats.porUsuario[u.username] || { series: 0, vol: 0 }
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className="w-full text-left bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8 hover:border-red-600/50 transition-all active:scale-[0.99]"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-2xl font-black uppercase italic text-white">{u.username}</p>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-1">
                      {data.series} series · {data.vol.toLocaleString()} KG
                    </p>
                  </div>
                  <span className="text-red-500 font-black text-xl">→</span>
                </div>
              </button>
            )
          })}
          {usuarios.filter((u) => u.role !== 'master').length === 0 && (
            <p className="text-center py-16 text-zinc-600 font-black uppercase text-xs">No hay atletas registrados</p>
          )}
        </div>
      )}

      {tab === 'usuarios' && selectedUser && (
        <div className="space-y-8">
          <button onClick={() => setSelectedUser(null)} className="text-[10px] font-black text-zinc-500 uppercase tracking-widest hover:text-white">
            ← Volver a usuarios
          </button>
          <header>
            <h3 className="text-4xl font-black uppercase italic text-white">{selectedUser.username}</h3>
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-2">
              {seriesUsuario.length} series totales
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MESES.map((mes) => {
              const delMes = seriesUsuario.filter((s) => s.mes === mes)
              const vol = delMes.reduce((a, s) => a + Number(s.peso) * Number(s.reps), 0)
              if (delMes.length === 0) return null
              return (
                <div key={mes} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{mes}</p>
                  <p className="text-3xl font-black italic text-white mt-2">{vol.toLocaleString()} KG</p>
                  <p className="text-[10px] font-black text-zinc-600 uppercase mt-1">{delMes.length} series</p>
                </div>
              )
            })}
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-hide">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest sticky top-0 bg-black py-2">Historial completo</p>
            {seriesUsuario.map((s, i) => (
              <div key={i} className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-900 flex justify-between items-center">
                <div>
                  <p className="font-black uppercase italic text-white text-sm">{s.ejercicios?.nombre || 'Ejercicio'}</p>
                  <p className="text-[10px] font-black text-zinc-600 uppercase mt-1">
                    {s.mes} · Sem {s.semana} · Serie {s.nro_serie} {s.sobrado && '💪'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-red-500">{s.peso} KG</p>
                  <p className="text-[10px] font-black text-zinc-500">{s.reps} reps</p>
                </div>
              </div>
            ))}
            {seriesUsuario.length === 0 && (
              <p className="text-center py-10 text-zinc-600 font-black uppercase text-xs">Sin actividad</p>
            )}
          </div>
        </div>
      )}

      {tab === 'actividad' && (
        <div className="space-y-3 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {actividadReciente.map((s, i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 flex justify-between items-center gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{s.perfiles?.username || 'Usuario'}</p>
                <p className="font-black uppercase italic text-white truncate">{s.ejercicios?.nombre}</p>
                <p className="text-[10px] font-black text-zinc-600 uppercase mt-1">
                  {s.mes} S{s.semana} · {new Date(s.created_at).toLocaleDateString('es-AR')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-black text-white">{s.peso}×{s.reps}</p>
                {s.sobrado && <span className="text-emerald-500 text-xs">💪</span>}
              </div>
            </div>
          ))}
          {actividadReciente.length === 0 && (
            <p className="text-center py-16 text-zinc-600 font-black uppercase text-xs">Sin actividad registrada</p>
          )}
        </div>
      )}

      {tab === 'ejercicios' && (
        <div className="space-y-8">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Rutinas personalizadas de cada atleta
          </p>
          {usuarios.filter((u) => u.role !== 'master').map((u) => {
            const rutina = ejerciciosPorUsuario.filter((e) => e.perfil_id === u.id)
            if (rutina.length === 0) return null
            return (
              <div key={u.id} className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
                <p className="text-lg font-black uppercase italic text-white mb-4">{u.username}</p>
                <div className="space-y-2">
                  {rutina.map((e) => (
                    <div key={e.id} className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-900">
                      <div>
                        <p className="font-black uppercase italic text-white text-sm">{e.nombre}</p>
                        <p className="text-[10px] font-black text-zinc-600 uppercase">{e.dia} · {e.num_series || 3} series</p>
                      </div>
                      {e.foto_url && <span className="text-[10px] text-emerald-500 font-black uppercase">Con foto</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {ejerciciosPorUsuario.length === 0 && (
            <p className="text-center py-16 text-zinc-600 font-black uppercase text-xs">Nadie cargó rutina todavía</p>
          )}
        </div>
      )}
    </div>
  )
}
