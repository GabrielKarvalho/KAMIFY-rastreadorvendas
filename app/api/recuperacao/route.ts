import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import { contarProntos } from "@/lib/recuperacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quantos PIX pendentes já passaram de 1h e ainda não foram chamados (para o aviso dentro do app). */
export async function GET() {
  if (!(await estaLogado())) return NextResponse.json({ ok: false }, { status: 401 });
  await garantirSchema();
  return NextResponse.json({ ok: true, prontos: await contarProntos() });
}

/** body: { id, acao: "contatado" | "descartar" | "restaurar" } */
export async function POST(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ ok: false, erro: "id inválido" }, { status: 400 });
  if (b.acao === "contatado") {
    await sql`UPDATE vendas SET rec_contatado_em = COALESCE(rec_contatado_em, now()), rec_descartado_em = NULL WHERE id = ${id}`;
  } else if (b.acao === "descartar") {
    await sql`UPDATE vendas SET rec_descartado_em = now() WHERE id = ${id}`;
  } else if (b.acao === "restaurar") {
    await sql`UPDATE vendas SET rec_descartado_em = NULL, rec_contatado_em = NULL WHERE id = ${id}`;
  } else {
    return NextResponse.json({ ok: false, erro: "ação inválida" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
