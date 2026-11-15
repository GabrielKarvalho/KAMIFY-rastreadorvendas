"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ICONES: Record<string, React.ReactNode> = {
  painel: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  campanhas: <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zm13-3a5 5 0 0 1 0 8m2.5-10.5a8.5 8.5 0 0 1 0 13" />,
  vendas: <><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.3 0-2.4-.5-3-1.4M12 6v2m0 8v2" /></>,
  utm: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
};

const ITENS = [
  { href: "/painel", rotulo: "Painel", icone: "painel" },
  { href: "/painel/campanhas", rotulo: "Campanhas", icone: "campanhas" },
  { href: "/painel/vendas", rotulo: "Vendas", icone: "vendas" },
  { href: "/painel/utm", rotulo: "Parâmetros UTM", icone: "utm" },
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

  return (
    <aside className="side">
      <div className="logo">
        <svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 3h4v12h8v4H6z" fill="var(--blue)" /><path d="M14 3h4v8h-4z" fill="var(--blue-2)" /></svg>
        <span>kami<b>fy</b></span>
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
        <button>Sair</button>
      </form>
    </aside>
  );
}
