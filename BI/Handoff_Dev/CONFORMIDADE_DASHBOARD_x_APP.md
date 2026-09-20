# Conformidade — Dashboard de Faturamento × App DreamTickets

Checklist item a item de tudo que o dashboard do Bruno pede, comparado com o que o app tem
hoje no banco (`emissoes`, `emissoes_terceirizadas`, `reembolsos` e cadastros).

**Legenda**

| | Significado |
|---|---|
| ✅ | **Dá direto** — o dado já existe, é só ler |
| 🟡 | **Dá com ajuste** — existe, mas precisa transformação ou uma decisão de regra |
| 🔴 | **Não dá hoje** — o dado não existe no app; exige mudança de banco ou de processo |

> **Pendência que muda várias linhas abaixo:** não consegui listar os valores reais do
> cadastro `operacoes` em produção (`select distinct nome_operacao from emissoes`).
> Se o operacional já lança "Remarcação", "Queima CPFs", "Assento" e "Bagagem" como
> emissões separadas nesse campo, tudo marcado com 🟡(op) vira ✅ automaticamente.

---

## 1. Campos do contrato de dados (13)

| # | Campo | No app | St |
|---|---|---|---|
| 1 | `data` | `emissoes.data_emissao` | ✅ |
| 2 | `hora` | `emissoes.hora` (+ `data_hora_emissao`) | ✅ |
| 3 | `programa` | `emissoes.programa` / `programa_real` | ✅ |
| 4 | `operacao` | `emissoes.nome_operacao` (cadastro `operacoes`) | 🟡(op) |
| 5 | `emissor` | `emissoes.emissor` (cadastro `emissores`) | ✅ |
| 6 | `cliente` | `clientes.codigo` via `cliente_id` | ✅ |
| 7 | `pax` | `passageiros_qtd` | ✅ |
| 8 | `milhas` | `milhas_cobrado` | ✅ |
| 9 | `preco_milheiro` | `preco_milheiro` | ✅ |
| 10 | `taxas` | `taxas_cobrado` (já convertido de moeda estrangeira) | ✅ |
| 11 | `outros` | `outros_cobrado` **+** `bagagens_cobrado` **+** `assentos_cobrado` | 🟡 somar 3 colunas |
| 12 | `total` | `preco_total` | ✅ |
| 13 | `status` | `status_pix` | 🟡 app usa `CANCELADO`, dash usa `CANCELADA` |

**Fórmula bate.** O app calcula
`preco_total = milhas × milheiro ÷ 1000 + taxas + bagagens + assentos + outros`,
que é exatamente o invariante do contrato depois de agrupar as 3 colunas em `outros`.

---

## 2. Regras de negócio R1–R7

| Regra | O que pede | St | Observação |
|---|---|---|---|
| R1 | Emissões = só `operacao == "Emissão"` | 🟡(op) | Depende do cadastro `operacoes`. Se pós-venda não é linha, a regra vira "toda emissão conta" |
| R2 | PAX = só linhas Emissão | 🟡(op) | Idem |
| R3 | Faturamento = Σ total de tudo | ✅ | `Σ preco_total` |
| R3 | Venda de Milhas = milhas × milheiro ÷ 1000 | 🟡 | Ver 2.1 abaixo |
| R3 | Taxas+Outros = Faturamento − Venda de Milhas | ✅ | Derivado |
| R3 | Milhas vendidas = Σ milhas | ✅ | `Σ milhas_cobrado` |
| R4 | Ticket médio, Fat÷PAX, Milhas÷PAX, Milhas÷Emissão | ✅ | Todos derivados de campos existentes |
| R4 | Preço médio milheiro **ponderado por milhas** | ✅ | ⚠️ o `RelatorioEmissoesPage` atual usa **média simples** — o dashboard precisa da ponderada |
| R5 | Faixas por milhas÷PAX (Smiles 5, Latam 6) | 🟡 | Calculável, mas hoje seria hardcode. Ver 2.2 |
| R6 | Semana ISO seg→dom | ✅ | `date-fns` já está no projeto |
| R7 | Formatação pt-BR | ✅ | Helpers `brl`/`num`/`pct` já existem nos relatórios |

### 2.1 Ressalva na "Venda de Milhas"
No app, taxas/bagagens/assentos/outros podem ser lançados **em milhas** (`*_tipo = "milhas"`)
e são convertidos para R$ pelo próprio milheiro. Essas milhas **não entram** em
`milhas_cobrado`. Efeito: "Venda de Milhas" fica subestimada e "Taxas + Outros"
superestimada, em relação à planilha. Decisão: normalizar ou aceitar.

### 2.2 Faixas de precificação
Os cortes (100K / 75-99K / 50-74K / 25-49K / 18-24K / até 17K) hoje não existem em lugar
nenhum do app. Duas saídas: constante no código (rápido) ou cadastro novo
`faixas_precificacao` por programa (melhor, e alinhado com a decisão de nunca mais
hardcodear por nome de programa — como já foi feito com as regras em `programas`).

---

## 3. Filtros (seção 4.2 da spec)

| Filtro | St | Observação |
|---|---|---|
| Programa | ✅ | Cadastro `programas` |
| Emissor | ✅ | Cadastro `emissores` |
| Cliente | ✅ | Cadastro `clientes` (código) |
| Status Pix | ✅ | `status_pix` |
| De / Até | ✅ | `data_emissao` |
| Botões-pílula de mês | ✅ | Só front |
| Limpar filtros | ✅ | Só front |

---

## 4. KPIs

### 4.1 Cards mensais + card do ano
| Item | St |
|---|---|
| Faturamento do mês | ✅ |
| Milhas em M | ✅ |
| Nº de emissões do mês | 🟡(op) |
| Ticket do mês | 🟡(op) |
| Card "Total {ano}" | ✅ |

### 4.2 Os 15 KPIs gerais
| # | KPI | St | Origem |
|---|---|---|---|
| 1 | Faturamento | ✅ | Σ `preco_total` |
| 2 | Emissões | 🟡(op) | Contagem sob R1 |
| 3 | Milhas Vendidas | ✅ | Σ `milhas_cobrado` |
| 4 | PAX | 🟡(op) | Σ `passageiros_qtd` sob R2 |
| 5 | Ticket Médio | 🟡(op) | Derivado de 1 e 2 |
| 6 | Recebido (PAGO) | ✅ | Filtro `status_pix = PAGO` |
| 7 | A Receber (EM ABERTO) | ✅ | Idem |
| 8 | Cancelado | ✅ | `CANCELADO` (rótulo difere) |
| 9 | Preço Médio Milheiro ponderado | ✅ | Calculável |
| 10 | Taxas Cobradas | ✅ | Σ `taxas_cobrado` |
| 11 | Venda de Milhas | 🟡 | Ver 2.1 |
| 12 | Taxas + Outros | 🟡 | Ver 2.1 |
| 13 | Faturamento ÷ PAX | 🟡(op) | |
| 14 | Milhas ÷ PAX | 🟡(op) | |
| 15 | Milhas ÷ Emissão | 🟡(op) | |

> Nada aqui é bloqueador — todos os 🟡 caem no **mesmo** ponto: como contar "emissão".

---

## 5. Tabelas Programa × Mês (5)

| Tabela | St |
|---|---|
| Faturamento por programa/mês + % participação | ✅ |
| Venda de Milhas por programa/mês | 🟡 (ver 2.1) |
| Milhas Vendidas (K) por programa/mês | ✅ |
| Emissões (qtd) por programa/mês | 🟡(op) |
| Milhas ÷ PAX (K) por programa/mês | 🟡(op) |

Ponto extra a decidir: com retarifação existem `programa` (vendido) e `programa_real`
(emitido). Qual entra na linha da tabela? Sugestão: `programa_real` quando preenchido.

---

## 6. Análise por Faixa de Precificação (8 tabelas)

| Tabela | St |
|---|---|
| Smiles — visão geral por faixa | 🟡 (faixas, ver 2.2) |
| Smiles — emissões por faixa/mês (escala laranja) | 🟡 |
| Smiles — faturamento por faixa/mês | 🟡 |
| Smiles — preço médio milheiro por faixa/mês (ponderado) | 🟡 |
| Latam — as mesmas 4 (escala vermelha) | 🟡 |
| Escala de calor + regra de contraste do texto | ✅ (só CSS) |

Todos os dados de entrada existem (`milhas_cobrado`, `passageiros_qtd`, `preco_milheiro`,
`preco_total`). O 🟡 é só a definição das faixas.

---

## 7. Gráficos (9)

| # | Gráfico | St |
|---|---|---|
| 1 | Milhas por programa por mês (empilhado) | ✅ |
| 2 | Faturamento por programa (barras h.) | ✅ |
| 3 | Emissões por emissor por mês (empilhado) | 🟡(op) |
| 4 | Top 15 clientes por faturamento (empilhado por programa) | ✅ |
| 5 | Faturamento mensal — top 15 clientes | ✅ |
| 6 | Faturamento semanal (linha/área) | ✅ |
| 7 | Faturamento por dia da semana | ✅ |
| 8 | Emissões por dia da semana | 🟡(op) |
| 9 | Vendas diárias (linha/área) | ✅ |
| — | **Biblioteca de gráficos** | 🔴 **o app não tem nenhuma** |

O `package.json` só tem React, Radix, Tailwind, date-fns, lucide, supabase e react-query.
O HTML de referência usa **Chart.js 4.5.0 por CDN**, o que não funciona no build Vite.
Precisa entrar `npm i chart.js` (recomendado — reaproveita as configs prontas do HTML)
ou `recharts` (mais idiomático, mas exige reescrever os 9 gráficos).

---

## 8. Rankings, matriz e calendários

| Item | St | Observação |
|---|---|---|
| Top 15 clientes por mês — faturamento | ✅ | |
| Top 15 clientes por mês — emissões | 🟡(op) | |
| Matriz % faturamento mensal top 15 (escala verde) | ✅ | |
| Calendário geral de faturamento (semana × dia) | ✅ | |
| Calendário Smiles (milhas K, escala laranja) | ✅ | |
| Calendário Latam (milhas K, escala vermelha) | ✅ | |
| Nº de emissões dentro de cada célula do calendário | 🟡(op) | |
| **Data das operações de pós-venda no calendário** | 🔴 | Ver seção 10 |

---

## 9. Detalhamento e identidade visual

| Item | St | Observação |
|---|---|---|
| Tabela de registros, 500 linhas, ordem de data | ✅ | Padrão já usado nos relatórios |
| Badges de status coloridas | ✅ | Componente `Badge` já existe |
| Exportar para Excel | ✅ | **Bônus** — `lib/exportarExcel.ts` já pronto, o dashboard do Bruno não tem |
| Header preto + logo dourada | 🟡 | O app tem tema/layout próprio; replicar o header exato conflita com o resto da UI. Sugestão: manter o padrão do app |
| Paleta por programa (Latam #E2231A, Smiles #FF8000…) | 🟡 | Não existe cor por programa no cadastro `programas`. Ou hardcode num mapa, ou coluna `cor` no cadastro (melhor, porque a lista é aberta) |

---

## 10. O que **não existe** no app (os 🔴 de verdade)

Estes são os únicos pontos que exigem decisão estrutural — todos giram em torno de
**pós-venda como linha**:

| Operação da planilha | Como está no app | O que falta |
|---|---|---|
| **Assento** | Coluna `assentos_cobrado` dentro da emissão (+ flag `compra_apos_assentos`) | Não é linha própria e **não tem data própria** — se o assento foi comprado depois, o calendário jogaria o valor na data da emissão |
| **Bagagem** | Coluna `bagagens_cobrado` (+ `compra_apos_bagagens`) | Idem |
| **Remarcação** | Apenas a flag `ajuste_retarifacao` / `ajuste_retarifacao_outro_programa` | **Não tem valor nem data próprios.** Faturamento de remarcação não é separável hoje |
| **Queima CPFs** | Valor `queima_cpf` dentro de `reembolsos` + cadastro `taxas_queima_cpf` | Existe o valor, não existe a linha |
| **Taxa Reembolso** | Tabela `reembolsos` (`preco_total`, `programa`, `pax_qtd`, `status_pix`) | Existe quase tudo, mas **não há campo "data do reembolso"** — só `created_at`, `data_cobranca`, `data_pagamento`. O campo `reembolsos.operacao` guarda o `nome_operacao` da emissão original, não o tipo de pós-venda |

**Consequência prática:** as regras R1/R2 ("emissão é só quem tem `operacao == Emissão`")
só funcionam 1:1 se a operação já lança pós-venda como registro separado. Senão, há
três caminhos:

| Opção | Como | Custo | Fidelidade |
|---|---|---|---|
| **A** | View/RPC "explode" a emissão em linhas virtuais (Emissão + Assento + Bagagem + linhas de `reembolsos`) | Alto | Alta — mas Remarcação continua sem valor próprio |
| **B** | 1 linha por emissão; assento/bagagem já dentro do total; sem corte por tipo de operação | Baixo | Média — números batem no total, não no detalhe |
| **C** | Usar `nome_operacao` como já está, se o cadastro `operacoes` já tiver esses tipos | Zero | Alta |

---

## 11. O que o **app tem e o dashboard não** (ganho de graça)

Vale a pena mostrar ao Bruno — são análises que a planilha nunca conseguiu dar:

| Dado no app | Análise que habilita |
|---|---|
| `milhas_real`, `taxas_real`, `custo_milheiro`, `custo_total` | **Margem e lucro por emissão / programa / cliente / emissor** — o dashboard atual só vê receita |
| `valor_recebido` vs `preco_total` | Recebimento parcial real, não só o status do Pix |
| `emissoes_terceirizadas` + `fornecedores` | Faturamento e margem por fornecedor; próprio × terceirizado |
| `data_recebimento`, `data_cobranca` | Prazo médio de recebimento, aging da carteira |
| `data_voo_ida` | Antecedência média de emissão (venda × voo) |
| `contas`, `cartoes`, `conta_programas` | Consumo por conta/cartão, cruzando com estoque |
| `estoque_movimentos` | Custo do estoque consumido × preço vendido, na mesma tela |
| `assinaturas`, `planos_clube`, `assinatura_bonus` | Receita recorrente de clube, fora da planilha |
| `facial`, `cpfs_otimizados`, `percentual_cb` | Análises operacionais que a planilha não carrega |
| `origem_venda`, `clientes.grupo/nivel/uf` | Faturamento por origem, por grupo de agência, por estado |

---

## 12. Resumo do placar

| Situação | Qtd aprox. | Comentário |
|---|---|---|
| ✅ **Dá direto** | ~45 itens | A maior parte do dashboard |
| 🟡 **Dá com ajuste/decisão** | ~25 itens | Quase todos caem em **uma única decisão**: como contar "emissão" (seção 10) |
| 🔴 **Não dá hoje** | 3 | 1) biblioteca de gráficos (resolve com `npm i chart.js`); 2) data própria de pós-venda; 3) valor próprio de Remarcação |

**Conclusão:** não há nenhum impedimento técnico. Fechada a definição da seção 10 com o
Bruno, o dashboard inteiro é implementável — e, no modelo do app, dá para entregar
**mais** do que a planilha entrega (seção 11).
