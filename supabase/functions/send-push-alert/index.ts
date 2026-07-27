import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const { titulo, mensaje, perfilId } = await req.json()
    if (!titulo || !mensaje) {
      return new Response(JSON.stringify({ error: 'Faltan titulo o mensaje' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!publicKey || !privateKey) {
      return new Response(JSON.stringify({ error: 'VAPID keys no configuradas en Edge Function' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let query = supabase.from('push_subscriptions').select('subscription, endpoint')
    if (perfilId) {
      query = query.eq('perfil_id', perfilId)
    }

    const { data: subs, error: dbError } = await query
    if (dbError) throw dbError

    webpush.setVapidDetails('mailto:gym@local.app', publicKey, privateKey)

    const payload = JSON.stringify({
      title: titulo,
      body: mensaje,
      url: '/',
    })

    let sent = 0
    const stale = []

    for (const row of subs ?? []) {
      try {
        await webpush.sendNotification(row.subscription, payload)
        sent++
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          stale.push(row.endpoint)
        }
      }
    }

    if (stale.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', stale)
    }

    return new Response(JSON.stringify({ sent, total: subs?.length ?? 0 }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
