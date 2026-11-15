import { redirect } from "next/navigation";
import { estaLogado } from "@/lib/auth";
import Copiar from "@/components/Copiar";

export const dynamic = "force-dynamic";

const PARAMS =
  "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}";

export default async function Utm() {
  if (!(await estaLogado())) redirect("/entrar");
  const webhook = `${process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "https://SEU-PROJETO.vercel.app"}/api/venda`;

  return (
    <>
      <header className="topbar"><h1>Parâmetros UTM</h1></header>

      <section className="box">
        <h2>Meta Ads</h2>
        <p className="texto">
          Cole no campo <b>Parâmetros de URL</b> de cada anúncio (Gerenciador de Anúncios → anúncio → Destino → Parâmetros de URL).
          A própria Meta troca os códigos entre chaves pelo nome e ID da campanha, do conjunto e do anúncio — é o mesmo padrão da Utmify.
        </p>
        <div className="codigo">
          <code>{PARAMS}</code>
          <Copiar texto={PARAMS} />
        </div>
        <ul className="dicas">
          <li><b>Dica:</b> configure em um anúncio e duplique — o campo vai junto. Não precisa mexer quando trocar o nome da campanha.</li>
          <li>Os IDs depois do <code>|</code> são o que liga cada venda ao gasto do anúncio na aba Campanhas.</li>
          <li>Sua landing já repassa essas UTMs para o checkout da Wiapy, que as devolve no webhook.</li>
        </ul>
      </section>

      <section className="box">
        <h2>Como fica o mapeamento</h2>
        <table>
          <thead><tr><th>Parâmetro</th><th className="l">Recebe</th><th className="l">Aparece no painel como</th></tr></thead>
          <tbody>
            <tr><td className="nome"><code>utm_source</code></td><td className="nome">FB</td><td className="nome">Origem</td></tr>
            <tr><td className="nome"><code>utm_campaign</code></td><td className="nome">Nome da campanha|ID</td><td className="nome">Campanha</td></tr>
            <tr><td className="nome"><code>utm_medium</code></td><td className="nome">Nome do conjunto|ID</td><td className="nome">Conjunto</td></tr>
            <tr><td className="nome"><code>utm_content</code></td><td className="nome">Nome do anúncio|ID</td><td className="nome">Anúncio</td></tr>
            <tr><td className="nome"><code>utm_term</code></td><td className="nome">Posicionamento (Instagram_Feed, Facebook_Stories…)</td><td className="nome">Posicionamento</td></tr>
          </tbody>
        </table>
      </section>

      <section className="box">
        <h2>Webhook da Wiapy</h2>
        <p className="texto">Wiapy → Integrações → Webhook. Use a URL abaixo e o mesmo token da variável <code>WIAPY_TOKEN</code>. Marque todos os eventos.</p>
        <div className="codigo">
          <code>{webhook}</code>
          <Copiar texto={webhook} />
        </div>
      </section>
    </>
  );
}
