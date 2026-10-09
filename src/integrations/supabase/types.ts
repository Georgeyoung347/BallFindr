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
  public: {
    Tables: {
      account_restrictions: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: string
          lifted_at: string | null
          lifted_by: string | null
          lifted_reason: string | null
          profile_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          lifted_at?: string | null
          lifted_by?: string | null
          lifted_reason?: string | null
          profile_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          lifted_at?: string | null
          lifted_by?: string | null
          lifted_reason?: string | null
          profile_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_restrictions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_restrictions_lifted_by_fkey"
            columns: ["lifted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_restrictions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          club_name: string | null
          created_at: string
          detail: string | null
          id: string
          kind: Database["public"]["Enums"]["achievement_kind"]
          profile_id: string
          season: string | null
          title: string
        }
        Insert: {
          club_name?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: Database["public"]["Enums"]["achievement_kind"]
          profile_id: string
          season?: string | null
          title: string
        }
        Update: {
          club_name?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["achievement_kind"]
          profile_id?: string
          season?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_events: {
        Row: {
          actor_profile_id: string | null
          application_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["application_stage"] | null
          id: string
          to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Insert: {
          actor_profile_id?: string | null
          application_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Update: {
          actor_profile_id?: string | null
          application_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          to_stage?: Database["public"]["Enums"]["application_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "application_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          club_id: string
          created_at: string
          id: string
          note: string | null
          player_id: string
          stage: Database["public"]["Enums"]["application_stage"]
          updated_at: string
          vacancy_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          note?: string | null
          player_id: string
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
          vacancy_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          note?: string | null
          player_id?: string
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      club_history: {
        Row: {
          club_id: string
          created_at: string
          cup_achievement: string | null
          draws: number | null
          final_position: string | null
          id: string
          league: string
          level_id: number | null
          losses: number | null
          notes: string | null
          outcome: string | null
          season: string
          season_start: number
          wins: number | null
        }
        Insert: {
          club_id: string
          created_at?: string
          cup_achievement?: string | null
          draws?: number | null
          final_position?: string | null
          id?: string
          league: string
          level_id?: number | null
          losses?: number | null
          notes?: string | null
          outcome?: string | null
          season: string
          season_start: number
          wins?: number | null
        }
        Update: {
          club_id?: string
          created_at?: string
          cup_achievement?: string | null
          draws?: number | null
          final_position?: string | null
          id?: string
          league?: string
          level_id?: number | null
          losses?: number | null
          notes?: string | null
          outcome?: string | null
          season?: string
          season_start?: number
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "club_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_history_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          active_section: Database["public"]["Enums"]["football_section"]
          badge_path: string | null
          contact_email: string | null
          contact_name: string | null
          contact_role: string | null
          created_at: string
          description: string | null
          facilities: string[]
          facilities_other: string | null
          fees_policy: string | null
          football_section: Database["public"]["Enums"]["football_section"]
          founded: string | null
          founder_granted_at: string | null
          founder_granted_by: string | null
          home_ground: string | null
          home_ground_photo_path: string | null
          id: string
          is_founder_club: boolean
          league: string | null
          level_id: number | null
          location: string | null
          match_day: string | null
          match_subs_fee: number | null
          monthly_fee: number | null
          name: string
          other_fee: number | null
          other_fee_label: string | null
          recruitment_status: string
          short_name: string | null
          slug: string | null
          team_photo_path: string | null
          training_days: string[] | null
          training_location: string | null
          training_pitch_photo_path: string | null
          training_time: string | null
          updated_at: string
          yearly_fee: number | null
        }
        Insert: {
          active_section?: Database["public"]["Enums"]["football_section"]
          badge_path?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_role?: string | null
          created_at?: string
          description?: string | null
          facilities?: string[]
          facilities_other?: string | null
          fees_policy?: string | null
          football_section?: Database["public"]["Enums"]["football_section"]
          founded?: string | null
          founder_granted_at?: string | null
          founder_granted_by?: string | null
          home_ground?: string | null
          home_ground_photo_path?: string | null
          id: string
          is_founder_club?: boolean
          league?: string | null
          level_id?: number | null
          location?: string | null
          match_day?: string | null
          match_subs_fee?: number | null
          monthly_fee?: number | null
          name?: string
          other_fee?: number | null
          other_fee_label?: string | null
          recruitment_status?: string
          short_name?: string | null
          slug?: string | null
          team_photo_path?: string | null
          training_days?: string[] | null
          training_location?: string | null
          training_pitch_photo_path?: string | null
          training_time?: string | null
          updated_at?: string
          yearly_fee?: number | null
        }
        Update: {
          active_section?: Database["public"]["Enums"]["football_section"]
          badge_path?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_role?: string | null
          created_at?: string
          description?: string | null
          facilities?: string[]
          facilities_other?: string | null
          fees_policy?: string | null
          football_section?: Database["public"]["Enums"]["football_section"]
          founded?: string | null
          founder_granted_at?: string | null
          founder_granted_by?: string | null
          home_ground?: string | null
          home_ground_photo_path?: string | null
          id?: string
          is_founder_club?: boolean
          league?: string | null
          level_id?: number | null
          location?: string | null
          match_day?: string | null
          match_subs_fee?: number | null
          monthly_fee?: number | null
          name?: string
          other_fee?: number | null
          other_fee_label?: string | null
          recruitment_status?: string
          short_name?: string | null
          slug?: string | null
          team_photo_path?: string | null
          training_days?: string[] | null
          training_location?: string | null
          training_pitch_photo_path?: string | null
          training_time?: string | null
          updated_at?: string
          yearly_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_founder_granted_by_fkey"
            columns: ["founder_granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          muted_at: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          muted_at?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          muted_at?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          club_id: string
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          last_message_sender_id: string | null
          paused_at: string | null
          paused_by: string | null
          player_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          club_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_sender_id?: string | null
          paused_at?: string | null
          paused_by?: string | null
          player_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          club_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_sender_id?: string | null
          paused_at?: string | null
          paused_by?: string | null
          player_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_last_message_sender_id_fkey"
            columns: ["last_message_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_paused_by_fkey"
            columns: ["paused_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      email_reverifications: {
        Row: {
          created_at: string
          profile_id: string
          sent_at: string | null
          sent_by: string | null
          status: string
          token_hash: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          profile_id: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          token_hash?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          profile_id?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          token_hash?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_reverifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          id: number
          name: string
          rank: number
        }
        Insert: {
          id: number
          name: string
          rank: number
        }
        Update: {
          id?: number
          name?: string
          rank?: number
        }
        Relationships: []
      }
      media: {
        Row: {
          bucket: string
          caption: string | null
          content_type: string | null
          created_at: string
          duration_seconds: number | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          owner_profile_id: string
          size_bytes: number | null
          sort_order: number
          storage_path: string
          title: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          bucket: string
          caption?: string | null
          content_type?: string | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          owner_profile_id: string
          size_bytes?: number | null
          sort_order?: number
          storage_path: string
          title?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          bucket?: string
          caption?: string | null
          content_type?: string | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          owner_profile_id?: string
          size_bytes?: number | null
          sort_order?: number
          storage_path?: string
          title?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_reactions: {
        Row: {
          created_at: string
          id: string
          media_id: string
          profile_id: string
          reaction: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          profile_id: string
          reaction: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          profile_id?: string
          reaction?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_reactions_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          unblocked_at: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          unblocked_at?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          unblocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          admin_display_name: string | null
          admin_profile_id: string | null
          created_at: string
          id: string
          new_status: string | null
          note: string | null
          previous_status: string | null
          report_id: string | null
          restriction_id: string | null
          subject_display_name: string | null
          subject_profile_id: string | null
        }
        Insert: {
          action: string
          admin_display_name?: string | null
          admin_profile_id?: string | null
          created_at?: string
          id?: string
          new_status?: string | null
          note?: string | null
          previous_status?: string | null
          report_id?: string | null
          restriction_id?: string | null
          subject_display_name?: string | null
          subject_profile_id?: string | null
        }
        Update: {
          action?: string
          admin_display_name?: string | null
          admin_profile_id?: string | null
          created_at?: string
          id?: string
          new_status?: string | null
          note?: string | null
          previous_status?: string | null
          report_id?: string | null
          restriction_id?: string | null
          subject_display_name?: string | null
          subject_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_restriction_id_fkey"
            columns: ["restriction_id"]
            isOneToOne: false
            referencedRelation: "account_restrictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          applications: boolean
          created_at: string
          messages: boolean
          profile_id: string
          push_enabled: boolean
          recruitment: boolean
          trials: boolean
          updated_at: string
        }
        Insert: {
          applications?: boolean
          created_at?: string
          messages?: boolean
          profile_id: string
          push_enabled?: boolean
          recruitment?: boolean
          trials?: boolean
          updated_at?: string
        }
        Update: {
          applications?: boolean
          created_at?: string
          messages?: boolean
          profile_id?: string
          push_enabled?: boolean
          recruitment?: boolean
          trials?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read_at: string | null
          recipient_profile_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_profile_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_profile_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_history: {
        Row: {
          appearances: number | null
          assists: number | null
          clean_sheets: number | null
          club_name: string
          created_at: string
          goals: number | null
          goals_against: number | null
          id: string
          league: string | null
          level_id: number | null
          notes: string | null
          player_id: string
          position: Database["public"]["Enums"]["position_code"] | null
          season: string
          season_start: number
        }
        Insert: {
          appearances?: number | null
          assists?: number | null
          clean_sheets?: number | null
          club_name: string
          created_at?: string
          goals?: number | null
          goals_against?: number | null
          id?: string
          league?: string | null
          level_id?: number | null
          notes?: string | null
          player_id: string
          position?: Database["public"]["Enums"]["position_code"] | null
          season: string
          season_start: number
        }
        Update: {
          appearances?: number | null
          assists?: number | null
          clean_sheets?: number | null
          club_name?: string
          created_at?: string
          goals?: number | null
          goals_against?: number | null
          id?: string
          league?: string | null
          level_id?: number | null
          notes?: string | null
          player_id?: string
          position?: Database["public"]["Enums"]["position_code"] | null
          season?: string
          season_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_history_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_private: {
        Row: {
          created_at: string
          date_of_birth: string | null
          player_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          player_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_private_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          availability: Database["public"]["Enums"]["availability"]
          bio: string | null
          created_at: string
          current_club_name: string | null
          football_section: Database["public"]["Enums"]["football_section"]
          has_club: boolean
          height_inches: number | null
          id: string
          level_id: number | null
          location: string | null
          looking_for: string | null
          max_travel_miles: number | null
          open_to_trials: boolean
          preferred_level_id: number | null
          preferred_training_days: string[] | null
          primary_position: Database["public"]["Enums"]["position_code"] | null
          secondary_positions:
            | Database["public"]["Enums"]["position_code"][]
            | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability"]
          bio?: string | null
          created_at?: string
          current_club_name?: string | null
          football_section?: Database["public"]["Enums"]["football_section"]
          has_club?: boolean
          height_inches?: number | null
          id: string
          level_id?: number | null
          location?: string | null
          looking_for?: string | null
          max_travel_miles?: number | null
          open_to_trials?: boolean
          preferred_level_id?: number | null
          preferred_training_days?: string[] | null
          primary_position?: Database["public"]["Enums"]["position_code"] | null
          secondary_positions?:
            | Database["public"]["Enums"]["position_code"][]
            | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability"]
          bio?: string | null
          created_at?: string
          current_club_name?: string | null
          football_section?: Database["public"]["Enums"]["football_section"]
          has_club?: boolean
          height_inches?: number | null
          id?: string
          level_id?: number | null
          location?: string | null
          looking_for?: string | null
          max_travel_miles?: number | null
          open_to_trials?: boolean
          preferred_level_id?: number | null
          preferred_training_days?: string[] | null
          primary_position?: Database["public"]["Enums"]["position_code"] | null
          secondary_positions?:
            | Database["public"]["Enums"]["position_code"][]
            | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_preferred_level_id_fkey"
            columns: ["preferred_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          day: string
          id: string
          source: string | null
          viewed_at: string
          viewed_profile_id: string
          viewer_profile_id: string | null
        }
        Insert: {
          day?: string
          id?: string
          source?: string | null
          viewed_at?: string
          viewed_profile_id: string
          viewer_profile_id?: string | null
        }
        Update: {
          day?: string
          id?: string
          source?: string | null
          viewed_at?: string
          viewed_profile_id?: string
          viewer_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_viewed_profile_id_fkey"
            columns: ["viewed_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_profile_id_fkey"
            columns: ["viewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_path: string | null
          cover_path: string | null
          created_at: string
          display_name: string
          id: string
          is_hidden: boolean
          is_owner: boolean
          updated_at: string
          verification_decided_at: string | null
          verification_decided_by: string | null
          verification_notes: string | null
          verification_requested_at: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_path?: string | null
          cover_path?: string | null
          created_at?: string
          display_name: string
          id: string
          is_hidden?: boolean
          is_owner?: boolean
          updated_at?: string
          verification_decided_at?: string | null
          verification_decided_by?: string | null
          verification_notes?: string | null
          verification_requested_at?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_path?: string | null
          cover_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_hidden?: boolean
          is_owner?: boolean
          updated_at?: string
          verification_decided_at?: string | null
          verification_decided_by?: string | null
          verification_notes?: string | null
          verification_requested_at?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_verification_decided_by_fkey"
            columns: ["verification_decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_devices: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform: string
          token: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          details: string | null
          id: string
          kind: string
          message_body: string | null
          message_id: string | null
          message_sent_at: string | null
          reason: string
          reported_display_name: string | null
          reported_profile_id: string | null
          reporter_display_name: string | null
          reporter_profile_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          kind?: string
          message_body?: string | null
          message_id?: string | null
          message_sent_at?: string | null
          reason: string
          reported_display_name?: string | null
          reported_profile_id?: string | null
          reporter_display_name?: string | null
          reporter_profile_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          kind?: string
          message_body?: string | null
          message_id?: string | null
          message_sent_at?: string | null
          reason?: string
          reported_display_name?: string | null
          reported_profile_id?: string | null
          reporter_display_name?: string | null
          reporter_profile_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_profile_id_fkey"
            columns: ["reported_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_clubs: {
        Row: {
          club_id: string
          created_at: string
          id: string
          player_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          player_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_clubs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_clubs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_clubs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_players: {
        Row: {
          club_id: string
          created_at: string
          id: string
          player_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          player_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_vacancies: {
        Row: {
          created_at: string
          id: string
          player_id: string
          vacancy_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          vacancy_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_vacancies_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_vacancies_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_vacancies_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_vacancies_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_invites: {
        Row: {
          additional_instructions: string | null
          application_id: string | null
          arrival_time: string | null
          changing_info: string | null
          club_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          decline_reason: string | null
          end_time: string
          id: string
          kit_instructions: string | null
          notes: string | null
          player_id: string
          postcode: string
          responded_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["trial_invite_status"]
          street_address: string
          surface: Database["public"]["Enums"]["trial_surface"]
          surface_other: string | null
          trial_date: string
          updated_at: string
          vacancy_id: string | null
          venue_name: string
          what_to_bring: string | null
        }
        Insert: {
          additional_instructions?: string | null
          application_id?: string | null
          arrival_time?: string | null
          changing_info?: string | null
          club_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          decline_reason?: string | null
          end_time: string
          id?: string
          kit_instructions?: string | null
          notes?: string | null
          player_id: string
          postcode: string
          responded_at?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["trial_invite_status"]
          street_address: string
          surface: Database["public"]["Enums"]["trial_surface"]
          surface_other?: string | null
          trial_date: string
          updated_at?: string
          vacancy_id?: string | null
          venue_name: string
          what_to_bring?: string | null
        }
        Update: {
          additional_instructions?: string | null
          application_id?: string | null
          arrival_time?: string | null
          changing_info?: string | null
          club_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          decline_reason?: string | null
          end_time?: string
          id?: string
          kit_instructions?: string | null
          notes?: string | null
          player_id?: string
          postcode?: string
          responded_at?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["trial_invite_status"]
          street_address?: string
          surface?: Database["public"]["Enums"]["trial_surface"]
          surface_other?: string | null
          trial_date?: string
          updated_at?: string
          vacancy_id?: string | null
          venue_name?: string
          what_to_bring?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_invites_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_invites_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_invites_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_invites_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_invites_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_outcomes: {
        Row: {
          club_id: string
          created_at: string
          id: string
          outcome: string
          player_id: string
          recorded_by: string | null
          trial_invite_id: string
          vacancy_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          outcome: string
          player_id: string
          recorded_by?: string | null
          trial_invite_id: string
          vacancy_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          outcome?: string
          player_id?: string
          recorded_by?: string | null
          trial_invite_id?: string
          vacancy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_outcomes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_outcomes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_outcomes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_outcomes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_outcomes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_outcomes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_outcomes_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_outcomes_trial_invite_id_fkey"
            columns: ["trial_invite_id"]
            isOneToOne: true
            referencedRelation: "trial_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_outcomes_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
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
      vacancies: {
        Row: {
          club_id: string
          created_at: string
          description: string | null
          expires_at: string | null
          football_section: Database["public"]["Enums"]["football_section"]
          id: string
          level_id: number | null
          location: string | null
          match_day: string | null
          positions: Database["public"]["Enums"]["position_code"][]
          requirements: string | null
          slug: string | null
          status: Database["public"]["Enums"]["vacancy_status"]
          title: string | null
          training_days: string[] | null
          trials_available: boolean
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          football_section?: Database["public"]["Enums"]["football_section"]
          id?: string
          level_id?: number | null
          location?: string | null
          match_day?: string | null
          positions: Database["public"]["Enums"]["position_code"][]
          requirements?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["vacancy_status"]
          title?: string | null
          training_days?: string[] | null
          trials_available?: boolean
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          football_section?: Database["public"]["Enums"]["football_section"]
          id?: string
          level_id?: number | null
          location?: string | null
          match_day?: string | null
          positions?: Database["public"]["Enums"]["position_code"][]
          requirements?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["vacancy_status"]
          title?: string | null
          training_days?: string[] | null
          trials_available?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancies_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancies_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club_share_slugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancies_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancies_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      club_cards: {
        Row: {
          badge_path: string | null
          created_at: string | null
          description: string | null
          football_section:
            | Database["public"]["Enums"]["football_section"]
            | null
          founded: string | null
          home_ground: string | null
          id: string | null
          league: string | null
          level_id: number | null
          location: string | null
          match_day: string | null
          name: string | null
          recruitment_status: string | null
          short_name: string | null
          training_days: string[] | null
          training_location: string | null
          training_time: string | null
        }
        Insert: {
          badge_path?: string | null
          created_at?: string | null
          description?: string | null
          football_section?:
            | Database["public"]["Enums"]["football_section"]
            | null
          founded?: string | null
          home_ground?: string | null
          id?: string | null
          league?: string | null
          level_id?: number | null
          location?: string | null
          match_day?: string | null
          name?: string | null
          recruitment_status?: string | null
          short_name?: string | null
          training_days?: string[] | null
          training_location?: string | null
          training_time?: string | null
        }
        Update: {
          badge_path?: string | null
          created_at?: string | null
          description?: string | null
          football_section?:
            | Database["public"]["Enums"]["football_section"]
            | null
          founded?: string | null
          home_ground?: string | null
          id?: string | null
          league?: string | null
          level_id?: number | null
          location?: string | null
          match_day?: string | null
          name?: string | null
          recruitment_status?: string | null
          short_name?: string | null
          training_days?: string[] | null
          training_location?: string | null
          training_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      club_share_slugs: {
        Row: {
          id: string | null
          slug: string | null
        }
        Insert: {
          id?: string | null
          slug?: string | null
        }
        Update: {
          id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_cards: {
        Row: {
          age: number | null
          availability: Database["public"]["Enums"]["availability"] | null
          avatar_path: string | null
          bio: string | null
          cover_path: string | null
          created_at: string | null
          current_club_name: string | null
          display_name: string | null
          football_section:
            | Database["public"]["Enums"]["football_section"]
            | null
          height_inches: number | null
          id: string | null
          is_hidden: boolean | null
          level_id: number | null
          level_name: string | null
          location: string | null
          looking_for: string | null
          max_travel_miles: number | null
          open_to_trials: boolean | null
          preferred_level_id: number | null
          preferred_level_name: string | null
          preferred_training_days: string[] | null
          primary_position: Database["public"]["Enums"]["position_code"] | null
          secondary_positions:
            | Database["public"]["Enums"]["position_code"][]
            | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_preferred_level_id_fkey"
            columns: ["preferred_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      player_share_slugs: {
        Row: {
          id: string | null
          slug: string | null
        }
        Insert: {
          id?: string | null
          slug?: string | null
        }
        Update: {
          id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_issue_warning: {
        Args: { _message: string; _profile_id: string }
        Returns: string
      }
      admin_list_admin_ids: { Args: never; Returns: string[] }
      admin_list_roles: {
        Args: never
        Returns: {
          role: string
          user_id: string
        }[]
      }
      admin_set_admin_role: {
        Args: { _grant: boolean; _profile_id: string }
        Returns: boolean
      }
      admin_set_football_section: {
        Args: {
          _profile_id: string
          _section: Database["public"]["Enums"]["football_section"]
        }
        Returns: string
      }
      admin_set_profile_hidden: {
        Args: { _hidden: boolean; _profile_id: string }
        Returns: boolean
      }
      admin_set_role: {
        Args: { _profile_id: string; _role: string }
        Returns: string
      }
      admin_switch_account_type: {
        Args: {
          _profile_id: string
          _to: Database["public"]["Enums"]["account_type"]
        }
        Returns: string
      }
      admin_verification_info: {
        Args: { _profile_id?: string }
        Returns: {
          profile_id: string
          verification_decided_at: string
          verification_decided_by: string
          verification_notes: string
          verification_requested_at: string
        }[]
      }
      can_moderate: { Args: never; Returns: boolean }
      can_view_player_details: {
        Args: { _player_id: string }
        Returns: boolean
      }
      get_public_club: { Args: { _slug: string }; Returns: Json }
      get_public_player: { Args: { _slug: string }; Returns: Json }
      get_public_vacancy: { Args: { _slug: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _profile_id: string }
        Returns: boolean
      }
      is_moderator: { Args: never; Returns: boolean }
      messaging_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      my_club_contact: {
        Args: never
        Returns: {
          contact_email: string
          contact_name: string
          contact_role: string
        }[]
      }
      my_player_private: {
        Args: never
        Returns: {
          date_of_birth: string
        }[]
      }
      my_restriction: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          kind: string
          reason: string
        }[]
      }
      my_staff_role: { Args: never; Returns: string }
      player_age: { Args: { _player_id: string }; Returns: number }
      player_details: {
        Args: { _player_id: string }
        Returns: {
          bio: string
          location: string
          looking_for: string
          max_travel_miles: number
          preferred_training_days: string[]
        }[]
      }
      position_label: {
        Args: { _p: Database["public"]["Enums"]["position_code"] }
        Returns: string
      }
      push_hook_secret_ok: { Args: { _s: string }; Returns: boolean }
      record_trial_outcome: {
        Args: { _invite_id: string; _outcome: string }
        Returns: string
      }
      trial_invite_summary: {
        Args: { _i: Database["public"]["Tables"]["trial_invites"]["Row"] }
        Returns: string
      }
      vacancy_label: {
        Args: {
          _positions: Database["public"]["Enums"]["position_code"][]
          _title: string
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "player" | "club"
      achievement_kind:
        | "award"
        | "league_title"
        | "cup"
        | "individual"
        | "promotion"
        | "relegation"
        | "other"
      app_role: "admin" | "moderator"
      application_stage:
        | "interested"
        | "reviewing"
        | "shortlisted"
        | "contacted"
        | "trial"
        | "accepted"
        | "rejected"
        | "withdrawn"
      availability: "actively_looking" | "open_to_offers" | "not_looking"
      conversation_status: "active" | "paused" | "blocked"
      football_section: "mens" | "womens" | "both"
      media_kind: "highlight" | "video" | "photo"
      position_code:
        | "GK"
        | "RB"
        | "CB"
        | "LB"
        | "CDM"
        | "CM"
        | "CAM"
        | "RW"
        | "LW"
        | "ST"
      report_status: "open" | "resolved" | "dismissed"
      trial_invite_status: "pending" | "accepted" | "declined" | "cancelled"
      trial_surface: "grass" | "3g" | "4g" | "astro" | "other"
      vacancy_status: "active" | "closed" | "filled" | "expired"
      verification_status: "unverified" | "pending" | "verified" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: ["player", "club"],
      achievement_kind: [
        "award",
        "league_title",
        "cup",
        "individual",
        "promotion",
        "relegation",
        "other",
      ],
      app_role: ["admin", "moderator"],
      application_stage: [
        "interested",
        "reviewing",
        "shortlisted",
        "contacted",
        "trial",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      availability: ["actively_looking", "open_to_offers", "not_looking"],
      conversation_status: ["active", "paused", "blocked"],
      football_section: ["mens", "womens", "both"],
      media_kind: ["highlight", "video", "photo"],
      position_code: [
        "GK",
        "RB",
        "CB",
        "LB",
        "CDM",
        "CM",
        "CAM",
        "RW",
        "LW",
        "ST",
      ],
      report_status: ["open", "resolved", "dismissed"],
      trial_invite_status: ["pending", "accepted", "declined", "cancelled"],
      trial_surface: ["grass", "3g", "4g", "astro", "other"],
      vacancy_status: ["active", "closed", "filled", "expired"],
      verification_status: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const
