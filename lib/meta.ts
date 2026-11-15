import { createHash } from "node:crypto";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const limpa = (v?: string | null) => (v ?? "").toString().trim().toLowerCase();
const digitos = (v?: string | null) => (v ?? "").toString().replace(/\D/g, "");

/** Telefone BR → formato E.164 sem "+" (ex.: 5511999999999). */
function normalizaTelefone(v?: string | null) {
  let d = digitos(v);
  if (!d) return "";
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length <= 11) d = "55" + d;
  return d;
}

export type VendaCapi = {
  id: string;
  valor: number; // centavos
  pago_em: Date | string | null;
  checkout_id: string | null;
  checkout_titulo: string | null;
  orderbumps: { id?: string; title?: string; amount?: number }[];
  cliente_nome: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  cliente_documento: string | null;
  fbc: string | null;
  fbp: string | null;
  ip: string | null;
  useragent: string | null;
};

export async function enviarPurchase(v: VendaCapi) {
  const pixel = process.env.META_PIXEL_ID;
  const token = process.env.META_ACCESS_TOKEN;
  if (!pixel || !token) return { ok: false, resposta: "META_PIXEL_ID/META_ACCESS_TOKEN ausentes" };

  const versao = process.env.META_API_VERSION || "v25.0";
  const agora = Math.floor(Date.now() / 1000);
  let eventTime = v.pago_em ? Math.floor(new Date(v.pago_em).getTime() / 1000) : agora;
  // A Meta recusa eventos com mais de 7 dias ou no futuro
  if (!eventTime || eventTime > agora || agora - eventTime > 7 * 86400 - 60) eventTime = agora;

  const nomes = limpa(v.cliente_nome).split(/\s+/).filter(Boolean);
  const email = limpa(v.cliente_email);
  const tel = normalizaTelefone(v.cliente_telefone);
  const doc = digitos(v.cliente_documento);

  const user_data: Record<string, unknown> = { country: [sha("br")] };
  if (email) user_data.em = [sha(email)];
  if (tel) user_data.ph = [sha(tel)];
  if (nomes[0]) user_data.fn = [sha(nomes[0])];
  if (nomes.length > 1) user_data.ln = [sha(nomes[nomes.length - 1])];
  if (doc || email) user_data.external_id = [sha(doc || email)];
  if (v.ip) user_data.client_ip_address = v.ip;
  if (v.useragent) user_data.client_user_agent = v.useragent;
  if (v.fbc) user_data.fbc = v.fbc;
  if (v.fbp) user_data.fbp = v.fbp;

  const bumps = Array.isArray(v.orderbumps) ? v.orderbumps : [];
  const contentIds = [v.checkout_id, ...bumps.map((b) => b.id)].filter(Boolean) as string[];

  const evento = {
    event_name: "Purchase",
    event_time: eventTime,
    event_id: v.id, // mesmo ID da transação Wiapy → deduplicação
    action_source: "website",
    event_source_url: process.env.LANDING_URL || "https://forma-tecnicoiphone.vercel.app/",
    user_data,
    custom_data: {
      currency: "BRL",
      value: Math.round(v.valor) / 100,
      order_id: v.id,
      content_type: "product",
      content_name: v.checkout_titulo || undefined,
      content_ids: contentIds,
      num_items: 1 + bumps.length,
    },
  };

  const body: Record<string, unknown> = { data: [evento] };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const r = await fetch(
      `https://graph.facebook.com/${versao}/${pixel}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      },
    );
    const texto = await r.text();
    return { ok: r.ok, resposta: texto.slice(0, 1000) };
  } catch (e) {
    return { ok: false, resposta: "erro de rede: " + String(e) };
  }
}
