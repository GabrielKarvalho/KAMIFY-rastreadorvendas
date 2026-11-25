import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** body: { campaign_id, produto } — produto: id do checkout, "" (nenhum produto) ou null (voltar ao automático). */
export async function POST(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();
  const b = await req.json().catch(() => ({}));
  const id = String(b.campaign_id || "");
  if (!/^\d+$/.test(id)) return NextResponse.json({ ok: false, erro: "campanha inválida" }, { status: 400 });
  if (b.produto === null || b.produto === undefined) {
    await sql`DELETE FROM campanha_produto WHERE campaign_id = ${id}`;
  } else {
    const prod = String(b.produto).slice(0, 200);
    await sql`INSERT INTO campanha_produto (campaign_id, checkout_id) VALUES (${id}, ${prod})
              ON CONFLICT (campaign_id) DO UPDATE SET checkout_id = EXCLUDED.checkout_id, atualizado_em = now()`;
  }
  return NextResponse.json({ ok: true });
}
