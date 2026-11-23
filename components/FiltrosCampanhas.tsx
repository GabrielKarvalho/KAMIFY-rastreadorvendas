"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** Atalhos de ordenação: [rótulo, coluna, direção] */
export const ORDENS: [string, string, "desc" | "asc"][] = [
  ["Mais gasto", "gasto", "desc"],
  ["Mais vendas", "vendas", "desc"],
  ["Maior lucro", "lucro", "desc"],
  ["Melhor ROAS", "roas", "desc"],
  ["Menor CPA", "cpa", "asc"],
  ["Maior faturamento", "fat", "desc"],
  ["Maior orçamento", "orcamento", "desc"],
  ["Melhor conexão", "conexao", "desc"],
  ["Maior CTR", "ctr", "desc"],
  ["Pior lucro", "lucro", "asc"],
];

const STATUS: [string, string][] = [
  ["", "Todas"],
  ["ativas", "Ativas"],
  ["pausadas", "Pausadas"],
  ["gasto", "Com gasto"],
];
const RESULTADO: [string, string][] = [
  ["", "Qualquer resultado"],
  ["vendas", "Com vendas"],
  ["lucro", "Lucrativas"],
  ["prejuizo", "No prejuízo"],
  ["sem-venda", "Gastou e não vendeu"],
];

export default function FiltrosCampanhas({ total, mostrando }: { total: number; mostrando: number }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const [busca, setBusca] = useState(sp.get("busca") || "");

  useEffect(() => setBusca(sp.get("busca") || ""), [sp]);

  const ir = (mudar: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(mudar)) (v ? q.set(k, v) : q.delete(k));
    const s = q.toString();
    iniciar(() => router.push(s ? `${path}?${s}` : path, { scroll: false }));
  };

  // busca com pequeno atraso enquanto digita
  useEffect(() => {
    if (busca === (sp.get("busca") || "")) return;
    const t = setTimeout(() => ir({ busca: busca.trim() || null }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const st = sp.get("st") || "";
  const res = sp.get("res") || "";
  const ordem = sp.get("ordem") || "gasto";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const atalho = ORDENS.find(([, k, d]) => k === ordem && d === dir);
  const filtrando = !!(st || res || busca);

  return (
    <div className={`filtros-camp${pendente ? " carregando" : ""}`}>
      <div className="fc-linha">
        <div className="fc-seg" role="group" aria-label="Status">
          {STATUS.map(([k, t]) => (
            <button key={k} type="button" className={st === k ? "on" : ""} onClick={() => ir({ st: k || null })}>{t}</button>
          ))}
        </div>
        <input
          className="fc-busca"
          type="search"
          placeholder="Buscar pelo nome…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <div className="fc-linha">
        <label className="fc-sel">
          Resultado
          <select value={res} onChange={(e) => ir({ res: e.target.value || null })}>
            {RESULTADO.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        <label className="fc-sel">
          Ordenar por
          <select
            value={atalho ? `${ordem}:${dir}` : ""}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":");
              ir({ ordem: k === "gasto" && d === "desc" ? null : k, dir: d === "asc" ? "asc" : null });
            }}
          >
            {!atalho && <option value="">Coluna da tabela</option>}
            {ORDENS.map(([t, k, d]) => <option key={t} value={`${k}:${d}`}>{t}</option>)}
          </select>
        </label>
        <span className="fc-cont">
          {filtrando ? <>Mostrando <b>{mostrando}</b> de {total}</> : <><b>{total}</b> no período</>}
          {filtrando && (
            <button type="button" className="link-btn" onClick={() => { setBusca(""); ir({ st: null, res: null, busca: null }); }}>
              ✕ limpar filtros
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
