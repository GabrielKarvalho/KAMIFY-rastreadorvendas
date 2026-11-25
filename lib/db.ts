import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const sql = neon(url || "postgres://invalid");

let schemaPronto: Promise<void> | null = null;

/** Cria as tabelas na primeira chamada de cada instância (idempotente). */
export function garantirSchema() {
  if (!url) throw new Error("DATABASE_URL não configurada");
  if (!schemaPronto) {
    schemaPronto = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS vendas (
          id                TEXT PRIMARY KEY,
          status            TEXT NOT NULL,
          metodo            TEXT,
          tipo              TEXT,
          valor             INTEGER NOT NULL DEFAULT 0,
          taxa              INTEGER NOT NULL DEFAULT 0,
          valor_produto     INTEGER NOT NULL DEFAULT 0,
          checkout_id       TEXT,
          checkout_titulo   TEXT,
          orderbumps        JSONB NOT NULL DEFAULT '[]'::jsonb,
          cliente_nome      TEXT,
          cliente_email     TEXT,
          cliente_telefone  TEXT,
          cliente_documento TEXT,
          utm_source        TEXT,
          utm_medium        TEXT,
          utm_campaign      TEXT,
          utm_content       TEXT,
          utm_term          TEXT,
          fbc               TEXT,
          fbp               TEXT,
          ip                TEXT,
          useragent         TEXT,
          criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
          atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
          pago_em           TIMESTAMPTZ,
          capi_enviado_em   TIMESTAMPTZ,
          capi_resposta     TEXT,
          recebido_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
          raw               JSONB
        )`;
      await sql`CREATE INDEX IF NOT EXISTS vendas_criado_idx ON vendas (criado_em)`;
      await sql`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'webhook'`;
      await sql`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS lote TEXT`;
      await sql`
        CREATE TABLE IF NOT EXISTS webhook_log (
          id          BIGSERIAL PRIMARY KEY,
          recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
          payment_id  TEXT,
          status      TEXT,
          payload     JSONB
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS carrinhos (
          id          BIGSERIAL PRIMARY KEY,
          recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
          nome        TEXT,
          email       TEXT,
          telefone    TEXT,
          checkout_id TEXT,
          valor       INTEGER,
          payload     JSONB
        )`;
      // ---- Meta Ads ----
      await sql`
        CREATE TABLE IF NOT EXISTS ads_diario (
          data          DATE NOT NULL,
          ad_id         TEXT NOT NULL,
          conta         TEXT NOT NULL,
          campaign_id   TEXT, campaign_name TEXT,
          adset_id      TEXT, adset_name    TEXT,
          ad_name       TEXT,
          gasto         INTEGER NOT NULL DEFAULT 0,
          impressoes    INTEGER NOT NULL DEFAULT 0,
          cliques       INTEGER NOT NULL DEFAULT 0,
          cliques_link  INTEGER NOT NULL DEFAULT 0,
          lp_views      INTEGER NOT NULL DEFAULT 0,
          checkouts     INTEGER NOT NULL DEFAULT 0,
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (data, ad_id)
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS meta_objetos (
          id            TEXT PRIMARY KEY,
          nivel         TEXT NOT NULL,
          conta         TEXT NOT NULL,
          pai_id        TEXT,
          nome          TEXT,
          status        TEXT,
          orcamento     INTEGER,
          tipo_orcamento TEXT,
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`ALTER TABLE meta_objetos ADD COLUMN IF NOT EXISTS status_config TEXT`;
      await sql`
        CREATE TABLE IF NOT EXISTS meta_acoes (
          id         BIGSERIAL PRIMARY KEY,
          em         TIMESTAMPTZ NOT NULL DEFAULT now(),
          objeto_id  TEXT NOT NULL,
          nivel      TEXT,
          nome       TEXT,
          acao       TEXT NOT NULL,
          de         TEXT,
          para       TEXT,
          ok         BOOLEAN NOT NULL,
          resposta   TEXT
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS meta_contas (
          id            TEXT PRIMARY KEY,
          nome          TEXT,
          saldo_texto   TEXT,
          saldo         INTEGER,
          gasto_total   INTEGER,
          limite        INTEGER,
          status        INTEGER,
          moeda         TEXT,
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS gasto_manual (
          data          DATE PRIMARY KEY,
          valor         INTEGER NOT NULL,
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      // ---- Produto de cada campanha (para filtrar o gasto da Meta por produto) ----
      await sql`
        CREATE TABLE IF NOT EXISTS campanha_produto (
          campaign_id   TEXT PRIMARY KEY,
          checkout_id   TEXT NOT NULL,          -- '' = nenhum produto (não conta em nenhum filtro)
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      // automático: o produto com mais pedidos (qualquer status) vindos da UTM da campanha; o manual tem prioridade
      await sql.query(`
        CREATE OR REPLACE VIEW campanha_produto_efetivo AS
        WITH auto AS (
          SELECT DISTINCT ON (cid) cid, checkout_id
          FROM (
            SELECT substring(utm_campaign from '\\|([0-9]+)$') AS cid, checkout_id, count(*) AS n
            FROM vendas WHERE utm_campaign ~ '\\|[0-9]+$' AND checkout_id IS NOT NULL
            GROUP BY 1, 2
          ) t ORDER BY cid, n DESC
        )
        SELECT coalesce(m.campaign_id, a.cid) AS campaign_id,
               coalesce(m.checkout_id, a.checkout_id) AS checkout_id,
               (m.campaign_id IS NOT NULL) AS manual
        FROM auto a FULL OUTER JOIN campanha_produto m ON m.campaign_id = a.cid`)
        .catch((e) => console.error("view campanha_produto_efetivo", e?.message)); // corrida entre instâncias: outra já criou
      // ---- Recuperação de PIX ----
      await sql`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS rec_contatado_em TIMESTAMPTZ`;
      await sql`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS rec_descartado_em TIMESTAMPTZ`;
      await sql`ALTER TABLE vendas ADD COLUMN IF NOT EXISTS rec_notificado_em TIMESTAMPTZ`;
      await sql`
        CREATE TABLE IF NOT EXISTS push_inscricoes (
          endpoint   TEXT PRIMARY KEY,
          inscricao  JSONB NOT NULL,
          criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS config (
          chave         TEXT PRIMARY KEY,
          valor         TEXT,
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS meta_sync (
          chave TEXT PRIMARY KEY,
          em    TIMESTAMPTZ NOT NULL DEFAULT now(),
          erro  TEXT
        )`;
    })().catch((e) => {
      schemaPronto = null;
      throw e;
    });
  }
  return schemaPronto;
}
