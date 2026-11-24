import { handleCallback } from "@vercel/queue";
import { garantirSchema, sql } from "@/lib/db";
import { avisarSeDevido } from "@/lib/avisos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Consumidor da fila "rec-aviso": cada mensagem chega na hora em que um PIX completa o tempo de espera. */
export const POST = handleCallback<{ id?: string; teste?: boolean }>(async (msg, meta) => {
  await garantirSchema();
  if (msg?.teste) {
    await sql`INSERT INTO config (chave, valor) VALUES ('fila_teste', ${new Date().toISOString()})
              ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`;
    console.log("fila rec-aviso ok", meta.messageId);
    return;
  }
  if (!msg?.id) return;
  const r = await avisarSeDevido(String(msg.id));
  console.log("rec-aviso", msg.id, r);
});
