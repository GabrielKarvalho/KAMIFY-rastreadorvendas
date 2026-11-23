import { sql } from "@/lib/db";

/** Minutos depois do PIX gerado em que entra o contato manual (a Wiapy manda o dela aos 10 min).
 *  Padrão 60; muda pela tela de Recuperação (config "rec_minutos"). */
export const MINUTOS_PADRAO = 60;
export const MINUTOS_MIN = 15;
export const MINUTOS_MAX = 240;
export const OPCOES_MINUTOS = [15, 20, 30, 45, 60, 90, 120];

export async function lerMinutos() {
  const [r] = (await sql`SELECT valor FROM config WHERE chave = 'rec_minutos'`) as any[];
  const n = Math.round(Number(r?.valor));
  return Number.isFinite(n) && n >= MINUTOS_MIN && n <= MINUTOS_MAX ? n : MINUTOS_PADRAO;
}

/** 30 → "30 min", 60 → "1h", 90 → "1h30" */
export function tempoTxt(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
/** Depois disso o PIX provavelmente expirou: a mensagem manda o link do checkout em vez do código. */
export const HORAS_PIX_VALIDO = 24;
/** Até quantos dias atrás um PIX pendente aparece na lista. */
export const DIAS_LISTA = 7;

export const CHECKOUT_URL = process.env.CHECKOUT_URL || "https://pay.wiapy.com/KnDXpyANX9T-";

export const MODELOS_PADRAO = {
  modelo_pix: `Oi, {nome}! Tudo bem? 👋
Aqui é da equipe da *Formação Técnico em iPhone*.

Vi que seu PIX de {valor} ficou pendente. Aconteceu alguma coisa ou ficou alguma dúvida sobre o curso?

Se quiser garantir sua vaga, vou te mandar o código do PIX aqui embaixo. É só tocar e segurar nele, copiar e colar no app do seu banco (Pix copia e cola). O acesso é liberado assim que o pagamento cai 📲 👇`,
  modelo_expirado: `Oi, {nome}! Tudo bem? 👋
Aqui é da equipe da *Formação Técnico em iPhone*.

Vi que você tentou garantir sua vaga, mas o PIX não chegou a ser pago. Ficou alguma dúvida que eu possa te ajudar?

Se ainda quiser entrar, é só gerar um novo PIX por aqui: {link}`,
};
export type ChaveModelo = keyof typeof MODELOS_PADRAO;

export async function lerModelos(): Promise<Record<ChaveModelo, string>> {
  const rows = (await sql`SELECT chave, valor FROM config WHERE chave = ANY(${Object.keys(MODELOS_PADRAO)})`) as any[];
  const m = { ...MODELOS_PADRAO };
  for (const r of rows) if (r.valor) m[r.chave as ChaveModelo] = r.valor;
  return m;
}

/** Mesmo cliente (e-mail ou telefone) — usado para não cobrar quem já pagou ou gerou PIX mais novo. */
const MESMA_PESSOA = (a: string, b: string) => `(
  (${b}.cliente_email IS NOT NULL AND lower(${a}.cliente_email) = lower(${b}.cliente_email))
  OR (${b}.cliente_telefone IS NOT NULL AND length(regexp_replace(${b}.cliente_telefone, '\\D', '', 'g')) >= 8
      AND right(regexp_replace(${a}.cliente_telefone, '\\D', '', 'g'), 8) = right(regexp_replace(${b}.cliente_telefone, '\\D', '', 'g'), 8))
)`;

/** PIX pendentes que ainda podem ser recuperados (sem pagamento posterior e sem PIX mais novo da mesma pessoa). */
export const SQL_PENDENTES = `
  SELECT v.id, v.valor, v.checkout_titulo, v.orderbumps, v.cliente_nome, v.cliente_email, v.cliente_telefone,
         v.criado_em, v.rec_contatado_em, v.rec_descartado_em, v.rec_notificado_em, v.utm_campaign,
         v.raw->'payment'->'pix_boleto'->>'code' AS pix_code,
         extract(epoch FROM now() - v.criado_em) / 60 AS idade_min
  FROM vendas v
  WHERE v.metodo = 'pix' AND v.status = 'unpaid'
    AND v.criado_em > now() - interval '${DIAS_LISTA} days'
    AND NOT EXISTS (SELECT 1 FROM vendas p WHERE p.status = 'paid' AND p.criado_em > now() - interval '30 days' AND ${MESMA_PESSOA("p", "v")})
    AND NOT EXISTS (SELECT 1 FROM vendas n WHERE n.id <> v.id AND n.metodo = 'pix' AND n.criado_em > v.criado_em AND ${MESMA_PESSOA("n", "v")})`;

/** Contatados nos últimos dias e se pagaram depois do contato. */
export const SQL_CONTATADOS = `
  SELECT v.id, v.valor, v.cliente_nome, v.cliente_telefone, v.cliente_email, v.criado_em, v.rec_contatado_em, v.status,
         (SELECT p.valor FROM vendas p WHERE p.status = 'paid' AND (p.id = v.id OR (${MESMA_PESSOA("p", "v")} AND p.criado_em >= v.criado_em))
          ORDER BY p.pago_em DESC NULLS LAST LIMIT 1) AS valor_pago
  FROM vendas v
  WHERE v.rec_contatado_em IS NOT NULL AND v.rec_contatado_em > now() - interval '30 days'
  ORDER BY v.rec_contatado_em DESC`;

export function primeiroNome(nome?: string | null) {
  const n = (nome || "").trim().split(/\s+/)[0] || "";
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : "tudo bem";
}

/** Telefone no formato do wa.me (DDI 55 + DDD + número). */
export function telefoneWa(tel?: string | null) {
  let d = String(tel || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d.length >= 12 ? d : null;
}

export const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function montarMensagem(
  modelos: Record<ChaveModelo, string>,
  v: { cliente_nome?: string | null; valor: number; checkout_titulo?: string | null; pix_code?: string | null; idade_min: number },
) {
  const usarPix = !!v.pix_code && v.idade_min < HORAS_PIX_VALIDO * 60;
  const modelo = usarPix ? modelos.modelo_pix : modelos.modelo_expirado;
  // o código PIX vai sempre numa mensagem separada (fica fácil de copiar), então {pix} sai do texto
  return modelo
    .replace(/\n*\{pix\}\n*/g, "\n")
    .replaceAll("{nome}", primeiroNome(v.cliente_nome))
    .replaceAll("{valor}", reais(Number(v.valor)))
    .replaceAll("{produto}", v.checkout_titulo || "Formação Técnico em iPhone")
    .replaceAll("{link}", CHECKOUT_URL)
    .trim();
}

/** PIX que já passaram do tempo de espera e ainda não foram chamados nem descartados. */
export async function contarProntos(minutos?: number) {
  const espera = minutos ?? (await lerMinutos());
  const [r] = (await sql.query(
    `SELECT count(*) AS n FROM (${SQL_PENDENTES}) x
     WHERE x.idade_min >= ${espera} AND x.idade_min < 48 * 60
       AND x.rec_contatado_em IS NULL AND x.rec_descartado_em IS NULL`,
  )) as any[];
  return Number(r?.n || 0);
}
