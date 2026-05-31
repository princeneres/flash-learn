import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserClient } from '../supabase.js';
import { rethrowFriendly } from '../planErrors.js';
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
      const { client, userId } = await getUserClient();
      const { data, error } = await client
        .from('collections')
        .insert({
          owner_id: userId,
          title: args.title,
          description: args.description ?? null,
          category: args.category ?? null,
          tags: args.tags ?? [],
          is_public: args.isPublic ?? false,
          cover_color: args.coverColor ?? null,
        })
        .select('id')
        .single();
      if (error) rethrowFriendly(error);
      return {
        content: [{ type: 'text', text: `Collection criada: "${args.title}" (id ${data!.id}).` }],
      };
    },
  );

  server.tool(
    'add_deck_to_collection',
    'Adiciona um deck a uma collection. Ambos devem pertencer a você (validado por RLS).',
    addDeckToCollectionSchema,
    async (args) => {
      const { client, userId } = await getUserClient();
      const { error } = await client.from('deck_collections').upsert(
        {
          collection_id: args.collectionId,
          deck_id: args.deckId,
          owner_id: userId,
          order_index: args.orderIndex ?? 0,
        },
        { onConflict: 'collection_id,deck_id' },
      );
      if (error) rethrowFriendly(error);
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
    'Lista as collections do usuário (e públicas visíveis), com id, título e contagem de decks.',
    listCollectionsSchema,
    async (args) => {
      const { client } = await getUserClient();
      const { data, error } = await client
        .from('collections')
        .select('id, title, description, is_public, deck_count, created_at')
        .order('created_at', { ascending: false })
        .limit(args.limit ?? 50);
      if (error) rethrowFriendly(error);
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] };
    },
  );
}
