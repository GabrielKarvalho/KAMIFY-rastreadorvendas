const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

/** Aviso quando a leitura da Meta Ads falha. Vendas continuam em tempo real. */
export default function AvisoMeta({ erro, ultima }: { erro: string | null; ultima: string | null }) {
  if (!erro) return null;
  const bloqueado = /blocked|bloque/i.test(erro);
  const semPermissao = /permission|ads_read|ads_management/i.test(erro);
  const titulo = bloqueado
    ? "A Meta bloqueou o acesso do app Kamify"
    : semPermissao
      ? "O token da Meta está sem permissão"
      : "Não consegui atualizar a Meta Ads";
  const u = quando(ultima);
  return (
    <div className="aviso bad">
      <b>{titulo}.</b> Vendas da Wiapy continuam em tempo real; gasto, campanhas e funil mostram
      {u ? ` a última leitura (${u}).` : " dados antigos."} Nova tentativa automática a cada 30 min ou pelo botão Atualizar.
      <details>
        <summary>Detalhes</summary>
        <code>{erro}</code>
      </details>
    </div>
  );
}
