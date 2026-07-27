import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import {
  changePasswordByMaster,
  fetchRutinaUsuario,
  formatFecha,
  ultimosPesosPorEjercicio,
} from '../lib/auth'
import {
  MESES,
  buildMasterAnalytics,
  resolveUltimoLogin,
  estadoActividad,
  diasDesde,
  statsUsuario,
  filtrarAtletas,
  ordenarAtletas,
} from '../lib/masterStats'

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'rutinas', label: 'Rutinas' },
  { id: 'ejercicios', label: 'Ejercicios' },
  { id: 'alertas', label: 'Alertas' },
]

function Badge({ tone, children }) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    zinc: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  }
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[tone] || colors.zinc}`}>
      {children}
    </span>
  )
}

function KpiCard({ label, value, sub, accent = 'text-white' }) {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-4xl md:text-5xl font-black italic ${accent} leading-none`}>{value}</p>
      {sub && <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-3">{sub}</p>}
    </div>
  )
}

function MiniBarChart({ data, valueKey = 'series' }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => (
        <div key={d.key} className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="w-full flex items-end justify-center h-24">
            <div
              className="w-full max-w-[2.5rem] bg-red-600 rounded-t-xl transition-all"
              style={{ height: `${Math.max(8, (d[valueKey] / max) * 100)}%` }}
              title={`${d[valueKey]} series`}
            />
          </div>
          <span className="text-[8px] font-black text-zinc-600 uppercase truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 font-black text-white text-sm outline-none focus:border-red-600 placeholder:text-zinc-700"
    />
  )
}

function UserDetailPanel({
  user,
  analytics,
  allSeries,
  onBack,
}) {
  const [userRutina, setUserRutina] = useState({ ejercicios: [], tipo: '' })
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [detailTab, setDetailTab] = useState('resumen')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passMsg, setPassMsg] = useState(null)

  const seriesUsuario = useMemo(
    () => allSeries.filter((s) => s.perfil_id === user.id),
    [allSeries, user.id]
  )
  const uStats = useMemo(() => statsUsuario(seriesUsuario, user), [seriesUsuario, user])
  const pesosRecientes = useMemo(() => ultimosPesosPorEjercicio(seriesUsuario), [seriesUsuario])
  const ultimo = resolveUltimoLogin(user, analytics.porUsuario)
  const estado = estadoActividad(ultimo || analytics.porUsuario[user.username]?.last)

  useEffect(() => {
    setLoadingDetail(true)
    fetchRutinaUsuario(user).then((r) => {
      setUserRutina(r)
      setLoadingDetail(false)
    })
  }, [user])

  const rutinaPorDia = useMemo(() => {
    const map = {}
    userRutina.ejercicios.forEach((e) => {
      if (!map[e.dia]) map[e.dia] = []
      map[e.dia].push(e)
    })
    return map
  }, [userRutina])

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPassMsg(null)
    if (newPassword !== confirmPassword) {
      setPassMsg({ ok: false, text: 'Las contraseñas no coinciden' })
      return
    }
    const result = await changePasswordByMaster(user.id, newPassword)
    setPassMsg(result.ok ? { ok: true, text: 'Contraseña actualizada' } : { ok: false, text: result.error })
    if (result.ok) {
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const detailTabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'rutina', label: 'Rutina' },
    { id: 'progreso', label: 'Progreso' },
    { id: 'historial', label: 'Historial' },
    { id: 'seguridad', label: 'Seguridad' },
  ]

  return (
    <div className="space-y-8">
      <button type="button" onClick={onBack} className="text-[10px] font-black text-zinc-500 uppercase tracking-widest hover:text-white">
        ← Volver a usuarios
      </button>

      <header className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center font-black text-3xl text-white uppercase shrink-0">
              {user.username[0]}
            </div>
            <div>
              <h3 className="text-3xl md:text-4xl font-black uppercase italic text-white">{user.username}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge tone={estado.tone}>{estado.label}</Badge>
                <Badge tone={user.rutina_personalizada ? 'amber' : 'blue'}>
                  {user.rutina_personalizada ? 'Rutina propia' : 'Rutina gym'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div><p className="text-[9px] font-black text-zinc-600 uppercase">Último ingreso</p><p className="text-xs font-black text-blue-400 mt-1">{formatFecha(ultimo)}</p></div>
          <div><p className="text-[9px] font-black text-zinc-600 uppercase">Alta</p><p className="text-xs font-black text-white mt-1">{formatFecha(user.created_at)}</p></div>
          <div><p className="text-[9px] font-black text-zinc-600 uppercase">Series</p><p className="text-xs font-black text-white mt-1">{seriesUsuario.length}</p></div>
          <div><p className="text-[9px] font-black text-zinc-600 uppercase">Volumen</p><p className="text-xs font-black text-red-400 mt-1">{uStats.vol.toLocaleString()} KG</p></div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {detailTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDetailTab(t.id)}
            className={`px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest ${detailTab === t.id ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {detailTab === 'resumen' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCard label="Volumen total" value={`${uStats.vol.toLocaleString()} KG`} accent="text-red-500" />
          <KpiCard label="Intensidad sobrado" value={`${uStats.intensidad}%`} sub={`${uStats.sobrado} series sobradas`} accent="text-emerald-400" />
          <KpiCard label="Ejercicios usados" value={uStats.ejerciciosUnicos} />
          <KpiCard label="Días sin actividad" value={estado.dias ?? '—'} sub={estado.label} />
          <div className="md:col-span-2 bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Records personales</p>
            {uStats.prs.length === 0 ? (
              <p className="text-zinc-600 text-xs font-black uppercase">Sin records</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {uStats.prs.slice(0, 8).map((pr, i) => (
                  <div key={i} className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-900 flex justify-between gap-2">
                    <p className="font-black uppercase italic text-white text-sm truncate">{pr.nombre}</p>
                    <p className="font-black text-red-500 shrink-0">{pr.peso} KG {pr.sobrado && '💪'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detailTab === 'rutina' && (
        <div className="space-y-4">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
            Tipo: {loadingDetail ? '...' : userRutina.tipo}
          </p>
          {loadingDetail ? (
            <p className="text-zinc-600 animate-pulse text-xs font-black uppercase">Cargando...</p>
          ) : Object.keys(rutinaPorDia).length === 0 ? (
            <p className="text-zinc-600 text-xs font-black uppercase">Sin ejercicios</p>
          ) : (
            Object.entries(rutinaPorDia).map(([dia, ejercicios]) => (
              <div key={dia} className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
                <p className="text-lg font-black uppercase italic text-white mb-4">{dia}</p>
                <div className="space-y-2">
                  {ejercicios.map((e) => {
                    const ultimoPeso = pesosRecientes.find((p) => p.ejercicio_id === e.id)
                    return (
                      <div key={e.id} className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-900 gap-3">
                        <div className="min-w-0">
                          <p className="font-black uppercase italic text-white text-sm">{e.nombre}</p>
                          <p className="text-[10px] font-black text-zinc-600 uppercase">{e.num_series || 3} series</p>
                        </div>
                        <div className="text-right shrink-0">
                          {ultimoPeso ? (
                            <p className="text-sm font-black text-red-500">{ultimoPeso.peso} KG × {ultimoPeso.reps}</p>
                          ) : (
                            <p className="text-[10px] text-zinc-700 font-black uppercase">Sin peso</p>
                          )}
                          {e.foto_url && <span className="text-[9px] text-emerald-500 font-black">📷</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {detailTab === 'progreso' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MESES.map((mes) => {
              const d = uStats.porMes[mes]
              if (!d) return null
              return (
                <div key={mes} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
                  <p className="text-[10px] font-black text-blue-500 uppercase">{mes}</p>
                  <p className="text-2xl font-black italic text-white mt-2">{d.vol.toLocaleString()} KG</p>
                  <p className="text-[10px] font-black text-zinc-600 uppercase mt-1">{d.series} series · {d.sobrado} sobradas</p>
                </div>
              )
            })}
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Último peso por ejercicio</p>
            {pesosRecientes.map((s) => (
              <div key={`${s.ejercicio_id}-${s.created_at}`} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex justify-between">
                <div>
                  <p className="font-black uppercase italic text-white text-sm">{s.ejercicios?.nombre}</p>
                  <p className="text-[10px] text-zinc-600 font-black uppercase mt-1">{s.mes} S{s.semana} · {formatFecha(s.created_at)}</p>
                </div>
                <p className="font-black text-red-500">{s.peso}×{s.reps} {s.sobrado && '💪'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailTab === 'historial' && (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-hide">
          {seriesUsuario.map((s, i) => (
            <div key={i} className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-900 flex justify-between">
              <div>
                <p className="font-black uppercase italic text-white text-sm">{s.ejercicios?.nombre}</p>
                <p className="text-[10px] text-zinc-600 font-black uppercase">{s.mes} S{s.semana} · Serie {s.nro_serie} · {formatFecha(s.created_at)}</p>
              </div>
              <p className="font-black text-red-500">{s.peso} KG · {s.reps}r {s.sobrado && '💪'}</p>
            </div>
          ))}
          {seriesUsuario.length === 0 && <p className="text-zinc-600 text-xs font-black uppercase text-center py-10">Sin historial</p>}
        </div>
      )}

      {detailTab === 'seguridad' && (
        <section className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8 space-y-4 max-w-xl">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Cambiar contraseña del atleta</p>
          {passMsg && (
            <div className={`p-3 rounded-xl text-[10px] font-black uppercase text-center ${passMsg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {passMsg.text}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contraseña" minLength={4} required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 font-black text-white outline-none focus:border-red-600" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar" minLength={4} required className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 font-black text-white outline-none focus:border-red-600" />
            <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest">Guardar contraseña</button>
          </form>
        </section>
      )}
    </div>
  )
}

export default function MasterAdminPanel() {
  const [tab, setTab] = useState('overview')
  const [usuarios, setUsuarios] = useState([])
  const [allSeries, setAllSeries] = useState([])
  const [allEjercicios, setAllEjercicios] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroUsuarios, setFiltroUsuarios] = useState('todos')
  const [ordenUsuarios, setOrdenUsuarios] = useState('ultimo')
  const [filtroActividadUser, setFiltroActividadUser] = useState('todos')
  const [filtroActividadDias, setFiltroActividadDias] = useState('30')
  const [rutinaExpandida, setRutinaExpandida] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    const [u, s, e] = await Promise.all([
      supabase.from('perfiles').select('id, username, role, created_at, ultimo_login, rutina_personalizada, dias_rutina').order('username'),
      supabase.from('series').select('*, ejercicios(nombre, dia), perfiles(username)').order('created_at', { ascending: false }),
      supabase.from('ejercicios').select('*, perfiles(username)').order('dia'),
    ])
    setUsuarios(u.data || [])
    setAllSeries(s.data || [])
    setAllEjercicios(e.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const analytics = useMemo(
    () => buildMasterAnalytics(usuarios, allSeries, allEjercicios),
    [usuarios, allSeries, allEjercicios]
  )

  const atletasFiltrados = useMemo(() => {
    const filtrados = filtrarAtletas(analytics.atletas, {
      busqueda,
      filtro: filtroUsuarios,
      porUsuario: analytics.porUsuario,
    })
    return ordenarAtletas(filtrados, ordenUsuarios, analytics.porUsuario)
  }, [analytics, busqueda, filtroUsuarios, ordenUsuarios])

  const actividadFiltrada = useMemo(() => {
    let list = [...allSeries]
    if (filtroActividadUser !== 'todos') {
      list = list.filter((s) => s.perfil_id === filtroActividadUser)
    }
    if (filtroActividadDias !== 'all') {
      const limite = Date.now() - Number(filtroActividadDias) * 24 * 60 * 60 * 1000
      list = list.filter((s) => new Date(s.created_at).getTime() >= limite)
    }
    return list.slice(0, 150)
  }, [allSeries, filtroActividadUser, filtroActividadDias])

  const rutinasPorAtleta = useMemo(() => {
    return analytics.atletas.map((u) => {
      const propios = allEjercicios.filter((e) => e.perfil_id === u.id)
      const usaTemplate = !u.rutina_personalizada || propios.length === 0
      const ejercicios = usaTemplate ? analytics.predefinidos : propios
      return { usuario: u, ejercicios, tipo: usaTemplate ? 'predefinida' : 'personalizada' }
    })
  }, [analytics, allEjercicios])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-zinc-600 font-black uppercase text-xs tracking-widest animate-pulse">Cargando panel master...</p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-8 pb-24">
      <header>
        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] italic mb-2">Master Admin</p>
        <h2 className="text-4xl md:text-7xl font-black italic uppercase tracking-tighter text-white leading-none">Control Total</h2>
        <p className="text-zinc-600 font-bold mt-3 uppercase text-[10px] tracking-[0.25em] italic">
          Visibilidad completa de todos los atletas · {analytics.atletas.length} usuarios · {analytics.totalSeries} series · {analytics.volTotal.toLocaleString()} KG
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setSelectedUser(null) }}
            className={`px-4 py-2.5 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${tab === t.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
          >
            {t.label}
            {t.id === 'alertas' && analytics.inactivos.length > 0 && (
              <span className="ml-1.5 bg-white text-red-600 px-1.5 py-0.5 rounded-full text-[8px]">{analytics.inactivos.length}</span>
            )}
          </button>
        ))}
        <button type="button" onClick={fetchAll} className="ml-auto px-4 py-2.5 rounded-2xl font-black text-[9px] uppercase bg-zinc-900 text-zinc-500 border border-zinc-800">
          ↻ Actualizar
        </button>
      </div>

      {/* RESUMEN */}
      {tab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="Atletas" value={analytics.atletas.length} />
            <KpiCard label="Series" value={analytics.totalSeries} />
            <KpiCard label="Volumen" value={analytics.volTotal.toLocaleString()} sub="KG totales" accent="text-red-500" />
            <KpiCard label="Intensidad" value={`${analytics.intensidad}%`} sub="series sobradas" accent="text-emerald-400" />
            <KpiCard label="Activos 7d" value={analytics.activosSemana} accent="text-blue-400" />
            <KpiCard label="Rutinas propias" value={analytics.atletasPersonalizados} sub={`de ${analytics.atletas.length}`} accent="text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-6">Actividad últimos 7 días</p>
              <MiniBarChart data={analytics.ultimos7} />
              <div className="flex gap-4 mt-4 text-[9px] font-black text-zinc-600 uppercase">
                {analytics.ultimos7.map((d) => (
                  <span key={d.key}>{d.users} atletas · {d.vol.toLocaleString()} KG</span>
                )).slice(-1)}
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Ranking volumen</p>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                {Object.entries(analytics.porUsuario)
                  .sort((a, b) => b[1].vol - a[1].vol)
                  .slice(0, 8)
                  .map(([name, d], i) => (
                    <div key={name} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-xl">
                      <span className="font-black uppercase italic text-white text-sm"><span className="text-zinc-700 mr-2">0{i + 1}</span>{name}</span>
                      <span className="font-black text-red-500 text-sm">{d.vol.toLocaleString()} KG</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">Hall of Fame · Records</p>
              <div className="space-y-2">
                {analytics.topPRs.slice(0, 6).map((pr, i) => (
                  <div key={i} className="flex justify-between bg-zinc-900/50 p-3 rounded-xl gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-red-500 uppercase">{pr.username}</p>
                      <p className="font-black uppercase italic text-white text-sm truncate">{pr.nombre}</p>
                    </div>
                    <p className="font-black text-white shrink-0">{pr.peso} KG</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Volumen por mes (global)</p>
              <div className="grid grid-cols-2 gap-2">
                {MESES.map((mes) => {
                  const d = analytics.porMes[mes]
                  if (!d) return null
                  return (
                    <div key={mes} className="bg-zinc-900/50 p-3 rounded-xl">
                      <p className="text-[9px] font-black text-blue-500 uppercase">{mes.slice(0, 3)}</p>
                      <p className="font-black text-white text-sm">{d.vol.toLocaleString()} KG</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Última actividad registrada</p>
            <div className="space-y-2">
              {allSeries.slice(0, 8).map((s, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-900 last:border-0">
                  <div>
                    <span className="text-[10px] font-black text-red-500 uppercase">{s.perfiles?.username}</span>
                    <span className="text-white font-black uppercase italic text-sm ml-2">{s.ejercicios?.nombre}</span>
                  </div>
                  <span className="font-black text-zinc-400 text-sm">{s.peso}×{s.reps}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* USUARIOS */}
      {tab === 'usuarios' && !selectedUser && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar atleta..." />
            <div className="flex flex-wrap gap-2">
              {[
                ['todos', 'Todos'],
                ['activos', 'Activos'],
                ['inactivos', 'Inactivos'],
                ['personalizada', 'Rutina propia'],
                ['predefinida', 'Rutina gym'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFiltroUsuarios(id)}
                  className={`px-3 py-2 rounded-xl font-black text-[9px] uppercase ${filtroUsuarios === id ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[9px] font-black text-zinc-600 uppercase">Ordenar:</span>
            {[['ultimo', 'Último ingreso'], ['volumen', 'Volumen'], ['series', 'Series'], ['nombre', 'Nombre']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setOrdenUsuarios(id)} className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase ${ordenUsuarios === id ? 'text-red-500' : 'text-zinc-600'}`}>
                {label}
              </button>
            ))}
            <span className="ml-auto text-[9px] font-black text-zinc-600 uppercase">{atletasFiltrados.length} resultados</span>
          </div>
          <div className="space-y-3">
            {atletasFiltrados.map((u) => {
              const data = analytics.porUsuario[u.username] || { series: 0, vol: 0 }
              const ultimo = resolveUltimoLogin(u, analytics.porUsuario)
              const estado = estadoActividad(ultimo || data.last)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  className="w-full text-left bg-zinc-950 border border-zinc-900 rounded-[1.5rem] p-5 md:p-6 hover:border-red-600/40 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-black text-xl text-white uppercase shrink-0">{u.username[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xl font-black uppercase italic text-white">{u.username}</p>
                        <Badge tone={estado.tone}>{estado.label}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[9px] font-black uppercase tracking-widest">
                        <span className="text-zinc-600">{data.series} series</span>
                        <span className="text-red-500">{data.vol.toLocaleString()} KG</span>
                        <span className="text-blue-400">Ingreso: {formatFecha(ultimo).split(',')[0]}</span>
                        <span className="text-amber-500">{u.rutina_personalizada ? 'Rutina propia' : 'Rutina gym'}</span>
                      </div>
                    </div>
                    <span className="text-red-500 text-lg shrink-0">→</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'usuarios' && selectedUser && (
        <UserDetailPanel user={selectedUser} analytics={analytics} allSeries={allSeries} onBack={() => setSelectedUser(null)} />
      )}

      {/* ACTIVIDAD */}
      {tab === 'actividad' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={filtroActividadUser}
              onChange={(e) => setFiltroActividadUser(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 font-black text-white text-sm uppercase"
            >
              <option value="todos">Todos los atletas</option>
              {analytics.atletas.map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
            <select
              value={filtroActividadDias}
              onChange={(e) => setFiltroActividadDias(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 font-black text-white text-sm uppercase"
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="all">Todo el historial</option>
            </select>
          </div>
          <p className="text-[10px] font-black text-zinc-600 uppercase">{actividadFiltrada.length} registros</p>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-hide">
            {actividadFiltrada.map((s, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-red-500 uppercase">{s.perfiles?.username}</p>
                  <p className="font-black uppercase italic text-white truncate">{s.ejercicios?.nombre}</p>
                  <p className="text-[10px] font-black text-zinc-600 uppercase mt-1">{s.mes} · Sem {s.semana} · Serie {s.nro_serie} · {formatFecha(s.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-white">{s.peso} KG</p>
                  <p className="text-[10px] font-black text-zinc-500">{s.reps} reps {s.sobrado && '💪'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RUTINAS */}
      {tab === 'rutinas' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label="Rutina gym (template)" value={analytics.predefinidos.length} sub="ejercicios globales" />
            <KpiCard label="Rutinas personalizadas" value={analytics.personalizados.length} sub="ejercicios propios" accent="text-amber-400" />
            <KpiCard label="Atletas con rutina propia" value={analytics.atletasPersonalizados} accent="text-blue-400" />
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Plantilla del gym (todos la ven hasta personalizar)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {analytics.predefinidos.map((e) => (
                <div key={e.id} className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-900">
                  <p className="font-black uppercase italic text-white text-sm">{e.nombre}</p>
                  <p className="text-[9px] font-black text-zinc-600 uppercase">{e.dia} · {e.num_series || 3} series</p>
                </div>
              ))}
              {analytics.predefinidos.length === 0 && <p className="text-zinc-600 text-xs font-black uppercase">Sin plantilla cargada</p>}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Rutina efectiva por atleta</p>
            {rutinasPorAtleta.map(({ usuario, ejercicios, tipo }) => (
              <div key={usuario.id} className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRutinaExpandida(rutinaExpandida === usuario.id ? null : usuario.id)}
                  className="w-full p-5 flex justify-between items-center hover:bg-zinc-900/30"
                >
                  <div className="text-left">
                    <p className="text-lg font-black uppercase italic text-white">{usuario.username}</p>
                    <p className="text-[10px] font-black text-amber-500 uppercase mt-1">{tipo} · {ejercicios.length} ejercicios</p>
                  </div>
                  <span className="text-red-500 font-black">{rutinaExpandida === usuario.id ? '−' : '+'}</span>
                </button>
                {rutinaExpandida === usuario.id && (
                  <div className="px-5 pb-5 space-y-2 border-t border-zinc-900 pt-4">
                    {ejercicios.map((e) => (
                      <div key={e.id} className="flex justify-between bg-zinc-900/50 p-3 rounded-xl">
                        <div>
                          <p className="font-black uppercase italic text-white text-sm">{e.nombre}</p>
                          <p className="text-[9px] text-zinc-600 font-black uppercase">{e.dia}</p>
                        </div>
                        <span className="text-[9px] font-black text-zinc-500">{e.num_series || 3} ser</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EJERCICIOS GLOBAL */}
      {tab === 'ejercicios' && (
        <div className="space-y-6">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ejercicios más registrados en la app</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.topEjercicios.map((ej, i) => (
              <div key={ej.nombre} className="bg-zinc-950 border border-zinc-900 rounded-[1.5rem] p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-zinc-700">#{i + 1}</span>
                    <p className="font-black uppercase italic text-white text-lg mt-1">{ej.nombre}</p>
                  </div>
                  <p className="font-black text-red-500">{ej.maxPeso} KG max</p>
                </div>
                <div className="flex gap-4 mt-3 text-[9px] font-black uppercase text-zinc-600">
                  <span>{ej.count} series</span>
                  <span>{ej.vol.toLocaleString()} KG vol</span>
                  <span>{ej.users} atletas</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALERTAS */}
      {tab === 'alertas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KpiCard label="Inactivos +7 días" value={analytics.inactivos.length} accent="text-amber-400" />
            <KpiCard label="Sin ninguna serie" value={analytics.atletas.filter((u) => !(analytics.porUsuario[u.username]?.series)).length} accent="text-red-500" />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Atletas que necesitan atención</p>
            {analytics.inactivos.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => { setTab('usuarios'); setSelectedUser(u) }}
                className="w-full text-left bg-zinc-950 border border-amber-500/20 rounded-2xl p-5 flex justify-between items-center hover:border-amber-500/50"
              >
                <div>
                  <p className="font-black uppercase italic text-white">{u.username}</p>
                  <p className="text-[10px] font-black text-zinc-600 uppercase mt-1">
                    {u.estado.dias != null ? `Hace ${u.estado.dias} días sin actividad` : 'Nunca registró actividad'}
                  </p>
                  <p className="text-[10px] font-black text-blue-500 uppercase mt-1">Último ingreso: {formatFecha(resolveUltimoLogin(u, analytics.porUsuario))}</p>
                </div>
                <Badge tone={u.estado.tone}>{u.estado.label}</Badge>
              </button>
            ))}
            {analytics.inactivos.length === 0 && (
              <p className="text-center py-12 text-emerald-500 font-black uppercase text-xs">Todos los atletas están activos 🎉</p>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Atletas sin registros de peso</p>
            {analytics.atletas.filter((u) => !(analytics.porUsuario[u.username]?.series)).map((u) => (
              <div key={u.id} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex justify-between">
                <p className="font-black uppercase italic text-white">{u.username}</p>
                <Badge tone="zinc">Sin series</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
