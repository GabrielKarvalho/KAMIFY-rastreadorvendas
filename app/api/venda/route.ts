import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { enviarPurchase, type VendaCapi } from "@/lib/meta";
import { iguais } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_FINAIS = ["paid", "refunded", "chargedback"];
const txt = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

export async function GET() {
  return NextResponse.json({ ok: true, info: "Endpoint de webhook da Wiapy. Use POST." });
}

export async function POST(req: NextRequest) {
  // 1. Validação do token (header Authorization, com ou sem "Bearer ")
  const esperado = process.env.WIAPY_TOKEN || "";
  const recebido = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!esperado || !iguais(recebido, esperado)) {
    return NextResponse.json({ ok: false, erro: "token inválido" }, { status: 401 });
  }

  let p: any;
  try {
    p = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "JSON inválido" }, { status: 400 });
  }

  await garantirSchema();
  const pay = p?.payment;
  await sql`INSERT INTO webhook_log (payment_id, status, payload)
            VALUES (${txt(pay?.id)}, ${txt(pay?.status) ?? "carrinho"}, ${JSON.stringify(p)}::jsonb)`;

  // 2. Carrinho abandonado (payment = null)
  if (!pay || !pay.id) {
    const c = p?.customer ?? {};
    await sql`INSERT INTO carrinhos (nome, email, telefone, checkout_id, valor, payload)
              VALUES (${txt(c.name)}, ${txt(c.email)}, ${txt(c.mobile_phone)},
                      ${txt(p?.checkout?.id)}, ${int(p?.checkout?.amount)}, ${JSON.stringify(p)}::jsonb)`;
    return NextResponse.json({ ok: true, tipo: "carrinho" });
  }

  // 3. Grava/atualiza a venda
  const c = p.customer ?? {};
  const t = p.tracking ?? {};
  const ck = p.checkout ?? {};
  const bumps = Array.isArray(ck.orderbump) ? ck.orderbump : [];
  const status = String(pay.status || "unpaid");
  const criado = txt(pay.dt_create) ?? new Date().toISOString();
  const atualizado = txt(pay.dt_update) ?? new Date().toISOString();
  const pagoEm = status === "paid" ? atualizado : null;

  const [venda] = (await sql`
    INSERT INTO vendas (
      id, status, metodo, tipo, valor, taxa, valor_produto, checkout_id, checkout_titulo, orderbumps,
      cliente_nome, cliente_email, cliente_telefone, cliente_documento,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbc, fbp, ip, useragent,
      criado_em, atualizado_em, pago_em, raw
    ) VALUES (
      ${String(pay.id)}, ${status}, ${txt(pay.payment_method)}, ${txt(pay.type)},
      ${int(pay.amount ?? ck.amount)}, ${int(pay.fee)}, ${int(ck.amount)},
      ${txt(ck.id)}, ${txt(ck.title)}, ${JSON.stringify(bumps)}::jsonb,
      ${txt(c.name)}, ${txt(c.email)}, ${txt(c.mobile_phone)}, ${txt(c.document)},
      ${txt(t.utm_source)}, ${txt(t.utm_medium)}, ${txt(t.utm_campaign)}, ${txt(t.utm_content)}, ${txt(t.utm_term)},
      ${txt(t.fbc)}, ${txt(t.fbp)}, ${txt(t.ip)}, ${txt(t.useragent)},
      ${criado}, ${atualizado}, ${pagoEm}, ${JSON.stringify(p)}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      -- não deixa um "unpaid"/"declined" atrasado sobrescrever um status final
      status = CASE
        WHEN vendas.status = ANY(${STATUS_FINAIS}) AND EXCLUDED.status NOT IN ('paid','refunded','chargedback')
          THEN vendas.status
        ELSE EXCLUDED.status END,
      metodo        = COALESCE(EXCLUDED.metodo, vendas.metodo),
      valor         = CASE WHEN EXCLUDED.valor > 0 THEN EXCLUDED.valor ELSE vendas.valor END,
      taxa          = CASE WHEN EXCLUDED.taxa > 0 THEN EXCLUDED.taxa ELSE vendas.taxa END,
      orderbumps    = CASE WHEN jsonb_array_length(EXCLUDED.orderbumps) > 0 THEN EXCLUDED.orderbumps ELSE vendas.orderbumps END,
      cliente_nome      = COALESCE(EXCLUDED.cliente_nome, vendas.cliente_nome),
      cliente_email     = COALESCE(EXCLUDED.cliente_email, vendas.cliente_email),
      cliente_telefone  = COALESCE(EXCLUDED.cliente_telefone, vendas.cliente_telefone),
      cliente_documento = COALESCE(EXCLUDED.cliente_documento, vendas.cliente_documento),
      utm_source    = COALESCE(vendas.utm_source, EXCLUDED.utm_source),
      utm_medium    = COALESCE(vendas.utm_medium, EXCLUDED.utm_medium),
      utm_campaign  = COALESCE(vendas.utm_campaign, EXCLUDED.utm_campaign),
      utm_content   = COALESCE(vendas.utm_content, EXCLUDED.utm_content),
      utm_term      = COALESCE(vendas.utm_term, EXCLUDED.utm_term),
      fbc           = COALESCE(vendas.fbc, EXCLUDED.fbc),
      fbp           = COALESCE(vendas.fbp, EXCLUDED.fbp),
      ip            = COALESCE(vendas.ip, EXCLUDED.ip),
      useragent     = COALESCE(vendas.useragent, EXCLUDED.useragent),
      criado_em     = LEAST(vendas.criado_em, EXCLUDED.criado_em),
      atualizado_em = GREATEST(vendas.atualizado_em, EXCLUDED.atualizado_em),
      pago_em       = COALESCE(vendas.pago_em, EXCLUDED.pago_em),
      raw           = EXCLUDED.raw,
      recebido_em   = now()
    RETURNING *`) as any[];

  // 4. Purchase na API de Conversões — só uma vez por venda (trava atômica)
  let capi: string = "não aplicável";
  const capiAtivo =
    !!process.env.META_ACCESS_TOKEN && !!process.env.META_PIXEL_ID && process.env.META_CAPI_ATIVO !== "false";
  if (!capiAtivo) {
    capi = "desativado";
  } else if (venda.status === "paid" && !venda.capi_enviado_em) {
    const [trava] = (await sql`
      UPDATE vendas SET capi_enviado_em = now()
      WHERE id = ${venda.id} AND capi_enviado_em IS NULL RETURNING id`) as any[];
    if (trava) {
      const r = await enviarPurchase(venda as VendaCapi);
      if (r.ok) {
        await sql`UPDATE vendas SET capi_resposta = ${r.resposta} WHERE id = ${venda.id}`;
        capi = "enviado";
      } else {
        // libera para nova tentativa no próximo webhook / reenvio manual
        await sql`UPDATE vendas SET capi_enviado_em = NULL, capi_resposta = ${"ERRO: " + r.resposta}
                  WHERE id = ${venda.id}`;
        capi = "erro";
        console.error("CAPI falhou", venda.id, r.resposta);
      }
    }
  } else if (venda.capi_enviado_em) {
    capi = "já enviado";
  }

  return NextResponse.json({ ok: true, id: venda.id, status: venda.status, capi });
}
