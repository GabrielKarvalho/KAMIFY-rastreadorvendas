import { send } from "@vercel/queue";
import { sql } from "@/lib/db";
import { notificarTodos } from "@/lib/push";
import { SQL_PENDENTES, contarProntos, lerMinutos, primeiroNome, reais, tempoTxt } from "@/lib/recuperacao";

export const TOPICO_AVISO = "rec-aviso";

/**
 * Agenda, na fila da Vercel, o aviso deste PIX para o momento exato em que ele completa o tempo de espera.
 * A chave inclui o tempo de espera: se você mudar o tempo, um novo aviso é agendado e o antigo é ignorado.
 */
export async function agendarAviso(id: string, criadoEm: string | Date, espera?: number) {
  const min = espera ?? (await lerMinutos());
  const idadeSeg = (Date.now() - new Date(criadoEm).getTime()) / 1000;
  const delay = Math.max(0, Math.ceil(min * 60 - idadeSeg));
  await send(TOPICO_AVISO, { id }, {
    delaySeconds: delay,
    retentionSeconds: Math.min(604800, delay + 6 * 3600),
    idempotencyKey: `rec-${id}-${min}`,
  });
  return delay;
}

/** Reagenda todos os PIX ainda pendentes e não avisados (usado quando o tempo de espera muda). */
export async function reagendarPendentes(espera: number) {
  const rows = (await sql.query(
    `SELECT x.id, x.criado_em FROM (${SQL_PENDENTES}) x
     WHERE x.rec_notificado_em IS NULL AND x.rec_contatado_em IS NULL AND x.rec_descartado_em IS NULL
       AND x.idade_min < ${espera + 120}`,
  )) as any[];
  for (const r of rows) await agendarAviso(r.id, r.criado_em, espera).catch((e) => console.error("reagendar", r.id, e?.message));
  return rows.length;
}

/** Chamado pela fila quando chega a hora: confere se o PIX continua pendente e manda a notificação (uma vez só). */
export async function avisarSeDevido(id: string) {
  const espera = await lerMinutos();
  const [v] = (await sql.query(`SELECT * FROM (${SQL_PENDENTES}) x WHERE x.id = $1`, [id])) as any[];
  if (!v) return "pago ou substituído";
  if (v.rec_notificado_em || v.rec_contatado_em || v.rec_descartado_em) return "já tratado";
  const idade = Number(v.idade_min);
  if (idade < espera - 0.25) {
    await agendarAviso(id, v.criado_em, espera);
    return "cedo, reagendado";
  }
  if (idade >= espera + 120) return "antigo demais";
  const [marcado] = (await sql`
    UPDATE vendas SET rec_notificado_em = now() WHERE id = ${id} AND rec_notificado_em IS NULL RETURNING id`) as any[];
  if (!marcado) return "já avisado";
  const total = await contarProntos(espera);
  const r = await notificarTodos({
    title: "💬 Hora de chamar no WhatsApp",
    body: `${primeiroNome(v.cliente_nome)} gerou um PIX de ${reais(Number(v.valor))} há ${tempoTxt(espera)} e não pagou. Toque para abrir a conversa.`,
    url: "/painel/vendas/recuperacao",
    tag: `rec-${id}`,
    badge: total || 1,
  });
  return `avisado (${r.enviados} aparelho(s))`;
}
