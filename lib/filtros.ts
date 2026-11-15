export type SP = Record<string, string | undefined>;

export const TZ = "America/Sao_Paulo";

/** Brasil não tem horário de verão desde 2019: São Paulo = UTC-3 fixo. */
export function diaSP(offsetDias = 0) {
  return new Date(Date.now() - 3 * 3600_000 + offsetDias * 86400_000).toISOString().slice(0, 10);
}
export const inicioDia = (d: string) => new Date(`${d}T00:00:00-03:00`).toISOString();
export const somaDia = (d: string, k: number) =>
  new Date(new Date(`${d}T12:00:00Z`).getTime() + k * 86400_000).toISOString().slice(0, 10);
const dataValida = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export type Intervalo = {
  ini: string; // ISO (timestamptz) inclusivo
  fim: string; // ISO exclusivo
  deDia: string; // YYYY-MM-DD (para a Meta)
  ateDia: string;
  rotulo: string;
  porHora: boolean;
};

export function intervalo(sp: SP): Intervalo {
  const hoje = diaSP();
  const mk = (de: string, ate: string, rotulo: string): Intervalo => ({
    ini: inicioDia(de),
    fim: inicioDia(somaDia(ate, 1)),
    deDia: de,
    ateDia: ate,
    rotulo,
    porHora: de === ate,
  });
  if (dataValida(sp.de) && dataValida(sp.ate)) {
    const [a, b] = [sp.de!, sp.ate!].sort();
    return mk(a, b, `${a.split("-").reverse().join("/")} – ${b.split("-").reverse().join("/")}`);
  }
  switch (sp.periodo) {
    case "ontem": return mk(diaSP(-1), diaSP(-1), "Ontem");
    case "7d": return mk(diaSP(-6), hoje, "7 dias");
    case "15d": return mk(diaSP(-14), hoje, "15 dias");
    case "30d": return mk(diaSP(-29), hoje, "30 dias");
    case "mes": return mk(hoje.slice(0, 8) + "01", hoje, "Este mês");
    default: return mk(hoje, hoje, "Hoje");
  }
}

/** Monta um link preservando os filtros globais (período, produto, conta). */
export function linkCom(path: string, sp: SP, extra: SP = {}) {
  const q = new URLSearchParams();
  const base: SP = { periodo: sp.periodo, de: sp.de, ate: sp.ate, produto: sp.produto, conta: sp.conta };
  for (const [k, v] of Object.entries({ ...base, ...extra })) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export const brl = (centavos: number | string | null | undefined) =>
  (Number(centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (v: unknown) => Number(v || 0);
export const inteiro = (v: unknown) => num(v).toLocaleString("pt-BR");
export const pct = (a: number, b: number, casas = 1) =>
  b > 0 ? ((a / b) * 100).toFixed(casas).replace(".", ",") + "%" : "—";
export const vezes = (a: number, b: number) => (b > 0 ? (a / b).toFixed(2).replace(".", ",") + "x" : "—");
