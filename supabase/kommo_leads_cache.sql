CREATE TABLE IF NOT EXISTS kommo_leads_cache (
  lead_id      bigint PRIMARY KEY,
  price        numeric NOT NULL DEFAULT 0,
  status_id    integer NOT NULL DEFAULT 0,
  status_name  text NOT NULL DEFAULT '',
  is_won       boolean NOT NULL DEFAULT false,
  is_lost      boolean NOT NULL DEFAULT false,
  course       text NOT NULL DEFAULT 'Não informado',
  source       text NOT NULL DEFAULT 'Não informado',
  created_date date NOT NULL,
  synced_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kommo_leads_cache_date_idx ON kommo_leads_cache (created_date);
