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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance_logs: {
        Row: {
          approved: boolean
          created_at: string
          employee_id: string | null
          id: string
          latitude: number | null
          logged_at: string
          longitude: number | null
          note: string | null
          photo_url: string | null
          sync_status: string
          type: Database["public"]["Enums"]["punch_type"]
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          employee_id?: string | null
          id?: string
          latitude?: number | null
          logged_at?: string
          longitude?: number | null
          note?: string | null
          photo_url?: string | null
          sync_status?: string
          type: Database["public"]["Enums"]["punch_type"]
          user_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          employee_id?: string | null
          id?: string
          latitude?: number | null
          logged_at?: string
          longitude?: number | null
          note?: string | null
          photo_url?: string | null
          sync_status?: string
          type?: Database["public"]["Enums"]["punch_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          note_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          note_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          note_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      deductions: {
        Row: {
          amount: number
          created_at: string
          effective_date: string
          employee_id: string
          id: string
          kind: string
          note: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          effective_date?: string
          employee_id: string
          id?: string
          kind?: string
          note?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          effective_date?: string
          employee_id?: string
          id?: string
          kind?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          archived_at: string | null
          contact: string | null
          created_at: string
          daily_rate: number
          fixed_monthly: number
          full_name: string
          id: string
          late_deduction: number
          passcode_hash: string | null
          passcode_set_at: string | null
          pay_periods: number
          rate_per_visit: number
          role: Database["public"]["Enums"]["app_role"]
          salary_structure: Database["public"]["Enums"]["salary_structure"]
          user_id: string | null
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          contact?: string | null
          created_at?: string
          daily_rate?: number
          fixed_monthly?: number
          full_name: string
          id?: string
          late_deduction?: number
          passcode_hash?: string | null
          passcode_set_at?: string | null
          pay_periods?: number
          rate_per_visit?: number
          role?: Database["public"]["Enums"]["app_role"]
          salary_structure?: Database["public"]["Enums"]["salary_structure"]
          user_id?: string | null
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          contact?: string | null
          created_at?: string
          daily_rate?: number
          fixed_monthly?: number
          full_name?: string
          id?: string
          late_deduction?: number
          passcode_hash?: string | null
          passcode_set_at?: string | null
          pay_periods?: number
          rate_per_visit?: number
          role?: Database["public"]["Enums"]["app_role"]
          salary_structure?: Database["public"]["Enums"]["salary_structure"]
          user_id?: string | null
        }
        Relationships: []
      }
      payroll_records: {
        Row: {
          cash_advance: number
          days_worked: number
          employee_id: string
          generated_at: string
          gross_pay: number
          id: string
          late_deduction: number
          lates: number
          net_pay: number
          period_end: string
          period_start: string
          total_deductions: number
          visits: number
        }
        Insert: {
          cash_advance?: number
          days_worked?: number
          employee_id: string
          generated_at?: string
          gross_pay?: number
          id?: string
          late_deduction?: number
          lates?: number
          net_pay?: number
          period_end: string
          period_start: string
          total_deductions?: number
          visits?: number
        }
        Update: {
          cash_advance?: number
          days_worked?: number
          employee_id?: string
          generated_at?: string
          gross_pay?: number
          id?: string
          late_deduction?: number
          lates?: number
          net_pay?: number
          period_end?: string
          period_start?: string
          total_deductions?: number
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_staff_passcode: {
        Args: { _employee_id: string; _passcode: string }
        Returns: undefined
      }
      verify_staff_passcode: {
        Args: { _employee_id: string; _passcode: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "doctor" | "nurse" | "caregiver"
      punch_type: "IN" | "OUT"
      salary_structure: "rate_per_visit" | "daily_rate" | "fixed_monthly"
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
      app_role: ["admin", "doctor", "nurse", "caregiver"],
      punch_type: ["IN", "OUT"],
      salary_structure: ["rate_per_visit", "daily_rate", "fixed_monthly"],
    },
  },
} as const
