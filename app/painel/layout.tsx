import { Suspense } from "react";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { estaLogado } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  if (!(await estaLogado())) redirect("/entrar");
  return (
    <div className="app">
      <Suspense fallback={<aside className="side" />}>
        <Sidebar />
      </Suspense>
      <main className="conteudo">{children}</main>
    </div>
  );
}
