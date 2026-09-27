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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      token_assets: {
        Row: {
          created_at: string
          decimals: number | null
          logo_url: string | null
          mint: string
          name: string | null
          symbol: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decimals?: number | null
          logo_url?: string | null
          mint: string
          name?: string | null
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decimals?: number | null
          logo_url?: string | null
          mint?: string
          name?: string | null
          symbol?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          block_time: string | null
          confidence: string
          created_at: string
          direction: string
          fee_lamports: number | null
          id: string
          input_amount: number
          input_decimals: number
          input_mint: string
          output_amount: number
          output_decimals: number
          output_mint: string
          parser_version: number
          protocol: string | null
          signature: string
          source: string | null
          transaction_id: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          block_time?: string | null
          confidence: string
          created_at?: string
          direction?: string
          fee_lamports?: number | null
          id?: string
          input_amount: number
          input_decimals: number
          input_mint: string
          output_amount: number
          output_decimals: number
          output_mint: string
          parser_version?: number
          protocol?: string | null
          signature: string
          source?: string | null
          transaction_id: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          block_time?: string | null
          confidence?: string
          created_at?: string
          direction?: string
          fee_lamports?: number | null
          id?: string
          input_amount?: number
          input_decimals?: number
          input_mint?: string
          output_amount?: number
          output_decimals?: number
          output_mint?: string
          parser_version?: number
          protocol?: string | null
          signature?: string
          source?: string | null
          transaction_id?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_input_mint_fkey"
            columns: ["input_mint"]
            isOneToOne: false
            referencedRelation: "token_assets"
            referencedColumns: ["mint"]
          },
          {
            foreignKeyName: "trades_output_mint_fkey"
            columns: ["output_mint"]
            isOneToOne: false
            referencedRelation: "token_assets"
            referencedColumns: ["mint"]
          },
          {
            foreignKeyName: "trades_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          block_time: string | null
          created_at: string
          fee_lamports: number | null
          id: string
          parsed_type: string
          parser_version: number
          programs: string[]
          raw_transaction_reference: string | null
          signature: string
          slot: number
          source: string | null
          status: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          block_time?: string | null
          created_at?: string
          fee_lamports?: number | null
          id?: string
          parsed_type?: string
          parser_version?: number
          programs?: string[]
          raw_transaction_reference?: string | null
          signature: string
          slot: number
          source?: string | null
          status: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          block_time?: string | null
          created_at?: string
          fee_lamports?: number | null
          id?: string
          parsed_type?: string
          parser_version?: number
          programs?: string[]
          raw_transaction_reference?: string | null
          signature?: string
          slot?: number
          source?: string | null
          status?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          address: string
          backfill_complete: boolean
          created_at: string
          first_seen_at: string
          id: string
          last_signature: string | null
          last_synced_at: string | null
          newest_block_time: string | null
          newest_signature: string | null
          oldest_block_time: string | null
          oldest_signature: string | null
          profile_id: string
          sync_error: string | null
          sync_started_at: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          address: string
          backfill_complete?: boolean
          created_at?: string
          first_seen_at?: string
          id?: string
          last_signature?: string | null
          last_synced_at?: string | null
          newest_block_time?: string | null
          newest_signature?: string | null
          oldest_block_time?: string | null
          oldest_signature?: string | null
          profile_id: string
          sync_error?: string | null
          sync_started_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          backfill_complete?: boolean
          created_at?: string
          first_seen_at?: string
          id?: string
          last_signature?: string | null
          last_synced_at?: string | null
          newest_block_time?: string | null
          newest_signature?: string | null
          oldest_block_time?: string | null
          oldest_signature?: string | null
          profile_id?: string
          sync_error?: string | null
          sync_started_at?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_username: { Args: { _u: string }; Returns: string }
      is_reserved_username: { Args: { _u: string }; Returns: boolean }
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
