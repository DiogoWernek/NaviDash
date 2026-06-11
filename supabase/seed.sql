-- =============================================================
-- SEED: Business Managers e Ad Accounts
-- Execute no SQL Editor do Supabase após criar as tabelas
-- =============================================================

-- Business Managers
INSERT INTO business_managers (id, name, meta_bm_id) VALUES
  (gen_random_uuid(), 'Conta Principal', '<ID_DA_BM_PRINCIPAL>'),
  (gen_random_uuid(), 'Conta Saúde',     '<ID_DA_BM_SAUDE>')
ON CONFLICT (meta_bm_id) DO NOTHING;

-- Ad Accounts — substitua act_XXXXXXXXXX pelos IDs reais das contas
-- O access_token vem das variáveis META_TOKEN_CONTA_PRINCIPAL e META_TOKEN_CONTA_SAUDE do .env.local
--
-- Para descobrir o ID das suas ad accounts, acesse:
-- https://graph.facebook.com/v21.0/me/adaccounts?access_token=SEU_TOKEN

INSERT INTO ad_accounts (bm_id, name, meta_account_id, access_token, currency, active)
SELECT
  bm.id,
  'Conta Principal — Ad Account 1',
  'act_XXXXXXXXXX',  -- substitua pelo ID real
  'SEU_TOKEN_CONTA_PRINCIPAL',  -- cole o valor de META_TOKEN_CONTA_PRINCIPAL
  'BRL',
  TRUE
FROM business_managers bm
WHERE bm.name = 'Conta Principal';

INSERT INTO ad_accounts (bm_id, name, meta_account_id, access_token, currency, active)
SELECT
  bm.id,
  'Conta Saúde — Ad Account 1',
  'act_YYYYYYYYYY',  -- substitua pelo ID real
  'SEU_TOKEN_CONTA_SAUDE',  -- cole o valor de META_TOKEN_CONTA_SAUDE
  'BRL',
  TRUE
FROM business_managers bm
WHERE bm.name = 'Conta Saúde';

-- =============================================================
-- Para listar suas ad accounts via API (rode no browser/curl):
-- GET https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id&access_token=SEU_TOKEN
-- =============================================================
