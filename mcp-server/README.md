# Flash Learn MCP Server

An [MCP](https://modelcontextprotocol.io) server for creating Flash Learn **decks**, **collections** and
**quizzes** in conversation, from Claude or any other MCP client.

## How permissions work

The server signs in **as you**, using the public anon key plus your session token. It never uses the
service-role key, so every rule the database already enforces applies automatically:

- **Ownership and visibility.** Row Level Security lets you create and read only your own content, plus public
  content.
- **Plan limits.** The `enforce_deck_quota` and `enforce_card_quota` triggers apply the plan's deck and card
  limits. When a limit is reached, the tool returns a clear error message.
- **No impersonation.** `owner_id` always comes from the session and is never accepted as a parameter.

Creating content through MCP is ordinary CRUD, exactly like the UI.

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
email, Google or GitHub), the page hands the session back to the command, which stores it in
`~/.flash-learn-mcp/session.json`. The server reads that file and refreshes the access token on its own, so you
only sign in once.

> If you are not signed in to the app in the browser, the page asks you to sign in first. Then reopen the link
> printed in the terminal.

## Client configuration

Environment variables:

| Variable                                          | Required | Description                                                                                                           |
| ------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                    | Yes      | Supabase project URL, same as the app's `VITE_SUPABASE_URL`                                                           |
| `SUPABASE_ANON_KEY`                               | Yes      | Public anon key, same as the app's `VITE_SUPABASE_ANON_KEY`                                                           |
| `FLASH_LEARN_APP_URL`                             | No       | App URL used by `login`. Defaults to `https://flashlearn.princeneres.dev`; override it for a local or self-hosted app |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_REFRESH_TOKEN` | No       | Fallback for CI or development. When set, they take precedence over the saved `login` session                         |

### Example: Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "flash-learn": {
      "command": "node",
      "args": ["/path/to/flash-learn/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project-ref.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
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
