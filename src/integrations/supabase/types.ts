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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          created_at: string
          id: string
          influencer_id: string | null
          kind: string
          owner_id: string | null
          project_id: string | null
          prompt: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          influencer_id?: string | null
          kind: string
          owner_id?: string | null
          project_id?: string | null
          prompt?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          influencer_id?: string | null
          kind?: string
          owner_id?: string | null
          project_id?: string | null
          prompt?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_images_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          model: string | null
          owner_id: string | null
          project_id: string | null
          status: string
          task: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          model?: string | null
          owner_id?: string | null
          project_id?: string | null
          status: string
          task: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          model?: string | null
          owner_id?: string | null
          project_id?: string | null
          status?: string
          task?: string
        }
        Relationships: []
      }
      hook_categories: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      hooks: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          is_favorite: boolean
          notes: string | null
          owner_id: string | null
          source: string
          template: string
          usage_count: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          notes?: string | null
          owner_id?: string | null
          source?: string
          template: string
          usage_count?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          notes?: string | null
          owner_id?: string | null
          source?: string
          template?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "hooks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "hook_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          age_range: string | null
          appearance: Json
          created_at: string
          description: string | null
          gender: string | null
          id: string
          identity: string | null
          name: string
          niche: string | null
          owner_id: string | null
          reference_image_urls: string[]
          style: string | null
          updated_at: string
          visual_traits: string | null
        }
        Insert: {
          age_range?: string | null
          appearance?: Json
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          identity?: string | null
          name: string
          niche?: string | null
          owner_id?: string | null
          reference_image_urls?: string[]
          style?: string | null
          updated_at?: string
          visual_traits?: string | null
        }
        Update: {
          age_range?: string | null
          appearance?: Json
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          identity?: string | null
          name?: string
          niche?: string | null
          owner_id?: string | null
          reference_image_urls?: string[]
          style?: string | null
          updated_at?: string
          visual_traits?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          analysis: Json | null
          created_at: string
          description: string | null
          id: string
          image_urls: string[]
          link: string | null
          name: string | null
          owner_id: string | null
          page_extract: string | null
          updated_at: string
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          image_urls?: string[]
          link?: string | null
          name?: string | null
          owner_id?: string | null
          page_extract?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          image_urls?: string[]
          link?: string | null
          name?: string | null
          owner_id?: string | null
          page_extract?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          created_at: string
          credits_balance: number | null
          display_name: string | null
          id: string
          plan: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          credits_balance?: number | null
          display_name?: string | null
          id?: string
          plan?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          credits_balance?: number | null
          display_name?: string | null
          id?: string
          plan?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          auto_mode: boolean
          caption: string | null
          created_at: string
          cta: string | null
          current_step: string
          hashtags: string[]
          hook: Json | null
          id: string
          influencer_id: string | null
          owner_id: string | null
          parent_project_id: string | null
          product_id: string | null
          scenes: Json
          script: Json | null
          settings: Json
          status: string
          strategy: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          auto_mode?: boolean
          caption?: string | null
          created_at?: string
          cta?: string | null
          current_step?: string
          hashtags?: string[]
          hook?: Json | null
          id?: string
          influencer_id?: string | null
          owner_id?: string | null
          parent_project_id?: string | null
          product_id?: string | null
          scenes?: Json
          script?: Json | null
          settings?: Json
          status?: string
          strategy?: Json | null
          title?: string
          updated_at?: string
        }
        Update: {
          auto_mode?: boolean
          caption?: string | null
          created_at?: string
          cta?: string | null
          current_step?: string
          hashtags?: string[]
          hook?: Json | null
          id?: string
          influencer_id?: string | null
          owner_id?: string | null
          parent_project_id?: string | null
          product_id?: string | null
          scenes?: Json
          script?: Json | null
          settings?: Json
          status?: string
          strategy?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_project_id_fkey"
            columns: ["parent_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
