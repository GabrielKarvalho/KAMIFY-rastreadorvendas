"use client";
import { useEffect, useState } from "react";

type Tema = "claro" | "escuro";

function aplicar(t: Tema) {
  document.documentElement.dataset.tema = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "escuro" ? "#0e1117" : "#2f6bff");
}

export default function TemaToggle({ mobile = false, comTexto = false }: { mobile?: boolean; comTexto?: boolean }) {
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    const atual = (document.documentElement.dataset.tema as Tema) || "claro";
    setTema(atual);
    aplicar(atual);
    // acompanha o sistema enquanto a pessoa não escolher manualmente
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mudou = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem("kamify-tema")) return;
      } catch {}
      const t: Tema = e.matches ? "escuro" : "claro";
      aplicar(t);
      setTema(t);
    };
    mq.addEventListener?.("change", mudou);
    return () => mq.removeEventListener?.("change", mudou);
  }, []);

  const alternar = () => {
    const novo: Tema = tema === "escuro" ? "claro" : "escuro";
    aplicar(novo);
    setTema(novo);
    try {
      localStorage.setItem("kamify-tema", novo);
    } catch {}
  };

  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      className={`tema-btn${mobile ? " mobile" : ""}`}
      onClick={alternar}
      aria-label={escuro ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
    >
      {escuro ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      {comTexto && <span>{escuro ? "Modo claro" : "Modo escuro"}</span>}
    </button>
  );
}
