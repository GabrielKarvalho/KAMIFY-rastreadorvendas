import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import { filtroVendas } from "@/lib/consultas";
import { intervalo, TZ } from "@/lib/filtros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const reais = (c: unknown) => (Number(c || 0) / 100).toFixed(2).replace(".", ",");

export async function GET(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  await garantirSchema();
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const iv = intervalo(sp);
  const f = filtroVendas(iv, sp);
  if (sp.status) f.add((p) => `v.status = ${p}`, sp.status);

  const linhas = (await sql.query(
    `SELECT v.*, to_char(v.criado_em AT TIME ZONE '${TZ}', 'DD/MM/YYYY HH24:MI') AS data_br,
            to_char(v.pago_em AT TIME ZONE '${TZ}', 'DD/MM/YYYY HH24:MI') AS pago_br
     FROM vendas v WHERE ${f.where} ORDER BY v.criado_em DESC LIMIT 20000`, f.params)) as any[];

  const cab = ["Data", "Pago em", "ID", "Status", "Método", "Valor", "Taxa", "Líquido", "Produto", "Order bumps", "Cliente", "E-mail",
    "Telefone", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term", "Enviado à Meta"];
  const corpo = linhas.map((v) => [
    v.data_br, v.pago_br, v.id, v.status, v.metodo, reais(v.valor), reais(v.taxa), reais(Number(v.valor) - Number(v.taxa)),
    v.checkout_titulo, (Array.isArray(v.orderbumps) ? v.orderbumps : []).map((b: any) => b.title).join(" + "),
    v.cliente_nome, v.cliente_email, v.cliente_telefone, v.utm_source, v.utm_campaign, v.utm_medium, v.utm_content, v.utm_term,
    v.capi_enviado_em ? "sim" : "não",
  ].map(esc).join(";"));

  const csv = "﻿" + [cab.join(";"), ...corpo].join("\n"); // BOM + ";" para abrir certo no Excel BR
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendas-${iv.deDia}-a-${iv.ateDia}.csv"`,
    },
  });
}
