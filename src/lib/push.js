import { supabase } from '../supabaseClient'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushSoportado() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export async function obtenerSuscripcionPush(perfilId) {
  if (!perfilId) return null
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('perfil_id', perfilId)
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function suscribirPush(perfilId) {
  if (!pushSoportado()) {
    return { ok: false, error: 'Tu navegador no soporta notificaciones push' }
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    return { ok: false, error: 'Falta configurar VITE_VAPID_PUBLIC_KEY en el deploy' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: 'Activá las notificaciones en Ajustes del navegador' }
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const subscription = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      perfil_id: perfilId,
      endpoint: subscription.endpoint,
      subscription,
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    const hint =
      error.code === '42501' || error.message?.includes('row-level security')
        ? 'RLS bloquea el guardado. Corré: ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;'
        : error.message?.includes('relation') || error.code === '42P01'
          ? '¿Corriste migration_push.sql?'
          : error.message
    return { ok: false, error: hint }
  }
  return { ok: true }
}

export async function desuscribirPush(perfilId) {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    /* ignore */
  }
  return { ok: true }
}

export async function invocarPushAlerta({ titulo, mensaje, perfilId }) {
  try {
    const { error } = await supabase.functions.invoke('send-push-alert', {
      body: { titulo, mensaje, perfilId: perfilId || null },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'Edge Function no desplegada' }
  }
}
