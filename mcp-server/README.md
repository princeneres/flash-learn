# Flash Learn MCP Server

An [MCP](https://modelcontextprotocol.io) server for creating Flash Learn **decks**, **collections** and
**quizzes** in conversation, from Claude or any other MCP client.

## How permissions work

The server acts **as you**, with a personal token issued by the app (never a database credential). It calls the
app's `/api/mcp` endpoint, which enforces the same rules as the UI:

- **Ownership.** You can only add cards, decks and quizzes to content you own; lists show only your content.
- **Plan limits.** The `enforce_deck_quota` and `enforce_card_quota` database triggers apply the plan's deck and
  card limits. When a limit is reached, the tool returns a clear error message.
- **No impersonation.** `owner_id` always comes from the token and is never accepted as a parameter.
- **Revocable.** Tokens are stored only as hashes and can be revoked without touching your password.

## Tools

| Tool                     | Description                                  |
| ------------------------ | -------------------------------------------- |
| `create_deck`            | Create a deck, optionally with initial cards |
| `add_cards`              | Add cards to an existing deck                |
| `list_decks`             | List your decks                              |
| `create_collection`      | Create a collection                          |
| `add_deck_to_collection` | Link a deck to a collection                  |
| `list_collections`       | List your collections                        |
| `create_quiz`            | Create a quiz inside a collection            |
| `add_quiz_questions`     | Add questions to a quiz                      |

## Build

```bash
cd mcp-server
npm install
npm run build
```

## Sign in once, no token copying

```bash
node dist/index.js login
```

The command opens the app's `/connect-mcp` page in your browser. Since you are already signed in there (with
email, Google or GitHub), the page issues a personal MCP token and hands it back to the command, which stores it
in `~/.flash-learn-mcp/session.json`. The token does not expire, so you only sign in once.

> If you are not signed in to the app in the browser, the page asks you to sign in first. Then reopen the link
> printed in the terminal.

## Client configuration

Environment variables:

| Variable              | Required | Description                                                                                        |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `FLASH_LEARN_APP_URL` | No       | App URL used by `login` and the tools. Defaults to `https://flashlearn.princeneres.dev`            |
| `FLASH_LEARN_TOKEN`   | No       | Personal token for CI or development. When set, it takes precedence over the saved `login` session |

### Example: Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "flash-learn": {
      "command": "node",
      "args": ["/path/to/flash-learn/mcp-server/dist/index.js"],
      "env": {
        "FLASH_LEARN_APP_URL": "https://flashlearn.princeneres.dev"
      }
    }
  }
}
```

After registering the server, run `node dist/index.js login` once to connect your account.

## Local testing

```bash
npm run inspect   # opens the MCP Inspector
```
