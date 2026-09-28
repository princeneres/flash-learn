import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callTool } from '../client.js';
import { addCardsSchema, createDeckSchema, listDecksSchema } from '../schemas.js';

export function registerDeckTools(server: McpServer): void {
  server.tool(
    'create_deck',
    'Cria um novo deck de flashcards para o usuário autenticado. Respeita o limite de decks do plano. Pode opcionalmente criar cards iniciais.',
    createDeckSchema,
    async (args) => {
      const { id, cardsInserted } = await callTool<{ id: string; cardsInserted: number }>(
        'create_deck',
        args,
      );
      return {
        content: [
          {
            type: 'text',
            text: `Deck criado: "${args.title}" (id ${id})${
              cardsInserted > 0 ? ` com ${cardsInserted} card(s)` : ''
            }.`,
          },
        ],
      };
    },
  );

  server.tool(
    'add_cards',
    'Adiciona cards a um deck existente do usuário. Respeita os limites de cards por deck e totais do plano.',
    addCardsSchema,
    async (args) => {
      const { inserted } = await callTool<{ inserted: number }>('add_cards', args);
      return {
        content: [
          { type: 'text', text: `${inserted} card(s) adicionado(s) ao deck ${args.deckId}.` },
        ],
      };
    },
  );

  server.tool(
    'list_decks',
    'Lista os decks do usuário, com id, título e contagem de cards.',
    listDecksSchema,
    async (args) => {
      const data = await callTool<unknown[]>('list_decks', args);
      return {
        content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }],
      };
    },
  );
}
