---
description: Commita os arquivos em staged de forma inteligente, agrupando por contexto e seguindo Conventional Commits (mensagens sempre em inglês)
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git commit:*), Bash(git reset:*), Bash(git add:*), Read
---

Crie commits inteligentes a partir do que está **em staged** agora.

## Contexto atual

- Arquivos em staged: !`git diff --cached --name-status`
- Diff completo do staged: !`git diff --cached`
- Estilo dos commits recentes (para manter o tom): !`git log --oneline -15`

## O que fazer

1. **Só considere o que já está em staged.** Não rode `git add` em arquivos que o usuário não preparou. Se nada estiver em staged, avise e pare.

2. **Agrupe por contexto.** Analise o diff e separe as mudanças em grupos coesos por finalidade (ex.: uma feature nova, um bugfix, um ajuste de build). Cada grupo vira **um commit**.
   - Se todos os arquivos pertencem ao mesmo contexto, faça **um único commit**.
   - Se há contextos distintos (ex.: uma `feat` + um `chore` de config não relacionado), faça **commits separados**. Para isso, use `git reset HEAD <arquivos>` para tirar do staged o que não entra no commit atual, commite o restante, e repita o ciclo re-adicionando o próximo grupo com `git add`. No fim, deixe staged apenas o que já foi commitado (nada sobrando).

3. **Escreva a mensagem sempre em inglês**, no formato Conventional Commits:

   ```
   <tipo>(<escopo opcional>): <descrição imperativa e concisa>
   ```

   - Assunto em letra minúscula, modo imperativo ("add", "fix", "update"), sem ponto final, idealmente ≤ 72 caracteres.
   - Adicione corpo (após linha em branco) só quando o "porquê" não for óbvio pelo assunto.

4. **Escolha o `tipo` pela natureza da mudança:**

   | tipo       | quando usar                                                                    | SemVer |
   | ---------- | ------------------------------------------------------------------------------ | ------ |
   | `fix`      | corrige um bug                                                                 | PATCH  |
   | `feat`     | adiciona um novo recurso                                                       | MINOR  |
   | `docs`     | só documentação (ex.: README), sem mudança de código                           | —      |
   | `style`    | formatação, semicolons, lint, espaços — sem mudança de lógica                  | —      |
   | `refactor` | refatoração que mantém a funcionalidade (inclui melhoria de performance)       | —      |
   | `build`    | arquivos de build e dependências (package.json, lockfile, etc.)                | —      |
   | `test`     | criação/alteração/remoção de testes, sem mudança de código de produção         | —      |
   | `chore`    | tarefas de build, config de admin, pacotes, .gitignore — sem mudança de código | —      |

   Na dúvida entre `feat` e `fix`: se introduz comportamento novo → `feat`; se conserta algo que estava errado → `fix`.

5. **Antes de commitar**, mostre ao usuário o plano: quantos commits, quais arquivos em cada um e a mensagem proposta de cada um. Então execute os `git commit`.

6. **Depois**, rode `git log --oneline -<n>` (n = número de commits criados) e mostre o resultado.

$ARGUMENTS
