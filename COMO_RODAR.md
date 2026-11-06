# Como rodar o MilesControl (dream-tickets)

## 1. Pré-requisitos
- Node.js 18+ instalado (https://nodejs.org)

## 2. Instalar dependências
Abra o terminal NA PASTA do projeto (dream-tickets) e rode:

```bash
npm install
```

(Se preferir bun: `bun install`)

## 3. Rodar em modo desenvolvimento
```bash
npm run dev
```
O app abre em http://localhost:8081

## 4. Banco de dados (Supabase) — JÁ CONFIGURADO
- Projeto: dream-tickets-app
- Região: São Paulo (sa-east-1)
- URL: https://lrrsgguqhitrnhoncisj.supabase.co
- As credenciais já estão no arquivo .env
- As 8 tabelas (clientes, contas, cartoes, emissoes, programas, operacoes,
  origens, emissores) já foram criadas com RLS e funções.

## 5. Primeiro acesso
- Crie sua conta na tela de login (Cadastre-se).
- IMPORTANTE: para ter permissão de DELETAR registros, o e-mail admin
  configurado no banco é `bruno@dreamticketsbr.com`. Se quiser usar outro
  e-mail como admin, é preciso ajustar a função `is_delete_admin` no banco.

## 6. Antes de versionar com Git
Apague a pasta `.git` quebrada (resíduo de import) pelo Windows e rode:
```bash
git init
git add .
git commit -m "Importação inicial do MilesControl"
```

## Outros comandos
- `npm run build` — gera build de produção (pasta dist/)
- `npm run lint` — checa o código
- `npm test` — roda os testes
