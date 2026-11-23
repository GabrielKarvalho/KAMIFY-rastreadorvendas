"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function enviar(body: object) {
  const r = await fetch("/api/meta/acao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({ ok: false, erro: "erro de rede" }));
  if (!j.ok) throw new Error(j.erro || "falhou");
}

/** Liga/desliga campanha, conjunto ou anúncio. */
export function ChaveStatus({ id, ativo, nome }: { id: string; ativo: boolean; nome: string }) {
  const router = useRouter();
  const [on, setOn] = useState(ativo);
  const [carregando, setCarregando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState("");

  const aplicar = async () => {
    setConfirmar(false);
    setCarregando(true);
    setErro("");
    try {
      await enviar({ id, acao: "status", valor: on ? "PAUSED" : "ACTIVE" });
      setOn(!on);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <span className="ctrl">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${on ? "Pausar" : "Ativar"} ${nome}`}
        className={`chave${on ? " on" : ""}${carregando ? " carregando" : ""}`}
        disabled={carregando}
        onClick={() => setConfirmar(true)}
      >
        <i />
      </button>
      {confirmar && (
        <span className="confirma">
          {on ? "Pausar?" : "Ativar?"}
          <button type="button" className="sim" onClick={aplicar}>Sim</button>
          <button type="button" onClick={() => setConfirmar(false)}>Não</button>
        </span>
      )}
      {erro && <span className="ctrl-erro" title={erro}>{erro}</span>}
    </span>
  );
}

/** Mostra e edita o orçamento (diário ou total). */
export function EditaOrcamento({ id, valor, tipo }: { id: string; valor: number; tipo: string | null }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [atual, setAtual] = useState(valor);
  const [texto, setTexto] = useState((valor / 100).toFixed(2).replace(".", ","));
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const novo = Math.round(Number(texto.replace(/\./g, "").replace(",", ".")) * 100);
  const valido = Number.isFinite(novo) && novo >= 100;
  const delta = valido && atual ? ((novo - atual) / atual) * 100 : 0;

  const salvar = async () => {
    if (!valido) return;
    setCarregando(true);
    setErro("");
    try {
      await enviar({ id, acao: "orcamento", valor: novo });
      setAtual(novo);
      setEditando(false);
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };
  const ajusta = (pct: number) => setTexto(((atual * (1 + pct / 100)) / 100).toFixed(2).replace(".", ","));

  if (!editando) {
    return (
      <button type="button" className="orc" onClick={() => setEditando(true)} title="Editar orçamento">
        {brl(atual)}
        <small>{tipo === "total" ? "total" : "/dia"} ✎</small>
      </button>
    );
  }
  return (
    <span className="orc-edit">
      <span className="orc-linha">
        R$
        <input
          inputMode="decimal"
          value={texto}
          autoFocus
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") salvar();
            if (e.key === "Escape") setEditando(false);
          }}
        />
      </span>
      <span className="orc-rapido">
        {[20, 30, 50, 100].map((p) => (
          <button type="button" key={p} onClick={() => ajusta(p)}>{p > 0 ? "+" : ""}{p}%</button>
        ))}
      </span>
      {valido && novo !== atual && (
        <small className={delta > 0 ? "verde" : "vermelho"}>
          {brl(atual)} → {brl(novo)} ({delta > 0 ? "+" : ""}{delta.toFixed(0)}%)
        </small>
      )}
      <span className="orc-acoes">
        <button type="button" className="sim" disabled={!valido || carregando || novo === atual} onClick={salvar}>
          {carregando ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={() => { setEditando(false); setErro(""); }}>Cancelar</button>
      </span>
      {erro && <span className="ctrl-erro">{erro}</span>}
    </span>
  );
}
