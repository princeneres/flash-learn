export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          id: string
          key: string
          owner_id: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          key: string
          owner_id: string
          unlocked_at?: string
        }
        Update: {
          id?: string
          key?: string
          owner_id?: string
          unlocked_at?: string
        }
        Relationships: []
      }
      ai_credit_ledger: {
        Row: {
          abacate_id: string | null
          created_at: string
          delta: number
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          abacate_id?: string | null
          created_at?: string
          delta: number
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          abacate_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_credit_orders: {
        Row: {
          abacate_id: string | null
          amount_cents: number
          created_at: string
          credits: number
          id: string
          pack_id: string
          status: string
          user_id: string
        }
        Insert: {
          abacate_id?: string | null
          amount_cents: number
          created_at?: string
          credits: number
          id?: string
          pack_id: string
          status?: string
          user_id: string
        }
        Update: {
          abacate_id?: string | null
          amount_cents?: number
          created_at?: string
          credits?: number
          id?: string
          pack_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_credits: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_media: {
        Row: {
          card_id: string
          kind: string
          owner_id: string
          ref: string
        }
        Insert: {
          card_id: string
          kind: string
          owner_id: string
          ref: string
        }
        Update: {
          card_id?: string
          kind?: string
          owner_id?: string
          ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_media_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          back: string
          back_audio: string | null
          created_at: string
          deck_id: string
          ease_factor: number
          front: string
          front_audio: string | null
          id: string
          interval: number
          next_review: string
          owner_id: string
          repetitions: number
          status: string
          tags: string[]
        }
        Insert: {
          back: string
          back_audio?: string | null
          created_at?: string
          deck_id: string
          ease_factor?: number
          front: string
          front_audio?: string | null
          id?: string
          interval?: number
          next_review?: string
          owner_id: string
          repetitions?: number
          status?: string
          tags?: string[]
        }
        Update: {
          back?: string
          back_audio?: string | null
          created_at?: string
          deck_id?: string
          ease_factor?: number
          front?: string
          front_audio?: string | null
          id?: string
          interval?: number
          next_review?: string
          owner_id?: string
          repetitions?: number
          status?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          category: string | null
          cover_color: string | null
          created_at: string
          deck_count: number
          description: string | null
          id: string
          is_public: boolean
          owner_id: string
          owner_name: string | null
          tags: string[]
          title: string
        }
        Insert: {
          category?: string | null
          cover_color?: string | null
          created_at?: string
          deck_count?: number
          description?: string | null
          id?: string
          is_public?: boolean
          owner_id: string
          owner_name?: string | null
          tags?: string[]
          title: string
        }
        Update: {
          category?: string | null
          cover_color?: string | null
          created_at?: string
          deck_count?: number
          description?: string | null
          id?: string
          is_public?: boolean
          owner_id?: string
          owner_name?: string | null
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
      deck_collections: {
        Row: {
          collection_id: string
          created_at: string
          deck_id: string
          order_index: number
          owner_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          deck_id: string
          order_index?: number
          owner_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          deck_id?: string
          order_index?: number
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_collections_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_favorites: {
        Row: {
          created_at: string
          deck_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_favorites_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          card_count: number
          category: string | null
          created_at: string
          id: string
          is_public: boolean
          owner_id: string
          srs_settings: Json
          tags: string[]
          title: string
        }
        Insert: {
          card_count?: number
          category?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          owner_id: string
          srs_settings?: Json
          tags?: string[]
          title: string
        }
        Update: {
          card_count?: number
          category?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          owner_id?: string
          srs_settings?: Json
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
      feature_suggestions: {
        Row: {
          category: string
          context: Json
          created_at: string
          id: string
          message: string
          status: string
          user_id: string
        }
        Insert: {
          category?: string
          context?: Json
          created_at?: string
          id?: string
          message: string
          status?: string
          user_id: string
        }
        Update: {
          category?: string
          context?: Json
          created_at?: string
          id?: string
          message?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          max_cards_per_deck: number
          max_decks: number
          max_media_bytes: number
          max_total_cards: number
          name: string
        }
        Insert: {
          created_at?: string
          features?: Json
          id: string
          max_cards_per_deck: number
          max_decks: number
          max_media_bytes: number
          max_total_cards: number
          name: string
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          max_cards_per_deck?: number
          max_decks?: number
          max_media_bytes?: number
          max_total_cards?: number
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          language: string
          last_study_date: string | null
          photo_url: string | null
          points: number
          provider: string | null
          sound_enabled: boolean
          streak: number
          total_reviews: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          language?: string
          last_study_date?: string | null
          photo_url?: string | null
          points?: number
          provider?: string | null
          sound_enabled?: boolean
          streak?: number
          total_reviews?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          language?: string
          last_study_date?: string | null
          photo_url?: string | null
          points?: number
          provider?: string | null
          sound_enabled?: boolean
          streak?: number
          total_reviews?: number
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          collection_id: string | null
          completed_at: string
          id: string
          owner_id: string
          quiz_id: string | null
          score: number
          total: number
        }
        Insert: {
          answers?: Json
          collection_id?: string | null
          completed_at?: string
          id?: string
          owner_id: string
          quiz_id?: string | null
          score?: number
          total?: number
        }
        Update: {
          answers?: Json
          collection_id?: string | null
          completed_at?: string
          id?: string
          owner_id?: string
          quiz_id?: string | null
          score?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          kind: string
          options: Json
          order_index: number
          owner_id: string
          prompt: string
          quiz_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          kind?: string
          options?: Json
          order_index?: number
          owner_id: string
          prompt: string
          quiz_id: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          kind?: string
          options?: Json
          order_index?: number
          owner_id?: string
          prompt?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          collection_id: string
          created_at: string
          description: string | null
          id: string
          order_index: number
          owner_id: string
          pass_threshold: number | null
          question_count: number
          title: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          owner_id: string
          pass_threshold?: number | null
          question_count?: number
          title: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          owner_id?: string
          pass_threshold?: number | null
          question_count?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      review_logs: {
        Row: {
          card_id: string | null
          deck_category: string | null
          deck_id: string | null
          id: string
          owner_id: string
          prev_status: string | null
          quality: number
          reviewed_at: string
          was_correct: boolean
        }
        Insert: {
          card_id?: string | null
          deck_category?: string | null
          deck_id?: string | null
          id?: string
          owner_id: string
          prev_status?: string | null
          quality: number
          reviewed_at?: string
          was_correct: boolean
        }
        Update: {
          card_id?: string | null
          deck_category?: string | null
          deck_id?: string | null
          id?: string
          owner_id?: string
          prev_status?: string | null
          quality?: number
          reviewed_at?: string
          was_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_logs_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          version: string
        }
        Insert: {
          applied_at?: string
          version: string
        }
        Update: {
          applied_at?: string
          version?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          abacate_subscription_id: string | null
          created_at: string
          current_period_end: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abacate_subscription_id?: string | null
          created_at?: string
          current_period_end?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abacate_subscription_id?: string | null
          created_at?: string
          current_period_end?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          activated_at: string
          expires_at: string | null
          plan_id: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          expires_at?: string | null
          plan_id: string
          user_id: string
        }
        Update: {
          activated_at?: string
          expires_at?: string | null
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_subscription: {
        Args: {
          p_abacate_id: string
          p_period_end: string
          p_plan: string
          p_status: string
          p_user: string
        }
        Returns: undefined
      }
      cancel_subscription: { Args: { p_user: string }; Returns: undefined }
      credit_ai: {
        Args: {
          p_abacate_id?: string
          p_amount: number
          p_reason: string
          p_user: string
        }
        Returns: number
      }
      debit_ai_credit: { Args: { p_user: string }; Returns: number }
      get_ai_credits: { Args: never; Returns: number }
      get_collection_decks: {
        Args: { p_collection_id: string }
        Returns: {
          card_count: number
          category: string
          created_at: string
          id: string
          is_public: boolean
          order_index: number
          owner_id: string
          owner_name: string
          srs_settings: Json
          tags: string[]
          title: string
        }[]
      }
      get_collection_detail: {
        Args: { p_collection_id: string }
        Returns: {
          category: string
          cover_color: string
          created_at: string
          deck_count: number
          description: string
          id: string
          is_public: boolean
          owner_id: string
          owner_name: string
          tags: string[]
          title: string
        }[]
      }
      get_collection_quizzes: {
        Args: { p_collection_id: string }
        Returns: {
          collection_id: string
          created_at: string
          description: string
          id: string
          order_index: number
          owner_id: string
          pass_threshold: number
          question_count: number
          title: string
        }[]
      }
      get_deck_detail: {
        Args: { p_deck_id: string }
        Returns: {
          card_count: number
          category: string
          created_at: string
          id: string
          is_public: boolean
          owner_id: string
          owner_name: string
          srs_settings: Json
          tags: string[]
          title: string
        }[]
      }
      get_favorite_decks: {
        Args: never
        Returns: {
          card_count: number
          category: string
          created_at: string
          id: string
          is_public: boolean
          owner_id: string
          owner_name: string
          tags: string[]
          title: string
        }[]
      }
      get_leaderboard: {
        Args: never
        Returns: {
          display_name: string
          id: string
          photo_url: string
          points: number
          streak: number
          total_reviews: number
        }[]
      }
      get_my_limits: { Args: never; Returns: Json }
      get_public_collections: {
        Args: never
        Returns: {
          category: string
          cover_color: string
          created_at: string
          deck_count: number
          description: string
          id: string
          is_public: boolean
          owner_id: string
          owner_name: string
          tags: string[]
          title: string
        }[]
      }
      get_public_decks: {
        Args: never
        Returns: {
          card_count: number
          category: string
          created_at: string
          id: string
          is_public: boolean
          owner_id: string
          owner_name: string
          srs_settings: Json
          tags: string[]
          title: string
        }[]
      }
      get_user_plan: {
        Args: { uid: string }
        Returns: {
          created_at: string
          features: Json
          id: string
          max_cards_per_deck: number
          max_decks: number
          max_media_bytes: number
          max_total_cards: number
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_review: {
        Args: { p_card_id: string; p_quality: number }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
