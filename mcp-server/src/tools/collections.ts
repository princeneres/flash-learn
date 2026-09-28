import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callTool } from '../client.js';
import {
  addDeckToCollectionSchema,
  createCollectionSchema,
  listCollectionsSchema,
} from '../schemas.js';

export function registerCollectionTools(server: McpServer): void {
  server.tool(
    'create_collection',
    'Cria uma nova collection (agrupador de decks e quizzes) para o usuário autenticado.',
    createCollectionSchema,
    async (args) => {
      const { id } = await callTool<{ id: string }>('create_collection', args);
      return {
        content: [{ type: 'text', text: `Collection criada: "${args.title}" (id ${id}).` }],
      };
    },
  );

  server.tool(
    'add_deck_to_collection',
    'Adiciona um deck a uma collection. Ambos devem pertencer a você.',
    addDeckToCollectionSchema,
    async (args) => {
      await callTool('add_deck_to_collection', args);
      return {
        content: [
          {
            type: 'text',
            text: `Deck ${args.deckId} adicionado à collection ${args.collectionId}.`,
          },
        ],
      };
    },
  );

  server.tool(
    'list_collections',
    'Lista as collections do usuário, com id, título e contagem de decks.',
    listCollectionsSchema,
    async (args) => {
      const data = await callTool<unknown[]>('list_collections', args);
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] };
    },
  );
}
