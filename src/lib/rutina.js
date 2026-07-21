import { supabase } from '../supabaseClient'

export const DIAS_DEFAULT = [
  { nombre: 'Lunes', musculos: 'Espalda y Bíceps' },
  { nombre: 'Miércoles', musculos: 'Pecho, Hombro y Tríceps' },
  { nombre: 'Viernes', musculos: 'Piernas' },
]

export const TODOS_LOS_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const ORDEN_DIAS = TODOS_LOS_DIAS

const lsKey = (perfilId, key) => `gym_${key}_${perfilId}`

export function getDiasLocal(perfilId) {
  try {
    const raw = localStorage.getItem(lsKey(perfilId, 'dias_rutina'))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setDiasLocal(perfilId, dias) {
  localStorage.setItem(lsKey(perfilId, 'dias_rutina'), JSON.stringify(dias))
}

function marcaPersonalizadoLocal(perfilId, dias) {
  localStorage.setItem(lsKey(perfilId, 'rutina_personalizada'), 'true')
  if (dias) setDiasLocal(perfilId, dias)
}

export function isPersonalizado(perfil) {
  if (!perfil?.id) return false
  if (perfil.rutina_personalizada) return true
  return localStorage.getItem(lsKey(perfil.id, 'rutina_personalizada')) === 'true'
}

export function usaRutinaPredefinida(perfil) {
  return !isPersonalizado(perfil)
}

export async function fetchPredefinidos() {
  const { data } = await supabase.from('ejercicios').select('*').is('perfil_id', null).order('nombre')
  if (data?.length) return data
  const { data: all } = await supabase.from('ejercicios').select('*').order('nombre')
  return (all || []).filter((e) => !e.perfil_id)
}

export function diasFromEjercicios(ejercicios) {
  const unicos = [...new Set(ejercicios.map((e) => e.dia).filter(Boolean))]
  unicos.sort((a, b) => {
    const ia = ORDEN_DIAS.indexOf(a)
    const ib = ORDEN_DIAS.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  if (unicos.length) {
    return unicos.map((nombre) => ({
      nombre,
      musculos: DIAS_DEFAULT.find((d) => d.nombre === nombre)?.musculos || '',
    }))
  }
  return DIAS_DEFAULT
}

export function parseDias(perfil, ejerciciosActuales = []) {
  if (isPersonalizado(perfil)) {
    const dias = perfil?.dias_rutina?.length ? perfil.dias_rutina : getDiasLocal(perfil.id)
    if (dias?.length) return dias
  }
  return diasFromEjercicios(ejerciciosActuales)
}

export async function fetchEjerciciosRutina(perfilId, personalizado) {
  const predefinidos = await fetchPredefinidos()
  if (!personalizado) return predefinidos
  const { data } = await supabase.from('ejercicios').select('*').eq('perfil_id', perfilId).order('nombre')
  const personal = data || []
  return personal.length ? personal : predefinidos
}

async function persistPersonalizado(perfilId, perfilBase, dias) {
  marcaPersonalizadoLocal(perfilId, dias)
  const { data, error } = await supabase
    .from('perfiles')
    .update({ rutina_personalizada: true, dias_rutina: dias })
    .eq('id', perfilId)
    .select('*')
    .single()
  if (!error && data) {
    return { ...data, rutina_personalizada: true, dias_rutina: dias }
  }
  return { ...perfilBase, rutina_personalizada: true, dias_rutina: dias }
}

export async function ensurePersonalizado(perfilId) {
  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', perfilId).single()
  if (isPersonalizado(perfil)) {
    const dias = parseDias(perfil, [])
    return { already: true, perfil: { ...perfil, rutina_personalizada: true, dias_rutina: dias } }
  }

  const globals = await fetchPredefinidos()
  const idMap = {}

  if (globals.length) {
    for (const g of globals) {
      const { data: inserted, error } = await supabase
        .from('ejercicios')
        .insert({
          nombre: g.nombre,
          dia: g.dia,
          num_series: g.num_series || 3,
          foto_url: g.foto_url || '',
          perfil_id: perfilId,
        })
        .select('id')
        .single()
      if (!error && inserted) idMap[g.id] = inserted.id
    }
    for (const [oldId, newId] of Object.entries(idMap)) {
      await supabase.from('series').update({ ejercicio_id: newId }).eq('perfil_id', perfilId).eq('ejercicio_id', oldId)
    }
  }

  const diasBase = diasFromEjercicios(globals)
  const updated = await persistPersonalizado(perfilId, perfil, diasBase)
  return { already: false, perfil: updated }
}

export async function guardarDiasRutina(perfilId, perfilBase, dias) {
  return persistPersonalizado(perfilId, perfilBase, dias)
}

export async function agregarDia(perfilId, perfil, nombre, musculos) {
  if (!musculos?.trim()) throw new Error('El grupo muscular es obligatorio')
  let p = perfil
  if (!isPersonalizado(perfil)) {
    const r = await ensurePersonalizado(perfilId)
    p = r.perfil
  }
  const dias = parseDias(p, [])
  if (dias.some((d) => d.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
    throw new Error('Ese día ya existe')
  }
  return guardarDiasRutina(perfilId, p, [...dias, { nombre: nombre.trim(), musculos: musculos.trim() }])
}

export async function eliminarDia(perfilId, perfil, nombreDia) {
  let p = perfil
  if (!isPersonalizado(perfil)) {
    const r = await ensurePersonalizado(perfilId)
    p = r.perfil
  }
  const dias = parseDias(p, []).filter((d) => d.nombre !== nombreDia)
  if (dias.length === 0) throw new Error('Tenés que tener al menos un día')
  await supabase.from('ejercicios').delete().eq('perfil_id', perfilId).eq('dia', nombreDia)
  return guardarDiasRutina(perfilId, p, dias)
}
