# Rodar as migrações de pagador/recebedor Pix via Claude

Para quem tem o **conector do Supabase** ligado no Claude, com acesso ao projeto DreamTickets (`qvtfxtneitigsgllplnk`).

1. Abra uma conversa no projeto **DreamTickets** do Claude, com o conector Supabase ativo.
2. Cole o comando abaixo.
3. Se o conector pedir confirmação ("destructive statement"), **aprove**: o script desliga por alguns segundos os gatilhos de 4 tabelas para preencher a instituição dos Pix antigos sem disparar auditoria ou regras de reembolso, e os religa em seguida.

---

**Comando para colar no Claude:**

> Leia o documento do projeto `claude/RODAR_pix_pagador_recebedor.sql` e aplique-o no projeto Supabase `qvtfxtneitigsgllplnk` com a ferramenta `apply_migration`, usando o nome `pix_pagador_recebedor`. Envie o arquivo inteiro, sem alterar nada. Remova só o `begin;`/`commit;` e a consulta final de conferência, porque o apply_migration já roda numa transação. Se eu precisar aprovar, me avise. Depois rode com `execute_sql` a consulta de conferência do fim do arquivo e me mostre o resultado. O esperado é: tabela `pix_instituicoes`, 16 colunas `pagador_*`, 7 colunas `recebedor_*` e 2 funções. Não faça nenhuma outra alteração no banco.

---

**Sem Claude (SQL Editor ou psql):** rode `supabase/rodar/RODAR_pix_pagador_recebedor.sql` inteiro, por exemplo com `psql "$SUPABASE_DB_URL" -f supabase/rodar/RODAR_pix_pagador_recebedor.sql`. O arquivo já tem `begin`/`commit` e a conferência no fim.

**Depois de rodar:** publique o front (`npm run build`). As telas de Conferência Pix e Relatório de Emissões precisam das colunas novas.
