import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { iguais } from "@/lib/auth";
import { notificarTodos } from "@/lib/push";
import { MINUTOS_CONTATO, SQL_PENDENTES, primeiroNome, reais } from "@/lib/recuperacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chamado a cada poucos minutos por um agendador externo.
 * Avisa (push) sobre cada PIX que acabou de completar 1h sem pagamento. Cada PIX é avisado uma única vez.
 * Se CRON_SECRET estiver definido, exige ?chave=... ou header Authorization: Bearer ...
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (segredo) {
    const veio = req.nextUrl.searchParams.get("chave") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!iguais(veio, segredo)) return NextResponse.json({ ok: false }, { status: 401 });
  }
  await garantirSchema();

  // só PIX entre 1h e 3h (não avisa sobre pendências antigas de uma vez)
  const novos = (await sql.query(
    `UPDATE vendas SET rec_notificado_em = now()
     WHERE id IN (
       SELECT x.id FROM (${SQL_PENDENTES}) x
       WHERE x.idade_min >= ${MINUTOS_CONTATO} AND x.idade_min < 180
         AND x.rec_notificado_em IS NULL AND x.rec_contatado_em IS NULL AND x.rec_descartado_em IS NULL
     ) AND rec_notificado_em IS NULL
     RETURNING id, cliente_nome, valor`,
  )) as any[];

  if (novos.length === 0) return NextResponse.json({ ok: true, novos: 0 });

  const [tot] = (await sql.query(
    `SELECT count(*) AS n FROM (${SQL_PENDENTES}) x
     WHERE x.idade_min >= ${MINUTOS_CONTATO} AND x.idade_min < 48 * 60 AND x.rec_contatado_em IS NULL AND x.rec_descartado_em IS NULL`,
  )) as any[];

  const msg =
    novos.length === 1
      ? {
          title: "💬 Hora de chamar no WhatsApp",
          body: `${primeiroNome(novos[0].cliente_nome)} gerou um PIX de ${reais(Number(novos[0].valor))} há 1h e não pagou. Toque para abrir a conversa.`,
        }
      : {
          title: `💬 ${novos.length} PIX para recuperar`,
          body: `${novos.map((n) => primeiroNome(n.cliente_nome)).join(", ")} geraram PIX há 1h e não pagaram.`,
        };
  const r = await notificarTodos({ ...msg, url: "/painel/vendas/recuperacao", tag: "recuperacao", badge: Number(tot?.n || novos.length) });
  return NextResponse.json({ ok: true, novos: novos.length, ...r });
}
