import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import { MODELOS_PADRAO } from "@/lib/recuperacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Salva o texto de uma mensagem de recuperação. Valor vazio volta ao padrão. */
export async function POST(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();
  const b = await req.json().catch(() => ({}));
  const chave = String(b.chave || "");
  if (!(chave in MODELOS_PADRAO)) return NextResponse.json({ ok: false, erro: "modelo inválido" }, { status: 400 });
  const valor = String(b.valor || "").slice(0, 3000).trim();
  if (!valor) {
    await sql`DELETE FROM config WHERE chave = ${chave}`;
  } else {
    await sql`INSERT INTO config (chave, valor) VALUES (${chave}, ${valor})
              ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`;
  }
  return NextResponse.json({ ok: true });
}
