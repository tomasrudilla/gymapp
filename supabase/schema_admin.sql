-- ============================================================
-- GYM APP — Ejecutá TODO esto en Supabase → SQL Editor → Run
-- ============================================================

-- 1) PERFILES: columnas nuevas
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'atleta';
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS rutina_personalizada boolean DEFAULT false;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS dias_rutina jsonb;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS ultimo_login timestamptz;

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

-- 4) CREAR USUARIO MASTER
--    Opción A: convertir un usuario existente (cambiá 'admin' por tu username)
-- UPDATE perfiles SET role = 'master' WHERE username = 'admin';

--    Opción B: crear master nuevo (cambiá usuario y contraseña)
-- INSERT INTO perfiles (username, password, role)
-- VALUES ('admin', 'admin123', 'master')
-- ON CONFLICT DO NOTHING;

-- 5) Verificación (opcional)
-- SELECT id, username, role, ultimo_login, rutina_personalizada FROM perfiles ORDER BY username;
-- SELECT id, nombre, dia, num_series, perfil_id FROM ejercicios ORDER BY dia, nombre;
