-- Push notifications (Web Push / PWA)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid REFERENCES perfiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_perfil ON push_subscriptions(perfil_id);

-- Esta app usa la anon key sin Supabase Auth (igual que perfiles/series).
-- En el popup de Supabase elegí "Run without RLS", o ejecutá esto después:
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;

-- Generar claves VAPID (en tu Mac, una sola vez):
--   npx web-push generate-vapid-keys
-- Copiá la Public Key en .env → VITE_VAPID_PUBLIC_KEY
-- Copiá la Private Key en Supabase Edge Function secrets → VAPID_PRIVATE_KEY
-- También secret VAPID_PUBLIC_KEY (misma public key)
