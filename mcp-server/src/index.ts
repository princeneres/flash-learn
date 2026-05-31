#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerDeckTools } from './tools/decks.js';
import { registerCollectionTools } from './tools/collections.js';
import { registerQuizTools } from './tools/quizzes.js';

const server = new McpServer({
  name: 'flash-learn-mcp',
  version: '0.1.0',
});

registerDeckTools(server);
registerCollectionTools(server);
registerQuizTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs go to stderr so they don't corrupt the stdio JSON-RPC channel.
  console.error('flash-learn-mcp server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error starting flash-learn-mcp:', err);
  process.exit(1);
});
