import { NextResponse } from "next/server";
import { estaLogado } from "@/lib/auth";
import { contasConfiguradas } from "@/lib/meta-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mostra o que o token da Meta Ads consegue acessar (sem expor o token). */
export async function GET() {
  if (!(await estaLogado())) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const token = process.env.META_ADS_TOKEN || process.env.META_ACCESS_TOKEN || "";
  const v = process.env.META_API_VERSION || "v25.0";
  const get = async (path: string) => {
    try {
      const r = await fetch(`https://graph.facebook.com/${v}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`);
      return await r.json();
    } catch (e) {
      return { erro: String(e) };
    }
  };
  const contas = contasConfiguradas();
  return NextResponse.json({
    token_configurado: !!token,
    token_tamanho: token.length,
    variavel_usada: process.env.META_ADS_TOKEN ? "META_ADS_TOKEN" : process.env.META_ACCESS_TOKEN ? "META_ACCESS_TOKEN" : "nenhuma",
    eu: await get("me?fields=id,name"),
    permissoes: await get("me/permissions"),
    contas_visiveis: await get("me/adaccounts?fields=id,name,account_status&limit=50"),
    contas_configuradas: contas,
    teste_contas: await Promise.all(contas.map(async (c) => ({ conta: c, resposta: await get(`${c}?fields=name,account_status,currency`) }))),
  });
}
