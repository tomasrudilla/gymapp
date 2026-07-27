import { getUltimoLoginLocal } from './auth'

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function resolveUltimoLogin(usuario, porUsuario) {
  if (usuario?.ultimo_login) return usuario.ultimo_login
  const local = getUltimoLoginLocal(usuario?.id)
  if (local) return local
  return porUsuario[usuario?.username]?.last || null
}

export function diasDesde(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function estadoActividad(ultimoIso) {
  const dias = diasDesde(ultimoIso)
  if (dias === null) return { label: 'Sin actividad', tone: 'zinc', dias: null }
  if (dias <= 3) return { label: 'Activo', tone: 'emerald', dias }
  if (dias <= 7) return { label: 'Moderado', tone: 'blue', dias }
  if (dias <= 14) return { label: 'Inactivo', tone: 'amber', dias }
  return { label: 'Muy inactivo', tone: 'red', dias }
}

export function buildMasterAnalytics(usuarios, allSeries, allEjercicios) {
  const atletas = usuarios.filter((u) => u.role !== 'master')
  const porUsuario = {}
  const porMes = {}
  const porDia = {}
  const prs = {}
  const porEjercicio = {}
  let sobradoCount = 0

  allSeries.forEach((s) => {
    const name = s.perfiles?.username || s.perfil_id
    const vol = Number(s.peso) * Number(s.reps)
    const ejNombre = s.ejercicios?.nombre || 'Ejercicio'

    if (!porUsuario[name]) {
      porUsuario[name] = {
        perfil_id: s.perfil_id,
        series: 0,
        vol: 0,
        last: s.created_at,
        lastLoginProxy: s.created_at,
        sobrado: 0,
        ejercicios: new Set(),
      }
    }
    porUsuario[name].series++
    porUsuario[name].vol += vol
    porUsuario[name].ejercicios.add(s.ejercicio_id)
    if (s.created_at > porUsuario[name].last) porUsuario[name].last = s.created_at
    if (s.sobrado) {
      porUsuario[name].sobrado++
      sobradoCount++
    }

    if (!porMes[s.mes]) porMes[s.mes] = { series: 0, vol: 0 }
    porMes[s.mes].series++
    porMes[s.mes].vol += vol

    const dayKey = s.created_at?.slice(0, 10)
    if (dayKey) {
      if (!porDia[dayKey]) porDia[dayKey] = { series: 0, vol: 0, users: new Set() }
      porDia[dayKey].series++
      porDia[dayKey].vol += vol
      porDia[dayKey].users.add(s.perfil_id)
    }

    const prKey = `${s.perfil_id}-${s.ejercicio_id}`
    if (!prs[prKey] || Number(s.peso) > prs[prKey].peso) {
      prs[prKey] = {
        perfil_id: s.perfil_id,
        username: name,
        ejercicio_id: s.ejercicio_id,
        nombre: ejNombre,
        peso: Number(s.peso),
        reps: Number(s.reps),
        mes: s.mes,
        semana: s.semana,
        created_at: s.created_at,
      }
    }

    if (!porEjercicio[ejNombre]) {
      porEjercicio[ejNombre] = { count: 0, vol: 0, maxPeso: 0, users: new Set() }
    }
    porEjercicio[ejNombre].count++
    porEjercicio[ejNombre].vol += vol
    porEjercicio[ejNombre].maxPeso = Math.max(porEjercicio[ejNombre].maxPeso, Number(s.peso))
    porEjercicio[ejNombre].users.add(s.perfil_id)
  })

  atletas.forEach((u) => {
    if (!porUsuario[u.username]) {
      porUsuario[u.username] = {
        perfil_id: u.id,
        series: 0,
        vol: 0,
        last: null,
        sobrado: 0,
        ejercicios: new Set(),
      }
    }
  })

  const volTotal = allSeries.reduce((a, s) => a + Number(s.peso) * Number(s.reps), 0)
  const intensidad = allSeries.length ? Math.round((sobradoCount / allSeries.length) * 100) : 0

  const ultimos7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    ultimos7.push({
      key,
      label: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
      series: porDia[key]?.series || 0,
      vol: porDia[key]?.vol || 0,
      users: porDia[key]?.users?.size || 0,
    })
  }

  const topPRs = Object.values(prs)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 10)

  const topEjercicios = Object.entries(porEjercicio)
    .map(([nombre, d]) => ({ nombre, ...d, users: d.users.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  const predefinidos = allEjercicios.filter((e) => !e.perfil_id)
  const personalizados = allEjercicios.filter((e) => e.perfil_id)
  const atletasPersonalizados = atletas.filter((u) => u.rutina_personalizada).length

  const inactivos = atletas
    .map((u) => {
      const ultimo = resolveUltimoLogin(u, porUsuario)
      const actividad = porUsuario[u.username]?.last
      const ref = ultimo || actividad
      return { ...u, ref, estado: estadoActividad(ref) }
    })
    .filter((u) => u.estado.tone === 'red' || u.estado.tone === 'amber')
    .sort((a, b) => (diasDesde(a.ref) ?? 999) - (diasDesde(b.ref) ?? 999))

  const activosSemana = atletas.filter((u) => {
    const ref = resolveUltimoLogin(u, porUsuario) || porUsuario[u.username]?.last
    const d = diasDesde(ref)
    return d !== null && d <= 7
  }).length

  return {
    atletas,
    porUsuario,
    porMes,
    volTotal,
    totalSeries: allSeries.length,
    intensidad,
    sobradoCount,
    ultimos7,
    topPRs,
    topEjercicios,
    predefinidos,
    personalizados,
    atletasPersonalizados,
    inactivos,
    activosSemana,
    prsList: Object.values(prs),
  }
}

export function statsUsuario(series, perfil) {
  const vol = series.reduce((a, s) => a + Number(s.peso) * Number(s.reps), 0)
  const sobrado = series.filter((s) => s.sobrado).length
  const porMes = {}
  series.forEach((s) => {
    if (!porMes[s.mes]) porMes[s.mes] = { series: 0, vol: 0, sobrado: 0 }
    porMes[s.mes].series++
    porMes[s.mes].vol += Number(s.peso) * Number(s.reps)
    if (s.sobrado) porMes[s.mes].sobrado++
  })
  const prs = {}
  series.forEach((s) => {
    const key = s.ejercicio_id
    if (!prs[key] || Number(s.peso) > prs[key].peso) {
      prs[key] = {
        nombre: s.ejercicios?.nombre || 'Ejercicio',
        peso: Number(s.peso),
        reps: Number(s.reps),
        mes: s.mes,
        semana: s.semana,
        created_at: s.created_at,
        sobrado: s.sobrado,
      }
    }
  })
  return {
    vol,
    sobrado,
    intensidad: series.length ? Math.round((sobrado / series.length) * 100) : 0,
    porMes,
    prs: Object.values(prs).sort((a, b) => b.peso - a.peso),
    ejerciciosUnicos: new Set(series.map((s) => s.ejercicio_id)).size,
  }
}

export function filtrarAtletas(atletas, { busqueda, filtro, porUsuario, usuarios }) {
  let list = [...atletas]
  const q = busqueda.trim().toLowerCase()
  if (q) list = list.filter((u) => u.username.toLowerCase().includes(q))

  if (filtro === 'activos') {
    list = list.filter((u) => {
      const ref = resolveUltimoLogin(u, porUsuario) || porUsuario[u.username]?.last
      const d = diasDesde(ref)
      return d !== null && d <= 7
    })
  } else if (filtro === 'inactivos') {
    list = list.filter((u) => {
      const ref = resolveUltimoLogin(u, porUsuario) || porUsuario[u.username]?.last
      const d = diasDesde(ref)
      return d === null || d > 7
    })
  } else if (filtro === 'personalizada') {
    list = list.filter((u) => u.rutina_personalizada)
  } else if (filtro === 'predefinida') {
    list = list.filter((u) => !u.rutina_personalizada)
  }

  return list
}

export function ordenarAtletas(list, orden, porUsuario, usuarios) {
  const sorted = [...list]
  sorted.sort((a, b) => {
    if (orden === 'nombre') return a.username.localeCompare(b.username)
    if (orden === 'volumen') {
      return (porUsuario[b.username]?.vol || 0) - (porUsuario[a.username]?.vol || 0)
    }
    if (orden === 'series') {
      return (porUsuario[b.username]?.series || 0) - (porUsuario[a.username]?.series || 0)
    }
    if (orden === 'ultimo') {
      const ra = resolveUltimoLogin(a, porUsuario) || porUsuario[a.username]?.last || ''
      const rb = resolveUltimoLogin(b, porUsuario) || porUsuario[b.username]?.last || ''
      return rb.localeCompare(ra)
    }
    return 0
  })
  return sorted
}
