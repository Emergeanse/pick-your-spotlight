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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cinematic_profiles: {
        Row: {
          distinctions: Json
          dna_archetype: string | null
          evolution_note: string | null
          generated_at: string
          global_level: string
          id: string
          narrative: string
          personality_title: string
          representative_films: string[]
          social_reputation: Json
          specializations: Json
          taste_signatures: Json
          taste_traits: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          distinctions?: Json
          dna_archetype?: string | null
          evolution_note?: string | null
          generated_at?: string
          global_level?: string
          id?: string
          narrative?: string
          personality_title?: string
          representative_films?: string[]
          social_reputation?: Json
          specializations?: Json
          taste_signatures?: Json
          taste_traits?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          distinctions?: Json
          dna_archetype?: string | null
          evolution_note?: string | null
          generated_at?: string
          global_level?: string
          id?: string
          narrative?: string
          personality_title?: string
          representative_films?: string[]
          social_reputation?: Json
          specializations?: Json
          taste_signatures?: Json
          taste_traits?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_usage: {
        Row: {
          chat_count: number
          companion_questions: Json
          created_at: string
          id: string
          recommendation_count: number
          usage_date: string
          user_id: string
        }
        Insert: {
          chat_count?: number
          companion_questions?: Json
          created_at?: string
          id?: string
          recommendation_count?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          chat_count?: number
          companion_questions?: Json
          created_at?: string
          id?: string
          recommendation_count?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      group_session_members: {
        Row: {
          guest_name: string | null
          id: string
          joined_at: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          guest_name?: string | null
          id?: string
          joined_at?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          guest_name?: string | null
          id?: string
          joined_at?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_sessions: {
        Row: {
          context: string | null
          created_at: string
          creator_id: string
          id: string
          invite_code: string | null
          mood: string | null
          name: string
          time_available: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          creator_id: string
          id?: string
          invite_code?: string | null
          mood?: string | null
          name?: string
          time_available?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          invite_code?: string | null
          mood?: string | null
          name?: string
          time_available?: string | null
        }
        Relationships: []
      }
      liked_movies: {
        Row: {
          genres: string[] | null
          id: string
          liked_at: string
          poster_path: string | null
          rating: number | null
          title: string
          tmdb_id: number
          user_id: string
        }
        Insert: {
          genres?: string[] | null
          id?: string
          liked_at?: string
          poster_path?: string | null
          rating?: number | null
          title: string
          tmdb_id: number
          user_id: string
        }
        Update: {
          genres?: string[] | null
          id?: string
          liked_at?: string
          poster_path?: string | null
          rating?: number | null
          title?: string
          tmdb_id?: number
          user_id?: string
        }
        Relationships: []
      }
      movie_embeddings: {
        Row: {
          created_at: string
          embedding: string
          genres: string[] | null
          id: string
          taste_tags: string[]
          title: string
          tmdb_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          embedding: string
          genres?: string[] | null
          id?: string
          taste_tags?: string[]
          title: string
          tmdb_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          embedding?: string
          genres?: string[] | null
          id?: string
          taste_tags?: string[]
          title?: string
          tmdb_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_recommendations: number
          avatar_url: string | null
          best_streak: number
          created_at: string
          display_name: string | null
          excluded_genres: string[] | null
          excluded_platforms: number[] | null
          favorite_genres: string[] | null
          first_use_date: string | null
          friend_code: string
          hook_messages_seen: string[]
          id: string
          last_recommendation_date: string | null
          media_preference: string
          min_rating: number | null
          onboarding_completed: boolean
          preferred_platforms: number[] | null
          profile_confidence: number
          ritual_enabled: boolean
          ritual_time: string | null
          streak_count: number
          total_recommendations: number
          updated_at: string
        }
        Insert: {
          accepted_recommendations?: number
          avatar_url?: string | null
          best_streak?: number
          created_at?: string
          display_name?: string | null
          excluded_genres?: string[] | null
          excluded_platforms?: number[] | null
          favorite_genres?: string[] | null
          first_use_date?: string | null
          friend_code?: string
          hook_messages_seen?: string[]
          id: string
          last_recommendation_date?: string | null
          media_preference?: string
          min_rating?: number | null
          onboarding_completed?: boolean
          preferred_platforms?: number[] | null
          profile_confidence?: number
          ritual_enabled?: boolean
          ritual_time?: string | null
          streak_count?: number
          total_recommendations?: number
          updated_at?: string
        }
        Update: {
          accepted_recommendations?: number
          avatar_url?: string | null
          best_streak?: number
          created_at?: string
          display_name?: string | null
          excluded_genres?: string[] | null
          excluded_platforms?: number[] | null
          favorite_genres?: string[] | null
          first_use_date?: string | null
          friend_code?: string
          hook_messages_seen?: string[]
          id?: string
          last_recommendation_date?: string | null
          media_preference?: string
          min_rating?: number | null
          onboarding_completed?: boolean
          preferred_platforms?: number[] | null
          profile_confidence?: number
          ritual_enabled?: boolean
          ritual_time?: string | null
          streak_count?: number
          total_recommendations?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_interactions: {
        Row: {
          action_type: string
          context: Json | null
          created_at: string
          id: string
          tmdb_id: number
          user_id: string
        }
        Insert: {
          action_type: string
          context?: Json | null
          created_at?: string
          id?: string
          tmdb_id: number
          user_id: string
        }
        Update: {
          action_type?: string
          context?: Json | null
          created_at?: string
          id?: string
          tmdb_id?: number
          user_id?: string
        }
        Relationships: []
      }
      user_taste_vectors: {
        Row: {
          id: string
          liked_count: number
          taste_vector: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          liked_count?: number
          taste_vector: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          liked_count?: number
          taste_vector?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_at: string
          genres: string[] | null
          id: string
          media_type: string
          poster_path: string | null
          runtime: number | null
          title: string
          tmdb_id: number
          user_id: string
        }
        Insert: {
          added_at?: string
          genres?: string[] | null
          id?: string
          media_type?: string
          poster_path?: string | null
          runtime?: number | null
          title: string
          tmdb_id: number
          user_id: string
        }
        Update: {
          added_at?: string
          genres?: string[] | null
          id?: string
          media_type?: string
          poster_path?: string | null
          runtime?: number | null
          title?: string
          tmdb_id?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_friend_code: { Args: never; Returns: string }
      generate_session_code: { Args: never; Returns: string }
      is_session_member: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      match_movies_by_taste: {
        Args: {
          exclude_ids?: number[]
          match_count?: number
          query_vector: string
        }
        Returns: {
          similarity: number
          taste_tags: string[]
          title: string
          tmdb_id: number
        }[]
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
