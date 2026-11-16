import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataValida = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Lança (ou substitui) o gasto em anúncios de um dia. body: { data: "AAAA-MM-DD", valor: centavos } */
export async function POST(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();
  const b = await req.json().catch(() => ({}));
  const valor = Math.round(Number(b.valor));
  if (!dataValida(b.data)) return NextResponse.json({ ok: false, erro: "data inválida" }, { status: 400 });
  if (!Number.isFinite(valor) || valor < 0 || valor > 100_000_000) {
    return NextResponse.json({ ok: false, erro: "valor inválido" }, { status: 400 });
  }
  await sql`INSERT INTO gasto_manual (data, valor) VALUES (${b.data}, ${valor})
            ON CONFLICT (data) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`;
  return NextResponse.json({ ok: true });
}

/** Remove o gasto manual de um dia (volta a usar o da Meta). ?data=AAAA-MM-DD */
export async function DELETE(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();
  const data = req.nextUrl.searchParams.get("data");
  if (!dataValida(data)) return NextResponse.json({ ok: false, erro: "data inválida" }, { status: 400 });
  await sql`DELETE FROM gasto_manual WHERE data = ${data}`;
  return NextResponse.json({ ok: true });
}
