# Análise de viabilidade — Dashboard de Faturamento dentro do DreamTickets

Análise do pacote `Handoff_Dev` (README_Integracao.md + Especificacao_Completa_Dashboard.md +
Dashboard_Faturamento.html + exemplo_dados.json) contra o modelo de dados atual do app.

**Veredito: viável.** ~90% do contrato de dados já existe nas tabelas `emissoes` /
`emissoes_terceirizadas`. Não é preciso mudar o modelo — só uma camada de leitura, uma tela
nova e uma biblioteca de gráficos. O trabalho real está em **decidir 5 pontos de regra de
negócio** (seção 3), não em infraestrutura.

---

## 1. Mapeamento do contrato → banco atual

| Campo do contrato | Origem no app | Situação |
|---|---|---|
| `data` | `data_emissao` | OK |
| `hora` | `hora` (e `data_hora_emissao`) | OK |
| `programa` | `programa` (ou `programa_real` quando retarifação) | OK — ver 3.4 |
| `operacao` | `nome_operacao` (cadastro `operacoes`) | **Confirmar valores** — ver 3.1 |
| `emissor` | `emissor` | OK |
| `cliente` | `clientes.codigo` (join por `cliente_id`) | OK |
| `pax` | `passageiros_qtd` | OK |
| `milhas` | `milhas_cobrado` | OK |
| `preco_milheiro` | `preco_milheiro` | OK |
| `taxas` | `taxas_cobrado` (já convertido se em moeda estrangeira) | OK |
| `outros` | `outros_cobrado + bagagens_cobrado + assentos_cobrado` | **Precisa somar 3 colunas** — ver 3.2 |
| `total` | `preco_total` | OK |
| `status` | `status_pix` | Confirmar rótulos (PAGO / EM ABERTO / CANCELADA) |

O invariante do dashboard (`total = milhas × milheiro ÷ 1000 + taxas + outros`) bate com o
cálculo do app, que faz exatamente:

```
preco_total = milhas_cobrado × preco_milheiro ÷ 1000
            + taxas + bagagens + assentos + outros   (todos já em R$)
```

---

## 2. O que o app já tem e pode ser reaproveitado

- **Paginação PostgREST acima de 1.000 linhas** — o padrão de laço já usado em
  `RelatorioEmissoesPage.tsx` resolve o limite do PostgREST.
- **Filtros + regra de visibilidade** — operador só enxerga as próprias emissões;
  admin/super_admin enxergam tudo (`usePerfil`). Mesma lógica se aplica ao dashboard.
- **Controle de tela/permissão** — basta uma chave nova em `telas` + `usuario_telas`,
  agrupada em `lib/menuGrupos.ts` no grupo "Dashboard" (que já existe e hoje está vazio,
  com o item comentado no `AppSidebar.tsx`).
- **Formatação pt-BR** — helpers `brl`, `num`, `pct` já existem nos relatórios.
- **Exportação Excel** — `lib/exportarExcel.ts` já pronto, se quiserem exportar as tabelas.

---

## 3. Lacunas e decisões (o que precisa ser combinado com o Bruno)

### 3.1 Pós-vendas: linha própria ou coluna? — **é a decisão mais importante**

Na planilha, `Assento`, `Bagagem`, `Remarcação`, `Queima CPFs` e `Taxa Reembolso` são
**linhas separadas**. No app, a estrutura é diferente:

- Assento e bagagem são **colunas dentro da própria emissão** (`assentos_cobrado`,
  `bagagens_cobrado`);
- Reembolso e queima de CPF vivem na tabela `reembolsos` (com campo `queima_cpf`);
- Remarcação/retarifação é uma **flag de ajuste** na emissão (`ajuste_retarifacao`).

Ou seja: **os números não vão bater automaticamente** com o dashboard do Bruno, porque as
regras R1/R2 dele ("só conta linhas tipo Emissão") pressupõem que pós-venda é uma linha.

Três caminhos:

| Opção | Como | Consequência |
|---|---|---|
| **A — "explodir" no backend** | A view/RPC gera linhas virtuais: 1 linha "Emissão" + 1 linha "Assento" se `assentos_cobrado > 0` + 1 linha "Bagagem" + linhas de `reembolsos` como "Taxa Reembolso"/"Queima CPFs" | Fidelidade total ao dashboard atual; mais trabalho e mais lógica para manter |
| **B — 1 linha por emissão** | Faturamento já inclui assento/bagagem dentro do total | Bem mais simples; ticket médio e faixas ficam iguais; perde o corte "por tipo de operação" |
| **C — usar `nome_operacao` como está** | Se o operacional já lança "Remarcação"/"Queima CPFs" como emissões separadas com esse `nome_operacao`, o contrato já bate 1:1 | Zero trabalho extra — **precisa checar os valores reais do cadastro `operacoes` em produção** |

> **Pendência de verificação:** não consegui rodar a consulta em produção nesta sessão
> (`select distinct nome_operacao from emissoes`). É o primeiro passo antes de escolher.
> Se o resultado trouxer "Emissão", "Remarcação", "Queima CPFs" etc., a opção C resolve tudo.

### 3.2 "Outros" precisa somar bagagens + assentos

O contrato tem um único campo `outros`. No app são três colunas. Mapeamento proposto:
`outros = outros_cobrado + bagagens_cobrado + assentos_cobrado` (se ficar na opção B).
Na opção A, bagagens e assentos viram linhas próprias e `outros = outros_cobrado`.

### 3.3 Taxas lançadas em milhas distorcem "Venda de Milhas"

No app, taxas/bagagens/assentos/outros podem ser lançados **em milhas** (`*_tipo = "milhas"`)
e são convertidos para R$ pelo próprio milheiro. Essas milhas **não entram** em
`milhas_cobrado`. Resultado: a métrica "Venda de Milhas = milhas × milheiro ÷ 1000" fica um
pouco menor que a realidade, e "Taxas + Outros" um pouco maior. Precisa decidir se
normaliza (somar essas milhas ao total) ou se aceita a diferença.

### 3.4 Emissões terceirizadas entram?

O dashboard atual só conhece uma origem. O app tem `emissoes` **e**
`emissoes_terceirizadas` (mesmo desenho de colunas). Sugestão: incluir as duas com um filtro
"Origem: Própria / Terceirizada / Todas" — mas isso muda os totais em relação à planilha.

### 3.5 Retarifação — qual programa conta?

Existe `programa` (vendido) e `programa_real` (efetivamente emitido). As tabelas
"Programa × Mês" e os calendários Smiles/Latam mudam conforme a escolha. Sugestão:
usar `programa_real` quando preenchido (é o que baixa estoque), com nota na tela.

---

## 4. Ponto técnico: biblioteca de gráficos

O app **não tem** biblioteca de gráficos hoje (só `lucide-react` e Tailwind). O HTML de
referência usa Chart.js 4.5.0 por CDN — não serve para o build Vite. Opções:

- `npm i chart.js` + wrapper próprio (mais fiel ao HTML, ~170 KB gz);
- `recharts` (React-nativo, mais idiomático no projeto, mas exige reescrever os 9 gráficos).

Recomendo **chart.js**: as configurações dos 9 gráficos vêm prontas do HTML de referência.

---

## 5. Plano de implementação sugerido

| Fase | O que | Estimativa |
|---|---|---|
| 0 | Rodar as consultas de verificação em produção (`nome_operacao`, `status_pix`, volume, período) e fechar as decisões da seção 3 com o Bruno | 1 h |
| 1 | Camada de dados: RPC/view `dashboard_faturamento(de, ate)` no formato do contrato, unindo `emissoes` (+ terceirizadas, + reembolsos se opção A) | 4–6 h |
| 2 | Tela `DashboardFaturamentoPage.tsx` — header, filtros, KPIs mensais e os 15 KPIs gerais | 6–8 h |
| 3 | Tabelas Programa × Mês (5) + Faixas de precificação (8, com escala de calor) | 8–10 h |
| 4 | Gráficos (9, chart.js) | 6–8 h |
| 5 | Rankings mensais, matriz % Top 15, calendários (3) e detalhamento | 8–10 h |
| 6 | Tela em `telas`/`usuario_telas` (**não liberar automaticamente para operador**), item no `AppSidebar`, chave em `menuGrupos.ts`, texto em `ajudaConteudo.tsx` | 2 h |
| 7 | Conferência dos números contra o `Dashboard_Faturamento.html` no mesmo período | 3 h |

Total aproximado: **40–50 h** (~1,5 semana de desenvolvimento).

---

## 6. Riscos

- **Performance**: hoje toda a agregação do HTML é client-side com 1.215 registros. O app
  já acumula histórico maior; acima de ~10 mil registros o carregamento fica pesado.
  Mitigação: filtro de período obrigatório (default: ano corrente) e, se necessário,
  mover as agregações para SQL numa segunda etapa.
- **Divergência de números**: a planilha era a fonte provisória e pode ter ajustes manuais
  que o banco não tem. A fase 7 (conferência) é obrigatória antes de mostrar ao cliente.
- **Visibilidade**: dashboard financeiro consolidado exibe faturamento da empresa inteira —
  definir se fica restrito a admin/super_admin.
- **Manutenção de duas fontes**: enquanto o Bruno mantiver a planilha em paralelo, os dois
  dashboards vão divergir. Combinar uma data de corte.
