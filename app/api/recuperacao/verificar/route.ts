import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { iguais } from "@/lib/auth";
import { notificarTodos } from "@/lib/push";
import { send } from "@vercel/queue";
import { TOPICO_AVISO, agendarAviso } from "@/lib/avisos";
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

  // diagnóstico nos logs (sem dados pessoais) + agenda na fila os PIX que ainda não chegaram no tempo
  const ultimos = (await sql.query(
    `SELECT v.id, v.status, v.metodo, v.criado_em, v.rec_notificado_em, v.rec_contatado_em, v.rec_descartado_em,
            extract(epoch FROM now() - v.criado_em) / 60 AS idade_min, (v.id IN (SELECT x.id FROM (${SQL_PENDENTES}) x)) AS pendente
     FROM vendas v WHERE v.criado_em > now() - interval '6 hours' ORDER BY v.criado_em DESC LIMIT 10`,
  )) as any[];
  for (const u of ultimos) {
    let fila = "";
    if (u.pendente && !u.rec_notificado_em && !u.rec_contatado_em && !u.rec_descartado_em && Number(u.idade_min) < espera) {
      fila = await agendarAviso(u.id, u.criado_em, espera).then((d) => `agendado em ${d}s`, (e) => `erro fila: ${e?.message || e}`);
    }
    console.log("diag", String(u.id).slice(-6), u.status, u.metodo, Math.round(Number(u.idade_min)) + "min",
      u.pendente ? "pendente" : "fora", u.rec_notificado_em ? "notificado" : "", u.rec_contatado_em ? "contatado" : "",
      u.rec_descartado_em ? "descartado" : "", fila);
  }

  // autoteste da fila, no máximo 1x por dia (o consumidor registra "fila rec-aviso ok" nos logs)
  const dia = new Date().toISOString().slice(0, 10);
  const teste = await send(TOPICO_AVISO, { teste: true }, { idempotencyKey: `teste-${dia}` }).then(
    (r) => `ok ${r.messageId ?? ""}`, (e) => `erro: ${e?.message || e}`);
  console.log("diag fila envio", teste);

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
