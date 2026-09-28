import { callApi } from '../lib/api';

export type SuggestionCategory = 'feature' | 'improvement' | 'bug' | 'other';

export interface SuggestionInput {
  message: string;
  category: SuggestionCategory;
}

export const FeatureSuggestionService = {
  /**
   * Submits a feature suggestion. The server function derives the user's
   * identity and enrichment data (plan, points, streak…) from the JWT —
   * the client only sends the message and category.
   */
  submit: async ({ message, category }: SuggestionInput): Promise<void> => {
    await callApi('feature-suggestion', { message: message.trim(), category });
  },
};
