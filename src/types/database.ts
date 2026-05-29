export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
      decks: {
        Row: {
          card_count: number
          category: string | null
          created_at: string
          id: string
          is_public: boolean
          owner_id: string
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
          tags?: string[]
          title?: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
