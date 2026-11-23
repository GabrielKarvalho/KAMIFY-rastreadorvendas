import { redirect } from "next/navigation";
import { sql, garantirSchema } from "@/lib/db";
import { estaLogado } from "@/lib/auth";
import SubAbasVendas from "@/components/SubAbasVendas";
import { AcoesRecuperacao, AtivarNotificacoes, AutoAtualizar, EditarModelo, EscolherTempo, Restaurar } from "@/components/Recuperacao";
import {
  HORAS_PIX_VALIDO, MINUTOS_MAX, MINUTOS_MIN, MODELOS_PADRAO, OPCOES_MINUTOS, SQL_CONTATADOS, SQL_PENDENTES,
  lerMinutos, lerModelos, montarMensagem, telefoneWa, tempoTxt,
} from "@/lib/recuperacao";
import { brl, linkCom, num, TZ, type SP } from "@/lib/filtros";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const nomeUtm = (v: string | null) => (v ? v.replace(/\|\d+$/, "") : "");
function tempo(min: number) {
  if (min < 60) return `${Math.floor(min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${String(Math.floor(min % 60)).padStart(2, "0")}`;
  const d = Math.floor(h / 24);
  return `${d} dia${d > 1 ? "s" : ""}`;
}
const hora = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function Recuperacao({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await estaLogado())) redirect("/entrar");
  await garantirSchema();
  const sp = await searchParams;
  const qs = linkCom("", sp);

  const [pendentes, contatados, modelos, espera] = await Promise.all([
    sql.query(`${SQL_PENDENTES} ORDER BY v.criado_em DESC`) as Promise<any[]>,
    sql.query(SQL_CONTATADOS) as Promise<any[]>,
    lerModelos(),
    lerMinutos(),
  ]);
  const esperaTxt = tempoTxt(espera);

  const livres = pendentes.filter((p) => !p.rec_contatado_em && !p.rec_descartado_em);
  const prontos = livres.filter((p) => num(p.idade_min) >= espera && num(p.idade_min) < 48 * 60);
  const aguardando = livres.filter((p) => num(p.idade_min) < espera);
  const antigos = livres.filter((p) => num(p.idade_min) >= 48 * 60);
  const descartados = pendentes.filter((p) => p.rec_descartado_em);

  const recuperados = contatados.filter((c) => c.valor_pago != null);
  const fatRec = recuperados.reduce((a, c) => a + num(c.valor_pago), 0);
  const taxa = contatados.length ? (recuperados.length / contatados.length) * 100 : 0;

  const cartao = (p: any, destaque = false) => {
    const idade = num(p.idade_min);
    const msg = montarMensagem(modelos, { ...p, idade_min: idade });
    const pixValido = !!p.pix_code && idade < HORAS_PIX_VALIDO * 60;
    const bumps = Array.isArray(p.orderbumps) ? p.orderbumps : [];
    return (
      <div key={p.id} className={`rec-card${destaque ? " pronto" : ""}`}>
        <div className="rec-top">
          <div>
            <div className="rec-nome">{p.cliente_nome || "Sem nome"}</div>
            <small className="muted">{p.cliente_telefone || "sem telefone"}{p.cliente_email ? ` · ${p.cliente_email}` : ""}</small>
          </div>
          <div className="rec-valor">
            <b>{brl(p.valor)}</b>
            <small className={idade >= espera ? "amarelo" : "muted"}>há {tempo(idade)}</small>
          </div>
        </div>
        <div className="rec-info">
          <span>{p.checkout_titulo || "—"}{bumps.length > 0 && ` + ${bumps.map((b: any) => b.title).join(", ")}`}</span>
          {p.utm_campaign && <span className="muted">📣 {nomeUtm(p.utm_campaign)}</span>}
          <span className={`tag ${pixValido ? "ok" : "muted"}`}>{pixValido ? "PIX na mensagem" : "PIX provavelmente expirado: vai o link do checkout"}</span>
        </div>
        <details className="rec-previa">
          <summary>{pixValido ? "Ver mensagens" : "Ver mensagem"}</summary>
          <pre>{msg}</pre>
          {pixValido && <pre className="rec-pre-pix">{p.pix_code}</pre>}
        </details>
        <AcoesRecuperacao id={p.id} wa={telefoneWa(p.cliente_telefone)} email={p.cliente_email} mensagem={msg} pix={pixValido ? p.pix_code : null} />
      </div>
    );
  };

  return (
    <>
      <AutoAtualizar />
      <header className="topbar"><h1>Vendas</h1></header>
      <SubAbasVendas atual="recuperacao" prontos={prontos.length} qs={qs} />

      <EscolherTempo atual={espera} opcoes={OPCOES_MINUTOS} min={MINUTOS_MIN} max={MINUTOS_MAX} />
      <AtivarNotificacoes esperaTxt={esperaTxt} />

      <div className="grade g4 rec-kpis">
        <div className="card"><span className="ct">Prontos para chamar</span><strong className={prontos.length ? "amarelo" : ""}>{prontos.length}</strong><span className="cx">PIX com mais de {esperaTxt} sem pagar</span></div>
        <div className="card"><span className="ct">Chamados <small>(30 dias)</small></span><strong>{contatados.length}</strong><span className="cx">{aguardando.length} aguardando completar {esperaTxt}</span></div>
        <div className="card"><span className="ct">Recuperados <small>(30 dias)</small></span><strong className="verde">{recuperados.length}</strong><span className="cx">{contatados.length ? `${taxa.toFixed(0)}% dos chamados pagaram` : "—"}</span></div>
        <div className="card"><span className="ct">Faturamento recuperado</span><strong className="verde">{brl(fatRec)}</strong><span className="cx">pago depois do seu contato</span></div>
      </div>

      <section className="rec-secao">
        <h2>💬 Prontos para chamar <span className="cont">{prontos.length}</span></h2>
        {prontos.length === 0 ? (
          <p className="vazio box">Nenhum PIX esperando contato agora. Quando um PIX completar {esperaTxt} sem pagamento, ele aparece aqui{" "}
            e você recebe uma notificação.</p>
        ) : (
          <div className="rec-lista">{prontos.map((p) => cartao(p, true))}</div>
        )}
      </section>

      {aguardando.length > 0 && (
        <section className="rec-secao">
          <h2>⏳ Aguardando completar {esperaTxt} <span className="cont">{aguardando.length}</span></h2>
          <div className="box sem-pad">
            <table className="rec-tabela">
              <tbody>
                {aguardando.map((p) => (
                  <tr key={p.id}>
                    <td className="nome l">{p.cliente_nome || "Sem nome"}<small>{p.cliente_telefone}</small></td>
                    <td><b>{brl(p.valor)}</b></td>
                    <td className="muted">gerado {hora(p.criado_em)}</td>
                    <td><span className="tag wait">chamar em {Math.max(1, Math.ceil(espera - num(p.idade_min)))} min</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota">A Wiapy já manda a mensagem automática dela aos 10 minutos. Se a pessoa pagar antes de {esperaTxt}, ela some daqui sozinha.</p>
        </section>
      )}

      {contatados.length > 0 && (
        <section className="rec-secao">
          <h2>✅ Já chamados <small className="muted">(últimos 30 dias)</small></h2>
          <div className="box sem-pad">
            <div className="scroll">
              <table className="rec-tabela">
                <thead><tr><th className="l">Cliente</th><th>Valor</th><th>Chamado em</th><th>Resultado</th><th></th></tr></thead>
                <tbody>
                  {contatados.map((c) => {
                    const pend = pendentes.find((p) => p.id === c.id);
                    return (
                      <tr key={c.id}>
                        <td className="nome l">{c.cliente_nome || "Sem nome"}<small>{c.cliente_telefone}</small></td>
                        <td>{brl(c.valor)}</td>
                        <td className="muted">{hora(c.rec_contatado_em)}</td>
                        <td>{c.valor_pago != null ? <span className="tag ok">Pagou {brl(c.valor_pago)}</span> : pend ? <span className="tag wait">Aguardando</span> : <span className="tag muted">Sem pagamento</span>}</td>
                        <td>{pend && c.valor_pago == null && (
                          <AcoesRecuperacao id={c.id} contatado wa={telefoneWa(c.cliente_telefone)} email={c.cliente_email}
                            mensagem={montarMensagem(modelos, { ...pend, idade_min: num(pend.idade_min) })}
                            pix={pend.pix_code && num(pend.idade_min) < HORAS_PIX_VALIDO * 60 ? pend.pix_code : null} />
                        )}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {antigos.length > 0 && (
        <details className="rec-secao rec-dobra">
          <summary>Mais antigos que 48h sem contato <span className="cont">{antigos.length}</span></summary>
          <div className="rec-lista">{antigos.map((p) => cartao(p))}</div>
        </details>
      )}

      {descartados.length > 0 && (
        <details className="rec-secao rec-dobra">
          <summary>Descartados <span className="cont">{descartados.length}</span></summary>
          <div className="box sem-pad">
            <table className="rec-tabela"><tbody>
              {descartados.map((p) => (
                <tr key={p.id}>
                  <td className="nome l">{p.cliente_nome || "Sem nome"}<small>{p.cliente_telefone}</small></td>
                  <td>{brl(p.valor)}</td>
                  <td className="muted">{hora(p.criado_em)}</td>
                  <td><Restaurar id={p.id} /></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </details>
      )}

      <details className="rec-secao rec-dobra">
        <summary>✏️ Editar mensagens</summary>
        <div className="box">
          <p className="texto">Use <code>{"{nome}"}</code> (primeiro nome), <code>{"{valor}"}</code>, <code>{"{produto}"}</code>, e <code>{"{link}"}</code> (link do checkout). O código PIX não vai no texto: ele é enviado sozinho numa segunda mensagem, para a pessoa copiar com um toque. Asteriscos deixam o texto em <b>*negrito*</b> no WhatsApp.</p>
          <EditarModelo chave="modelo_pix" titulo="Mensagem com o PIX" dica={`usada até ${HORAS_PIX_VALIDO}h depois do PIX gerado`} valor={modelos.modelo_pix} padrao={MODELOS_PADRAO.modelo_pix} />
          <EditarModelo chave="modelo_expirado" titulo="Mensagem com link do checkout" dica="usada quando o PIX já deve ter expirado" valor={modelos.modelo_expirado} padrao={MODELOS_PADRAO.modelo_expirado} />
        </div>
      </details>

      <p className="nota">
        Somem da lista automaticamente: quem pagou (mesmo e-mail ou telefone) e quem gerou um PIX mais novo, que aparece no lugar do antigo.
        Ao tocar em <b>Chamar no WhatsApp</b>, o PIX vai para &quot;Já chamados&quot;, e se a pessoa pagar depois, entra em Recuperados.
      </p>
    </>
  );
}
