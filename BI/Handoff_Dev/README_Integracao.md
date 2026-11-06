# Dashboard de Faturamento — Dream Tickets
## Guia de Integração para o Dev do ERP

Este pacote contém tudo que você precisa para replicar o dashboard dentro do ERP.

---

## Arquivos do pacote

| Arquivo | O que é |
|---|---|
| `Dashboard_Faturamento.html` | Dashboard completo, self-contained (HTML + CSS + JS + dados embutidos). **Arquivo principal de referência** — toda a lógica de cálculo e visualização está nele. |
| `exemplo_dados.json` | Amostra real do formato de dados que o front consome (1.215 registros, JSON array) — usar como **contrato do endpoint** que o ERP deve expor. |
| `Especificacao_Completa_Dashboard.md` | Especificação completa e autossuficiente do dashboard, escrita para ser usada como contexto em ferramentas de IA (Claude, ChatGPT, Copilot etc.). |
| `logo_dream_tickets.png` | Logomarca com fundo transparente (também está embutida no HTML como data-URL base64). |
| `README_Integracao.md` | Este arquivo. |

---

## 1. Contrato de dados

> **Importante:** a planilha Excel usada até aqui era só a fonte provisória. No ERP, os dados
> virão direto do banco do sistema. O que precisa ser respeitado é o **contrato abaixo** —
> cada registro é 1 operação, com estes campos:

| Campo | Tipo | Observação |
|---|---|---|
| data | date | data da emissão/operação |
| hora | time | opcional — usada em análises de horário de atendimento, não aparece no dashboard atual |
| programa | string | Latam, Smiles, Interline, American, Azul Viagens, Azul Liminar, Iberia, TAP, All Accor, Qatar… (lista aberta — o dashboard descobre os valores dinamicamente) |
| operacao | string | **Emissão**, Queima CPFs, Remarcação, Assento, Bagagem, Taxa Reembolso |
| emissor | string | nome do emissor (lista aberta) |
| cliente | string | código da agência (A215, A406…) |
| pax | int | nº de passageiros |
| milhas | number | quantidade de milhas cobrada |
| preco_milheiro | number | R$ por 1.000 milhas — **preço puro, sem taxas** |
| taxas | number | taxas cobradas |
| outros | number | outros valores cobrados |
| total | number | = (milhas × preco_milheiro ÷ 1000) + taxas + outros |
| status | string | PAGO, EM ABERTO, CANCELADA |

Formato JSON consumido pelo front (ver amostra real em `exemplo_dados.json`):

```json
{
  "data": "2026-01-01",
  "programa": "Smiles",
  "operacao": "Emissão",
  "emissor": "Gabriel",
  "cliente": "A399",
  "pax": 3,
  "milhas": 188400,
  "preco_milheiro": 16.25,
  "taxas": 316.98,
  "outros": 0,
  "total": 3378.48,
  "status": "PAGO"
}
```

---

## 2. Regras de negócio (IMPORTANTES — não mudar sem consultar o Bruno)

### 2.1 Contagem de emissões e PAX
- **Contagem de "emissões" considera SOMENTE linhas com `operacao == "Emissão"`** (coluna F).
- **Soma de PAX idem** — só linhas tipo Emissão.
- Remarcação, Queima CPFs, Assento, Bagagem, Taxa Reembolso **não contam** como emissão nem somam PAX.

### 2.2 Valores financeiros
- **Faturamento** = soma da coluna P (Preço Total) de **todas** as operações (inclusive pós-vendas).
- **Venda de Milhas** = `milhas × preco_milheiro ÷ 1000` (sem taxas/outros).
- **Taxas + Outros** = Faturamento − Venda de Milhas.
- **Ticket Médio** = Faturamento ÷ nº de emissões (só tipo Emissão).
- **Preço Médio do Milheiro (ponderado)** = Σ(milhas × preço_milheiro ÷ 1000) ÷ Σ(milhas) × 1000. Ponderar por milhas, não média simples.

### 2.3 Faixas de precificação (baseadas em milhas ÷ PAX)

Aplicáveis apenas a linhas tipo Emissão com PAX > 0.

**Smiles** (5 faixas):
| Faixa | Critério |
|---|---|
| 100K+ por PAX | milhas/pax ≥ 100.000 |
| 75-99K por PAX | 75.000 ≤ milhas/pax < 100.000 |
| 50-74K por PAX | 50.000 ≤ milhas/pax < 75.000 |
| 25-49K por PAX | 25.000 ≤ milhas/pax < 50.000 |
| até 24K por PAX | milhas/pax < 25.000 |

**Latam** (6 faixas):
| Faixa | Critério |
|---|---|
| 100K+ por PAX | milhas/pax ≥ 100.000 |
| 75-99K por PAX | 75.000 ≤ milhas/pax < 100.000 |
| 50-74K por PAX | 50.000 ≤ milhas/pax < 75.000 |
| 25-49K por PAX | 25.000 ≤ milhas/pax < 50.000 |
| 18-24K por PAX | 18.000 ≤ milhas/pax < 25.000 |
| até 17K por PAX | milhas/pax < 18.000 |

> Observação: existia uma faixa "550K+ total (até 9 pax)" para Smiles na precificação comercial, mas foi decidido **não usar** no dashboard — classificar tudo por milhas/PAX.

### 2.4 Calendários e semanas
- Semana = **ISO (segunda a domingo)**.
- Nas tabelas de calendário, a contagem de emissões segue a regra 2.1 e o faturamento a regra 2.2.

---

## 3. Estrutura do dashboard (ordem das seções no HTML)

1. **Header** — logo + nome + período/totais
2. **Filtros** — Programa, Emissor, Cliente, Status Pix, De/Até + botões de mês rápido (todos os componentes re-renderizam ao filtrar)
3. **KPIs mensais** — 1 card por mês (Faturamento, milhas em M, emissões, ticket) + card Total do ano (fundo preto/dourado)
4. **KPIs gerais** — 15 cards (Faturamento, Emissões, Milhas, PAX, Ticket Médio, PAGO, A Receber, Cancelado, Preço Médio Milheiro, Taxas, Venda de Milhas, Taxas+Outros, Fat÷PAX, Milhas÷PAX, Milhas÷Emissão)
5. **Tabelas Programa × Mês** — Faturamento | Venda de Milhas (lado a lado); Milhas Vendidas | Emissões (lado a lado); Milhas÷PAX (largura total). Todas com % de participação no mês.
6. **Análise por Faixa de Precificação** — 8 tabelas (Smiles/Latam × visão-geral/emissões-mês/faturamento-mês/preço-médio-mês), com escala de cor laranja (Smiles #ED7D31) e vermelha (Latam #E2231A)
7. **Gráficos** (Chart.js 4.5.0 via CDN) — milhas por programa/mês (empilhado), faturamento por programa, emissões por emissor/mês (empilhado), top 15 clientes (empilhado por programa), faturamento mensal top 15, faturamento semanal, faturamento/emissões por dia da semana, vendas diárias
8. **Rankings mensais** — Top 15 clientes por faturamento e por emissões (cards por mês)
9. **% Faturamento Mensal Top 15** — matriz com escala verde
10. **Calendários** — geral (escala verde, R$), Smiles (laranja, milhas K), Latam (vermelho, milhas K), com totais por semana e dia da semana
11. **Detalhamento** — tabela dos registros (máx. 500 exibidos), ordem crescente de data

## 4. Paleta de cores

| Uso | Hex |
|---|---|
| Azul principal (marca do dash) | #1F4E78 / #2E75B6 |
| Dourado Dream Tickets | #D4AF37 |
| Fundo header | #0A0A0A → #1F1F1F (gradient) |
| Latam | #E2231A |
| Smiles | #FF8000 (gráficos) / #ED7D31 (escala de calor) |
| Interline | #1F4E78 |
| American | #0078D2 |
| Azul Viagens | #0071CE |
| Azul Liminar | #5B9BD5 |
| Iberia | #D4AF37 |
| All Accor | #7030A0 |
| Qatar | #5C0F2B |
| TAP | #1B3A6B |
| PAGO / EM ABERTO / CANCELADA | #10B981 / #F59E0B / #EF4444 |

Formatação numérica: pt-BR (`toLocaleString('pt-BR')`), moeda R$ sem centavos nos cards, milhas em K (milhares) ou M (milhões).

---

## 5. Sugestão de integração no ERP

- **A planilha Excel não faz parte da integração** — ela era a fonte provisória. Os dados virão do banco do próprio ERP; o dashboard só precisa receber registros no formato do contrato (seção 1).
- O HTML atual é estático com dados embutidos (`const RAW = [...]`). No ERP, troque por um **endpoint** (ex.: `GET /api/faturamento?de=...&ate=...`) que devolva o mesmo JSON do `exemplo_dados.json` — o restante do JS funciona sem alteração se `RAW` for populado via fetch.
- Toda a lógica de agregação roda **client-side** em uma única função `render()` que é chamada a cada mudança de filtro. Com volume atual (~1.2k registros/quadrimestre) é instantâneo; se o ERP acumular anos de dados, mover agregações para o backend.
- Única dependência externa: **Chart.js 4.5.0** via CDN jsdelivr (pode ser hospedado localmente).
