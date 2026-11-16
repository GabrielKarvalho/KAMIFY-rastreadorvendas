import { NextRequest, NextResponse } from "next/server";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import { graphPost } from "@/lib/meta-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Altera uma campanha / conjunto / anúncio na Meta.
 * body: { id, acao: "status", valor: "ACTIVE" | "PAUSED" }
 *       { id, acao: "orcamento", valor: centavos }
 */
export async function POST(req: NextRequest) {
  if (!(await estaLogado())) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  await garantirSchema();

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const acao = String(b.acao || "");
  if (!/^\d+$/.test(id)) return NextResponse.json({ ok: false, erro: "id inválido" }, { status: 400 });

  const [obj] = (await sql`SELECT id, nivel, nome, status, status_config, orcamento, tipo_orcamento FROM meta_objetos WHERE id = ${id}`) as any[];
  if (!obj) return NextResponse.json({ ok: false, erro: "objeto não encontrado — clique em Atualizar" }, { status: 404 });

  let campos: Record<string, string>;
  let de: string | null;
  let para: string;

  if (acao === "status") {
    const valor = String(b.valor);
    if (!["ACTIVE", "PAUSED"].includes(valor)) return NextResponse.json({ ok: false, erro: "status inválido" }, { status: 400 });
    campos = { status: valor };
    de = obj.status_config || obj.status;
    para = valor;
  } else if (acao === "orcamento") {
    const centavos = Math.round(Number(b.valor));
    if (!Number.isFinite(centavos) || centavos < 100) {
      return NextResponse.json({ ok: false, erro: "orçamento mínimo R$ 1,00" }, { status: 400 });
    }
    if (!obj.tipo_orcamento) {
      return NextResponse.json({ ok: false, erro: "este item não tem orçamento próprio (o orçamento está no nível acima)" }, { status: 400 });
    }
    // trava de segurança contra digitação errada: no máximo 5x o orçamento atual de uma vez
    if (obj.orcamento && centavos > Number(obj.orcamento) * 5) {
      return NextResponse.json({ ok: false, erro: "aumento maior que 5x de uma vez — faça em etapas" }, { status: 400 });
    }
    campos = obj.tipo_orcamento === "total" ? { lifetime_budget: String(centavos) } : { daily_budget: String(centavos) };
    de = obj.orcamento != null ? String(obj.orcamento) : null;
    para = String(centavos);
  } else {
    return NextResponse.json({ ok: false, erro: "ação inválida" }, { status: 400 });
  }

  try {
    const r = await graphPost(id, campos);
    if (acao === "status") {
      await sql`UPDATE meta_objetos SET status_config = ${para},
                  status = CASE WHEN ${para} = 'PAUSED' THEN 'PAUSED' ELSE 'ACTIVE' END, atualizado_em = now()
                WHERE id = ${id}`;
    } else {
      await sql`UPDATE meta_objetos SET orcamento = ${Number(para)}, atualizado_em = now() WHERE id = ${id}`;
    }
    await sql`INSERT INTO meta_acoes (objeto_id, nivel, nome, acao, de, para, ok, resposta)
              VALUES (${id}, ${obj.nivel}, ${obj.nome}, ${acao}, ${de}, ${para}, true, ${JSON.stringify(r).slice(0, 500)})`;
    // força nova leitura da Meta na próxima abertura
    await sql`DELETE FROM meta_sync WHERE chave LIKE '%:objetos'`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || e);
    await sql`INSERT INTO meta_acoes (objeto_id, nivel, nome, acao, de, para, ok, resposta)
              VALUES (${id}, ${obj.nivel}, ${obj.nome}, ${acao}, ${de}, ${para}, false, ${msg.slice(0, 500)})`;
    const semPermissao = /ads_management|permission|permiss/i.test(msg);
    return NextResponse.json(
      {
        ok: false,
        erro: semPermissao
          ? "O token da Meta não tem permissão para alterar campanhas (ads_management). Veja as instruções em Parâmetros UTM → Controle de campanhas."
          : msg,
      },
      { status: 400 },
    );
  }
}
