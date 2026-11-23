import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import { notificarTodos, pushConfigurado } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Chave pública para o navegador se inscrever. */
export async function GET() {
  if (!(await estaLogado())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: pushConfigurado(), chave: process.env.VAPID_PUBLIC_KEY || null });
}

/** body: { inscricao } para inscrever este aparelho, ou { teste: true } para mandar uma notificação de teste. */
export async function POST(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();
  const b = await req.json().catch(() => ({}));
  if (b.teste) {
    const r = await notificarTodos({
      title: "🔔 Notificações ligadas",
      body: "Você vai receber um aviso aqui quando um PIX completar 1h sem pagamento.",
      url: "/painel/vendas/recuperacao",
      tag: "teste",
    });
    return NextResponse.json({ ok: r.enviados > 0, ...r });
  }
  const s = b.inscricao;
  if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) {
    return NextResponse.json({ ok: false, erro: "inscrição inválida" }, { status: 400 });
  }
  await sql`INSERT INTO push_inscricoes (endpoint, inscricao) VALUES (${s.endpoint}, ${JSON.stringify(s)}::jsonb)
            ON CONFLICT (endpoint) DO UPDATE SET inscricao = EXCLUDED.inscricao`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false }, { status: 401 });
  await garantirSchema();
  const b = await req.json().catch(() => ({}));
  if (b.endpoint) await sql`DELETE FROM push_inscricoes WHERE endpoint = ${String(b.endpoint)}`;
  return NextResponse.json({ ok: true });
}
