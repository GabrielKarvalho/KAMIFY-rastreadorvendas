import Link from "next/link";

export default function SubAbasVendas({ atual, prontos, qs }: { atual: "vendas" | "recuperacao"; prontos: number; qs: string }) {
  return (
    <div className="sub-abas">
      <Link href={`/painel/vendas${qs}`} className={atual === "vendas" ? "on" : ""}>Lista de vendas</Link>
      <Link href={`/painel/vendas/recuperacao${qs}`} className={atual === "recuperacao" ? "on" : ""}>
        💬 Recuperação de PIX {prontos > 0 && <span className="bolinha">{prontos}</span>}
      </Link>
    </div>
  );
}
