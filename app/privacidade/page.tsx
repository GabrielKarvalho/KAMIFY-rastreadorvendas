import Logo from "@/components/Logo";

export const metadata = { title: "Política de Privacidade — KAMIFY" };

export default function Privacidade() {
  return (
    <main className="doc">
      <header className="doc-top">
        <Logo tamanho={32} />
        <span className="doc-marca">KAMI<b>FY</b></span>
      </header>
      <h1>Política de Privacidade</h1>
      <p className="doc-data">Última atualização: 16 de novembro de 2026</p>

      <p>
        O KAMIFY é uma ferramenta interna de uso exclusivo do seu proprietário, usada para acompanhar as vendas dos
        próprios produtos digitais e o desempenho das próprias campanhas de anúncios. Ele não é oferecido ao público e
        não permite cadastro de terceiros.
      </p>

      <h2>Quais dados tratamos</h2>
      <ul>
        <li>
          <b>Dados de vendas</b> recebidos da plataforma de pagamento (Wiapy): identificação da transação, valor, status,
          forma de pagamento, produto, nome, e-mail, telefone e documento do comprador, e parâmetros de origem (UTMs,
          fbc, fbp, IP e navegador).
        </li>
        <li>
          <b>Dados de anúncios</b> obtidos pela API de Marketing da Meta, somente das contas de anúncios do próprio
          proprietário: nomes, status e orçamento de campanhas, conjuntos e anúncios, e métricas como gasto,
          impressões, cliques e visitas.
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Calcular faturamento, lucro, custo por venda e retorno das campanhas.</li>
        <li>Ligar cada venda à campanha, conjunto e anúncio de origem.</li>
        <li>Permitir que o proprietário pause, ative e ajuste o orçamento das próprias campanhas.</li>
      </ul>

      <h2>Compartilhamento</h2>
      <p>
        Os dados não são vendidos nem compartilhados com terceiros. Eles ficam armazenados em banco de dados privado
        (Neon/Vercel) com acesso protegido por senha, e só são enviados à Meta quando necessário para medir conversões,
        com dados pessoais criptografados (hash SHA-256), conforme as regras da própria Meta.
      </p>

      <h2>Retenção e exclusão</h2>
      <p>
        Os dados ficam guardados enquanto forem necessários para a análise de vendas e campanhas. Qualquer pessoa pode
        pedir a exclusão dos seus dados entrando em contato com o proprietário pelo e-mail de contato informado na
        página do aplicativo na Meta; a exclusão é feita em até 30 dias.
      </p>

      <h2>Seus direitos (LGPD)</h2>
      <p>
        Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode solicitar confirmação, acesso,
        correção ou exclusão dos seus dados pessoais pelo mesmo canal de contato.
      </p>
    </main>
  );
}
