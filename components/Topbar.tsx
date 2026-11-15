"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import TemaToggle from "@/components/TemaToggle";

type Props = {
  titulo: string;
  produtos: { id: string; titulo: string }[];
  contas: { id: string; nome: string }[];
  exportar?: boolean;
};

const PERIODOS = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["7d", "7 dias"],
  ["15d", "15 dias"],
  ["30d", "30 dias"],
];

export default function Topbar({ titulo, produtos, contas, exportar = true }: Props) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [abrir, setAbrir] = useState(false);

  const montar = (mudar: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    q.delete("sync");
    q.delete("pagina");
    for (const [k, v] of Object.entries(mudar)) v ? q.set(k, v) : q.delete(k);
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  const ir = (mudar: Record<string, string | null>) => iniciar(() => router.push(montar(mudar)));

  const atual = sp.get("de") ? "custom" : sp.get("periodo") || "hoje";
  const exportQs = new URLSearchParams(sp.toString());
  exportQs.delete("sync");

  return (
    <header className={`topbar${pendente ? " carregando" : ""}`}>
      <h1>{titulo}</h1>
      <TemaToggle mobile />
      <div className="chips">
        {PERIODOS.map(([k, r]) => (
          <button key={k} className={`chip${atual === k ? " on" : ""}`} onClick={() => ir({ periodo: k === "hoje" ? null : k, de: null, ate: null })}>
            {r}
          </button>
        ))}
        <div className="pop">
          <button className={`chip${atual === "custom" ? " on" : ""}`} onClick={() => setAbrir(!abrir)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
            Personalizado
          </button>
          {abrir && (
            <form
              className="popbox"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setAbrir(false);
                ir({ de: String(f.get("de") || "") || null, ate: String(f.get("ate") || "") || null, periodo: null });
              }}
            >
              <label>De<input type="date" name="de" defaultValue={sp.get("de") || ""} required /></label>
              <label>Até<input type="date" name="ate" defaultValue={sp.get("ate") || ""} required /></label>
              <button className="primario">Aplicar</button>
            </form>
          )}
        </div>
      </div>

      <div className="acoes">
        <select value={sp.get("produto") || ""} onChange={(e) => ir({ produto: e.target.value || null })}>
          <option value="">Produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.titulo || p.id}</option>)}
        </select>
        {contas.length > 0 && (
          <select value={sp.get("conta") || ""} onChange={(e) => ir({ conta: e.target.value || null })}>
            <option value="">Contas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <button className="chip" onClick={() => iniciar(() => { router.push(montar({ sync: "1" })); router.refresh(); })}>
          <svg className={pendente ? "gira" : ""} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></svg>
          Atualizar
        </button>
        {exportar && (
          <Link className="chip" href={`/api/exportar?${exportQs.toString()}`} prefetch={false}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M4 19h16" /></svg>
            Exportar
          </Link>
        )}
      </div>
    </header>
  );
}
