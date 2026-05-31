# Flash-Learn MCP Server

Servidor [MCP](https://modelcontextprotocol.io) que permite criar **decks**, **collections** e **quizzes** do Flash-Learn conversacionalmente (via Claude ou qualquer cliente MCP).

## Como as validações funcionam

O servidor se autentica **como o usuário** usando a `anon key` pública + o **access token (JWT)** dele — nunca a service role key. Por isso, **todas as regras já existentes são herdadas automaticamente do banco**:

- **Ownership / visibilidade**: Row Level Security garante que você só cria/lê o que é seu (ou público).
- **Limites de plano**: os triggers `enforce_deck_quota` e `enforce_card_quota` aplicam os limites de free/Pro (ex.: free = 10 decks, 100 cards/deck, 1000 cards totais). Ao estourar, o erro vira uma mensagem clara.
- `owner_id` é sempre derivado da sessão, nunca aceito como parâmetro — não há como criar conteúdo em nome de outro usuário.

Criar conteúdo via MCP é CRUD normal (igual à UI): **não consome créditos de IA**.

## Tools disponíveis

| Tool                     | Descrição                                       |
| ------------------------ | ----------------------------------------------- |
| `create_deck`            | Cria um deck (opcionalmente com cards iniciais) |
| `add_cards`              | Adiciona cards a um deck existente              |
| `list_decks`             | Lista seus decks                                |
| `create_collection`      | Cria uma collection                             |
| `add_deck_to_collection` | Vincula um deck a uma collection                |
| `list_collections`       | Lista suas collections                          |
| `create_quiz`            | Cria um quiz dentro de uma collection           |
| `add_quiz_questions`     | Adiciona perguntas a um quiz                    |

## Build

```bash
cd mcp-server
npm install
npm run build
```

## Login (sem copiar token)

O usuário **não precisa copiar nenhum token**. Basta rodar:

```bash
npx flash-learn-mcp login
# (em dev local: node dist/index.js login)
```

Isso abre o navegador na página `/connect-mcp` do app. Como o usuário já está logado no Flash-Learn (inclusive via Google/GitHub), a página entrega a sessão de volta ao comando, que a salva em `~/.flash-learn-mcp/session.json`. O servidor MCP lê esse arquivo e **renova o access token automaticamente** — login é feito uma vez só.

> Pré-requisito: estar logado no app no navegador. Se não estiver, a página pede login e você reabre o link mostrado no terminal.

## Configuração no cliente MCP

Variáveis de ambiente necessárias:

- `SUPABASE_URL` — URL do projeto (mesma do app, `VITE_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` — anon key pública (mesma do `VITE_SUPABASE_ANON_KEY`)
- `FLASH_LEARN_APP_URL` — URL do app para o login (ex.: `https://app.flash-learn.com`; default `http://localhost:5173`)

Opcionais (fallback para CI/devs; têm prioridade sobre o `login` se definidos):

- `SUPABASE_ACCESS_TOKEN` / `SUPABASE_REFRESH_TOKEN`

### Exemplo — Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "flash-learn": {
      "command": "node",
      "args": ["/caminho/para/flash-learn/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://xxxx.supabase.co",
        "SUPABASE_ANON_KEY": "ey...",
        "FLASH_LEARN_APP_URL": "https://app.flash-learn.com"
      }
    }
  }
}
```

Depois de registrar o servidor, rode `npx flash-learn-mcp login` uma vez para conectar a conta.

## Teste local

```bash
npm run inspect   # abre o MCP Inspector
```
