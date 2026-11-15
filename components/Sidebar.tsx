"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import TemaToggle from "@/components/TemaToggle";

const ICONES: Record<string, React.ReactNode> = {
  painel: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  campanhas: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zm13-3a5 5 0 0 1 0 8m2.5-10.5a8.5 8.5 0 0 1 0 13" />,
  vendas: <><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.3 0-2.4-.5-3-1.4M12 6v2m0 8v2" /></>,
  utm: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  importar: <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
};

const ITENS = [
  { href: "/painel", rotulo: "Painel", icone: "painel" },
  { href: "/painel/campanhas", rotulo: "Campanhas", icone: "campanhas" },
  { href: "/painel/vendas", rotulo: "Vendas", icone: "vendas" },
  { href: "/painel/importar", rotulo: "Importar", icone: "importar" },
  { href: "/painel/utm", rotulo: "Parâmetros UTM", icone: "utm", curto: "UTM" },
];

export default function Sidebar() {
  const path = usePathname();
  const sp = useSearchParams();
  const manter = new URLSearchParams();
  for (const k of ["periodo", "de", "ate", "produto", "conta"]) {
    const v = sp.get(k);
    if (v) manter.set(k, v);
  }
  const qs = manter.toString();

  const icone = (k: string) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONES[k]}
    </svg>
  );
  return (
    <>
    <nav className="bottom-nav" aria-label="Navegação">
      {ITENS.map((it) => {
        const ativo = it.href === "/painel" ? path === "/painel" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={qs ? `${it.href}?${qs}` : it.href} className={ativo ? "on" : ""}>
            {icone(it.icone)}
            <span>{(it as any).curto || it.rotulo}</span>
          </Link>
        );
      })}
    </nav>
    <aside className="side">
      <div className="logo">
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4f86ff" /><stop offset="1" stopColor="#1f4fe0" /></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#kg)" /><path d="M11 8v16" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" /><path d="M21.5 8.5 13.2 16.4l8.8 7.6" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
        <span>KAMI<b>FY</b></span>
      </div>
      <nav>
        {ITENS.map((it) => {
          const ativo = it.href === "/painel" ? path === "/painel" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={qs ? `${it.href}?${qs}` : it.href} className={ativo ? "on" : ""}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {ICONES[it.icone]}
              </svg>
              {it.rotulo}
            </Link>
          );
        })}
      </nav>
      <form action="/api/logout" method="post" className="sair">
        <TemaToggle comTexto />
        <button>Sair</button>
      </form>
    </aside>
    </>
  );
}
