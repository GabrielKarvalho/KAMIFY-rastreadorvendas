import { sql, garantirSchema } from "@/lib/db";
import { adsConfigurado, contasConfiguradas, sincronizarMeta } from "@/lib/meta-ads";
import type { Intervalo, SP } from "@/lib/filtros";

/** WHERE das vendas: período + produto (+ filtros extras já com $n). */
export function filtroVendas(iv: Intervalo, sp: SP) {
  const params: unknown[] = [iv.ini, iv.fim];
  const conds = ["v.criado_em >= $1", "v.criado_em < $2"];
  if (sp.produto) {
    params.push(sp.produto);
    conds.push(`v.checkout_id = $${params.length}`);
  }
  return {
    params,
    conds,
    add(cond: (n: string) => string, valor: unknown) {
      params.push(valor);
      conds.push(cond(`$${params.length}`));
    },
    get where() {
      return conds.join(" AND ");
    },
  };
}

/** WHERE dos dados da Meta: período + conta. */
export function filtroAds(iv: Intervalo, sp: SP) {
  const params: unknown[] = [iv.deDia, iv.ateDia];
  const conds = ["a.data BETWEEN $1 AND $2"];
  if (sp.conta) {
    params.push(sp.conta);
    conds.push(`a.conta = $${params.length}`);
  }
  return {
    params,
    conds,
    add(cond: (n: string) => string, valor: unknown) {
      params.push(valor);
      conds.push(cond(`$${params.length}`));
    },
    get where() {
      return conds.join(" AND ");
    },
  };
}

export const SQL_TOTAIS_VENDAS = `
  count(*) FILTER (WHERE v.status='paid')                                   AS vendas,
  coalesce(sum(v.valor) FILTER (WHERE v.status='paid'),0)                   AS bruto,
  coalesce(sum(v.valor - v.taxa) FILTER (WHERE v.status='paid'),0)          AS liquido,
  coalesce(sum(v.taxa) FILTER (WHERE v.status='paid'),0)                    AS taxas,
  count(*)                                                                  AS pedidos,
  count(*) FILTER (WHERE v.status='unpaid')                                 AS pendentes,
  coalesce(sum(v.valor) FILTER (WHERE v.status='unpaid'),0)                 AS pendentes_valor,
  count(*) FILTER (WHERE v.metodo='pix')                                    AS pix_gerados,
  count(*) FILTER (WHERE v.metodo='pix' AND v.pago_em IS NOT NULL)          AS pix_pagos,
  count(*) FILTER (WHERE v.metodo='credit_card')                            AS cartao_tent,
  count(*) FILTER (WHERE v.metodo='credit_card' AND v.pago_em IS NOT NULL)  AS cartao_aprov,
  count(*) FILTER (WHERE v.status='credit_card_declined')                   AS recusados,
  count(*) FILTER (WHERE v.status='refunded')                               AS estornos,
  coalesce(sum(v.valor) FILTER (WHERE v.status='refunded'),0)               AS estornos_valor,
  count(*) FILTER (WHERE v.status='chargedback')                            AS cbs,
  coalesce(sum(v.valor) FILTER (WHERE v.status='chargedback'),0)            AS cbs_valor,
  count(*) FILTER (WHERE v.pago_em IS NOT NULL)                             AS ja_pagas,
  count(*) FILTER (WHERE v.status='paid' AND v.capi_enviado_em IS NOT NULL) AS capi_ok
`;

export const SQL_TOTAIS_ADS = `
  coalesce(sum(a.gasto),0)        AS gasto,
  coalesce(sum(a.impressoes),0)   AS impressoes,
  coalesce(sum(a.cliques),0)      AS cliques,
  coalesce(sum(a.cliques_link),0) AS cliques_link,
  coalesce(sum(a.lp_views),0)     AS lp_views,
  coalesce(sum(a.checkouts),0)    AS checkouts
`;

/** Percentual de imposto opcional (ex.: IMPOSTO_PCT=6 para Simples) sobre o faturamento bruto. */
export const impostoPct = () => Math.max(0, Number(process.env.IMPOSTO_PCT || 0)) / 100;

/** Lista de produtos e contas para os filtros do topo, e sincroniza a Meta se preciso. */
export async function contexto(iv: Intervalo, sp: SP) {
  await garantirSchema();
  const erroMeta = await sincronizarMeta(iv.deDia, iv.ateDia, sp.sync === "1").catch((e) => String(e?.message || e));
  const [produtos, contas, ultimaMeta] = await Promise.all([
    sql`SELECT checkout_id AS id, max(checkout_titulo) AS titulo FROM vendas
        WHERE checkout_id IS NOT NULL GROUP BY 1 ORDER BY 2`,
    sql`SELECT id, nome FROM meta_contas ORDER BY nome`,
    sql`SELECT max(atualizado_em) AS em FROM ads_diario`,
  ]);
  const contasLista = contasConfiguradas().map((id) => ({
    id,
    nome: (contas as any[]).find((c) => c.id === id)?.nome || id,
  }));
  return {
    produtos: produtos as { id: string; titulo: string }[],
    contas: contasLista,
    adsAtivo: adsConfigurado(),
    erroMeta,
    ultimaMeta: ((ultimaMeta as any[])[0]?.em as string | null) || null,
  };
}
