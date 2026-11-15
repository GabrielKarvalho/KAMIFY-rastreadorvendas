import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Linha = Record<string, string | number | null | undefined>;

const txt = (v: unknown) => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "R$ 1.234,56" | "-R$ 66,06" | 66.06 → centavos */
function centavos(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Math.round(Math.abs(v) * 100);
  let s = String(v).replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Math.abs(Number(s));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Datas em formato BR (dd/mm/aaaa hh:mm[:ss]) ou ISO, horário de Brasília → ISO UTC */
function data(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // número serial do Excel
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms + 3 * 3600_000).toISOString();
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ ,T]*(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
  if (br) {
    const [, d, m, a, h = "0", mi = "0", se = "0"] = br;
    const ano = a.length === 2 ? "20" + a : a;
    const iso = `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi.padStart(2, "0")}:${se.padStart(2, "0")}-03:00`;
    const t = new Date(iso);
    return isNaN(t.getTime()) ? null : t.toISOString();
  }
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

function status(v: unknown): string {
  const s = semAcento(String(v ?? ""));
  if (/charge/.test(s)) return "chargedback";
  if (/estorn|reembol|refund|devolv/.test(s)) return "refunded";
  if (/recus|negad|declin|falh/.test(s)) return "credit_card_declined";
  if (/aguard|pendent|gerad|unpaid|aberto|venc/.test(s)) return "unpaid";
  if (/pago|aprov|paid|conclu|confirm/.test(s)) return "paid";
  return "unpaid";
}
function metodo(v: unknown): string | null {
  const s = semAcento(String(v ?? ""));
  if (!s) return null;
  if (/pix/.test(s)) return "pix";
  if (/cart|credit|card/.test(s)) return "credit_card";
  if (/boleto/.test(s)) return "boleto";
  return s.slice(0, 30);
}

export async function GET() {
  if (!(await estaLogado())) return NextResponse.json({ ok: false }, { status: 401 });
  await garantirSchema();
  const lotes = await sql`
    SELECT lote, count(*) AS qtd, min(criado_em) AS de, max(criado_em) AS ate, max(recebido_em) AS importado_em
    FROM vendas WHERE origem = 'importacao' AND lote IS NOT NULL
    GROUP BY lote ORDER BY max(recebido_em) DESC LIMIT 20`;
  return NextResponse.json({ ok: true, lotes });
}

export async function DELETE(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false }, { status: 401 });
  const lote = req.nextUrl.searchParams.get("lote") || "";
  if (!lote) return NextResponse.json({ ok: false, erro: "lote obrigatório" }, { status: 400 });
  const r = (await sql`DELETE FROM vendas WHERE origem = 'importacao' AND lote = ${lote} RETURNING id`) as any[];
  return NextResponse.json({ ok: true, removidas: r.length });
}

export async function POST(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();

  const body = await req.json().catch(() => null);
  const linhas: Linha[] = Array.isArray(body?.linhas) ? body.linhas : [];
  if (!linhas.length) return NextResponse.json({ ok: false, erro: "nenhuma linha" }, { status: 400 });
  if (linhas.length > 20000) return NextResponse.json({ ok: false, erro: "máximo 20.000 linhas por vez" }, { status: 400 });
  const lote = `imp_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

  // reaproveita o checkout_id de produtos que já chegaram por webhook (mesmo título)
  const conhecidos = (await sql`SELECT DISTINCT ON (lower(checkout_titulo)) lower(checkout_titulo) AS t, checkout_id
                                FROM vendas WHERE checkout_id IS NOT NULL AND checkout_titulo IS NOT NULL`) as any[];
  const mapaProduto = new Map(conhecidos.map((c) => [c.t, c.checkout_id]));

  const prontas = linhas
    .map((l) => {
      const criado = data(l.criado_em) || data(l.pago_em);
      if (!criado) return null;
      const valor = centavos(l.valor);
      const liquido = centavos(l.liquido);
      const taxa = l.taxa != null && l.taxa !== "" ? centavos(l.taxa) : liquido && valor && valor >= liquido ? valor - liquido : 0;
      const valorFinal = valor || liquido;
      const st = status(l.status);
      const produto = txt(l.produto);
      const id =
        txt(l.id) ||
        "imp_" + createHash("sha1").update([criado, txt(l.email), valorFinal, produto].join("|")).digest("hex").slice(0, 20);
      const bumpsTxt = txt(l.bumps);
      const bumps = bumpsTxt
        ? bumpsTxt.split(/\s*[;+|]\s*|,\s(?=[A-ZÀ-Ú])/).filter(Boolean).map((t) => ({ title: t }))
        : [];
      return {
        id,
        status: st,
        metodo: metodo(l.metodo),
        valor: valorFinal,
        taxa,
        checkout_id: produto ? mapaProduto.get(produto.toLowerCase()) || "produto:" + produto.toLowerCase().slice(0, 80) : null,
        checkout_titulo: produto,
        orderbumps: JSON.stringify(bumps),
        nome: txt(l.nome),
        email: txt(l.email),
        telefone: txt(l.telefone),
        documento: txt(l.documento),
        utm_source: txt(l.utm_source),
        utm_medium: txt(l.utm_medium),
        utm_campaign: txt(l.utm_campaign),
        utm_content: txt(l.utm_content),
        utm_term: txt(l.utm_term),
        fbc: txt(l.fbc),
        fbp: txt(l.fbp),
        criado_em: criado,
        pago_em: st === "paid" || st === "refunded" || st === "chargedback" ? data(l.pago_em) || criado : null,
      };
    })
    .filter(Boolean) as any[];

  let inseridas = 0;
  const COLS = 23;
  for (let i = 0; i < prontas.length; i += 200) {
    const lote200 = prontas.slice(i, i + 200);
    const vals: unknown[] = [];
    const tuplas = lote200.map((v) => {
      const b = vals.length;
      vals.push(
        v.id, v.status, v.metodo, v.valor, v.taxa, v.valor, v.checkout_id, v.checkout_titulo, v.orderbumps,
        v.nome, v.email, v.telefone, v.documento, v.utm_source, v.utm_medium, v.utm_campaign, v.utm_content, v.utm_term,
        v.fbc, v.fbp, v.criado_em, v.pago_em, lote,
      );
      const p = Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`);
      p[8] = `${p[8]}::jsonb`;
      return `(${p.join(",")}, $${b + 21}, 'importacao')`;
    });
    const r = (await sql.query(
      `INSERT INTO vendas (id, status, metodo, valor, taxa, valor_produto, checkout_id, checkout_titulo, orderbumps,
         cliente_nome, cliente_email, cliente_telefone, cliente_documento,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbc, fbp, criado_em, pago_em, lote,
         atualizado_em, origem)
       VALUES ${tuplas.join(",")}
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      vals,
    )) as any[];
    inseridas += r.length;
  }

  return NextResponse.json({
    ok: true,
    lote,
    recebidas: linhas.length,
    validas: prontas.length,
    inseridas,
    ja_existiam: prontas.length - inseridas,
    sem_data: linhas.length - prontas.length,
  });
}
