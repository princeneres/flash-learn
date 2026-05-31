import { supabase } from '../lib/supabase';

export type SuggestionCategory = 'feature' | 'improvement' | 'bug' | 'other';

export interface SuggestionInput {
  message: string;
  category: SuggestionCategory;
}

export const FeatureSuggestionService = {
  /**
   * Submits a feature suggestion. The edge function derives the user's
   * identity and enrichment data (plan, points, streak…) from the JWT —
   * the client only sends the message and category.
   */
  submit: async ({ message, category }: SuggestionInput): Promise<void> => {
    const { error } = await supabase.functions.invoke('feature-suggestion', {
      body: { message: message.trim(), category },
    });
    if (error) throw error;
  },
};
