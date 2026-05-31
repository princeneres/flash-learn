import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserClient } from '../supabase.js';
import { rethrowFriendly } from '../planErrors.js';
import { addCardsSchema, createDeckSchema, listDecksSchema } from '../schemas.js';

type Card = { front: string; back: string; tags?: string[] };

async function insertCards(deckId: string, ownerId: string, cards: Card[]): Promise<number> {
  if (cards.length === 0) return 0;
  const { client } = await getUserClient();
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < cards.length; i += CHUNK) {
    const slice = cards.slice(i, i + CHUNK);
    const rows = slice.map((c) => ({
      deck_id: deckId,
      owner_id: ownerId,
      front: c.front,
      back: c.back,
      tags: c.tags ?? [],
    }));
    const { error } = await client.from('cards').insert(rows);
    if (error) rethrowFriendly(error);
    inserted += slice.length;
  }
  return inserted;
}

export function registerDeckTools(server: McpServer): void {
  server.tool(
    'create_deck',
    'Cria um novo deck de flashcards para o usuário autenticado. Respeita o limite de decks do plano. Pode opcionalmente criar cards iniciais.',
    createDeckSchema,
    async (args) => {
      const { client, userId } = await getUserClient();
      const { data, error } = await client
        .from('decks')
        .insert({
          owner_id: userId,
          title: args.title,
          category: args.category ?? null,
          tags: args.tags ?? [],
          is_public: args.isPublic ?? false,
        })
        .select('id')
        .single();
      if (error) rethrowFriendly(error);

      const deckId = data!.id as string;
      let cardsInserted = 0;
      if (args.cards && args.cards.length > 0) {
        cardsInserted = await insertCards(deckId, userId, args.cards);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Deck criado: "${args.title}" (id ${deckId})${
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
      const { userId } = await getUserClient();
      const inserted = await insertCards(args.deckId, userId, args.cards);
      return {
        content: [
          { type: 'text', text: `${inserted} card(s) adicionado(s) ao deck ${args.deckId}.` },
        ],
      };
    },
  );

  server.tool(
    'list_decks',
    'Lista os decks do usuário (e públicos visíveis), com id, título e contagem de cards.',
    listDecksSchema,
    async (args) => {
      const { client } = await getUserClient();
      const { data, error } = await client
        .from('decks')
        .select('id, title, category, is_public, card_count, created_at')
        .order('created_at', { ascending: false })
        .limit(args.limit ?? 50);
      if (error) rethrowFriendly(error);
      return {
        content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }],
      };
    },
  );
}
