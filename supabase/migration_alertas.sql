-- Alertas in-app (master → atletas)
CREATE TABLE IF NOT EXISTS alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensaje text NOT NULL,
  perfil_id uuid REFERENCES perfiles(id) ON DELETE CASCADE,
  creado_por uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alertas_leidas (
  alerta_id uuid REFERENCES alertas(id) ON DELETE CASCADE,
  perfil_id uuid REFERENCES perfiles(id) ON DELETE CASCADE,
  leida_at timestamptz DEFAULT now(),
  PRIMARY KEY (alerta_id, perfil_id)
);

-- perfil_id NULL en alertas = mensaje para todos los atletas
