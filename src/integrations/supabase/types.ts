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
      alert_subscribers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          preferred_channel: string
          updated_at: string
          zip_code: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          preferred_channel?: string
          updated_at?: string
          zip_code: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          preferred_channel?: string
          updated_at?: string
          zip_code?: string
        }
        Relationships: []
      }
      community_alerts: {
        Row: {
          affected_zips: string[]
          alert_type: string
          created_at: string
          delivery_status: string
          fire_distance_km: number | null
          fire_latitude: number | null
          fire_longitude: number | null
          id: string
          message: string
          recipients_count: number
          severity: string
          title: string
        }
        Insert: {
          affected_zips?: string[]
          alert_type?: string
          created_at?: string
          delivery_status?: string
          fire_distance_km?: number | null
          fire_latitude?: number | null
          fire_longitude?: number | null
          id?: string
          message: string
          recipients_count?: number
          severity?: string
          title: string
        }
        Update: {
          affected_zips?: string[]
          alert_type?: string
          created_at?: string
          delivery_status?: string
          fire_distance_km?: number | null
          fire_latitude?: number | null
          fire_longitude?: number | null
          id?: string
          message?: string
          recipients_count?: number
          severity?: string
          title?: string
        }
        Relationships: []
      }
      customer_notifications: {
        Row: {
          channel: string
          created_at: string
          customer_id: string
          id: string
          message: string | null
          sent_at: string
          status: string
          type: string
        }
        Insert: {
          channel?: string
          created_at?: string
          customer_id: string
          id?: string
          message?: string | null
          sent_at?: string
          status?: string
          type?: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string
          id?: string
          message?: string | null
          sent_at?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requests: {
        Row: {
          agent_response: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          details: Json
          id: string
          request_type: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_response?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          details?: Json
          id?: string
          request_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_response?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          details?: Json
          id?: string
          request_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          agent_notes: string | null
          arrears_amount: number
          arrears_status: string
          bill_trend: string
          created_at: string
          current_outage_status: string
          digital_ack_status: string
          doorbell_status: string
          email: string | null
          grid_stress_level: string
          has_permanent_battery: string
          has_portable_battery: boolean
          has_transfer_meter: boolean
          hftd_tier: string
          id: string
          last_update: string
          medical_baseline: boolean
          name: string
          nearest_crc_location: string
          outage_history: string | null
          patrolling_progress: number
          psps_event_id: string
          psps_phase: string
          region: string
          restoration_timer: string
          wildfire_risk: string
          zip_code: string
        }
        Insert: {
          agent_notes?: string | null
          arrears_amount?: number
          arrears_status?: string
          bill_trend?: string
          created_at?: string
          current_outage_status?: string
          digital_ack_status?: string
          doorbell_status?: string
          email?: string | null
          grid_stress_level?: string
          has_permanent_battery?: string
          has_portable_battery?: boolean
          has_transfer_meter?: boolean
          hftd_tier?: string
          id?: string
          last_update?: string
          medical_baseline?: boolean
          name: string
          nearest_crc_location?: string
          outage_history?: string | null
          patrolling_progress?: number
          psps_event_id?: string
          psps_phase?: string
          region?: string
          restoration_timer?: string
          wildfire_risk?: string
          zip_code: string
        }
        Update: {
          agent_notes?: string | null
          arrears_amount?: number
          arrears_status?: string
          bill_trend?: string
          created_at?: string
          current_outage_status?: string
          digital_ack_status?: string
          doorbell_status?: string
          email?: string | null
          grid_stress_level?: string
          has_permanent_battery?: string
          has_portable_battery?: boolean
          has_transfer_meter?: boolean
          hftd_tier?: string
          id?: string
          last_update?: string
          medical_baseline?: boolean
          name?: string
          nearest_crc_location?: string
          outage_history?: string | null
          patrolling_progress?: number
          psps_event_id?: string
          psps_phase?: string
          region?: string
          restoration_timer?: string
          wildfire_risk?: string
          zip_code?: string
        }
        Relationships: []
      }
      hazard_reports: {
        Row: {
          created_at: string
          customer_name: string | null
          description: string | null
          hazard_type: string
          id: string
          photo_url: string | null
          review_due_at: string
          status: string
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          description?: string | null
          hazard_type: string
          id?: string
          photo_url?: string | null
          review_due_at?: string
          status?: string
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          description?: string | null
          hazard_type?: string
          id?: string
          photo_url?: string | null
          review_due_at?: string
          status?: string
          submitted_by?: string | null
        }
        Relationships: []
      }
      hvra_assets: {
        Row: {
          category: string
          created_at: string
          id: string
          importance_weight: number
          latitude: number
          longitude: number
          name: string
          notes: string | null
          population_served: number | null
          response_function: string
          subcategory: string | null
          updated_at: string
          value_estimate: number | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          importance_weight?: number
          latitude: number
          longitude: number
          name: string
          notes?: string | null
          population_served?: number | null
          response_function?: string
          subcategory?: string | null
          updated_at?: string
          value_estimate?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          importance_weight?: number
          latitude?: number
          longitude?: number
          name?: string
          notes?: string | null
          population_served?: number | null
          response_function?: string
          subcategory?: string | null
          updated_at?: string
          value_estimate?: number | null
        }
        Relationships: []
      }
      risk_thresholds: {
        Row: {
          band_name: string
          color_hex: string
          display_order: number
          id: string
          min_probability: number
          model_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          band_name: string
          color_hex?: string
          display_order?: number
          id?: string
          min_probability: number
          model_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          band_name?: string
          color_hex?: string
          display_order?: number
          id?: string
          min_probability?: number
          model_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "agent" | "customer" | "executive" | "field"
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
      app_role: ["agent", "customer", "executive", "field"],
    },
  },
} as const
