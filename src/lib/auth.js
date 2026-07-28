import { supabase } from '../supabaseClient'

export const BUCKET_EJERCICIOS = 'Ejercicios-GymApp'

export function getFotoEjercicioUrl(ej) {
  if (!ej?.foto_url?.trim()) return null
  return supabase.storage.from(BUCKET_EJERCICIOS).getPublicUrl(ej.foto_url.trim()).data.publicUrl
}

export async function fetchPerfilesMaster() {
  const full = await supabase
    .from('perfiles')
    .select('id, username, role, created_at, ultimo_login, rutina_personalizada, dias_rutina')
    .order('username')

  if (!full.error && full.data) return full.data

  const basic = await supabase
    .from('perfiles')
    .select('id, username, role, created_at')
    .order('username')

  return (basic.data || []).map((u) => ({
    ...u,
    ultimo_login: null,
    rutina_personalizada: false,
    dias_rutina: null,
  }))
}

export async function updateUltimoLogin(perfilId) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('perfiles').update({ ultimo_login: now }).eq('id', perfilId)
  if (error) {
    try {
      localStorage.setItem(`gym_ultimo_login_${perfilId}`, now)
    } catch {
      /* ignore */
    }
  }
  return now
}

export function getUltimoLoginLocal(perfilId) {
  try {
    return localStorage.getItem(`gym_ultimo_login_${perfilId}`)
  } catch {
    return null
  }
}

export async function resetPassword(username, newPassword) {
  const user = username?.trim()
  if (!user) return { ok: false, error: 'Ingresá tu usuario' }
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres' }
  }

  const { data, error } = await supabase
    .from('perfiles')
    .select('id, role')
    .eq('username', user)
    .single()

  if (error || !data) return { ok: false, error: 'Usuario no encontrado' }
  if (data.role === 'master') return { ok: false, error: 'Contactá al administrador para resetear una cuenta master' }

  const { error: updErr } = await supabase
    .from('perfiles')
    .update({ password: newPassword })
    .eq('id', data.id)

  if (updErr) return { ok: false, error: 'No se pudo actualizar la contraseña' }
  return { ok: true }
}

export async function changePasswordByMaster(perfilId, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: 'Mínimo 4 caracteres' }
  }
  const { error } = await supabase.from('perfiles').update({ password: newPassword }).eq('id', perfilId)
  if (error) return { ok: false, error: 'Error al guardar' }
  return { ok: true }
}

export async function crearUsuario({ username, password, role = 'atleta' }) {
  const user = username?.trim()
  if (!user) return { ok: false, error: 'Ingresá un nombre de usuario' }
  if (!password || password.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres' }
  }

  const { data: existing } = await supabase
    .from('perfiles')
    .select('id')
    .eq('username', user)
    .maybeSingle()

  if (existing) return { ok: false, error: 'Ese usuario ya existe' }

  const { data, error } = await supabase
    .from('perfiles')
    .insert({
      username: user,
      password,
      role: role === 'master' ? 'master' : 'atleta',
    })
    .select('id, username, role, created_at, ultimo_login, rutina_personalizada, dias_rutina')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ese usuario ya existe' }
    return { ok: false, error: error.message || 'No se pudo crear el usuario' }
  }

  return { ok: true, user: data }
}

export function formatFecha(iso) {
  if (!iso) return 'Sin registro'
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Sin registro'
  }
}

export async function fetchRutinaUsuario(perfil) {
  if (perfil?.rutina_personalizada) {
    const { data } = await supabase.from('ejercicios').select('*').eq('perfil_id', perfil.id).order('dia')
    if (data?.length) return { ejercicios: data, tipo: 'personalizada' }
  }
  const { data: predef } = await supabase.from('ejercicios').select('*').is('perfil_id', null).order('dia')
  if (predef?.length) return { ejercicios: predef, tipo: 'predefinida' }
  const { data: propios } = await supabase.from('ejercicios').select('*').eq('perfil_id', perfil.id).order('dia')
  return { ejercicios: propios || [], tipo: propios?.length ? 'personalizada' : 'sin rutina' }
}

export function ultimosPesosPorEjercicio(series) {
  const map = {}
  series.forEach((s) => {
    const key = s.ejercicio_id
    const prev = map[key]
    if (!prev || new Date(s.created_at) > new Date(prev.created_at)) {
      map[key] = s
    }
  })
  return Object.values(map).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
}
