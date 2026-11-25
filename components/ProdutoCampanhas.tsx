"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Camp = { id: string; nome: string; gasto: string; produto: string | null; manual: boolean };

/** Lista as campanhas do período com o produto ligado a cada uma; permite corrigir manualmente. */
export default function ProdutoCampanhas({
  campanhas, produtos, semProduto, aberto,
}: { campanhas: Camp[]; produtos: { id: string; titulo: string }[]; semProduto: number; aberto: boolean }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState<string | null>(null);
  const nomeProd = (id: string | null) => (id === null ? "" : id === "" ? "Nenhum produto" : produtos.find((p) => p.id === id)?.titulo || id);

  const salvar = async (cid: string, valor: string) => {
    setSalvando(cid);
    const produto = valor === "__auto" ? null : valor === "__nenhum" ? "" : valor;
    await fetch("/api/campanha-produto", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign_id: cid, produto }),
    }).catch(() => {});
    setSalvando(null);
    router.refresh();
  };

  return (
    <details className="rec-dobra prod-camp" open={aberto}>
      <summary>
        🏷️ Produto de cada campanha
        {semProduto > 0 && <span className="bolinha">{semProduto} sem produto</span>}
      </summary>
      <div className="box">
        <p className="texto">
          Usado quando você filtra por produto no topo: só o gasto das campanhas ligadas àquele produto entra na conta.
          A ligação é automática pelas vendas e PIX que cada campanha trouxe (UTM). Campanhas sem nenhum pedido ficam
          &quot;sem produto&quot;. Escolha o produto delas aqui.
        </p>
        {campanhas.length === 0 ? (
          <p className="vazio">Nenhuma campanha com gasto no período.</p>
        ) : (
          <div className="scroll">
            <table className="rec-tabela prod-camp-tab">
              <thead><tr><th className="l">Campanha</th><th>Gasto no período</th><th className="l">Produto</th></tr></thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.id} className={c.produto === null ? "sem" : ""}>
                    <td className="nome l">{c.nome}</td>
                    <td>{c.gasto}</td>
                    <td className="l">
                      <select
                        disabled={salvando === c.id}
                        value={c.manual ? (c.produto === "" ? "__nenhum" : c.produto || "__auto") : "__auto"}
                        onChange={(e) => salvar(c.id, e.target.value)}
                      >
                        <option value="__auto">
                          {c.manual ? "Automático" : c.produto !== null ? `Automático: ${nomeProd(c.produto)}` : "⚠️ Sem produto (automático)"}
                        </option>
                        {produtos.map((p) => <option key={p.id} value={p.id}>{p.titulo || p.id}</option>)}
                        <option value="__nenhum">Nenhum produto (não contar)</option>
                      </select>
                      {c.manual && <small className="muted"> manual</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
