import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { callTool } from '../client.js';
import { addQuizQuestionsSchema, createQuizSchema } from '../schemas.js';

export function registerQuizTools(server: McpServer): void {
  server.tool(
    'create_quiz',
    'Cria um quiz dentro de uma collection do usuário. A collection deve pertencer a você.',
    createQuizSchema,
    async (args) => {
      const { id } = await callTool<{ id: string }>('create_quiz', args);
      return {
        content: [{ type: 'text', text: `Quiz criado: "${args.title}" (id ${id}).` }],
      };
    },
  );

  server.tool(
    'add_quiz_questions',
    'Adiciona perguntas a um quiz existente do usuário. Cada pergunta precisa de ao menos 2 opções e uma correta.',
    addQuizQuestionsSchema,
    async (args) => {
      const { inserted } = await callTool<{ inserted: number }>('add_quiz_questions', args);
      return {
        content: [
          {
            type: 'text',
            text: `${inserted} pergunta(s) adicionada(s) ao quiz ${args.quizId}.`,
          },
        ],
      };
    },
  );
}
