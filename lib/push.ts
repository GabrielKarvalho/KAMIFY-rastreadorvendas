import webpush from "web-push";
import { sql } from "@/lib/db";

export const pushConfigurado = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let pronto = false;
function configurar() {
  if (pronto) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@kamify.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  pronto = true;
}

/** Envia uma notificação para todos os aparelhos inscritos. Remove inscrições que expiraram. */
export async function notificarTodos(msg: { title: string; body: string; url?: string; tag?: string; badge?: number }) {
  if (!pushConfigurado()) return { enviados: 0, erro: "VAPID não configurado" };
  configurar();
  const subs = (await sql`SELECT endpoint, inscricao FROM push_inscricoes`) as any[];
  let enviados = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.inscricao, JSON.stringify(msg), { TTL: 3600, urgency: "high" });
        enviados++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sql`DELETE FROM push_inscricoes WHERE endpoint = ${s.endpoint}`;
        } else {
          console.error("push falhou", e?.statusCode, e?.body || e?.message);
        }
      }
    }),
  );
  return { enviados, aparelhos: subs.length };
}
