-- Solo último login (si ya corriste el resto del schema_admin.sql)
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS ultimo_login timestamptz;

-- Verificar
SELECT username, role, ultimo_login FROM perfiles ORDER BY username;
