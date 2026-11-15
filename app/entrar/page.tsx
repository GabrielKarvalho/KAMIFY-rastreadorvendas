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
          <svg viewBox="0 0 24 24" width="28" height="28"><path d="M6 3h4v12h8v4H6z" fill="var(--blue)" /><path d="M14 3h4v8h-4z" fill="var(--blue-2)" /></svg>
          <span>kami<b>fy</b></span>
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
