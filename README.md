# DreamTickets / MilesControl

Plataforma de emissões com cobrança Pix (React 18 + Vite + TypeScript + Tailwind + Supabase). Desenvolvido pela Open Mind Solutions.

## Rodar local

```bash
cp .env.example .env   # preencher com os dados do Supabase
npm install
npm run dev            # http://localhost:8081
```

## Publicação (app.dreamticketsbr.com)

Todo push na branch `main` dispara a Action **Publicar app (Locaweb)**: build na nuvem e envio do `dist/` para `public_html/app/` na hospedagem Locaweb (FTP por padrão; SSH/rsync se a variável `DEPLOY_METHOD=ssh`). Também pode ser disparada manualmente em Actions → Run workflow.

Secrets necessários (Settings → Secrets and variables → Actions):
`VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` (ou `SSH_HOST`/`SSH_USER`/`SSH_PASSWORD` com a variável `DEPLOY_METHOD=ssh`).

⚠ `.env` e `Acessos.txt` nunca devem ser commitados (estão no `.gitignore`).

## Referência do projeto

Histórico técnico e decisões: `CONTEXTO_DREAMTICKETS.md` (pasta do projeto, fora do repo).
