import Link from "next/link";
import { sql } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import { redirect } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Barras, Card, Funil, Linha } from "@/components/Graficos";
import { contexto, filtroAds, filtroVendas, impostoPct, SQL_TOTAIS_ADS, SQL_TOTAIS_VENDAS } from "@/lib/consultas";
import { brl, intervalo, inteiro, linkCom, num, pct, TZ, vezes, type SP } from "@/lib/filtros";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const METODO: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };

export default async function Painel({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await estaLogado())) redirect("/entrar");
  const sp = await searchParams;
  const iv = intervalo(sp);
  const ctx = await contexto(iv, sp);

  const fv = filtroVendas(iv, sp);
  const fa = filtroAds(iv, sp);

  const serieVendasSql = iv.porHora
    ? `SELECT extract(hour FROM v.criado_em AT TIME ZONE '${TZ}')::int AS k,
         coalesce(sum(v.valor - v.taxa) FILTER (WHERE v.status='paid'),0) AS fat,
         count(*) FILTER (WHERE v.status='paid') AS vendas
       FROM vendas v WHERE ${fv.where} GROUP BY 1`
    : `SELECT to_char(v.criado_em AT TIME ZONE '${TZ}','YYYY-MM-DD') AS k,
         coalesce(sum(v.valor - v.taxa) FILTER (WHERE v.status='paid'),0) AS fat,
         count(*) FILTER (WHERE v.status='paid') AS vendas
       FROM vendas v WHERE ${fv.where} GROUP BY 1`;

  const [tv, ta, serieV, serieA, metodos, produtos, bumps, topCamp, gastoCamp, contas] = await Promise.all([
    sql.query(`SELECT ${SQL_TOTAIS_VENDAS} FROM vendas v WHERE ${fv.where}`, fv.params),
    sql.query(`SELECT ${SQL_TOTAIS_ADS} FROM ads_diario a WHERE ${fa.where}`, fa.params),
    sql.query(serieVendasSql, fv.params),
    sql.query(`SELECT to_char(a.data,'YYYY-MM-DD') AS k, sum(a.gasto) AS gasto FROM ads_diario a WHERE ${fa.where} GROUP BY 1`, fa.params),
    sql.query(
      `SELECT coalesce(v.metodo,'?') AS metodo, count(*) AS geradas,
              count(*) FILTER (WHERE v.pago_em IS NOT NULL) AS pagas,
              coalesce(sum(v.valor - v.taxa) FILTER (WHERE v.status='paid'),0) AS fat
       FROM vendas v WHERE ${fv.where} GROUP BY 1 ORDER BY fat DESC`, fv.params),
    sql.query(
      `SELECT coalesce(v.checkout_titulo,'(sem nome)') AS titulo, count(*) FILTER (WHERE v.status='paid') AS vendas,
              coalesce(sum(v.valor - v.taxa) FILTER (WHERE v.status='paid'),0) AS fat
       FROM vendas v WHERE ${fv.where} GROUP BY 1 ORDER BY fat DESC LIMIT 8`, fv.params),
    sql.query(
      `SELECT coalesce(b->>'title','(sem nome)') AS titulo, count(*) AS qtd, coalesce(sum((b->>'amount')::int),0) AS receita
       FROM vendas v, jsonb_array_elements(v.orderbumps) b
       WHERE v.status='paid' AND ${fv.where} GROUP BY 1 ORDER BY receita DESC`, fv.params),
    sql.query(
      `SELECT substring(v.utm_campaign from '\\|([0-9]+)$') AS id,
              max(split_part(v.utm_campaign,'|',1)) AS nome,
              count(*) FILTER (WHERE v.status='paid') AS vendas,
              coalesce(sum(v.valor - v.taxa) FILTER (WHERE v.status='paid'),0) AS fat
       FROM vendas v WHERE ${fv.where} AND v.utm_campaign IS NOT NULL
       GROUP BY 1 ORDER BY fat DESC LIMIT 6`, fv.params),
    sql.query(`SELECT a.campaign_id AS id, max(a.campaign_name) AS nome, sum(a.gasto) AS gasto FROM ads_diario a WHERE ${fa.where} GROUP BY 1`, fa.params),
    sql`SELECT id, nome, saldo_texto, saldo, gasto_total, limite FROM meta_contas ORDER BY nome`,
  ]);

  const t: any = (tv as any[])[0] || {};
  const a: any = (ta as any[])[0] || {};
  const gasto = num(a.gasto);
  const vendas = num(t.vendas);
  const liquido = num(t.liquido);
  const imposto = Math.round(num(t.bruto) * impostoPct());
  const lucro = liquido - gasto - imposto;
  const roas = gasto > 0 ? liquido / gasto : 0;

  // série do gráfico
  let serie: { rotulo: string; fat: number; vendas: number; gasto?: number }[];
  if (iv.porHora) {
    const m = new Map((serieV as any[]).map((r) => [num(r.k), r]));
    serie = Array.from({ length: 24 }, (_, h) => ({ rotulo: `${h}h`, fat: num(m.get(h)?.fat), vendas: num(m.get(h)?.vendas) }));
  } else {
    const mv = new Map((serieV as any[]).map((r) => [r.k, r]));
    const mg = new Map((serieA as any[]).map((r) => [r.k, num(r.gasto)]));
    serie = [];
    for (let d = iv.deDia; d <= iv.ateDia; d = new Date(new Date(d + "T12:00:00Z").getTime() + 86400_000).toISOString().slice(0, 10)) {
      serie.push({ rotulo: d.slice(8, 10) + "/" + d.slice(5, 7), fat: num(mv.get(d)?.fat), vendas: num(mv.get(d)?.vendas), gasto: mg.get(d) || 0 });
      if (serie.length > 400) break;
    }
  }

  const gastoPorCamp = new Map((gastoCamp as any[]).map((g) => [g.id, num(g.gasto)]));
  const top = (topCamp as any[]).map((c) => ({ ...c, gasto: gastoPorCamp.get(c.id) || 0 }));
  const maxMet = Math.max(1, ...(metodos as any[]).map((m) => num(m.fat)));
  const maxProd = Math.max(1, ...(produtos as any[]).map((p) => num(p.fat)));

  const seloRoas = !gasto ? null : roas >= 2 ? { texto: "Bom", tipo: "ok" as const } : roas >= 1 ? { texto: "Regular", tipo: "wait" as const } : { texto: "Ruim", tipo: "bad" as const };
  const seloLucro = !gasto && !vendas ? null : lucro >= 0 ? { texto: "Positivo", tipo: "ok" as const } : { texto: "Negativo", tipo: "bad" as const };

  return (
    <>
      <Topbar titulo="Painel" produtos={ctx.produtos} contas={ctx.contas} />
      {ctx.erroMeta && <div className="aviso bad">Não consegui atualizar a Meta Ads: {ctx.erroMeta}</div>}
      {!ctx.adsAtivo && (
        <div className="aviso">
          Gasto em anúncios ainda não conectado — configure <code>META_AD_ACCOUNT_IDS</code> e <code>META_ADS_TOKEN</code> na Vercel para ver gasto, lucro, ROAS e o funil.
        </div>
      )}

      <section className="grade g6">
        <Card titulo="Faturamento" sufixo="líquido" valor={brl(liquido)} extra={`Bruto ${brl(t.bruto)} · taxas ${brl(t.taxas)}`} />
        <Card titulo="Lucro" sufixo="líquido" valor={brl(lucro)} cor={lucro >= 0 ? "verde" : "vermelho"} selo={seloLucro}
          extra={imposto ? `Imposto ${brl(imposto)}` : undefined} />
        <Card titulo="Gasto em ads" valor={brl(gasto)} />
        <Card titulo="CPA" valor={vendas && gasto ? brl(gasto / vendas) : "—"} />
        <Card titulo="ARPU" valor={vendas ? brl(liquido / vendas) : "—"} />
        <Card titulo="ROAS" valor={gasto ? vezes(liquido, gasto) : "—"} cor={gasto && roas < 1 ? "vermelho" : "azul"} selo={seloRoas} />
      </section>

      <section className="grade g4">
        <Card titulo="Vendas aprovadas" valor={inteiro(vendas)} extra={brl(t.bruto)} grande />
        <Card titulo="Vendas pendentes" valor={brl(t.pendentes_valor)} extra={`${inteiro(t.pendentes)} ${num(t.pendentes) === 1 ? "venda" : "vendas"}`} grande />
        <Card titulo="Chargeback" valor={pct(num(t.cbs), num(t.ja_pagas))} cor={num(t.cbs) ? "vermelho" : undefined}
          extra={`${inteiro(t.cbs)} ${num(t.cbs) === 1 ? "venda" : "vendas"} · ${brl(t.cbs_valor)}`} grande />
        <Card titulo="Margem" valor={liquido ? pct(lucro, liquido) : "—"} cor={lucro < 0 ? "vermelho" : "azul"} grande
          selo={!liquido ? null : lucro >= 0 ? { texto: "Positivo", tipo: "ok" } : { texto: "Negativo", tipo: "bad" }} />
      </section>

      <section className="grade g4">
        <Card titulo="ROI" valor={gasto ? pct(lucro, gasto, 0) : "—"} cor={gasto ? (lucro < 0 ? "vermelho" : "verde") : undefined} />
        <Card titulo="Reembolsos" valor={inteiro(t.estornos)} extra={`${pct(num(t.estornos), num(t.ja_pagas))} · ${brl(t.estornos_valor)}`} cor={num(t.estornos) ? "vermelho" : undefined} />
        <Card titulo="Conversão PIX" valor={pct(num(t.pix_pagos), num(t.pix_gerados))} extra={`${inteiro(t.pix_pagos)} pagos de ${inteiro(t.pix_gerados)} gerados`} />
        <Card titulo="Aprovação cartão" valor={pct(num(t.cartao_aprov), num(t.cartao_tent))} extra={`${inteiro(t.recusados)} recusados`} />
      </section>

      <section className="grade g-1-2">
        <div className="box">
          <h2>💰 Saldo das contas</h2>
          {(contas as any[]).length === 0 && <p className="vazio">Nenhuma conta conectada.</p>}
          {(contas as any[]).map((c) => (
            <div key={c.id} className="saldo">
              <div>
                <b>{c.nome || c.id}</b>
                <small>{c.id}</small>
              </div>
              <span className="verde">{c.saldo_texto ? extraiValor(c.saldo_texto) : c.saldo != null ? brl(c.saldo) : "—"}</span>
            </div>
          ))}
        </div>
        <div className="box">
          <h2>Funil de conversão (Meta Ads)</h2>
          <Funil
            etapas={[
              { nome: "Cliques no link", valor: num(a.cliques_link) },
              { nome: "Visitas na página", valor: num(a.lp_views) },
              { nome: "Checkouts iniciados", valor: num(a.checkouts) },
              { nome: "Pedidos gerados", valor: num(t.pedidos) },
              { nome: "Vendas aprovadas", valor: vendas },
            ]}
          />
        </div>
      </section>

      <section className="box">
        <h2>{iv.porHora ? "Faturamento por hora" : "Faturamento por dia"} · {iv.rotulo}</h2>
        <Barras dados={serie} />
      </section>

      <section className="grade g3">
        <div className="box">
          <h2>Vendas por pagamento</h2>
          {(metodos as any[]).length === 0 && <p className="vazio">Sem vendas no período.</p>}
          {(metodos as any[]).map((m) => (
            <Linha key={m.metodo} nome={METODO[m.metodo] || m.metodo} valor={brl(m.fat)} fracao={num(m.fat) / maxMet}
              detalhe={`${inteiro(m.pagas)} pagas de ${inteiro(m.geradas)} geradas · conversão ${pct(num(m.pagas), num(m.geradas))}`}
              cor={m.metodo === "pix" ? "#3cc48a" : m.metodo === "credit_card" ? "#2f6bff" : "#9a64f0"} />
          ))}
        </div>
        <div className="box">
          <h2>Produtos</h2>
          {(produtos as any[]).length === 0 && <p className="vazio">Sem vendas no período.</p>}
          {(produtos as any[]).map((p) => (
            <Linha key={p.titulo} nome={p.titulo} valor={brl(p.fat)} fracao={num(p.fat) / maxProd} detalhe={`${inteiro(p.vendas)} vendas`} />
          ))}
        </div>
        <div className="box">
          <h2>Order bumps</h2>
          {(bumps as any[]).length === 0 && <p className="vazio">Nenhum bump vendido.</p>}
          {(bumps as any[]).map((b) => (
            <Linha key={b.titulo} nome={b.titulo} valor={brl(b.receita)} fracao={vendas ? num(b.qtd) / vendas : 0}
              detalhe={`${inteiro(b.qtd)} vendidos · take rate ${pct(num(b.qtd), vendas)}`} cor="#9a64f0" />
          ))}
        </div>
      </section>

      <section className="box">
        <div className="boxhead">
          <h2>Melhores campanhas</h2>
          <Link href={linkCom("/painel/campanhas", sp)} className="link">Ver todas →</Link>
        </div>
        <table>
          <thead><tr><th>Campanha</th><th>Vendas</th><th>Faturamento</th><th>Gasto</th><th>Lucro</th><th>ROAS</th></tr></thead>
          <tbody>
            {top.length === 0 && <tr><td colSpan={6} className="vazio">Nenhuma venda com UTM no período.</td></tr>}
            {top.map((c) => (
              <tr key={c.id || c.nome}>
                <td className="nome">{c.nome}<small>{c.id}</small></td>
                <td>{inteiro(c.vendas)}</td>
                <td>{brl(c.fat)}</td>
                <td>{c.gasto ? brl(c.gasto) : "—"}</td>
                <td className={num(c.fat) - c.gasto >= 0 ? "verde" : "vermelho"}>{brl(num(c.fat) - c.gasto)}</td>
                <td>{c.gasto ? vezes(num(c.fat), c.gasto) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

/** "Saldo disponível (R$339,68 BRL)" → "R$ 339,68" */
function extraiValor(txt: string) {
  const m = txt.match(/R\$\s?[\d.,]+/);
  return m ? m[0].replace("R$", "R$ ") .replace("  ", " ") : txt;
}
