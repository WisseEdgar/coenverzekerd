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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      answer_citations: {
        Row: {
          answer_id: string
          created_at: string
          document_id: string
          end_char: number | null
          id: string
          page: number | null
          score: number | null
          section_id: string | null
          start_char: number | null
        }
        Insert: {
          answer_id: string
          created_at?: string
          document_id: string
          end_char?: number | null
          id?: string
          page?: number | null
          score?: number | null
          section_id?: string | null
          start_char?: number | null
        }
        Update: {
          answer_id?: string
          created_at?: string
          document_id?: string
          end_char?: number | null
          id?: string
          page?: number | null
          score?: number | null
          section_id?: string | null
          start_char?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_citations_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_citations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_citations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          answer_text: string
          completion_tokens: number | null
          created_at: string
          id: string
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          query_id: string
        }
        Insert: {
          answer_text: string
          completion_tokens?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          query_id: string
        }
        Update: {
          answer_text?: string
          completion_tokens?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          query_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "queries"
            referencedColumns: ["id"]
          },
        ]
      }
      chunk_embeddings: {
        Row: {
          chunk_id: string
          created_at: string
          embedding: string | null
          id: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          embedding?: string | null
          id?: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          embedding?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chunk_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          created_at: string
          document_id: string
          id: string
          metadata: Json | null
          page: number | null
          section_id: string | null
          text: string
          token_count: number | null
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json | null
          page?: number | null
          section_id?: string | null
          text: string
          token_count?: number | null
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json | null
          page?: number | null
          section_id?: string | null
          text?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          address: string | null
          advisor_id: string
          advisor_notes: string | null
          annual_revenue: number | null
          birth_date: string | null
          bsn: string | null
          btw_number: string | null
          client_type: string
          company_legal_name: string | null
          company_name: string | null
          created_at: string
          current_insurances: Json | null
          email: string | null
          employment_type: string | null
          founding_year: number | null
          full_name: string | null
          gross_annual_income: number | null
          household_members: number | null
          id: string
          insurance_history: Json | null
          intake_questionnaire_md: string | null
          intake_responses: Json | null
          kvk_number: string | null
          legal_form: string | null
          marital_status: string | null
          net_annual_income: number | null
          number_of_employees: number | null
          occupation: string | null
          phone: string | null
          preferences: Json | null
          risk_assessment: Json | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          advisor_id: string
          advisor_notes?: string | null
          annual_revenue?: number | null
          birth_date?: string | null
          bsn?: string | null
          btw_number?: string | null
          client_type: string
          company_legal_name?: string | null
          company_name?: string | null
          created_at?: string
          current_insurances?: Json | null
          email?: string | null
          employment_type?: string | null
          founding_year?: number | null
          full_name?: string | null
          gross_annual_income?: number | null
          household_members?: number | null
          id?: string
          insurance_history?: Json | null
          intake_questionnaire_md?: string | null
          intake_responses?: Json | null
          kvk_number?: string | null
          legal_form?: string | null
          marital_status?: string | null
          net_annual_income?: number | null
          number_of_employees?: number | null
          occupation?: string | null
          phone?: string | null
          preferences?: Json | null
          risk_assessment?: Json | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          advisor_id?: string
          advisor_notes?: string | null
          annual_revenue?: number | null
          birth_date?: string | null
          bsn?: string | null
          btw_number?: string | null
          client_type?: string
          company_legal_name?: string | null
          company_name?: string | null
          created_at?: string
          current_insurances?: Json | null
          email?: string | null
          employment_type?: string | null
          founding_year?: number | null
          full_name?: string | null
          gross_annual_income?: number | null
          household_members?: number | null
          id?: string
          insurance_history?: Json | null
          intake_questionnaire_md?: string | null
          intake_responses?: Json | null
          kvk_number?: string | null
          legal_form?: string | null
          marital_status?: string | null
          net_annual_income?: number | null
          number_of_employees?: number | null
          occupation?: string | null
          phone?: string | null
          preferences?: Json | null
          risk_assessment?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_processing_logs: {
        Row: {
          created_at: string
          document_id: string | null
          extracted_company: string | null
          extracted_insurance_type: string | null
          id: string
          message: string | null
          processing_details: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          extracted_company?: string | null
          extracted_insurance_type?: string | null
          id?: string
          message?: string | null
          processing_details?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          extracted_company?: string | null
          extracted_insurance_type?: string | null
          id?: string
          message?: string | null
          processing_details?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_processing_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          embedding: string | null
          extracted_text: string | null
          file_path: string
          file_size: number | null
          filename: string
          id: string
          insurance_company_id: string | null
          insurance_type_id: string | null
          mime_type: string
          summary: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          extracted_text?: string | null
          file_path: string
          file_size?: number | null
          filename: string
          id?: string
          insurance_company_id?: string | null
          insurance_type_id?: string | null
          mime_type?: string
          summary?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          embedding?: string | null
          extracted_text?: string | null
          file_path?: string
          file_size?: number | null
          filename?: string
          id?: string
          insurance_company_id?: string | null
          insurance_type_id?: string | null
          mime_type?: string
          summary?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_insurance_company_id_fkey"
            columns: ["insurance_company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_insurance_type_id_fkey"
            columns: ["insurance_type_id"]
            isOneToOne: false
            referencedRelation: "insurance_types"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_v2: {
        Row: {
          created_at: string
          file_path: string
          file_sha256: string | null
          id: string
          pages: number | null
          processing_status: string | null
          product_id: string
          source_type: string | null
          title: string
          updated_at: string
          version_date: string | null
          version_label: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          file_sha256?: string | null
          id?: string
          pages?: number | null
          processing_status?: string | null
          product_id: string
          source_type?: string | null
          title: string
          updated_at?: string
          version_date?: string | null
          version_label?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          file_sha256?: string | null
          id?: string
          pages?: number | null
          processing_status?: string | null
          product_id?: string
          source_type?: string | null
          title?: string
          updated_at?: string
          version_date?: string | null
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_v2_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurers: {
        Row: {
          created_at: string
          id: string
          kvk: string | null
          name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kvk?: string | null
          name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kvk?: string | null
          name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      message_feedback: {
        Row: {
          additional_feedback: string | null
          created_at: string
          feedback_type: string
          id: string
          message_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_feedback?: string | null
          created_at?: string
          feedback_type: string
          id?: string
          message_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_feedback?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          message_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_feedback_message_id"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          insurer_id: string
          jurisdiction: string | null
          language: string | null
          line_of_business: string
          name: string
          updated_at: string
          version_date: string | null
          version_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          insurer_id: string
          jurisdiction?: string | null
          language?: string | null
          line_of_business: string
          name: string
          updated_at?: string
          version_date?: string | null
          version_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          insurer_id?: string
          jurisdiction?: string | null
          language?: string | null
          line_of_business?: string
          name?: string
          updated_at?: string
          version_date?: string | null
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      queries: {
        Row: {
          created_at: string
          filters: Json | null
          id: string
          query: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          filters?: Json | null
          id?: string
          query: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          filters?: Json | null
          id?: string
          query?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string
          document_id: string
          heading_path: string | null
          id: string
          page_end: number | null
          page_start: number | null
        }
        Insert: {
          created_at?: string
          document_id: string
          heading_path?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
        }
        Update: {
          created_at?: string
          document_id?: string
          heading_path?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
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
      get_documents_without_embeddings: {
        Args: { batch_size?: number }
        Returns: {
          extracted_text: string
          file_path: string
          filename: string
          id: string
          title: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id?: string }
        Returns: {
          role_name: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          _action: string
          _new_values?: Json
          _old_values?: Json
          _record_id?: string
          _table_name?: string
        }
        Returns: undefined
      }
      search_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          filename: string
          id: string
          insurance_company: string
          insurance_type: string
          similarity: number
          summary: string
          title: string
        }[]
      }
      search_insurance_chunks: {
        Args: {
          insurer_filter?: string
          line_of_business_filter?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_text: string
          document_id: string
          document_title: string
          insurer_name: string
          metadata: Json
          page: number
          product_name: string
          section_id: string
          similarity: number
          version_label: string
        }[]
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
