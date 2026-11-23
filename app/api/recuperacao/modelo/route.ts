import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import { MINUTOS_MAX, MINUTOS_MIN, MODELOS_PADRAO } from "@/lib/recuperacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Salva o texto de uma mensagem de recuperação (valor vazio volta ao padrão) ou o tempo de espera (chave "rec_minutos"). */
export async function POST(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();
  const b = await req.json().catch(() => ({}));
  const chave = String(b.chave || "");
  if (chave === "rec_minutos") {
    const n = Math.round(Number(b.valor));
    if (!Number.isFinite(n) || n < MINUTOS_MIN || n > MINUTOS_MAX) {
      return NextResponse.json({ ok: false, erro: `escolha entre ${MINUTOS_MIN} e ${MINUTOS_MAX} minutos` }, { status: 400 });
    }
    await sql`INSERT INTO config (chave, valor) VALUES ('rec_minutos', ${String(n)})
              ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`;
    return NextResponse.json({ ok: true });
  }
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
