"use client";
import { useEffect, useMemo, useState } from "react";

type Campo = { k: string; t: string; dicas: string[]; obrig?: boolean };

const CAMPOS: Campo[] = [
  { k: "id", t: "ID / código do pagamento", dicas: ["codigo do pagamento", "id pagamento", "id do pagamento", "codigo", "id da venda", "transacao", "id"] },
  { k: "criado_em", t: "Data da venda", dicas: ["data da venda", "data de criacao", "data movimentacao", "data da compra", "criado", "data"], obrig: true },
  { k: "pago_em", t: "Data do pagamento", dicas: ["data do pagamento", "data de pagamento", "data pagamento", "pago em", "aprovado em", "data de aprovacao"] },
  { k: "status", t: "Status", dicas: ["status", "situacao"], obrig: true },
  { k: "metodo", t: "Forma de pagamento", dicas: ["forma de pagamento", "metodo", "forma", "pagamento", "meio"] },
  { k: "valor", t: "Valor bruto (cliente pagou)", dicas: ["valor bruto", "valor total", "valor pago", "total", "valor da venda", "preco", "valor"], obrig: true },
  { k: "liquido", t: "Valor líquido (você recebeu)", dicas: ["valor liquido", "liquido", "recebido", "comissao", "seu ganho"] },
  { k: "taxa", t: "Taxa", dicas: ["taxa", "tarifa", "fee"] },
  { k: "produto", t: "Produto", dicas: ["produto", "oferta", "checkout", "nome do produto"] },
  { k: "bumps", t: "Order bumps", dicas: ["order bump", "orderbump", "bumps", "adicionais"] },
  { k: "nome", t: "Nome do cliente", dicas: ["nome do cliente", "cliente", "pagante", "comprador", "nome"] },
  { k: "email", t: "E-mail", dicas: ["email", "e-mail"] },
  { k: "telefone", t: "Telefone", dicas: ["telefone", "celular", "whatsapp", "fone"] },
  { k: "documento", t: "CPF / documento", dicas: ["cpf", "documento", "cnpj"] },
  { k: "utm_source", t: "utm_source", dicas: ["utm source", "utm_source", "utm (source)", "source"] },
  { k: "utm_medium", t: "utm_medium (conjunto)", dicas: ["utm medium", "utm_medium", "utm (medio)", "medium", "medio"] },
  { k: "utm_campaign", t: "utm_campaign (campanha)", dicas: ["utm campaign", "utm_campaign", "utm (campanha)", "campaign", "campanha"] },
  { k: "utm_content", t: "utm_content (anúncio)", dicas: ["utm content", "utm_content", "utm (conteudo)", "content", "conteudo"] },
  { k: "utm_term", t: "utm_term (posicionamento)", dicas: ["utm term", "utm_term", "utm (termo)", "term", "termo"] },
  { k: "fbc", t: "FBC", dicas: ["fbc"] },
  { k: "fbp", t: "FBP", dicas: ["fbp"] },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

function adivinhar(cabecalhos: string[]) {
  const usados = new Set<string>();
  const mapa: Record<string, string> = {};
  // 1ª passada: igualdade; 2ª: contém
  for (const modo of ["igual", "contem"] as const) {
    for (const c of CAMPOS) {
      if (mapa[c.k]) continue;
      for (const d of c.dicas) {
        const dn = norm(d);
        const h = cabecalhos.find((h) => !usados.has(h) && (modo === "igual" ? norm(h) === dn : norm(h).includes(dn)));
        if (h) {
          mapa[c.k] = h;
          usados.add(h);
          break;
        }
      }
    }
  }
  return mapa;
}

type Lote = { lote: string; qtd: string; de: string; ate: string; importado_em: string };

export default function Importador() {
  const [arquivo, setArquivo] = useState("");
  const [linhas, setLinhas] = useState<Record<string, unknown>[]>([]);
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState("");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [apagar, setApagar] = useState("");

  const carregarLotes = () =>
    fetch("/api/importar").then((r) => r.json()).then((j) => j.ok && setLotes(j.lotes)).catch(() => {});
  useEffect(() => {
    carregarLotes();
  }, []);

  const ler = async (f: File) => {
    setErro("");
    setResultado(null);
    setLendo(true);
    setArquivo(f.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: false });
      // pega a aba com mais linhas
      let melhor: Record<string, unknown>[] = [];
      for (const nome of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nome], { defval: "", raw: false });
        if (rows.length > melhor.length) melhor = rows;
      }
      if (!melhor.length) throw new Error("Não encontrei linhas nessa planilha.");
      const cab = Object.keys(melhor[0]);
      setLinhas(melhor);
      setCabecalhos(cab);
      setMapa(adivinhar(cab));
    } catch (e: any) {
      setErro(e.message || String(e));
      setLinhas([]);
    } finally {
      setLendo(false);
    }
  };

  const convertidas = useMemo(
    () =>
      linhas.map((l) => {
        const o: Record<string, unknown> = {};
        for (const c of CAMPOS) if (mapa[c.k]) o[c.k] = l[mapa[c.k]];
        return o;
      }),
    [linhas, mapa],
  );
  const faltando = CAMPOS.filter((c) => c.obrig && !mapa[c.k] && !(c.k === "valor" && mapa.liquido));

  const importar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch("/api/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linhas: convertidas }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || "falhou");
      setResultado(j);
      setLinhas([]);
      carregarLotes();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const desfazer = async (lote: string) => {
    setApagar("");
    const r = await fetch(`/api/importar?lote=${encodeURIComponent(lote)}`, { method: "DELETE" });
    const j = await r.json();
    if (j.ok) carregarLotes();
  };

  return (
    <>
      <section className="box">
        <h2>1. Escolha a planilha</h2>
        <p className="texto">
          Na Wiapy, vá em <b>Vendas → Exportar para Excel</b>. O arquivo chega no seu e-mail. Escolha o período que quiser
          (por exemplo, 90 dias). Aceita .xlsx, .xls e .csv.
        </p>
        <label className="upload">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
          <span>{lendo ? "Lendo…" : arquivo ? `📄 ${arquivo} — trocar arquivo` : "📄 Escolher arquivo"}</span>
        </label>
        {erro && <p className="ctrl-erro grande">{erro}</p>}
        {resultado && (
          <div className="aviso ok">
            ✓ Importação concluída: <b>{resultado.inseridas}</b> vendas novas
            {resultado.ja_existiam > 0 && <> · {resultado.ja_existiam} já existiam (mantidas como estavam)</>}
            {resultado.sem_data > 0 && <> · {resultado.sem_data} linhas ignoradas sem data</>}.
          </div>
        )}
      </section>

      {linhas.length > 0 && (
        <>
          <section className="box">
            <h2>2. Confira as colunas ({linhas.length} linhas)</h2>
            <p className="texto">Reconheci as colunas automaticamente. Ajuste se algo estiver errado. Campos com * são obrigatórios.</p>
            <div className="mapa">
              {CAMPOS.map((c) => (
                <label key={c.k}>
                  <span>{c.t}{c.obrig ? " *" : ""}</span>
                  <select value={mapa[c.k] || ""} onChange={(e) => setMapa({ ...mapa, [c.k]: e.target.value })}>
                    <option value="">— não importar —</option>
                    {cabecalhos.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="box sem-pad">
            <div className="boxhead pad"><h2>3. Prévia (5 primeiras)</h2></div>
            <div className="scroll">
              <table>
                <thead>
                  <tr>{CAMPOS.filter((c) => mapa[c.k]).map((c) => <th key={c.k} className="l">{c.t}</th>)}</tr>
                </thead>
                <tbody>
                  {convertidas.slice(0, 5).map((l, i) => (
                    <tr key={i}>{CAMPOS.filter((c) => mapa[c.k]).map((c) => <td key={c.k} className="nome">{String(l[c.k] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="importar-acao">
            {faltando.length > 0 ? (
              <p className="ctrl-erro grande">Falta escolher: {faltando.map((c) => c.t).join(", ")}</p>
            ) : (
              <p className="texto">
                Vendas que já chegaram pelo webhook não são alteradas. Você pode desfazer esta importação depois.
              </p>
            )}
            <button className="primario" disabled={enviando || faltando.length > 0} onClick={importar}>
              {enviando ? "Importando…" : `Importar ${linhas.length} vendas`}
            </button>
          </div>
        </>
      )}

      {lotes.length > 0 && (
        <section className="box">
          <h2>Importações anteriores</h2>
          <table>
            <thead><tr><th className="l">Importado em</th><th>Vendas</th><th className="l">Período das vendas</th><th></th></tr></thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.lote}>
                  <td className="data">{new Date(l.importado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{l.qtd}</td>
                  <td className="data">
                    {new Date(l.de).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} – {new Date(l.ate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </td>
                  <td>
                    {apagar === l.lote ? (
                      <span className="confirma">
                        Apagar {l.qtd} vendas?
                        <button className="sim perigo" onClick={() => desfazer(l.lote)}>Sim</button>
                        <button onClick={() => setApagar("")}>Não</button>
                      </span>
                    ) : (
                      <button className="link-btn" onClick={() => setApagar(l.lote)}>Desfazer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
