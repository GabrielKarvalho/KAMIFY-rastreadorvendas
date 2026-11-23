"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

async function acao(id: string, a: "contatado" | "descartar" | "restaurar") {
  await fetch("/api/recuperacao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, acao: a }),
    keepalive: true,
  }).catch(() => {});
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Botões de um PIX pendente: abrir WhatsApp com a mensagem pronta, copiar, descartar. */
export function AcoesRecuperacao({
  id, wa, email, mensagem, pix, contatado,
}: { id: string; wa: string | null; email: string | null; mensagem: string; pix: string | null; contatado?: boolean }) {
  const router = useRouter();
  const [aviso, setAviso] = useState("");
  const [feito, setFeito] = useState(!!contatado);

  const avisar = (t: string) => {
    setAviso(t);
    setTimeout(() => setAviso(""), 1800);
  };
  const marcar = () => {
    if (feito) return;
    setFeito(true);
    acao(id, "contatado").then(() => setTimeout(() => router.refresh(), 1500));
  };
  const linkWa = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(mensagem)}` : null;
  const linkEmail = email
    ? `mailto:${email}?subject=${encodeURIComponent("Seu PIX da Formação Técnico em iPhone")}&body=${encodeURIComponent(mensagem)}`
    : null;

  return (
    <div className="rec-acoes">
      {linkWa ? (
        <a className="rec-wa" href={linkWa} target="_blank" rel="noopener noreferrer" onClick={marcar}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z" /></svg>
          {feito ? "Abrir conversa de novo" : "Chamar no WhatsApp"}
        </a>
      ) : linkEmail ? (
        <a className="rec-wa email" href={linkEmail} onClick={marcar}>✉️ Mandar por e-mail</a>
      ) : (
        <span className="muted">sem telefone ou e-mail</span>
      )}
      <div className="rec-sec">
        <button type="button" onClick={async () => avisar((await copiar(mensagem)) ? "Mensagem copiada" : "Não deu para copiar")}>Copiar mensagem</button>
        {pix && <button type="button" onClick={async () => avisar((await copiar(pix)) ? "PIX copiado" : "Não deu para copiar")}>Copiar PIX</button>}
        {!feito && linkWa && linkEmail && <a href={linkEmail} onClick={marcar}>E-mail</a>}
        {feito ? (
          !contatado ? null : <button type="button" onClick={() => acao(id, "restaurar").then(() => router.refresh())}>Desfazer</button>
        ) : (
          <button type="button" className="perigo" onClick={() => acao(id, "descartar").then(() => router.refresh())}>Descartar</button>
        )}
      </div>
      {aviso && <span className="rec-aviso">{aviso}</span>}
    </div>
  );
}

export function Restaurar({ id }: { id: string }) {
  const router = useRouter();
  return <button type="button" className="link-btn azul" onClick={() => acao(id, "restaurar").then(() => router.refresh())}>Restaurar</button>;
}

/** Atualiza a página a cada minuto (contagem regressiva e novos PIX). */
export function AutoAtualizar({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), segundos * 1000);
    const vis = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [router, segundos]);
  return null;
}

/** Edita os textos das mensagens. */
export function EditarModelo({ chave, titulo, valor, padrao, dica }: { chave: string; titulo: string; valor: string; padrao: string; dica: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState(valor);
  const [estado, setEstado] = useState("");
  const salvar = async (v: string) => {
    setEstado("Salvando…");
    const r = await fetch("/api/recuperacao/modelo", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chave, valor: v }),
    }).then((r) => r.json()).catch(() => ({ ok: false }));
    setEstado(r.ok ? "Salvo ✓" : "Erro ao salvar");
    if (r.ok) router.refresh();
    setTimeout(() => setEstado(""), 2000);
  };
  return (
    <div className="rec-modelo">
      <div className="rec-modelo-top"><b>{titulo}</b><small>{dica}</small></div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={9} />
      <div className="rec-modelo-acoes">
        <button type="button" className="primario" disabled={texto === valor} onClick={() => salvar(texto)}>Salvar</button>
        {valor !== padrao && <button type="button" className="link-btn azul" onClick={() => { setTexto(padrao); salvar(""); }}>Voltar ao texto padrão</button>}
        <span className="muted">{estado}</span>
      </div>
    </div>
  );
}

const b64 = (s: string) => {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** Liga as notificações deste aparelho. */
export function AtivarNotificacoes() {
  const [estado, setEstado] = useState<"carregando" | "sem-suporte" | "ios-instalar" | "bloqueado" | "desligado" | "ligado" | "sem-config">("carregando");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const instalado = matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setEstado(ios && !instalado ? "ios-instalar" : "sem-suporte");
      }
      const cfg = await fetch("/api/push").then((r) => r.json()).catch(() => ({}));
      if (!cfg.ok) return setEstado("sem-config");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub && Notification.permission === "granted" ? "ligado" : "desligado");
      if (sub) fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inscricao: sub.toJSON() }) });
    })().catch(() => setEstado("sem-suporte"));
  }, []);

  const ligar = async () => {
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setEstado(perm === "denied" ? "bloqueado" : "desligado");
      const cfg = await fetch("/api/push").then((r) => r.json());
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.chave) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inscricao: sub.toJSON() }) }).then((r) => r.json());
      if (!r.ok) throw new Error(r.erro || "falhou");
      setEstado("ligado");
      testar();
    } catch (e: any) {
      setMsg("Não foi possível ativar: " + (e?.message || e));
    }
  };
  const testar = async () => {
    setMsg("Enviando teste…");
    const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teste: true }) }).then((r) => r.json()).catch(() => ({}));
    setMsg(r.ok ? `Teste enviado para ${r.enviados} aparelho(s).` : "O teste não foi entregue.");
  };

  const textos: Record<string, React.ReactNode> = {
    carregando: "Verificando notificações…",
    "sem-suporte": "Este navegador não recebe notificações. No iPhone, abra o KAMIFY pelo ícone da tela de início.",
    "ios-instalar": <>Para receber o aviso no iPhone, abra este site no Safari, toque em <b>Compartilhar → Adicionar à Tela de Início</b> e abra o KAMIFY pelo ícone. Depois volte aqui e ative.</>,
    bloqueado: "As notificações estão bloqueadas. Libere em Ajustes → Notificações → KAMIFY e recarregue a página.",
    "sem-config": "As notificações ainda não foram configuradas no servidor.",
    desligado: "Receba um aviso no celular quando um PIX completar 1h sem pagamento.",
    ligado: "Notificações ativas neste aparelho ✓",
  };
  return (
    <div className={`rec-notif ${estado}`}>
      <span className="rec-notif-ic">🔔</span>
      <span className="rec-notif-txt">{textos[estado]}{msg && <small>{msg}</small>}</span>
      {estado === "desligado" && <button type="button" className="primario" onClick={ligar}>Ativar notificações</button>}
      {estado === "ligado" && <button type="button" className="link-btn azul" onClick={testar}>Enviar teste</button>}
    </div>
  );
}

/** Aviso flutuante em qualquer tela do painel quando há PIX prontos para chamar. */
export function AvisoRecuperacao() {
  const [n, setN] = useState(0);
  const [path, setPath] = useState("");
  useEffect(() => {
    let vivo = true;
    const checar = async () => {
      setPath(location.pathname);
      if (document.visibilityState !== "visible") return;
      const r = await fetch("/api/recuperacao").then((r) => r.json()).catch(() => null);
      if (!vivo || !r?.ok) return;
      setN(r.prontos);
      const nav: any = navigator;
      if (nav.setAppBadge) (r.prontos ? nav.setAppBadge(r.prontos) : nav.clearAppBadge?.())?.catch?.(() => {});
    };
    checar();
    const t = setInterval(checar, 60_000);
    document.addEventListener("visibilitychange", checar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", checar); };
  }, []);
  useEffect(() => {
    const f = () => setPath(location.pathname);
    window.addEventListener("popstate", f);
    const t = setInterval(f, 1000);
    return () => { window.removeEventListener("popstate", f); clearInterval(t); };
  }, []);
  if (!n || path.startsWith("/painel/vendas/recuperacao")) return null;
  return (
    <a className="rec-flutuante" href="/painel/vendas/recuperacao">
      💬 <b>{n}</b> {n === 1 ? "PIX para chamar" : "PIX para chamar"} →
    </a>
  );
}
