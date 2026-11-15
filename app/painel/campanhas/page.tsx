import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { contexto, filtroAds, filtroVendas, impostoPct } from "@/lib/consultas";
import { STATUS_META } from "@/lib/meta-ads";
import { ChaveStatus, EditaOrcamento } from "@/components/Controles";
import { brl, intervalo, inteiro, linkCom, num, pct, vezes, type SP } from "@/lib/filtros";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NIVEIS = {
  campanhas: { ads: "campaign", utm: "utm_campaign", titulo: "Campanhas", um: "Campanha", obj: "campanha" },
  conjuntos: { ads: "adset", utm: "utm_medium", titulo: "Conjuntos", um: "Conjunto", obj: "conjunto" },
  anuncios: { ads: "ad", utm: "utm_content", titulo: "Anúncios", um: "Anúncio", obj: "anuncio" },
} as const;
type Nivel = keyof typeof NIVEIS;

type Linha = {
  id: string | null; nome: string; status?: string; statusConfig?: string | null; orcamento?: number | null; tipoOrc?: string | null; pai?: string | null;
  gasto: number; impressoes: number; cliques: number; cliques_link: number; lp_views: number; checkouts: number;
  vendas: number; bruto: number; fat: number; pix_gerados: number; pix_pagos: number; pedidos: number; perdas: number;
};

const COLUNAS: { k: string; t: string; dica?: string }[] = [
  { k: "orcamento", t: "Orçamento" },
  { k: "vendas", t: "Vendas" },
  { k: "cpa", t: "CPA" },
  { k: "gasto", t: "Gastos" },
  { k: "fat", t: "Faturamento", dica: "líquido de taxas" },
  { k: "lucro", t: "Lucro" },
  { k: "roas", t: "ROAS" },
  { k: "margem", t: "Margem" },
  { k: "roi", t: "ROI" },
  { k: "pix_gerados", t: "PIX gerados" },
  { k: "conv_pix", t: "Conv. PIX" },
  { k: "checkouts", t: "IC", dica: "Checkouts iniciados (Meta)" },
  { k: "cpi", t: "Custo/IC" },
  { k: "cpc", t: "CPC" },
  { k: "ctr", t: "CTR" },
  { k: "cpm", t: "CPM" },
  { k: "impressoes", t: "Impressões" },
  { k: "cliques_link", t: "Cliques" },
];

function metricas(l: Linha) {
  const imposto = Math.round(l.bruto * impostoPct());
  const lucro = l.fat - l.gasto - imposto;
  return {
    lucro,
    cpa: l.vendas && l.gasto ? l.gasto / l.vendas : null,
    roas: l.gasto ? l.fat / l.gasto : null,
    margem: l.fat ? lucro / l.fat : null,
    roi: l.gasto ? lucro / l.gasto : null,
    conv_pix: l.pix_gerados ? l.pix_pagos / l.pix_gerados : null,
    cpi: l.checkouts ? l.gasto / l.checkouts : null,
    cpc: l.cliques_link ? l.gasto / l.cliques_link : null,
    ctr: l.impressoes ? l.cliques_link / l.impressoes : null,
    cpm: l.impressoes ? (l.gasto / l.impressoes) * 1000 : null,
  };
}

export default async function Campanhas({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await estaLogado())) redirect("/entrar");
  const sp = await searchParams;
  const iv = intervalo(sp);
  const ctx = await contexto(iv, sp);
  const nivel: Nivel = (sp.nivel as Nivel) in NIVEIS ? (sp.nivel as Nivel) : "campanhas";
  const N = NIVEIS[nivel];

  const fv = filtroVendas(iv, sp);
  const fa = filtroAds(iv, sp);
  if (sp.campanha) {
    fa.add((p) => `a.campaign_id = ${p}`, sp.campanha);
    fv.add((p) => `v.utm_campaign ~ ('\\|' || ${p} || '$')`, sp.campanha);
  }
  if (sp.conjunto) {
    fa.add((p) => `a.adset_id = ${p}`, sp.conjunto);
    fv.add((p) => `v.utm_medium ~ ('\\|' || ${p} || '$')`, sp.conjunto);
  }

  const [ads, vendas, objs, nomesFiltro] = await Promise.all([
    sql.query(
      `SELECT a.${N.ads}_id AS id, max(a.${N.ads}_name) AS nome,
              sum(a.gasto) AS gasto, sum(a.impressoes) AS impressoes, sum(a.cliques) AS cliques,
              sum(a.cliques_link) AS cliques_link, sum(a.lp_views) AS lp_views, sum(a.checkouts) AS checkouts
       FROM ads_diario a WHERE ${fa.where} GROUP BY 1`, fa.params),
    sql.query(
      `SELECT substring(v.${N.utm} from '\\|([0-9]+)$') AS id,
              max(regexp_replace(v.${N.utm}, '\\|[0-9]+$', '')) AS nome,
              count(*) FILTER (WHERE v.status='paid') AS vendas,
              coalesce(sum(v.valor) FILTER (WHERE v.status='paid'),0) AS bruto,
              coalesce(sum(v.valor - v.taxa) FILTER (WHERE v.status='paid'),0) AS fat,
              count(*) FILTER (WHERE v.metodo='pix') AS pix_gerados,
              count(*) FILTER (WHERE v.metodo='pix' AND v.pago_em IS NOT NULL) AS pix_pagos,
              count(*) AS pedidos,
              count(*) FILTER (WHERE v.status IN ('refunded','chargedback')) AS perdas
       FROM vendas v WHERE ${fv.where} GROUP BY 1`, fv.params),
    sql.query(`SELECT id, nome, status, status_config, orcamento, tipo_orcamento, pai_id FROM meta_objetos WHERE nivel = $1`, [N.obj]),
    sql.query(`SELECT id, nome FROM meta_objetos WHERE id = ANY($1)`, [[sp.campanha, sp.conjunto].filter(Boolean)]),
  ]);

  const mapa = new Map<string, Linha>();
  const vazio = (id: string | null, nome: string): Linha => ({
    id, nome, gasto: 0, impressoes: 0, cliques: 0, cliques_link: 0, lp_views: 0, checkouts: 0,
    vendas: 0, bruto: 0, fat: 0, pix_gerados: 0, pix_pagos: 0, pedidos: 0, perdas: 0,
  });
  for (const r of ads as any[]) {
    const l = vazio(r.id, r.nome || r.id);
    for (const k of ["gasto", "impressoes", "cliques", "cliques_link", "lp_views", "checkouts"] as const) l[k] = num(r[k]);
    mapa.set(r.id, l);
  }
  for (const r of vendas as any[]) {
    const chave = r.id || "__sem__";
    const l = mapa.get(chave) || vazio(r.id, r.id ? r.nome || r.id : "(sem UTM / não identificado)");
    for (const k of ["vendas", "bruto", "fat", "pix_gerados", "pix_pagos", "pedidos", "perdas"] as const) l[k] = num(r[k]);
    if (!mapa.has(chave)) mapa.set(chave, l);
  }
  const objMap = new Map((objs as any[]).map((o) => [o.id, o]));
  for (const l of mapa.values()) {
    const o = l.id ? objMap.get(l.id) : null;
    if (o) {
      l.status = o.status;
      l.statusConfig = o.status_config;
      l.orcamento = o.orcamento;
      l.tipoOrc = o.tipo_orcamento;
      if (o.nome) l.nome = o.nome;
    }
  }

  const ord = sp.ordem || "gasto";
  const desc = sp.dir !== "asc";
  const valorOrd = (l: Linha) => {
    const m = metricas(l) as any;
    const v = ord in m ? m[ord] : (l as any)[ord];
    return v == null ? -Infinity : Number(v);
  };
  const linhas = [...mapa.values()].sort((a, b) => {
    const d = valorOrd(b) - valorOrd(a) || b.fat - a.fat;
    return desc ? d : -d;
  });

  const tot = linhas.reduce((acc, l) => {
    for (const k of ["gasto", "impressoes", "cliques", "cliques_link", "lp_views", "checkouts", "vendas", "bruto", "fat", "pix_gerados", "pix_pagos", "pedidos", "perdas"] as const) acc[k] += l[k];
    return acc;
  }, vazio(null, "Total"));

  const nomeFiltro = (id?: string) => (id ? (nomesFiltro as any[]).find((o) => o.id === id)?.nome || id : "");
  const drill = (l: Linha) =>
    !l.id ? null
      : nivel === "campanhas" ? linkCom("/painel/campanhas", sp, { nivel: "conjuntos", campanha: l.id })
      : nivel === "conjuntos" ? linkCom("/painel/campanhas", sp, { nivel: "anuncios", campanha: sp.campanha, conjunto: l.id })
      : null;
  const ordLink = (k: string) =>
    linkCom("/painel/campanhas", sp, { nivel, campanha: sp.campanha, conjunto: sp.conjunto, ordem: k, dir: ord === k && desc ? "asc" : undefined });

  return (
    <>
      <Topbar titulo="Campanhas" produtos={ctx.produtos} contas={ctx.contas} />
      {ctx.erroMeta && <div className="aviso bad">Não consegui atualizar a Meta Ads: {ctx.erroMeta}</div>}

      <div className="abas">
        {(Object.keys(NIVEIS) as Nivel[]).map((k) => (
          <Link key={k} className={k === nivel ? "on" : ""}
            href={linkCom("/painel/campanhas", sp, { nivel: k, campanha: k === "campanhas" ? undefined : sp.campanha, conjunto: k === "anuncios" ? sp.conjunto : undefined })}>
            {NIVEIS[k].titulo}
          </Link>
        ))}
        {(sp.campanha || sp.conjunto) && (
          <span className="trilha">
            {sp.campanha && <>Campanha: <b>{nomeFiltro(sp.campanha)}</b></>}
            {sp.conjunto && <> › Conjunto: <b>{nomeFiltro(sp.conjunto)}</b></>}
            <Link href={linkCom("/painel/campanhas", sp, { nivel })}>✕ limpar</Link>
          </span>
        )}
      </div>

      <section className="box sem-pad tabela-desktop">
        <div className="scroll">
          <table className="tabela-camp">
            <thead>
              <tr>
                <th className="fixa">{N.um}</th>
                <th>Status</th>
                {COLUNAS.map((c) => (
                  <th key={c.k} title={c.dica}>
                    <Link href={ordLink(c.k)} className={ord === c.k ? "ord on" : "ord"}>
                      {c.t}{ord === c.k ? (desc ? " ↓" : " ↑") : ""}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && <tr><td colSpan={COLUNAS.length + 2} className="vazio">Nenhum dado no período.</td></tr>}
              {linhas.map((l) => <LinhaTabela key={l.id || "sem"} l={l} link={drill(l)} />)}
            </tbody>
            {linhas.length > 0 && (
              <tfoot><LinhaTabela l={tot} link={null} total /></tfoot>
            )}
          </table>
        </div>
      </section>
      <section className="cartoes-camp">
        {linhas.length === 0 && <p className="vazio">Nenhum dado no período.</p>}
        {linhas.map((l) => {
          const m = metricas(l);
          const link = drill(l);
          return (
            <div key={l.id || "sem"} className="ccard">
              <div className="ccard-top">
                <div className="ccard-nome">
                  {link ? <Link href={link}>{l.nome}</Link> : <b>{l.nome}</b>}
                </div>
                {l.id && l.status && <StatusCelula l={l} stTxt={(STATUS_META[l.status] || [l.status])[0]} stCls={(STATUS_META[l.status] || [l.status, "muted"])[1]} />}
              </div>
              {l.id && l.orcamento && l.tipoOrc ? (
                <div className="ccard-orc">Orçamento <EditaOrcamento id={l.id} valor={Number(l.orcamento)} tipo={l.tipoOrc} /></div>
              ) : null}
              <div className="ccard-grade">
                <div><span>Gasto</span><b>{brl(l.gasto)}</b></div>
                <div><span>Faturamento</span><b>{brl(l.fat)}</b></div>
                <div><span>Lucro</span><b className={l.gasto || l.fat ? (m.lucro >= 0 ? "verde" : "vermelho") : ""}>{brl(m.lucro)}</b></div>
                <div><span>Vendas</span><b>{inteiro(l.vendas)}</b></div>
                <div><span>ROAS</span><b>{m.roas != null ? vezes(l.fat, l.gasto) : "—"}</b></div>
                <div><span>CPA</span><b>{m.cpa != null ? brl(m.cpa) : "—"}</b></div>
                <div><span>IC</span><b>{inteiro(l.checkouts)}</b></div>
                <div><span>CPC</span><b>{m.cpc != null ? brl(m.cpc) : "—"}</b></div>
                <div><span>CTR</span><b>{m.ctr != null ? pct(l.cliques_link, l.impressoes, 2) : "—"}</b></div>
              </div>
            </div>
          );
        })}
      </section>
      <p className="nota">
        Gasto, impressões, cliques e IC vêm da Meta Ads; vendas, faturamento e PIX vêm da Wiapy, ligados pelo ID no final de cada UTM
        (ex.: <code>Campanha X|1201…</code>). Clique no nome para descer de nível.
      </p>
    </>
  );
}

function LinhaTabela({ l, link, total }: { l: Linha; link: string | null; total?: boolean }) {
  const m = metricas(l);
  const [stTxt, stCls] = l.status ? STATUS_META[l.status] || [l.status, "muted"] : ["—", ""];
  const cor = (v: number | null) => (v == null ? "" : v >= 0 ? "verde" : "vermelho");
  const roasCor = m.roas == null ? "" : m.roas >= 2 ? "verde" : m.roas >= 1 ? "amarelo" : "vermelho";
  return (
    <tr className={total ? "total" : ""}>
      <td className="fixa nome">
        {link ? <Link href={link}>{l.nome}</Link> : l.nome}
        {!total && l.id && <small>{l.id}</small>}
      </td>
      <td className="st">
        {total ? "" : <StatusCelula l={l} stTxt={stTxt} stCls={stCls} />}
      </td>
      <td>{total ? "—" : l.id && l.orcamento && l.tipoOrc ? <EditaOrcamento id={l.id} valor={Number(l.orcamento)} tipo={l.tipoOrc} /> : "—"}</td>
      <td><b>{inteiro(l.vendas)}</b></td>
      <td>{m.cpa != null ? brl(m.cpa) : "—"}</td>
      <td>{brl(l.gasto)}</td>
      <td><b>{brl(l.fat)}</b></td>
      <td className={cor(l.gasto || l.fat ? m.lucro : null)}>{brl(m.lucro)}</td>
      <td className={roasCor}>{m.roas != null ? vezes(l.fat, l.gasto) : "—"}</td>
      <td>{m.margem != null ? pct(m.lucro, l.fat) : "—"}</td>
      <td className={cor(m.roi)}>{m.roi != null ? pct(m.lucro, l.gasto, 0) : "—"}</td>
      <td>{inteiro(l.pix_gerados)}</td>
      <td>{m.conv_pix != null ? pct(l.pix_pagos, l.pix_gerados) : "—"}</td>
      <td>{inteiro(l.checkouts)}</td>
      <td>{m.cpi != null ? brl(m.cpi) : "—"}</td>
      <td>{m.cpc != null ? brl(m.cpc) : "—"}</td>
      <td>{m.ctr != null ? pct(l.cliques_link, l.impressoes, 2) : "—"}</td>
      <td>{m.cpm != null ? brl(m.cpm) : "—"}</td>
      <td>{inteiro(l.impressoes)}</td>
      <td>{inteiro(l.cliques_link)}</td>
    </tr>
  );
}

function StatusCelula({ l, stTxt, stCls }: { l: Linha; stTxt: string; stCls: string }) {
  if (!l.id || !l.status) return <>—</>;
  const ligado = (l.statusConfig || l.status) === "ACTIVE";
  const mostraTag = !(l.status === "ACTIVE" || (l.status === "PAUSED" && !ligado));
  return (
    <span className="st-wrap">
      <ChaveStatus id={l.id} ativo={ligado} nome={l.nome} />
      {mostraTag && <span className={`tag ${stCls}`}>{stTxt}</span>}
    </span>
  );
}
