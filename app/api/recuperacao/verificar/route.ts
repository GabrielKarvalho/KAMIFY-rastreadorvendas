import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { iguais } from "@/lib/auth";
import { notificarTodos } from "@/lib/push";
import { SQL_PENDENTES, contarProntos, lerMinutos, primeiroNome, reais, tempoTxt } from "@/lib/recuperacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chamado a cada poucos minutos por um agendador externo.
 * Avisa (push) sobre cada PIX que acabou de passar do tempo de espera (padrão 1h) sem pagamento. Cada PIX é avisado uma única vez.
 * Se CRON_SECRET estiver definido, exige ?chave=... ou header Authorization: Bearer ...
 */
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (segredo) {
    const veio = req.nextUrl.searchParams.get("chave") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!iguais(veio, segredo)) return NextResponse.json({ ok: false }, { status: 401 });
  }
  await garantirSchema();
  const espera = await lerMinutos();

  // só PIX entre o tempo de espera e +2h (não avisa sobre pendências antigas de uma vez)
  const novos = (await sql.query(
    `UPDATE vendas SET rec_notificado_em = now()
     WHERE id IN (
       SELECT x.id FROM (${SQL_PENDENTES}) x
       WHERE x.idade_min >= ${espera} AND x.idade_min < ${espera + 120}
         AND x.rec_notificado_em IS NULL AND x.rec_contatado_em IS NULL AND x.rec_descartado_em IS NULL
     ) AND rec_notificado_em IS NULL
     RETURNING id, cliente_nome, valor`,
  )) as any[];

  if (novos.length === 0) return NextResponse.json({ ok: true, novos: 0 });

  const total = await contarProntos(espera);
  const ha = tempoTxt(espera);

  const msg =
    novos.length === 1
      ? {
          title: "💬 Hora de chamar no WhatsApp",
          body: `${primeiroNome(novos[0].cliente_nome)} gerou um PIX de ${reais(Number(novos[0].valor))} há ${ha} e não pagou. Toque para abrir a conversa.`,
        }
      : {
          title: `💬 ${novos.length} PIX para recuperar`,
          body: `${novos.map((n) => primeiroNome(n.cliente_nome)).join(", ")} geraram PIX há ${ha} e não pagaram.`,
        };
  const r = await notificarTodos({ ...msg, url: "/painel/vendas/recuperacao", tag: "recuperacao", badge: total || novos.length });
  return NextResponse.json({ ok: true, novos: novos.length, ...r });
}
