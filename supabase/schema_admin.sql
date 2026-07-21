-- ============================================================
-- GYM APP — Ejecutá TODO esto en Supabase → SQL Editor → Run
-- ============================================================

-- 1) PERFILES: columnas nuevas
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'atleta';
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS rutina_personalizada boolean DEFAULT false;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS dias_rutina jsonb;

-- 2) EJERCICIOS: columnas nuevas
ALTER TABLE ejercicios ADD COLUMN IF NOT EXISTS perfil_id uuid REFERENCES perfiles(id) ON DELETE CASCADE;
ALTER TABLE ejercicios ADD COLUMN IF NOT EXISTS num_series integer DEFAULT 3;

-- 3) RUTINA PREDEFINIDA DEL GYM
--    Los ejercicios que ya tenés cargados pasan a ser la plantilla para todos.
--    perfil_id NULL = visible para todos hasta que personalicen.
UPDATE ejercicios
SET
  perfil_id = NULL,
  num_series = COALESCE(num_series, 3);

-- 4) MASTER ADMIN (cambiá 'TU_USUARIO' por tu username real)
-- UPDATE perfiles SET role = 'master' WHERE username = 'TU_USUARIO';

-- 5) Verificación (opcional — podés correr esto después para chequear)
-- SELECT id, username, role, rutina_personalizada FROM perfiles;
-- SELECT id, nombre, dia, num_series, perfil_id FROM ejercicios ORDER BY dia, nombre;
