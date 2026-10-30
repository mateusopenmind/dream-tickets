# Especificação Completa — Dashboard de Faturamento Dream Tickets

> **Como usar este documento:** ele é autossuficiente e foi escrito para servir de contexto
> em ferramentas de IA (Claude, ChatGPT, Copilot etc.). Cole-o junto com o pedido do tipo
> "implemente este dashboard no meu sistema" e a IA terá todas as regras de negócio, fórmulas,
> layout e comportamento esperado. O arquivo `Dashboard_Faturamento.html` que acompanha o
> pacote é a implementação de referência — em caso de dúvida, o comportamento dele prevalece.

---

## 1. Contexto do negócio

A **Dream Tickets** é uma distribuidora de milhas aéreas que atende agências de viagem.
Ela compra/gerencia milhas de vários programas de fidelidade (Latam, Smiles, Azul, etc.)
e emite bilhetes aéreos para clientes finais das agências parceiras.

Cada **registro** no sistema é uma operação realizada para uma agência cliente. A operação
mais comum é a **Emissão** (emitir bilhete aéreo usando milhas), mas existem operações de
pós-venda: **Remarcação**, **Queima CPFs**, **Assento**, **Bagagem**, **Taxa Reembolso**.

Identidade visual: logo dourada em fundo preto. Nome exibido: **DREAM TICKETS**,
subtítulo "Distribuidora de Milhas Aéreas — Dashboard de Faturamento".

---

## 2. Modelo de dados (contrato)

Cada registro (1 linha = 1 operação):

```
data            date     — data da operação
hora            time     — hora da operação (opcional; usada em análises de expediente)
programa        string   — programa de fidelidade: "Latam", "Smiles", "Interline",
                           "American", "Azul Viagens", "Azul Liminar", "Iberia", "TAP",
                           "All Accor", "Qatar" (lista aberta — tratar dinamicamente)
operacao        string   — "Emissão" | "Queima CPFs" | "Remarcação" | "Assento"
                           | "Bagagem" | "Taxa Reembolso"
emissor         string   — funcionário que executou (ex.: "Gabriel", "João", "Bruno"...)
cliente         string   — código da agência (ex.: "A215", "A406"...)
pax             int      — número de passageiros
milhas          number   — quantidade de milhas cobrada
preco_milheiro  number   — R$ por 1.000 milhas (preço PURO das milhas, sem taxas)
taxas           number   — taxas cobradas (R$)
outros          number   — outros valores cobrados (R$)
total           number   — valor total cobrado (R$)
status          string   — "PAGO" | "EM ABERTO" | "CANCELADA"  (status do Pix)
```

Invariante: `total = (milhas × preco_milheiro ÷ 1000) + taxas + outros`

Amostra real: arquivo `exemplo_dados.json` (JSON array com 1.215 registros de jan-abr/2026).

---

## 3. Regras de negócio fundamentais

Estas regras foram definidas pelo dono (Bruno) e NÃO devem ser alteradas sem consulta:

### R1 — Contagem de emissões
"Número de emissões" conta **somente** registros com `operacao == "Emissão"`.
Pós-vendas (Remarcação, Queima CPFs, Assento, Bagagem, Taxa Reembolso) **nunca** contam.

### R2 — Contagem de PAX
Soma de `pax` **somente** de registros com `operacao == "Emissão"`. Mesma lógica de R1.

### R3 — Valores financeiros
- **Faturamento** = Σ `total` de **TODOS** os registros (inclusive pós-vendas).
- **Venda de Milhas** = Σ (`milhas` × `preco_milheiro` ÷ 1000) — exclui taxas/outros.
- **Taxas + Outros** = Faturamento − Venda de Milhas.
- **Milhas vendidas** = Σ `milhas` de todos os registros.

### R4 — Indicadores derivados
- **Ticket Médio** = Faturamento ÷ nº de emissões (R1).
- **Faturamento ÷ PAX** = Faturamento ÷ PAX (R2).
- **Milhas ÷ PAX** = Milhas ÷ PAX (R2).
- **Milhas ÷ Emissão** = Milhas ÷ nº de emissões (R1).
- **Preço Médio do Milheiro (ponderado)** = Σ(milhas × preco_milheiro ÷ 1000) ÷ Σ(milhas) × 1000.
  ⚠️ SEMPRE ponderado por milhas — nunca média simples dos preços.

### R5 — Faixas de precificação (classificação por emissão)
Aplicável somente a registros `operacao == "Emissão"` com `pax > 0`.
Critério: `milhas_por_pax = milhas ÷ pax`.

**Smiles (5 faixas):**
| Faixa | Condição |
|---|---|
| 100K+ por PAX | milhas_por_pax ≥ 100.000 |
| 75-99K por PAX | 75.000 ≤ milhas_por_pax < 100.000 |
| 50-74K por PAX | 50.000 ≤ milhas_por_pax < 75.000 |
| 25-49K por PAX | 25.000 ≤ milhas_por_pax < 50.000 |
| até 24K por PAX | milhas_por_pax < 25.000 |

**Latam (6 faixas):**
| Faixa | Condição |
|---|---|
| 100K+ por PAX | milhas_por_pax ≥ 100.000 |
| 75-99K por PAX | 75.000 ≤ milhas_por_pax < 100.000 |
| 50-74K por PAX | 50.000 ≤ milhas_por_pax < 75.000 |
| 25-49K por PAX | 25.000 ≤ milhas_por_pax < 50.000 |
| 18-24K por PAX | 18.000 ≤ milhas_por_pax < 25.000 |
| até 17K por PAX | milhas_por_pax < 18.000 |

Nota histórica: a tabela comercial da Smiles tem uma faixa "550K+ total (até 9 pax)",
mas ficou decidido NÃO usá-la no dashboard — classificar tudo por milhas/PAX.

### R6 — Semanas
Semana ISO: **segunda a domingo**. Usada em todos os agrupamentos semanais e calendários.

### R7 — Formatação (pt-BR)
- Moeda: `R$ 1.234.567` (sem centavos em cards/tabelas; com centavos em preços de milheiro
  e na tabela de detalhamento).
- Números: separador de milhar com ponto (`1.234`).
- Milhas abreviadas: **K** = milhares (`16.119K`), **M** = milhões sem casas decimais (`33M`).
- Percentuais: 1 casa decimal com vírgula (`46,7%`).
- Datas: `dd/mm/aa` ou `dd/mm`.

---

## 4. Estrutura do dashboard (ordem exata das seções)

### 4.1 Header
Fundo gradiente preto (`#0A0A0A → #1F1F1F`), logo à esquerda (~80px altura),
título "DREAM TICKETS" em dourado `#D4AF37`, subtítulo e metadados
(período, nº registros, nº emissões) em cinza claro.

### 4.2 Filtros
Uma barra com: Programa (select), Emissor (select), Cliente (select), Status Pix (select),
De (date), Até (date), botão "Limpar filtros".
Abaixo, **filtro rápido por mês**: botões-pílula "Todos os meses", "Jan/26", "Fev/26"...
(gerados dinamicamente conforme meses presentes nos dados). Clicar num mês seta De/Até
para o mês inteiro e destaca o botão. TODOS os componentes do dashboard reagem aos filtros.

### 4.3 KPIs mensais (linha "Faturamento mensal")
1 card por mês presente nos dados + 1 card "Total {ano}". Cada card mostra:
- Nome do mês (label)
- Faturamento do mês (valor grande, R$)
- Milhas vendidas em **M** (milhões inteiros) — ex.: "33M milhas"
- Sub: "N emissões · ticket R$ X"
Card do total: fundo preto gradiente com borda/label dourada.

### 4.4 KPIs gerais (grade de 15 cards)
1. Faturamento (R3)
2. Emissões (R1)
3. Milhas Vendidas (fmt: X,XXM se ≥1M)
4. PAX (R2)
5. Ticket Médio (R4)
6. Recebido (PAGO) — Σ total dos status PAGO + % do faturamento
7. A Receber (EM ABERTO) — idem
8. Cancelado (CANCELADA) — idem
9. Preço Médio Milheiro (R4, ponderado)
10. Taxas Cobradas — Σ taxas
11. Venda de Milhas (R3) + % do faturamento
12. Taxas + Outros (R3) + % do faturamento
13. Faturamento ÷ PAX
14. Milhas ÷ PAX
15. Milhas ÷ Emissão

### 4.5 Tabelas "Programa × Mês" (5 tabelas)
Todas com: linhas = programas ordenados pelo total desc, colunas = meses + Total,
bolinha colorida do programa antes do nome, células centralizadas, célula vazia = "—".

Layout: linha 1 lado a lado → **Faturamento (R$)** | **Venda de Milhas (R$ sem taxas)**;
linha 2 lado a lado → **Milhas Vendidas (em K)** | **Emissões (qtd, regra R1)**;
linha 3 largura total → **Milhas ÷ PAX (em K, regra R2)**.

As 4 primeiras mostram em cada célula o valor + **% de participação do programa no mês**
(embaixo, menor e cinza). A linha TOTAL do rodapé mostra o total do mês + "100,0%".
Milhas÷PAX não tem %, mostra apenas o valor K.

### 4.6 Análise por Faixa de Precificação (8 tabelas, 4 linhas de 2)
Somente Smiles e Latam. Cards com borda superior colorida
(Smiles laranja `#FF8000`, Latam vermelho `#E2231A`).

- **Linha 1 — visão geral por faixa:** colunas Faixa, Emi, % Emi, PAX, Milhas (K),
  Faturamento, % Fat, Milheiro (preço médio simples da faixa).
- **Linha 2 — emissões por faixa por mês:** valor + % do mês por célula.
  Escala de cor de fundo: branco → laranja (`rgb 237,125,49`) para Smiles,
  branco → vermelho (`rgb 226,35,26`) para Latam; intensidade ∝ valor ÷ máx da tabela.
- **Linha 3 — faturamento por faixa por mês:** mesma estrutura/escala, valores em R$.
  Contém nota: "Considera apenas operações tipo Emissão com PAX > 0. Pós-vendas são
  excluídas, então o total pode diferir da tabela Faturamento — Programa por Mês."
- **Linha 4 — preço médio do milheiro por faixa por mês:** média PONDERADA por milhas
  (regra R4). Mesma escala de cor (mín→máx da tabela). Coluna final "Média Período",
  rodapé "MÉDIA" (média ponderada do mês inteiro).

Regra de contraste nas células coloridas: intensidade ≥ 0,5 → texto branco;
0,25–0,5 → texto `#1F2937`; < 0,25 → texto `#374151`.

### 4.7 Gráficos (Chart.js 4.5.0)
1. **Milhas Vendidas por Programa por Mês** — colunas empilhadas; cores por programa.
2. **Faturamento por Programa** — barras horizontais; cores por programa.
3. **Emissões por Emissor por Mês** — barras horizontais empilhadas (série = mês);
   emissões pela regra R1; altura dinâmica p/ mostrar todos os emissores (autoSkip: false).
4. **Top 15 Clientes por Faturamento** — barras horizontais empilhadas por programa.
5. **Faturamento Mensal — Top 15 Clientes** — colunas empilhadas (série = cliente).
6. **Faturamento Semanal** — linha com área; semanas ISO; tooltip mostra nº de emissões.
7. **Faturamento por Dia da Semana** — colunas (Seg→Dom).
8. **Emissões por Dia da Semana** — colunas; regra R1.
9. **Vendas Diárias** — linha com área; 1 ponto por dia.

### 4.8 Rankings mensais (cards)
- **Top 15 Clientes por Mês — Faturamento:** 1 card por mês (header azul `#1F4E78`).
  Cada linha: posição, cliente, R$, nº emissões (R1), % do mês.
  Rodapé: total top 15 em R$ + emissões + % do mês.
- **Top 15 Clientes por Mês — Por Emissões:** igual, ordenado por emissões
  (desempate: faturamento), header verde `#10B981`.

### 4.9 % do Faturamento Mensal — Top 15 Clientes
Matriz: linhas = top 15 clientes do período, colunas = meses + Total.
Cada célula = % que o cliente representou do faturamento do mês.
Escala de fundo branco → verde (`rgb 56,118,29`), intensidade = pct ÷ 20% (cap 1.0).
Rodapé "TOTAL Top 15" com a soma dos %.

### 4.10 Calendários (semana × dia da semana)
Linhas = semanas ISO do período, colunas = Seg…Dom + Total, rodapé TOTAL por dia da semana.
Cada célula de dia: data (dd/mm), valor, "N emissões". Dias fora do período: "·".
Dias sem venda: data + "—". Totais centralizados e em negrito.

1. **Faturamento Diário — Calendário:** valores em R$, escala verde.
2. **Smiles — Calendário Diário:** milhas do dia em K (ex.: "2.500K"), escala laranja,
   lado a lado com…
3. **Latam — Calendário Diário:** idem, escala vermelha.
(2 e 3 mostram apenas registros do respectivo programa; emissões pela regra R1.)

### 4.11 Detalhamento
Tabela com todos os registros filtrados, **ordem crescente de data**, máx. 500 linhas
exibidas (aviso "Exibindo 500 de N — use os filtros para refinar").
Colunas: Data, Programa, Operação, Emissor, Cliente, PAX, Milhas, Preço/Mil, Taxas,
Outros, Total, Status. Status como badge colorida
(PAGO verde `#D1FAE5/#065F46`, EM ABERTO amarelo `#FEF3C7/#92400E`,
CANCELADA vermelho `#FEE2E2/#991B1B`).

---

## 5. Paleta de cores

| Uso | Hex |
|---|---|
| Azul principal | `#1F4E78` (secundário `#2E75B6`) |
| Dourado (marca) | `#D4AF37` |
| Header/fundo escuro | `#0A0A0A` → `#1F1F1F` |
| Latam | `#E2231A` |
| Smiles | `#FF8000` (gráficos) / `#ED7D31` (escalas de calor) |
| Interline | `#1F4E78` |
| American | `#0078D2` |
| Azul Viagens | `#0071CE` |
| Azul Liminar | `#5B9BD5` |
| Iberia | `#D4AF37` |
| All Accor | `#7030A0` |
| Qatar | `#5C0F2B` |
| TAP | `#1B3A6B` |
| PAGO / EM ABERTO / CANCELADA | `#10B981` / `#F59E0B` / `#EF4444` |
| Fundo página | `#F7F8FA`; cards brancos com sombra leve |

---

## 6. Arquitetura sugerida no ERP

1. **Endpoint** `GET /api/faturamento?de=YYYY-MM-DD&ate=YYYY-MM-DD` retornando JSON array
   no contrato da seção 2. (A implementação de referência embute os dados numa constante
   `RAW`; basta popular via fetch para reaproveitar todo o front.)
2. Agregações podem continuar client-side enquanto o volume for pequeno (~4k registros/ano
   é instantâneo). Para histórico multi-ano, mover agregações para SQL e expor endpoints
   agregados.
3. Filtros são interseção simples (AND) de programa/emissor/cliente/status/intervalo de datas.
4. Única dependência de terceiros: Chart.js 4.5.0 (UMD). Todo o resto é HTML/CSS/JS puro.
5. Não usar localStorage/sessionStorage no front (não é necessário — estado em memória).

---

## 7. Casos de borda conhecidos

- Registros com `pax = 0` (raros): entram no faturamento e nas milhas, mas ficam FORA
  das análises por faixa (R5) e não afetam PAX (R2).
- Emissores que só fazem pós-venda (ex.: Juliana no histórico) aparecem com 0 emissões —
  correto pela R1, não é bug.
- Meses parciais (mês corrente): mostrar normalmente; o usuário sabe que está incompleto.
- Programas com pouquíssimos registros (TAP, Qatar, All Accor: 1 cada) devem aparecer
  normalmente nas tabelas (sem filtro de mínimo).
- Divisões por zero: exibir "—" (nunca NaN/Infinity).
