import { sql, garantirSchema } from "@/lib/db";

/** Contas de anúncio configuradas (ex.: "act_123,act_456" ou "123,456"). */
export function contasConfiguradas(): string[] {
  return (process.env.META_AD_ACCOUNT_IDS || process.env.META_AD_ACCOUNT_ID || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("act_") ? s : "act_" + s));
}

const token = () => process.env.META_ADS_TOKEN || process.env.META_ACCESS_TOKEN || "";
const versao = () => process.env.META_API_VERSION || "v25.0";
export const adsConfigurado = () => contasConfiguradas().length > 0 && !!token();

async function graph(path: string, params: Record<string, string>) {
  const out: any[] = [];
  const q = new URLSearchParams({ ...params, access_token: token(), limit: "500" });
  let url: string | null = `https://graph.facebook.com/${versao()}/${path}?${q}`;
  let paginas = 0;
  while (url && paginas++ < 40) {
    const r: Response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const j: any = await r.json();
    if (!r.ok || j.error) throw new Error(j?.error?.message || `HTTP ${r.status}`);
    if (Array.isArray(j.data)) out.push(...j.data);
    else out.push(j);
    url = j.paging?.next || null;
  }
  return out;
}

/** POST na Graph API (alterar status/orçamento). */
export async function graphPost(id: string, campos: Record<string, string>) {
  const body = new URLSearchParams({ ...campos, access_token: token() });
  const r = await fetch(`https://graph.facebook.com/${versao()}/${id}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(15000),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j?.error || {};
    throw new Error(e.error_user_msg || e.message || `HTTP ${r.status}`);
  }
  return j;
}

const acao = (acoes: any[] | undefined, tipos: string[]) => {
  if (!Array.isArray(acoes)) return 0;
  let melhor = 0;
  for (const a of acoes) if (tipos.includes(a.action_type)) melhor = Math.max(melhor, Number(a.value) || 0);
  return Math.round(melhor);
};
const cent = (v: unknown) => Math.round((Number(v) || 0) * 100);

async function sincronizarConta(conta: string, deDia: string, ateDia: string) {
  // 1. Métricas por anúncio por dia
  const linhas = await graph(`${conta}/insights`, {
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since: deDia, until: ateDia }),
    fields: [
      "date_start", "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
      "spend", "impressions", "clicks", "inline_link_clicks", "actions",
    ].join(","),
  });

  await sql`DELETE FROM ads_diario WHERE conta = ${conta} AND data BETWEEN ${deDia} AND ${ateDia}`;
  for (let i = 0; i < linhas.length; i += 150) {
    const lote = linhas.slice(i, i + 150);
    const vals: unknown[] = [];
    const tuplas = lote.map((l) => {
      const base = vals.length;
      vals.push(
        l.date_start, l.ad_id, conta, l.campaign_id, l.campaign_name, l.adset_id, l.adset_name, l.ad_name,
        cent(l.spend), Number(l.impressions) || 0, Number(l.clicks) || 0, Number(l.inline_link_clicks) || 0,
        acao(l.actions, ["landing_page_view", "omni_landing_page_view"]),
        acao(l.actions, ["initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout"]),
      );
      return `(${Array.from({ length: 14 }, (_, k) => `$${base + k + 1}`).join(",")})`;
    });
    await sql.query(
      `INSERT INTO ads_diario (data, ad_id, conta, campaign_id, campaign_name, adset_id, adset_name, ad_name,
        gasto, impressoes, cliques, cliques_link, lp_views, checkouts)
       VALUES ${tuplas.join(",")}
       ON CONFLICT (data, ad_id) DO UPDATE SET
        gasto = EXCLUDED.gasto, impressoes = EXCLUDED.impressoes, cliques = EXCLUDED.cliques,
        cliques_link = EXCLUDED.cliques_link, lp_views = EXCLUDED.lp_views, checkouts = EXCLUDED.checkouts,
        campaign_name = EXCLUDED.campaign_name, adset_name = EXCLUDED.adset_name, ad_name = EXCLUDED.ad_name,
        atualizado_em = now()`,
      vals,
    );
  }

  // 2. Status e orçamento de campanhas / conjuntos / anúncios
  const [camps, sets, ads, info] = await Promise.all([
    graph(`${conta}/campaigns`, { fields: "id,name,status,effective_status,daily_budget,lifetime_budget" }),
    graph(`${conta}/adsets`, { fields: "id,name,status,campaign_id,effective_status,daily_budget,lifetime_budget" }),
    graph(`${conta}/ads`, { fields: "id,name,status,adset_id,effective_status" }),
    graph(conta, { fields: "name,balance,amount_spent,spend_cap,account_status,currency,is_prepay_account,funding_source_details" }),
  ]);
  const objs = [
    ...camps.map((o) => ["campanha", o.id, null, o.name, o.effective_status, o.daily_budget ?? o.lifetime_budget ?? null, o.daily_budget ? "diario" : o.lifetime_budget ? "total" : null, o.status]),
    ...sets.map((o) => ["conjunto", o.id, o.campaign_id, o.name, o.effective_status, o.daily_budget ?? o.lifetime_budget ?? null, o.daily_budget ? "diario" : o.lifetime_budget ? "total" : null, o.status]),
    ...ads.map((o) => ["anuncio", o.id, o.adset_id, o.name, o.effective_status, null, null, o.status]),
  ];
  for (let i = 0; i < objs.length; i += 150) {
    const lote = objs.slice(i, i + 150);
    const vals: unknown[] = [];
    const tuplas = lote.map((o) => {
      const b = vals.length;
      vals.push(o[1], o[0], conta, o[2], o[3], o[4], o[5] === null ? null : Number(o[5]), o[6], o[7] ?? null);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
    });
    await sql.query(
      `INSERT INTO meta_objetos (id, nivel, conta, pai_id, nome, status, orcamento, tipo_orcamento, status_config)
       VALUES ${tuplas.join(",")}
       ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, status = EXCLUDED.status, pai_id = EXCLUDED.pai_id,
         status_config = EXCLUDED.status_config,
         orcamento = EXCLUDED.orcamento, tipo_orcamento = EXCLUDED.tipo_orcamento, atualizado_em = now()`,
      vals,
    );
  }

  const a = info[0] || {};
  await sql`
    INSERT INTO meta_contas (id, nome, saldo_texto, saldo, gasto_total, limite, status, moeda)
    VALUES (${conta}, ${a.name ?? null}, ${a.funding_source_details?.display_string ?? null},
            ${a.balance != null ? Number(a.balance) : null},
            ${a.amount_spent != null ? Number(a.amount_spent) : null},
            ${a.spend_cap != null && a.spend_cap !== "0" ? Number(a.spend_cap) : null},
            ${a.account_status ?? null}, ${a.currency ?? null})
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, saldo_texto = EXCLUDED.saldo_texto, saldo = EXCLUDED.saldo, gasto_total = EXCLUDED.gasto_total,
      limite = EXCLUDED.limite, status = EXCLUDED.status, moeda = EXCLUDED.moeda, atualizado_em = now()`;
}

/**
 * Atualiza os dados da Meta para o período, no máximo a cada 10 min (ou na hora, se forcar).
 * Retorna o erro mais recente, se houver.
 */
export async function sincronizarMeta(deDia: string, ateDia: string, forcar = false): Promise<string | null> {
  if (!adsConfigurado()) return null;
  await garantirSchema();
  const erros: string[] = [];
  await Promise.all(
    contasConfiguradas().map(async (conta) => {
      const chave = `${conta}:${deDia}:${ateDia}`;
      const [ult] = (await sql`SELECT em, erro FROM meta_sync WHERE chave = ${chave}`) as any[];
      const fresco = ult && !ult.erro && Date.now() - new Date(ult.em).getTime() < 10 * 60_000;
      if (fresco && !forcar) return;
      try {
        await sincronizarConta(conta, deDia, ateDia);
        await sql`INSERT INTO meta_sync (chave, em, erro) VALUES (${chave}, now(), NULL)
                  ON CONFLICT (chave) DO UPDATE SET em = now(), erro = NULL`;
      } catch (e: any) {
        const msg = `${conta}: ${e?.message || e}`;
        erros.push(msg);
        await sql`INSERT INTO meta_sync (chave, em, erro) VALUES (${chave}, now(), ${msg})
                  ON CONFLICT (chave) DO UPDATE SET em = now(), erro = ${msg}`;
      }
    }),
  );
  return erros.length ? erros.join(" · ") : null;
}

export const STATUS_META: Record<string, [string, string]> = {
  ACTIVE: ["Ativo", "ok"],
  PAUSED: ["Pausado", "muted"],
  CAMPAIGN_PAUSED: ["Campanha pausada", "muted"],
  ADSET_PAUSED: ["Conjunto pausado", "muted"],
  DELETED: ["Excluído", "muted"],
  ARCHIVED: ["Arquivado", "muted"],
  IN_PROCESS: ["Em análise", "wait"],
  PENDING_REVIEW: ["Em análise", "wait"],
  WITH_ISSUES: ["Com problemas", "bad"],
  DISAPPROVED: ["Reprovado", "bad"],
  PENDING_BILLING_INFO: ["Pagamento pendente", "bad"],
};
