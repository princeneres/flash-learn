---
description: Sincroniza o schema do Supabase remoto e regenera os tipos TS (link + pull + repair + gen types)
allowed-tools: Bash(pnpm db:sync), Bash(git status:*), Bash(git diff:*), Read
---

Sincronize o projeto local com o banco Supabase remoto rodando:

!`pnpm db:sync`

O script `scripts/db-sync.sh` faz tudo automaticamente:

1. Garante o link com o projeto (`txjyqvaijuvuzpplhxag`).
2. `supabase db pull` — puxa o schema remoto; se o histórico de migrations divergir, repara (marca as locais como aplicadas) e repete o pull.
3. Regenera `src/types/database.ts`.

Depois que o comando acima rodar, com base na saída dele:

- Rode `git status --short supabase/migrations src/types/database.ts` e relate o que mudou.
- Se uma **nova migration** foi criada em `supabase/migrations/`, leia-a e descreva em 1–2 linhas o que ela contém (ex.: funções/RPCs ou tabelas que só existiam no dashboard).
- Se os tipos mudaram, mencione quais tabelas/colunas foram afetadas, se for óbvio pelo diff.
- Se algo falhar, mostre o erro e sugira a correção (ex.: `supabase login` se a sessão expirou).

Não faça commit — apenas sincronize e relate.
