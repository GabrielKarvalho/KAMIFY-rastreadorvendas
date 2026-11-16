"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Lancado = { data: string; valor: number; meta: number };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

/** Lançar o gasto do dia manualmente (substitui o da Meta naquele dia). */
export default function GastoManual({ de, ate, hoje, lancados }: { de: string; ate: string; hoje: string; lancados: Lancado[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const padrao = hoje >= de && hoje <= ate ? hoje : ate;
  const [data, setData] = useState(padrao);
  const atual = lancados.find((l) => l.data === data);
  const [texto, setTexto] = useState(atual ? (atual.valor / 100).toFixed(2).replace(".", ",") : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const valor = Math.round(Number(texto.replace(/\./g, "").replace(",", ".")) * 100);
  const valido = texto.trim() !== "" && Number.isFinite(valor) && valor >= 0;

  const escolherData = (d: string) => {
    setData(d);
    const l = lancados.find((x) => x.data === d);
    setTexto(l ? (l.valor / 100).toFixed(2).replace(".", ",") : "");
  };

  const salvar = async () => {
    if (!valido) return;
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch("/api/gasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, valor }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || "falhou");
      setAberto(false);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (d: string) => {
    await fetch(`/api/gasto?data=${d}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="gasto-manual">
      {lancados.length > 0 && (
        <span className="cx">
          {lancados.length === 1 ? "1 dia lançado manualmente" : `${lancados.length} dias lançados manualmente`}
        </span>
      )}
      {!aberto ? (
        <button type="button" className="gm-abrir" onClick={() => setAberto(true)}>✎ Lançar gasto</button>
      ) : (
        <div className="gm-form">
          <label>
            Dia
            <input type="date" value={data} max={hoje} onChange={(e) => escolherData(e.target.value)} />
          </label>
          <label>
            Gasto (R$)
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={texto}
              autoFocus
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
            />
          </label>
          <span className="gm-acoes">
            <button type="button" className="sim" disabled={!valido || salvando} onClick={salvar}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setAberto(false)}>Cancelar</button>
          </span>
          {erro && <span className="ctrl-erro">{erro}</span>}
          <small>Use o valor "Valor usado" do Gerenciador de Anúncios para esse dia. Ele substitui o gasto da Meta só nesse dia.</small>
          {lancados.length > 0 && (
            <ul className="gm-lista">
              {lancados.map((l) => (
                <li key={l.data}>
                  <span>{dataBR(l.data)}</span>
                  <b>{brl(l.valor)}</b>
                  {l.meta > 0 && <small>Meta: {brl(l.meta)}</small>}
                  <button type="button" onClick={() => remover(l.data)} title="Remover e voltar a usar o gasto da Meta">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
