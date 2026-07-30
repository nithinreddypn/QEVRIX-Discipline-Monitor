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
      branches: {
        Row: {
          code: string
          color_hex: string
          color_name: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          color_hex: string
          color_name: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          color_hex?: string
          color_name?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      detections: {
        Row: {
          branch_id: string | null
          color_match: boolean | null
          confidence: number | null
          created_at: string
          detection_time: string
          expected_branch_color: string | null
          id: string
          id_card_color: string | null
          id_card_found: boolean
          image_url: string | null
          notification_sent: boolean
          status: string | null
          student_id: string | null
          student_name: string | null
          processed_at: string | null
          processing_time_ms: number | null
          error_message: string | null
          face_similarity: number | null
          recognized: boolean
        }
        Insert: {
          branch_id?: string | null
          color_match?: boolean | null
          confidence?: number | null
          created_at?: string
          detection_time?: string
          expected_branch_color?: string | null
          id?: string
          id_card_color?: string | null
          id_card_found?: boolean
          image_url?: string | null
          notification_sent?: boolean
          status?: string | null
          student_id?: string | null
          student_name?: string | null
          processed_at?: string | null
          processing_time_ms?: number | null
          error_message?: string | null
          face_similarity?: number | null
          recognized?: boolean
        }
        Update: {
          branch_id?: string | null
          color_match?: boolean | null
          confidence?: number | null
          created_at?: string
          detection_time?: string
          expected_branch_color?: string | null
          id?: string
          id_card_color?: string | null
          id_card_found?: boolean
          image_url?: string | null
          notification_sent?: boolean
          status?: string | null
          student_id?: string | null
          student_name?: string | null
          processed_at?: string | null
          processing_time_ms?: number | null
          error_message?: string | null
          face_similarity?: number | null
          recognized?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "detections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          detection_id: string | null
          id: string
          is_read: boolean
          message: string
          recipient_user_id: string
          type: string | null
        }
        Insert: {
          created_at?: string
          detection_id?: string | null
          id?: string
          is_read?: boolean
          message: string
          recipient_user_id: string
          type?: string | null
        }
        Update: {
          created_at?: string
          detection_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          recipient_user_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_detection_id_fkey"
            columns: ["detection_id"]
            isOneToOne: false
            referencedRelation: "detections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          approval_email_sent: boolean | null
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          profile_photo_url: string | null
          rejection_reason: string | null
          semester: number | null
          status: string
          user_id: string | null
          usn: string
        }
        Insert: {
          approval_email_sent?: boolean | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          semester?: number | null
          status?: string
          user_id?: string | null
          usn: string
        }
        Update: {
          approval_email_sent?: boolean | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          semester?: number | null
          status?: string
          user_id?: string | null
          usn?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          ai_confidence_threshold: number
          created_at: string
          id: boolean
          notify_admin_missing_id: boolean
          notify_admin_unknown: boolean
          notify_student_flagged: boolean
          notify_student_verified: boolean
          notify_teacher_late_entry: boolean
          notify_teacher_missing_id: boolean
          notify_teacher_unknown: boolean
          system_name: string
          updated_at: string
        }
        Insert: {
          ai_confidence_threshold?: number
          created_at?: string
          id?: boolean
          notify_admin_missing_id?: boolean
          notify_admin_unknown?: boolean
          notify_student_flagged?: boolean
          notify_student_verified?: boolean
          notify_teacher_late_entry?: boolean
          notify_teacher_missing_id?: boolean
          notify_teacher_unknown?: boolean
          system_name?: string
          updated_at?: string
        }
        Update: {
          ai_confidence_threshold?: number
          created_at?: string
          id?: boolean
          notify_admin_missing_id?: boolean
          notify_admin_unknown?: boolean
          notify_student_flagged?: boolean
          notify_student_verified?: boolean
          notify_teacher_late_entry?: boolean
          notify_teacher_missing_id?: boolean
          notify_teacher_unknown?: boolean
          system_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          profile_photo_url: string | null
          rejection_reason: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_landing: string | null
          notification_channels: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_landing?: string | null
          notification_channels?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_landing?: string | null
          notification_channels?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_teacher_branch: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hex_color_close: {
        Args: { a: string; b: string; tolerance?: number }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
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
      app_role: ["student", "teacher", "admin"],
    },
  },
} as const
