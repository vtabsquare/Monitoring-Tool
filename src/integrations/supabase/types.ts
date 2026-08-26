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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activity_sessions: {
        Row: {
          app_name: string
          category: string
          device_id: string
          duration_seconds: number
          id: string
          is_idle: boolean
          org_id: string
          process_name: string | null
          profile_id: string
          started_at: string
          synced_at: string
          window_title: string | null
        }
        Insert: {
          app_name: string
          category?: string
          device_id: string
          duration_seconds: number
          id?: string
          is_idle?: boolean
          org_id: string
          process_name?: string | null
          profile_id: string
          started_at: string
          synced_at?: string
          window_title?: string | null
        }
        Update: {
          app_name?: string
          category?: string
          device_id?: string
          duration_seconds?: number
          id?: string
          is_idle?: boolean
          org_id?: string
          process_name?: string | null
          profile_id?: string
          started_at?: string
          synced_at?: string
          window_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reports: {
        Row: {
          concerns: Json
          confidence: number
          created_at: string
          id: string
          model: string
          org_id: string
          patterns: Json
          period_end: string
          period_start: string
          profile_id: string | null
          recommendations: Json
          report_type: string
          strengths: Json
          summary: string
        }
        Insert: {
          concerns?: Json
          confidence?: number
          created_at?: string
          id?: string
          model?: string
          org_id: string
          patterns?: Json
          period_end: string
          period_start: string
          profile_id?: string | null
          recommendations?: Json
          report_type?: string
          strengths?: Json
          summary: string
        }
        Update: {
          concerns?: Json
          confidence?: number
          created_at?: string
          id?: string
          model?: string
          org_id?: string
          patterns?: Json
          period_end?: string
          period_start?: string
          profile_id?: string | null
          recommendations?: Json
          report_type?: string
          strengths?: Json
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          org_id: string
        }
        Insert: {
          action: string
          actor_email: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          org_id: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_summaries: {
        Row: {
          context_switches: number
          date: string
          distracted_seconds: number
          focus_score: number
          focus_seconds: number
          id: string
          idle_seconds: number
          neutral_seconds: number
          org_id: string
          productive_seconds: number
          productivity_score: number
          profile_id: string
        }
        Insert: {
          context_switches?: number
          date: string
          distracted_seconds?: number
          focus_score?: number
          focus_seconds?: number
          id?: string
          idle_seconds?: number
          neutral_seconds?: number
          org_id: string
          productive_seconds?: number
          productivity_score?: number
          profile_id: string
        }
        Update: {
          context_switches?: number
          date?: string
          distracted_seconds?: number
          focus_score?: number
          focus_seconds?: number
          id?: string
          idle_seconds?: number
          neutral_seconds?: number
          org_id?: string
          productive_seconds?: number
          productivity_score?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_summaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_summaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          id: string
          name: string
          org_id: string
        }
        Insert: {
          id?: string
          name: string
          org_id: string
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          agent_version: string
          created_at: string
          device_key_hash: string | null
          id: string
          last_heartbeat_at: string | null
          last_sync_at: string | null
          monitoring_state: string
          name: string
          org_id: string
          os: string
          profile_id: string
          registered_at: string | null
          status: string
        }
        Insert: {
          agent_version?: string
          created_at?: string
          device_key_hash?: string | null
          id?: string
          last_heartbeat_at?: string | null
          last_sync_at?: string | null
          monitoring_state?: string
          name: string
          org_id: string
          os: string
          profile_id: string
          registered_at?: string | null
          status?: string
        }
        Update: {
          agent_version?: string
          created_at?: string
          device_key_hash?: string | null
          id?: string
          last_heartbeat_at?: string | null
          last_sync_at?: string | null
          monitoring_state?: string
          name?: string
          org_id?: string
          os?: string
          profile_id?: string
          registered_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          id: string
          metric: string
          org_id: string
          period: string
          profile_id: string | null
          target_value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          org_id: string
          period?: string
          profile_id?: string | null
          target_value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          org_id?: string
          period?: string
          profile_id?: string | null
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          profile_id: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          profile_id: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          profile_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_schedules: {
        Row: {
          day_of_week: number
          enabled: boolean
          end_time: string
          id: string
          org_id: string
          profile_id: string | null
          start_time: string
          timezone: string
        }
        Insert: {
          day_of_week: number
          enabled?: boolean
          end_time?: string
          id?: string
          org_id: string
          profile_id?: string | null
          start_time?: string
          timezone?: string
        }
        Update: {
          day_of_week?: number
          enabled?: boolean
          end_time?: string
          id?: string
          org_id?: string
          profile_id?: string | null
          start_time?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          data_retention_days: number
          heartbeat_interval_seconds: number
          id: string
          name: string
          slug: string
          timezone: string
        }
        Insert: {
          created_at?: string
          data_retention_days?: number
          heartbeat_interval_seconds?: number
          id?: string
          name: string
          slug: string
          timezone?: string
        }
        Update: {
          created_at?: string
          data_retention_days?: number
          heartbeat_interval_seconds?: number
          id?: string
          name?: string
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          job_role: string | null
          org_id: string
          status: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id?: string
          job_role?: string | null
          org_id: string
          status?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          job_role?: string | null
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
