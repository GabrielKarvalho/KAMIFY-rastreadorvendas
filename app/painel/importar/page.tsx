import { redirect } from "next/navigation";
import { estaLogado } from "@/lib/auth";
import TemaToggle from "@/components/TemaToggle";
import Importador from "@/components/Importador";

export const dynamic = "force-dynamic";

export default async function Importar() {
  if (!(await estaLogado())) redirect("/entrar");
  return (
    <>
      <header className="topbar"><h1>Importar vendas</h1><TemaToggle mobile /></header>
      <Importador />
    </>
  );
}
