#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerDeckTools } from './tools/decks.js';
import { registerCollectionTools } from './tools/collections.js';
import { registerQuizTools } from './tools/quizzes.js';
import { runLogin } from './login.js';

async function startServer(): Promise<void> {
  const server = new McpServer({
    name: 'flash-learn-mcp',
    version: '0.2.0',
  });

  registerDeckTools(server);
  registerCollectionTools(server);
  registerQuizTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs go to stderr so they don't corrupt the stdio JSON-RPC channel.
  console.error('flash-learn-mcp server running on stdio');
}

// `flash-learn-mcp login` runs the browser login flow instead of the server.
if (process.argv[2] === 'login') {
  runLogin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Falha no login:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
} else {
  startServer().catch((err) => {
    console.error('Fatal error starting flash-learn-mcp:', err);
    process.exit(1);
  });
}
