import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserClient } from '../supabase.js';
import { rethrowFriendly } from '../planErrors.js';
import { addQuizQuestionsSchema, createQuizSchema } from '../schemas.js';

export function registerQuizTools(server: McpServer): void {
  server.tool(
    'create_quiz',
    'Cria um quiz dentro de uma collection do usuário. A collection deve pertencer a você (validado por RLS).',
    createQuizSchema,
    async (args) => {
      const { client, userId } = await getUserClient();
      const { data, error } = await client
        .from('quizzes')
        .insert({
          owner_id: userId,
          collection_id: args.collectionId,
          title: args.title,
          description: args.description ?? null,
          pass_threshold: args.passThreshold ?? null,
          order_index: args.orderIndex ?? 0,
        })
        .select('id')
        .single();
      if (error) rethrowFriendly(error);
      return {
        content: [{ type: 'text', text: `Quiz criado: "${args.title}" (id ${data!.id}).` }],
      };
    },
  );

  server.tool(
    'add_quiz_questions',
    'Adiciona perguntas a um quiz existente do usuário. Cada pergunta precisa de ao menos 2 opções e uma correta.',
    addQuizQuestionsSchema,
    async (args) => {
      const { client, userId } = await getUserClient();
      const rows = args.questions.map((q, i) => ({
        quiz_id: args.quizId,
        owner_id: userId,
        prompt: q.prompt,
        kind: q.kind,
        // Match the app's shape: options are { id, text, correct }.
        options: q.options.map((o) => ({ id: randomUUID(), text: o.text, correct: o.correct })),
        explanation: q.explanation ?? null,
        order_index: i,
      }));
      const { error } = await client.from('quiz_questions').insert(rows);
      if (error) rethrowFriendly(error);
      return {
        content: [
          {
            type: 'text',
            text: `${rows.length} pergunta(s) adicionada(s) ao quiz ${args.quizId}.`,
          },
        ],
      };
    },
  );
}
