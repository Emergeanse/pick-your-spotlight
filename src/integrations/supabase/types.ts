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
      catalog_item_relations: {
        Row: {
          character_name: string | null
          created_at: string
          display_order: number | null
          id: string
          item_id: string
          person_item_id: string
          relation_type: string
        }
        Insert: {
          character_name?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          item_id: string
          person_item_id: string
          relation_type: string
        }
        Update: {
          character_name?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          item_id?: string
          person_item_id?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_relations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_relations_person_item_id_fkey"
            columns: ["person_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_item_tags: {
        Row: {
          created_at: string
          id: string
          item_id: string
          tag_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          tag_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          tag_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "preference_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          created_at: string
          id: string
          media_type: string
          overview: string | null
          popularity: number | null
          poster_path: string | null
          runtime: number | null
          title: string
          tmdb_id: number
          updated_at: string
          vote_average: number | null
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_type?: string
          overview?: string | null
          popularity?: number | null
          poster_path?: string | null
          runtime?: number | null
          title: string
          tmdb_id: number
          updated_at?: string
          vote_average?: number | null
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          overview?: string | null
          popularity?: number | null
          poster_path?: string | null
          runtime?: number | null
          title?: string
          tmdb_id?: number
          updated_at?: string
          vote_average?: number | null
          year?: number | null
        }
        Relationships: []
      }
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
      duo_taste_profiles: {
        Row: {
          affinity_score: number | null
          avoidance_vector: string | null
          common_genres: string[] | null
          created_at: string | null
          created_by: string
          duo_name: string
          excluded_genres: string[] | null
          id: string
          invite_code: string
          rejected_clusters: string[] | null
          status: string
          taste_vector: string | null
          top_clusters: string[] | null
          updated_at: string | null
          user1_display_name: string | null
          user1_genres: string[] | null
          user1_id: string
          user2_display_name: string | null
          user2_genres: string[] | null
          user2_id: string | null
        }
        Insert: {
          affinity_score?: number | null
          avoidance_vector?: string | null
          common_genres?: string[] | null
          created_at?: string | null
          created_by: string
          duo_name?: string
          excluded_genres?: string[] | null
          id?: string
          invite_code?: string
          rejected_clusters?: string[] | null
          status?: string
          taste_vector?: string | null
          top_clusters?: string[] | null
          updated_at?: string | null
          user1_display_name?: string | null
          user1_genres?: string[] | null
          user1_id: string
          user2_display_name?: string | null
          user2_genres?: string[] | null
          user2_id?: string | null
        }
        Update: {
          affinity_score?: number | null
          avoidance_vector?: string | null
          common_genres?: string[] | null
          created_at?: string | null
          created_by?: string
          duo_name?: string
          excluded_genres?: string[] | null
          id?: string
          invite_code?: string
          rejected_clusters?: string[] | null
          status?: string
          taste_vector?: string | null
          top_clusters?: string[] | null
          updated_at?: string | null
          user1_display_name?: string | null
          user1_genres?: string[] | null
          user1_id?: string
          user2_display_name?: string | null
          user2_genres?: string[] | null
          user2_id?: string | null
        }
        Relationships: []
      }
      engine_metrics: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          metric_date: string
          metric_type: string
          metric_value: number
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          metric_date?: string
          metric_type: string
          metric_value?: number
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          metric_date?: string
          metric_type?: string
          metric_value?: number
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          created_at: string | null
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_token: string | null
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_recommendations: {
        Row: {
          catalog_item_id: string
          created_at: string | null
          event_id: string
          id: string
          position: number | null
        }
        Insert: {
          catalog_item_id: string
          created_at?: string | null
          event_id: string
          id?: string
          position?: number | null
        }
        Update: {
          catalog_item_id?: string
          created_at?: string | null
          event_id?: string
          id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_recommendations_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_recommendations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_votes: {
        Row: {
          created_at: string | null
          event_id: string
          guest_token: string | null
          id: string
          recommendation_id: string
          voter_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          guest_token?: string | null
          id?: string
          recommendation_id: string
          voter_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          guest_token?: string | null
          id?: string
          recommendation_id?: string
          voter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_votes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "event_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          context: string | null
          created_at: string | null
          event_date: string
          event_time: string | null
          final_pick_id: string | null
          id: string
          invite_link_token: string
          is_remote: boolean | null
          location: string | null
          organizer_id: string
          reveal_mode: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          event_date: string
          event_time?: string | null
          final_pick_id?: string | null
          id?: string
          invite_link_token?: string
          is_remote?: boolean | null
          location?: string | null
          organizer_id: string
          reveal_mode?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string | null
          event_date?: string
          event_time?: string | null
          final_pick_id?: string | null
          id?: string
          invite_link_token?: string
          is_remote?: boolean | null
          location?: string | null
          organizer_id?: string
          reveal_mode?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_final_pick_id_fkey"
            columns: ["final_pick_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          guest_age_range: string | null
          guest_name: string | null
          guest_preferences_json: Json
          guest_profile_text: string | null
          id: string
          joined_at: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          guest_age_range?: string | null
          guest_name?: string | null
          guest_preferences_json?: Json
          guest_profile_text?: string | null
          id?: string
          joined_at?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          guest_age_range?: string | null
          guest_name?: string | null
          guest_preferences_json?: Json
          guest_profile_text?: string | null
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
          context_json: Json
          created_at: string
          creator_id: string
          decision_mode: string
          id: string
          invite_code: string | null
          mood: string | null
          name: string
          scheduled_for: string | null
          selected_catalog_item_id: string | null
          status: string
          time_available: string | null
          title: string | null
        }
        Insert: {
          context?: string | null
          context_json?: Json
          created_at?: string
          creator_id: string
          decision_mode?: string
          id?: string
          invite_code?: string | null
          mood?: string | null
          name?: string
          scheduled_for?: string | null
          selected_catalog_item_id?: string | null
          status?: string
          time_available?: string | null
          title?: string | null
        }
        Update: {
          context?: string | null
          context_json?: Json
          created_at?: string
          creator_id?: string
          decision_mode?: string
          id?: string
          invite_code?: string | null
          mood?: string | null
          name?: string
          scheduled_for?: string | null
          selected_catalog_item_id?: string | null
          status?: string
          time_available?: string | null
          title?: string | null
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
          cluster_labels: string[]
          created_at: string
          embedding: string
          genres: string[] | null
          id: string
          media_type: string
          original_language: string | null
          platform_ids: number[]
          popularity: number | null
          runtime: number | null
          safety_tags: string[]
          semantic_axes: Json
          suitability_tags: string[]
          taste_tags: string[]
          title: string
          tmdb_id: number
          updated_at: string
          vote_average: number | null
          year: number | null
        }
        Insert: {
          cluster_labels?: string[]
          created_at?: string
          embedding: string
          genres?: string[] | null
          id?: string
          media_type?: string
          original_language?: string | null
          platform_ids?: number[]
          popularity?: number | null
          runtime?: number | null
          safety_tags?: string[]
          semantic_axes?: Json
          suitability_tags?: string[]
          taste_tags?: string[]
          title: string
          tmdb_id: number
          updated_at?: string
          vote_average?: number | null
          year?: number | null
        }
        Update: {
          cluster_labels?: string[]
          created_at?: string
          embedding?: string
          genres?: string[] | null
          id?: string
          media_type?: string
          original_language?: string | null
          platform_ids?: number[]
          popularity?: number | null
          runtime?: number | null
          safety_tags?: string[]
          semantic_axes?: Json
          suitability_tags?: string[]
          taste_tags?: string[]
          title?: string
          tmdb_id?: number
          updated_at?: string
          vote_average?: number | null
          year?: number | null
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
      preference_tags: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          label: string
          metadata: Json | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          key: string
          label: string
          metadata?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_recommendations: number
          account_type: string | null
          activation_completed: boolean
          activation_step: string
          avatar_url: string | null
          best_streak: number
          bio: string | null
          birth_year: number | null
          created_at: string
          default_max_duration: number | null
          default_media_type: string
          default_recommendation_count: number
          display_name: string | null
          excluded_genres: string[] | null
          excluded_platforms: number[] | null
          favorite_genres: string[] | null
          first_use_date: string | null
          friend_code: string
          hook_messages_seen: string[]
          id: string
          is_test_account: boolean
          last_recommendation_date: string | null
          match_threshold: number
          media_preference: string
          min_rating: number | null
          onboarding_completed: boolean
          onboarding_skipped: boolean | null
          podium_film_ids: number[] | null
          preferred_platforms: number[] | null
          profile_confidence: number
          ritual_enabled: boolean
          ritual_time: string | null
          streak_count: number
          total_recommendations: number
          tour_completed: boolean
          updated_at: string
        }
        Insert: {
          accepted_recommendations?: number
          account_type?: string | null
          activation_completed?: boolean
          activation_step?: string
          avatar_url?: string | null
          best_streak?: number
          bio?: string | null
          birth_year?: number | null
          created_at?: string
          default_max_duration?: number | null
          default_media_type?: string
          default_recommendation_count?: number
          display_name?: string | null
          excluded_genres?: string[] | null
          excluded_platforms?: number[] | null
          favorite_genres?: string[] | null
          first_use_date?: string | null
          friend_code?: string
          hook_messages_seen?: string[]
          id: string
          is_test_account?: boolean
          last_recommendation_date?: string | null
          match_threshold?: number
          media_preference?: string
          min_rating?: number | null
          onboarding_completed?: boolean
          onboarding_skipped?: boolean | null
          podium_film_ids?: number[] | null
          preferred_platforms?: number[] | null
          profile_confidence?: number
          ritual_enabled?: boolean
          ritual_time?: string | null
          streak_count?: number
          total_recommendations?: number
          tour_completed?: boolean
          updated_at?: string
        }
        Update: {
          accepted_recommendations?: number
          account_type?: string | null
          activation_completed?: boolean
          activation_step?: string
          avatar_url?: string | null
          best_streak?: number
          bio?: string | null
          birth_year?: number | null
          created_at?: string
          default_max_duration?: number | null
          default_media_type?: string
          default_recommendation_count?: number
          display_name?: string | null
          excluded_genres?: string[] | null
          excluded_platforms?: number[] | null
          favorite_genres?: string[] | null
          first_use_date?: string | null
          friend_code?: string
          hook_messages_seen?: string[]
          id?: string
          is_test_account?: boolean
          last_recommendation_date?: string | null
          match_threshold?: number
          media_preference?: string
          min_rating?: number | null
          onboarding_completed?: boolean
          onboarding_skipped?: boolean | null
          podium_film_ids?: number[] | null
          preferred_platforms?: number[] | null
          profile_confidence?: number
          ritual_enabled?: boolean
          ritual_time?: string | null
          streak_count?: number
          total_recommendations?: number
          tour_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      recommendation_events: {
        Row: {
          accepted: boolean | null
          context: Json
          id: string
          rank_position: number
          reaction: string | null
          reaction_at: string | null
          score_breakdown: Json | null
          session_id: string | null
          shown_at: string
          skipped: boolean | null
          source: string
          title: string
          tmdb_id: number
          user_id: string
          watched: boolean | null
        }
        Insert: {
          accepted?: boolean | null
          context?: Json
          id?: string
          rank_position?: number
          reaction?: string | null
          reaction_at?: string | null
          score_breakdown?: Json | null
          session_id?: string | null
          shown_at?: string
          skipped?: boolean | null
          source?: string
          title: string
          tmdb_id: number
          user_id: string
          watched?: boolean | null
        }
        Update: {
          accepted?: boolean | null
          context?: Json
          id?: string
          rank_position?: number
          reaction?: string | null
          reaction_at?: string | null
          score_breakdown?: Json | null
          session_id?: string | null
          shown_at?: string
          skipped?: boolean | null
          source?: string
          title?: string
          tmdb_id?: number
          user_id?: string
          watched?: boolean | null
        }
        Relationships: []
      }
      recommendation_session_overrides: {
        Row: {
          created_at: string
          id: string
          override_weight: number
          session_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          override_weight: number
          session_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          override_weight?: number
          session_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_session_overrides_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "recommendation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_session_overrides_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "preference_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_sessions: {
        Row: {
          audience_type: string
          created_at: string
          decision_mode: string
          filters_snapshot: Json | null
          group_session_id: string | null
          id: string
          prompt_text: string | null
          results: Json | null
          scheduled_for: string | null
          selected_catalog_item_id: string | null
          source: string
          status: string
          taste_snapshot: Json | null
          user_id: string
        }
        Insert: {
          audience_type?: string
          created_at?: string
          decision_mode?: string
          filters_snapshot?: Json | null
          group_session_id?: string | null
          id?: string
          prompt_text?: string | null
          results?: Json | null
          scheduled_for?: string | null
          selected_catalog_item_id?: string | null
          source?: string
          status?: string
          taste_snapshot?: Json | null
          user_id: string
        }
        Update: {
          audience_type?: string
          created_at?: string
          decision_mode?: string
          filters_snapshot?: Json | null
          group_session_id?: string | null
          id?: string
          prompt_text?: string | null
          results?: Json | null
          scheduled_for?: string | null
          selected_catalog_item_id?: string | null
          source?: string
          status?: string
          taste_snapshot?: Json | null
          user_id?: string
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
      user_item_feedback: {
        Row: {
          action: string
          context: Json | null
          context_id: string | null
          context_type: string | null
          created_at: string
          feedback_type: string | null
          id: string
          item_id: string
          label: string | null
          score: number | null
          source: string
          user_id: string
        }
        Insert: {
          action: string
          context?: Json | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          feedback_type?: string | null
          id?: string
          item_id: string
          label?: string | null
          score?: number | null
          source?: string
          user_id: string
        }
        Update: {
          action?: string
          context?: Json | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          feedback_type?: string | null
          id?: string
          item_id?: string
          label?: string | null
          score?: number | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_item_feedback_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_movie_scores: {
        Row: {
          confidence: number
          last_updated: string
          movie_id: number
          score: number
          signals: Json
          user_id: string
        }
        Insert: {
          confidence?: number
          last_updated?: string
          movie_id: number
          score?: number
          signals?: Json
          user_id: string
        }
        Update: {
          confidence?: number
          last_updated?: string
          movie_id?: number
          score?: number
          signals?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_people_preferences: {
        Row: {
          created_at: string
          id: string
          known_for: string[] | null
          person_id: number
          person_name: string
          person_type: string
          photo_url: string | null
          preference: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          known_for?: string[] | null
          person_id: number
          person_name: string
          person_type?: string
          photo_url?: string | null
          preference?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          known_for?: string[] | null
          person_id?: number
          person_name?: string
          person_type?: string
          photo_url?: string | null
          preference?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          source: string
          tag_id: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          source?: string
          tag_id: string
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          source?: string
          tag_id?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "preference_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_taste_vectors: {
        Row: {
          avoidance_vector: string | null
          fatigue_state: Json
          id: string
          liked_count: number
          novelty_tolerance: number
          recent_taste_vector: string | null
          rejected_clusters: string[]
          stable_confidence: number
          taste_vector: string
          top_clusters: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          avoidance_vector?: string | null
          fatigue_state?: Json
          id?: string
          liked_count?: number
          novelty_tolerance?: number
          recent_taste_vector?: string | null
          rejected_clusters?: string[]
          stable_confidence?: number
          taste_vector: string
          top_clusters?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          avoidance_vector?: string | null
          fatigue_state?: Json
          id?: string
          liked_count?: number
          novelty_tolerance?: number
          recent_taste_vector?: string | null
          rejected_clusters?: string[]
          stable_confidence?: number
          taste_vector?: string
          top_clusters?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wishlist: {
        Row: {
          created_at: string
          id: string
          item_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wishlist_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
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
      count_movie_candidates:
        | {
            Args: {
              exclude_ids?: number[]
              excluded_genres?: string[]
              filter_media_type?: string
              liked_genres?: string[]
              max_duration?: number
              min_rating?: number
              p_excluded_languages?: string[]
              p_min_popularity?: number
              p_platform_ids?: number[]
            }
            Returns: {
              available_after_exclusions: number
              total_in_db: number
            }[]
          }
        | {
            Args: {
              exclude_ids?: number[]
              excluded_genres?: string[]
              filter_media_type?: string
              liked_genres?: string[]
              max_duration?: number
              min_rating?: number
              p_excluded_languages?: string[]
              p_min_popularity?: number
              p_platform_ids?: number[]
              p_user_id?: string
              p_user_id2?: string
            }
            Returns: {
              available_after_exclusions: number
              total_in_db: number
            }[]
          }
      find_profile_by_friend_code: {
        Args: { _code: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      generate_friend_code: { Args: never; Returns: string }
      generate_session_code: { Args: never; Returns: string }
      get_movies_needing_language: {
        Args: { p_limit?: number }
        Returns: {
          media_type: string
          tmdb_id: number
          year: number
        }[]
      }
      get_pending_duo_by_invite_code: {
        Args: { _code: string }
        Returns: {
          created_at: string
          created_by: string
          duo_name: string
          id: string
          invite_code: string
          status: string
          user1_display_name: string
          user1_genres: string[]
          user1_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      match_movies_explicit: {
        Args: {
          exclude_ids?: number[]
          excluded_genres?: string[]
          filter_media_type?: string
          liked_genres?: string[]
          match_count?: number
          max_duration?: number
          min_rating?: number
          p_excluded_languages?: string[]
          p_platform_ids?: number[]
          p_user_id?: string
          p_user_id2?: string
        }
        Returns: {
          cluster_labels: string[]
          genres: string[]
          media_type: string
          original_language: string
          platform_ids: number[]
          popularity: number
          similarity: number
          taste_tags: string[]
          title: string
          tmdb_id: number
          vote_average: number
          year: string
        }[]
      }
      match_movies_for_recommendation:
        | {
            Args: {
              exclude_ids?: number[]
              filter_media_type?: string
              match_count?: number
              query_vector: string
            }
            Returns: {
              cluster_labels: string[]
              genres: string[]
              media_type: string
              popularity: number
              similarity: number
              taste_tags: string[]
              title: string
              tmdb_id: number
              vote_average: number
              year: string
            }[]
          }
        | {
            Args: {
              exclude_ids?: number[]
              filter_media_type?: string
              match_count?: number
              min_rating?: number
              query_vector: string
            }
            Returns: {
              cluster_labels: string[]
              genres: string[]
              media_type: string
              popularity: number
              similarity: number
              taste_tags: string[]
              title: string
              tmdb_id: number
              vote_average: number
              year: string
            }[]
          }
        | {
            Args: {
              exclude_ids?: number[]
              excluded_genres?: string[]
              filter_media_type?: string
              match_count?: number
              min_rating?: number
              query_vector: string
            }
            Returns: {
              cluster_labels: string[]
              genres: string[]
              media_type: string
              popularity: number
              similarity: number
              taste_tags: string[]
              title: string
              tmdb_id: number
              vote_average: number
              year: string
            }[]
          }
        | {
            Args: {
              exclude_ids?: number[]
              excluded_genres?: string[]
              filter_media_type?: string
              liked_genres?: string[]
              match_count?: number
              min_rating?: number
              query_vector: string
            }
            Returns: {
              cluster_labels: string[]
              genres: string[]
              media_type: string
              popularity: number
              similarity: number
              taste_tags: string[]
              title: string
              tmdb_id: number
              vote_average: number
              year: string
            }[]
          }
        | {
            Args: {
              exclude_ids?: number[]
              excluded_genres?: string[]
              filter_media_type?: string
              liked_genres?: string[]
              match_count?: number
              max_duration?: number
              min_rating?: number
              query_vector: string
            }
            Returns: {
              cluster_labels: string[]
              genres: string[]
              media_type: string
              popularity: number
              similarity: number
              taste_tags: string[]
              title: string
              tmdb_id: number
              vote_average: number
              year: string
            }[]
          }
        | {
            Args: {
              exclude_ids?: number[]
              excluded_genres?: string[]
              filter_media_type?: string
              liked_genres?: string[]
              match_count?: number
              max_duration?: number
              min_rating?: number
              p_excluded_clusters?: string[]
              p_excluded_languages?: string[]
              p_max_year?: number
              p_min_popularity?: number
              p_min_year?: number
              p_original_language?: string
              p_platform_ids?: number[]
              p_user_id?: string
              p_user_id2?: string
              query_vector: string
            }
            Returns: {
              cluster_labels: string[]
              genres: string[]
              media_type: string
              original_language: string
              platform_ids: number[]
              popularity: number
              similarity: number
              taste_tags: string[]
              title: string
              tmdb_id: number
              vote_average: number
              year: string
            }[]
          }
      recompute_user_movie_score: {
        Args: { p_movie_id: number; p_user_id: string }
        Returns: undefined
      }
      update_movie_language: {
        Args: {
          p_original_language: string
          p_tmdb_id: number
          p_year?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
