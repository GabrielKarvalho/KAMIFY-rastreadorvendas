# Kamify — rastreador de vendas

Projeto Next.js independente da landing. Recebe os webhooks da Wiapy, grava no Postgres (Neon), puxa gasto e métricas
da Meta Ads, envia o Purchase pela API de Conversões e mostra tudo num painel com senha.

| Rota | O que é |
|---|---|
| `/painel` | Visão geral: faturamento, lucro, gasto, CPA, ROAS, margem, funil, gráfico, pagamentos, produtos, bumps |
| `/painel/campanhas` | Tabela estilo Gerenciador: campanhas → conjuntos → anúncios, com vendas, lucro, ROAS, CPA, CTR, CPM… |
| `/painel/vendas` | Todas as transações, com filtros por status e busca |
| `/painel/utm` | Parâmetros de URL para copiar e URL do webhook |
| `POST /api/venda` | Webhook da Wiapy |
| `/api/exportar` | CSV das vendas (botão Exportar) |

## Subir (GitHub + Vercel)

1. Crie um repositório no GitHub (ex.: `kamify`) com o conteúdo desta pasta.
2. Vercel → **Add New → Project** → importe o repositório.
3. No projeto: **Storage → Create Database → Neon** → conecte. A `DATABASE_URL` é criada sozinha; as tabelas também.
4. **Settings → Environment Variables** (veja `.env.example`):
   - `WIAPY_TOKEN`, `PAINEL_SENHA`, `SESSION_SECRET`
   - `META_PIXEL_ID`, `META_ACCESS_TOKEN` (Gerenciador de Eventos → Pixel → Configurações → API de Conversões → Gerar token)
   - `META_AD_ACCOUNT_IDS` (o número que aparece em `act=` no Gerenciador de Anúncios)
   - `META_ADS_TOKEN` com permissão **ads_read** (Configurações do negócio → Usuários do sistema → Gerar token, marcando `ads_read`)
5. **Redeploy**.

## Wiapy

- **Integrações → Webhook**: URL `https://SEU-PROJETO.vercel.app/api/venda`, token = `WIAPY_TOKEN`, todos os eventos.
- **Evite Purchase duplicado:** a integração "Pixel Téc. Iphone" da Wiapy já envia Purchase (tem token de CAPI e "Pagamento aprovado" marcado).
  Escolha UM:
  - desmarque "Pagamento aprovado" nessa integração e deixe o rastreador enviar (recomendado), **ou**
  - deixe a Wiapy enviar e coloque `META_CAPI_ATIVO=false` aqui.

## UTMs nos anúncios

Cole em **Parâmetros de URL** de cada anúncio (também está na página `/painel/utm` com botão de copiar):

```
utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}
```

## Como os números são calculados

- **Faturamento líquido** = valor pago − taxa da Wiapy. **Lucro** = líquido − gasto em ads − imposto (`IMPOSTO_PCT`, opcional).
- **ROAS** = líquido ÷ gasto · **ROI** = lucro ÷ gasto · **CPA** = gasto ÷ vendas · **ARPU** = líquido ÷ vendas · **Margem** = lucro ÷ líquido.
- Vendas entram pela data de criação da transação (horário de Brasília). Gasto é por dia, no fuso da conta de anúncios.
- Venda e gasto se ligam pelo ID depois do `|` na UTM. Vendas sem UTM aparecem como "(sem UTM / não identificado)".
- Os dados da Meta são atualizados ao abrir o painel (no máximo a cada 10 min) ou na hora pelo botão **Atualizar**.
- O filtro de **Produtos** vale para as vendas; o de **Contas** vale para o gasto.
- Mais ofertas: basta usar a mesma URL de webhook nelas na Wiapy — elas aparecem no filtro de produtos automaticamente.
