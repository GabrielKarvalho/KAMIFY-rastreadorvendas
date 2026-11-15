import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { contexto, filtroVendas } from "@/lib/consultas";
import { brl, intervalo, inteiro, linkCom, num, TZ, type SP } from "@/lib/filtros";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS: Record<string, [string, string]> = {
  paid: ["Aprovada", "ok"],
  unpaid: ["Pendente", "wait"],
  refunded: ["Reembolsada", "bad"],
  chargedback: ["Chargeback", "bad"],
  credit_card_declined: ["Recusada", "muted"],
};
const METODO: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };
const ABAS = [
  ["", "Todas"], ["paid", "Aprovadas"], ["unpaid", "Pendentes"], ["credit_card_declined", "Recusadas"],
  ["refunded", "Reembolsadas"], ["chargedback", "Chargebacks"],
];
const POR_PAGINA = 50;
const nomeUtm = (v: string | null) => (v ? v.replace(/\|\d+$/, "") : "");

export default async function Vendas({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await estaLogado())) redirect("/entrar");
  const sp = await searchParams;
  const iv = intervalo(sp);
  const ctx = await contexto(iv, sp);
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const fBase = filtroVendas(iv, sp);
  if (sp.q) {
    fBase.add((p) => `(v.cliente_nome ILIKE ${p} OR v.cliente_email ILIKE ${p} OR v.cliente_telefone ILIKE ${p} OR v.id = trim(both '%' from ${p}))`, `%${sp.q.trim()}%`);
  }
  const contagemSql = `SELECT v.status, count(*) AS n FROM vendas v WHERE ${fBase.where} GROUP BY 1`;
  const contagemParams = [...fBase.params];
  if (sp.status) fBase.add((p) => `v.status = ${p}`, sp.status);

  const [linhas, contagem, total] = await Promise.all([
    sql.query(
      `SELECT v.id, v.status, v.metodo, v.valor, v.taxa, v.checkout_titulo, v.orderbumps, v.cliente_nome, v.cliente_email,
              v.cliente_telefone, v.utm_source, v.utm_campaign, v.utm_medium, v.utm_content, v.criado_em, v.pago_em,
              v.capi_enviado_em, v.capi_resposta
       FROM vendas v WHERE ${fBase.where} ORDER BY v.criado_em DESC
       LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`, fBase.params),
    sql.query(contagemSql, contagemParams),
    sql.query(`SELECT count(*) AS n FROM vendas v WHERE ${fBase.where}`, fBase.params),
  ]);

  const cont = new Map((contagem as any[]).map((c) => [c.status, num(c.n)]));
  const todas = [...cont.values()].reduce((a, b) => a + b, 0);
  const paginas = Math.max(1, Math.ceil(num((total as any[])[0]?.n) / POR_PAGINA));
  const capiAtivo = !!process.env.META_ACCESS_TOKEN && process.env.META_CAPI_ATIVO !== "false";

  return (
    <>
      <Topbar titulo="Vendas" produtos={ctx.produtos} contas={ctx.contas} />

      <div className="abas">
        {ABAS.map(([k, r]) => (
          <Link key={k} className={(sp.status || "") === k ? "on" : ""} href={linkCom("/painel/vendas", sp, { status: k || undefined, q: sp.q })}>
            {r} <span className="cont">{k ? cont.get(k) || 0 : todas}</span>
          </Link>
        ))}
        <form className="busca" action="/painel/vendas">
          {(["periodo", "de", "ate", "produto", "conta", "status"] as const).map((k) => sp[k] && <input key={k} type="hidden" name={k} value={sp[k]} />)}
          <input name="q" defaultValue={sp.q} placeholder="Buscar nome, e-mail, telefone ou ID" />
        </form>
      </div>

      <section className="box sem-pad">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th><th className="l">Cliente</th><th className="l">Produto</th><th>Pagamento</th>
                <th>Valor</th><th>Líquido</th><th>Status</th><th className="l">Origem (UTM)</th>{capiAtivo && <th>Meta</th>}
              </tr>
            </thead>
            <tbody>
              {(linhas as any[]).length === 0 && <tr><td colSpan={9} className="vazio">Nenhuma venda encontrada.</td></tr>}
              {(linhas as any[]).map((v) => {
                const [rot, cls] = STATUS[v.status] || [v.status, "muted"];
                const bumps = Array.isArray(v.orderbumps) ? v.orderbumps : [];
                const erroCapi = String(v.capi_resposta || "").startsWith("ERRO");
                return (
                  <tr key={v.id}>
                    <td className="data">
                      {new Date(v.criado_em).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" })}
                      <small>{v.id}</small>
                    </td>
                    <td className="nome">{v.cliente_nome || "—"}<small>{v.cliente_email}{v.cliente_telefone ? ` · ${v.cliente_telefone}` : ""}</small></td>
                    <td className="nome">{v.checkout_titulo || "—"}
                      {bumps.length > 0 && <small>+ {bumps.map((b: any) => b.title).join(", ")}</small>}
                    </td>
                    <td>{METODO[v.metodo] || v.metodo || "—"}</td>
                    <td><b>{brl(v.valor)}</b></td>
                    <td>{brl(num(v.valor) - num(v.taxa))}</td>
                    <td><span className={`tag ${cls}`}>{rot}</span></td>
                    <td className="nome utm">
                      {v.utm_campaign ? nomeUtm(v.utm_campaign) : <span className="muted">{v.utm_source || "sem UTM"}</span>}
                      {(v.utm_medium || v.utm_content) && <small>{[nomeUtm(v.utm_medium), nomeUtm(v.utm_content)].filter(Boolean).join(" › ")}</small>}
                    </td>
                    {capiAtivo && (
                      <td title={v.capi_resposta || ""}>
                        {v.capi_enviado_em ? <span className="tag ok">✓ enviado</span> : erroCapi ? <span className="tag bad">erro</span> : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {paginas > 1 && (
        <div className="paginacao">
          {pagina > 1 && <Link href={linkCom("/painel/vendas", sp, { status: sp.status, q: sp.q, pagina: String(pagina - 1) })}>← Anterior</Link>}
          <span>Página {pagina} de {inteiro(paginas)}</span>
          {pagina < paginas && <Link href={linkCom("/painel/vendas", sp, { status: sp.status, q: sp.q, pagina: String(pagina + 1) })}>Próxima →</Link>}
        </div>
      )}
    </>
  );
}
