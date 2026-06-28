-- =============================================================
-- Tabela: facebook_pages
-- Execute no SQL Editor do Supabase
-- =============================================================

CREATE TABLE IF NOT EXISTS facebook_pages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  meta_page_id text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice para ordenação por nome (usado na query do GET)
CREATE INDEX IF NOT EXISTS facebook_pages_name_idx ON facebook_pages (name);

-- Exemplos (opcional — remova ou adapte)
-- INSERT INTO facebook_pages (name, meta_page_id) VALUES
--   ('Clínica Saúde Total', '123456789012345'),
--   ('Escola de Cursos XYZ', '987654321098765')
-- ON CONFLICT (meta_page_id) DO NOTHING;
