import { redirect } from "next/navigation";
import { estaLogado } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await estaLogado()) redirect("/painel");
  const { erro } = await searchParams;
  return (
    <main className="login">
      <form action="/api/login" method="post">
        <div className="logo">
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4f86ff" /><stop offset="1" stopColor="#1f4fe0" /></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#kg)" /><path d="M11 8v16" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" /><path d="M21.5 8.5 13.2 16.4l8.8 7.6" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          <span>KAMI<b>FY</b></span>
        </div>
        <p className="sub">Digite a senha para acessar o painel</p>
        <input type="password" name="senha" placeholder="Senha" autoFocus required />
        {erro && <p className="erro">Senha incorreta.</p>}
        {!process.env.PAINEL_SENHA && <p className="erro">Configure PAINEL_SENHA nas variáveis da Vercel.</p>}
        <button className="primario">Entrar</button>
      </form>
    </main>
  );
}
