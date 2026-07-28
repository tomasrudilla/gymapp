import { supabase } from '../supabaseClient'
import { invocarPushAlerta } from './push'

export async function enviarAlerta({ titulo, mensaje, perfilId, creadoPor }) {
  const t = titulo?.trim()
  const m = mensaje?.trim()
  if (!t || !m) return { ok: false, error: 'Título y mensaje son obligatorios' }

  const { error } = await supabase.from('alertas').insert({
    titulo: t,
    mensaje: m,
    perfil_id: perfilId || null,
    creado_por: creadoPor,
  })

  if (error) {
    const hint =
      error.code === '42501' || error.message?.includes('row-level security')
        ? 'RLS bloquea el envío. Corré: ALTER TABLE alertas DISABLE ROW LEVEL SECURITY;'
        : error.message?.includes('relation') || error.code === '42P01'
          ? '¿Corriste migration_alertas.sql?'
          : error.message
    return { ok: false, error: hint }
  }

  const push = await invocarPushAlerta({ titulo: t, mensaje: m, perfilId: perfilId || null })

  return {
    ok: true,
    pushOk: push.ok,
    pushError: push.error,
  }
}

export async function fetchAlertasMaster() {
  const { data, error } = await supabase
    .from('alertas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return []
  return data || []
}

export async function fetchAlertasParaUsuario(perfilId) {
  const { data: alertas, error } = await supabase
    .from('alertas')
    .select('*')
    .or(`perfil_id.is.null,perfil_id.eq.${perfilId}`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !alertas?.length) return []

  const { data: leidas } = await supabase
    .from('alertas_leidas')
    .select('alerta_id')
    .eq('perfil_id', perfilId)

  const leidasSet = new Set((leidas || []).map((l) => l.alerta_id))
  return alertas.filter((a) => !leidasSet.has(a.id))
}

export async function marcarAlertaLeida(alertaId, perfilId) {
  await supabase.from('alertas_leidas').upsert(
    { alerta_id: alertaId, perfil_id: perfilId },
    { onConflict: 'alerta_id,perfil_id' }
  )
}

export async function marcarTodasLeidas(perfilId, alertaIds) {
  if (!alertaIds.length) return
  await supabase.from('alertas_leidas').upsert(
    alertaIds.map((id) => ({ alerta_id: id, perfil_id: perfilId })),
    { onConflict: 'alerta_id,perfil_id' }
  )
}
