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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alertes_incoherences: {
        Row: {
          created_at: string
          description: string
          id: string
          site_id: string
          sources: Json
          statut: string
          titre: string
          traitee_at: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          site_id: string
          sources?: Json
          statut?: string
          titre: string
          traitee_at?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          site_id?: string
          sources?: Json
          statut?: string
          titre?: string
          traitee_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertes_incoherences_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      complements: {
        Row: {
          created_at: string
          id: string
          question: string
          question_id: string | null
          reponse: string
          site_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question: string
          question_id?: string | null
          reponse: string
          site_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question?: string
          question_id?: string | null
          reponse?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complements_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_sans_reponse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      fiches_reflexes: {
        Row: {
          created_at: string
          etapes: Json
          id: string
          livret_id: string
          ordre: number
          page: number | null
          quand: string | null
          site_id: string
          statut: string
          titre: string
          validee_at: string | null
        }
        Insert: {
          created_at?: string
          etapes?: Json
          id?: string
          livret_id: string
          ordre?: number
          page?: number | null
          quand?: string | null
          site_id: string
          statut?: string
          titre: string
          validee_at?: string | null
        }
        Update: {
          created_at?: string
          etapes?: Json
          id?: string
          livret_id?: string
          ordre?: number
          page?: number | null
          quand?: string | null
          site_id?: string
          statut?: string
          titre?: string
          validee_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiches_reflexes_livret_id_fkey"
            columns: ["livret_id"]
            isOneToOne: false
            referencedRelation: "livrets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiches_reflexes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      livret_pages: {
        Row: {
          contenu: Json
          id: string
          livret_id: string
          numero: number
          texte_brut: string
          titre: string | null
        }
        Insert: {
          contenu?: Json
          id?: string
          livret_id: string
          numero: number
          texte_brut?: string
          titre?: string | null
        }
        Update: {
          contenu?: Json
          id?: string
          livret_id?: string
          numero?: number
          texte_brut?: string
          titre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livret_pages_livret_id_fkey"
            columns: ["livret_id"]
            isOneToOne: false
            referencedRelation: "livrets"
            referencedColumns: ["id"]
          },
        ]
      }
      livrets: {
        Row: {
          avertissement: string | null
          controle: Json | null
          created_at: string
          fichier_nom: string
          fichier_path: string
          format: string
          id: string
          nb_pages: number | null
          site_id: string
          statut: string
          titre: string
          updated_at: string
        }
        Insert: {
          avertissement?: string | null
          controle?: Json | null
          created_at?: string
          fichier_nom: string
          fichier_path: string
          format: string
          id?: string
          nb_pages?: number | null
          site_id: string
          statut?: string
          titre: string
          updated_at?: string
        }
        Update: {
          avertissement?: string | null
          controle?: Json | null
          created_at?: string
          fichier_nom?: string
          fichier_path?: string
          format?: string
          id?: string
          nb_pages?: number | null
          site_id?: string
          statut?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "livrets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_sans_reponse: {
        Row: {
          created_at: string
          id: string
          posee_par: string | null
          question: string
          reponse: string | null
          site_id: string
          statut: string
          traitee_at: string | null
          traitee_par: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          posee_par?: string | null
          question: string
          reponse?: string | null
          site_id: string
          statut?: string
          traitee_at?: string | null
          traitee_par?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          posee_par?: string | null
          question?: string
          reponse?: string | null
          site_id?: string
          statut?: string
          traitee_at?: string | null
          traitee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_sans_reponse_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_members: {
        Row: {
          site_id: string
          user_id: string
        }
        Insert: {
          site_id: string
          user_id: string
        }
        Update: {
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_members_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          nom: string
          ville: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
          ville?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          ville?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_read_site: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "hotesse"
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
      app_role: ["super_admin", "hotesse"],
    },
  },
} as const
