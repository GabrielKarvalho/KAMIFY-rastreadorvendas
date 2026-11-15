import { brl, inteiro } from "@/lib/filtros";

export function Card(p: {
  titulo: string;
  sufixo?: string;
  valor: string;
  extra?: string;
  cor?: "verde" | "vermelho" | "azul";
  selo?: { texto: string; tipo: "ok" | "bad" | "wait" } | null;
  grande?: boolean;
}) {
  return (
    <div className={`card${p.grande ? " grande" : ""}`}>
      <span className="ct">
        {p.titulo}
        {p.sufixo && <small> ({p.sufixo})</small>}
      </span>
      <strong className={p.cor || ""}>{p.valor}</strong>
      {p.extra && <span className="cx">{p.extra}</span>}
      {p.selo && (
        <span className={`selo ${p.selo.tipo}`}>
          {p.selo.tipo === "ok" ? "↑" : p.selo.tipo === "bad" ? "↓" : "→"} {p.selo.texto}
        </span>
      )}
    </div>
  );
}

/** Funil em SVG com transições curvas entre as etapas. */
export function Funil({ etapas }: { etapas: { nome: string; valor: number }[] }) {
  const W = 1000, H = 230, topo = 10;
  const n = etapas.length;
  const larg = W / n;
  const base = Math.max(1, etapas[0]?.valor || 0);
  const alt = etapas.map((e) => Math.max(0.05, Math.min(1, e.valor / base)) * (H - topo * 2));
  const meio = H / 2;
  const cores = ["#2f6bff", "#4a7dff", "#6b6ef5", "#9a64f0", "#3cc48a"];

  return (
    <div className="funil">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Funil de conversão">
        <defs>
          {etapas.map((_, i) => (
            <linearGradient key={i} id={`fg${i}`} x1="0" x2="1">
              <stop offset="0" stopColor={cores[i % cores.length]} />
              <stop offset="1" stopColor={cores[(i + 1) % cores.length] && i < n - 1 ? cores[i + 1] : cores[i]} />
            </linearGradient>
          ))}
        </defs>
        {etapas.map((e, i) => {
          const x0 = i * larg, x1 = (i + 1) * larg;
          const h0 = alt[i], h1 = i < n - 1 ? alt[i + 1] : alt[i];
          const xc = x0 + larg * 0.55;
          const d = [
            `M${x0},${meio - h0 / 2}`,
            `L${xc},${meio - h0 / 2}`,
            `C${xc + larg * 0.25},${meio - h0 / 2} ${x1 - larg * 0.2},${meio - h1 / 2} ${x1},${meio - h1 / 2}`,
            `L${x1},${meio + h1 / 2}`,
            `C${x1 - larg * 0.2},${meio + h1 / 2} ${xc + larg * 0.25},${meio + h0 / 2} ${xc},${meio + h0 / 2}`,
            `L${x0},${meio + h0 / 2}Z`,
          ].join(" ");
          return (
            <g key={e.nome}>
              <path d={d} fill={`url(#fg${i})`} />
              {i > 0 && <line x1={x0} x2={x0} y1={4} y2={H - 4} style={{ stroke: "var(--border-strong)" }} strokeDasharray="4 5" />}
            </g>
          );
        })}
      </svg>
      <div className="funil-rotulos" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {etapas.map((e, i) => (
          <div key={e.nome}>
            <b>{base > 0 ? ((e.valor / base) * 100).toFixed(1).replace(".", ",") + "%" : "—"}</b>
            <span>{e.nome}</span>
            <small>
              {inteiro(e.valor)}
              {i > 0 && etapas[i - 1].valor > 0 && ` · ${((e.valor / etapas[i - 1].valor) * 100).toFixed(1).replace(".", ",")}% da etapa anterior`}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barras de faturamento com linha de gasto opcional. */
export function Barras({ dados }: { dados: { rotulo: string; fat: number; vendas: number; gasto?: number }[] }) {
  const W = 1000, H = 220, pe = 26, esq = 4;
  const max = Math.max(1, ...dados.map((d) => Math.max(d.fat, d.gasto || 0)));
  const passo = (W - esq) / Math.max(1, dados.length);
  const temGasto = dados.some((d) => (d.gasto || 0) > 0);
  const y = (v: number) => H - pe - (v / max) * (H - pe - 12);
  const pontos = dados.map((d, i) => `${esq + i * passo + passo / 2},${y(d.gasto || 0)}`).join(" ");
  const cada = Math.ceil(dados.length / 16);

  return (
    <div className="barras-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="barras-svg">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} style={{ stroke: "var(--grid)" }} />
        ))}
        {dados.map((d, i) => {
          const bw = Math.max(2, passo * 0.62);
          const x = esq + i * passo + (passo - bw) / 2;
          return (
            <rect key={i} x={x} y={y(d.fat)} width={bw} height={Math.max(0, H - pe - y(d.fat))} rx={3} fill="#2f6bff">
              <title>{`${d.rotulo}: ${brl(d.fat)} · ${d.vendas} vendas${d.gasto ? ` · gasto ${brl(d.gasto)}` : ""}`}</title>
            </rect>
          );
        })}
        {temGasto && <polyline points={pontos} fill="none" stroke="#f08a3c" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="barras-eixo">
        {dados.map((d, i) => <span key={i}>{i % cada === 0 ? d.rotulo : ""}</span>)}
      </div>
      <div className="legenda">
        <span><i style={{ background: "#2f6bff" }} /> Faturamento líquido</span>
        {temGasto && <span><i style={{ background: "#f08a3c" }} /> Gasto em ads</span>}
      </div>
    </div>
  );
}

/** Barra horizontal simples para listas (métodos, produtos). */
export function Linha(p: { nome: string; valor: string; fracao: number; detalhe?: string; cor?: string }) {
  return (
    <div className="linha">
      <div className="linha-top"><span>{p.nome}</span><b>{p.valor}</b></div>
      <div className="trilho"><div style={{ width: `${Math.max(0, Math.min(1, p.fracao)) * 100}%`, background: p.cor || "var(--blue)" }} /></div>
      {p.detalhe && <small>{p.detalhe}</small>}
    </div>
  );
}
