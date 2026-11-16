import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { estaLogado } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await estaLogado()) redirect("/painel");
  const { erro } = await searchParams;
  return (
    <main className="login">
      <form action="/api/login" method="post">
        <div className="logo">
          <Logo tamanho={34} />
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
