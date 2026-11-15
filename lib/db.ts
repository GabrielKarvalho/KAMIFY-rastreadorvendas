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
