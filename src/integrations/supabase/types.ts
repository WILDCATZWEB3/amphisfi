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
      evm_logs: {
        Row: {
          address: string
          block_number: number
          chain: string
          created_at: string
          data: string
          id: string
          log_index: number
          topic0: string | null
          topics: string[]
          transaction_hash: string
          transaction_id: string
        }
        Insert: {
          address: string
          block_number: number
          chain: string
          created_at?: string
          data?: string
          id?: string
          log_index: number
          topic0?: string | null
          topics?: string[]
          transaction_hash: string
          transaction_id: string
        }
        Update: {
          address?: string
          block_number?: number
          chain?: string
          created_at?: string
          data?: string
          id?: string
          log_index?: number
          topic0?: string | null
          topics?: string[]
          transaction_hash?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "evm_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_performance_snapshots: {
        Row: {
          calculated_at: string
          closed_trade_count: number
          data_completeness: string
          id: string
          losing_trades: number
          open_cost_basis_usd: number | null
          period: string
          priced_trade_count: number
          realized_pnl_usd: number | null
          trade_count: number
          volume_usd: number | null
          wallet_id: string
          win_rate: number | null
          winning_trades: number
        }
        Insert: {
          calculated_at?: string
          closed_trade_count?: number
          data_completeness?: string
          id?: string
          losing_trades?: number
          open_cost_basis_usd?: number | null
          period: string
          priced_trade_count?: number
          realized_pnl_usd?: number | null
          trade_count?: number
          volume_usd?: number | null
          wallet_id: string
          win_rate?: number | null
          winning_trades?: number
        }
        Update: {
          calculated_at?: string
          closed_trade_count?: number
          data_completeness?: string
          id?: string
          losing_trades?: number
          open_cost_basis_usd?: number | null
          period?: string
          priced_trade_count?: number
          realized_pnl_usd?: number | null
          trade_count?: number
          volume_usd?: number | null
          wallet_id?: string
          win_rate?: number | null
          winning_trades?: number
        }
        Relationships: [
          {
            foreignKeyName: "evm_performance_snapshots_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_position_lots: {
        Row: {
          acquired_at: string | null
          calculated_at: string
          cost_basis_usd: number
          id: string
          quantity: number
          remaining_cost_basis_usd: number
          remaining_quantity: number
          source_trade_id: string
          token: string
          wallet_id: string
        }
        Insert: {
          acquired_at?: string | null
          calculated_at?: string
          cost_basis_usd: number
          id?: string
          quantity: number
          remaining_cost_basis_usd: number
          remaining_quantity: number
          source_trade_id: string
          token: string
          wallet_id: string
        }
        Update: {
          acquired_at?: string | null
          calculated_at?: string
          cost_basis_usd?: number
          id?: string
          quantity?: number
          remaining_cost_basis_usd?: number
          remaining_quantity?: number
          source_trade_id?: string
          token?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_position_lots_source_trade_id_fkey"
            columns: ["source_trade_id"]
            isOneToOne: false
            referencedRelation: "evm_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evm_position_lots_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_price_snapshots: {
        Row: {
          chain: string
          created_at: string
          id: string
          observed_ts: number | null
          price_usd: number | null
          requested_ts: number
          source: string
          status: string
          token: string
        }
        Insert: {
          chain: string
          created_at?: string
          id?: string
          observed_ts?: number | null
          price_usd?: number | null
          requested_ts: number
          source: string
          status: string
          token: string
        }
        Update: {
          chain?: string
          created_at?: string
          id?: string
          observed_ts?: number | null
          price_usd?: number | null
          requested_ts?: number
          source?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      evm_realized_pnl: {
        Row: {
          calculated_at: string
          cost_basis_usd: number
          disposed_at: string | null
          fully_matched: boolean
          id: string
          matched_quantity: number
          pnl_usd: number
          proceeds_usd: number
          quantity: number
          token: string
          trade_id: string
          wallet_id: string
        }
        Insert: {
          calculated_at?: string
          cost_basis_usd: number
          disposed_at?: string | null
          fully_matched: boolean
          id?: string
          matched_quantity: number
          pnl_usd: number
          proceeds_usd: number
          quantity: number
          token: string
          trade_id: string
          wallet_id: string
        }
        Update: {
          calculated_at?: string
          cost_basis_usd?: number
          disposed_at?: string | null
          fully_matched?: boolean
          id?: string
          matched_quantity?: number
          pnl_usd?: number
          proceeds_usd?: number
          quantity?: number
          token?: string
          trade_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_realized_pnl_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "evm_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evm_realized_pnl_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_tokens: {
        Row: {
          address: string
          chain: string
          created_at: string
          decimals: number | null
          name: string | null
          symbol: string | null
          updated_at: string
        }
        Insert: {
          address: string
          chain: string
          created_at?: string
          decimals?: number | null
          name?: string | null
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          chain?: string
          created_at?: string
          decimals?: number | null
          name?: string | null
          symbol?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      evm_trades: {
        Row: {
          block_time: string | null
          bought_amount_raw: number
          bought_decimals: number | null
          bought_price_usd: number | null
          bought_token: string
          chain: string
          created_at: string
          id: string
          parser_version: number
          price_source: string | null
          sold_amount_raw: number
          sold_decimals: number | null
          sold_price_usd: number | null
          sold_token: string
          trade_value_usd: number | null
          transaction_hash: string
          transaction_id: string
          valuation_status: string
          valued_at: string | null
          wallet_id: string
        }
        Insert: {
          block_time?: string | null
          bought_amount_raw: number
          bought_decimals?: number | null
          bought_price_usd?: number | null
          bought_token: string
          chain?: string
          created_at?: string
          id?: string
          parser_version: number
          price_source?: string | null
          sold_amount_raw: number
          sold_decimals?: number | null
          sold_price_usd?: number | null
          sold_token: string
          trade_value_usd?: number | null
          transaction_hash: string
          transaction_id: string
          valuation_status?: string
          valued_at?: string | null
          wallet_id: string
        }
        Update: {
          block_time?: string | null
          bought_amount_raw?: number
          bought_decimals?: number | null
          bought_price_usd?: number | null
          bought_token?: string
          chain?: string
          created_at?: string
          id?: string
          parser_version?: number
          price_source?: string | null
          sold_amount_raw?: number
          sold_decimals?: number | null
          sold_price_usd?: number | null
          sold_token?: string
          trade_value_usd?: number | null
          transaction_hash?: string
          transaction_id?: string
          valuation_status?: string
          valued_at?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_trades_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "evm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evm_trades_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_transactions: {
        Row: {
          block_hash: string | null
          block_number: number
          block_time: string | null
          chain: string
          contract_address: string | null
          created_at: string
          effective_gas_price_wei: number | null
          from_address: string
          gas_limit: number | null
          gas_price_wei: number | null
          gas_used: number | null
          hash: string
          id: string
          input: string | null
          log_count: number
          method_selector: string | null
          nonce: number | null
          status: string
          to_address: string | null
          tx_index: number | null
          tx_type: string | null
          value_wei: number
        }
        Insert: {
          block_hash?: string | null
          block_number: number
          block_time?: string | null
          chain: string
          contract_address?: string | null
          created_at?: string
          effective_gas_price_wei?: number | null
          from_address: string
          gas_limit?: number | null
          gas_price_wei?: number | null
          gas_used?: number | null
          hash: string
          id?: string
          input?: string | null
          log_count?: number
          method_selector?: string | null
          nonce?: number | null
          status: string
          to_address?: string | null
          tx_index?: number | null
          tx_type?: string | null
          value_wei?: number
        }
        Update: {
          block_hash?: string | null
          block_number?: number
          block_time?: string | null
          chain?: string
          contract_address?: string | null
          created_at?: string
          effective_gas_price_wei?: number | null
          from_address?: string
          gas_limit?: number | null
          gas_price_wei?: number | null
          gas_used?: number | null
          hash?: string
          id?: string
          input?: string | null
          log_count?: number
          method_selector?: string | null
          nonce?: number | null
          status?: string
          to_address?: string | null
          tx_index?: number | null
          tx_type?: string | null
          value_wei?: number
        }
        Relationships: []
      }
      performance_snapshots: {
        Row: {
          average_trade_pnl_usd: number | null
          calculated_at: string
          closed_trade_count: number
          data_completeness: string
          id: string
          largest_loss_usd: number | null
          largest_win_usd: number | null
          losing_trades: number
          method: string
          network_fees_usd: number | null
          notes: string[]
          period: string
          priced_trade_count: number
          realized_pnl_usd: number | null
          total_pnl_usd: number | null
          trade_count: number
          unrealized_pnl_usd: number | null
          volume_usd: number | null
          wallet_id: string
          win_rate: number | null
          winning_trades: number
        }
        Insert: {
          average_trade_pnl_usd?: number | null
          calculated_at?: string
          closed_trade_count?: number
          data_completeness?: string
          id?: string
          largest_loss_usd?: number | null
          largest_win_usd?: number | null
          losing_trades?: number
          method?: string
          network_fees_usd?: number | null
          notes?: string[]
          period: string
          priced_trade_count?: number
          realized_pnl_usd?: number | null
          total_pnl_usd?: number | null
          trade_count?: number
          unrealized_pnl_usd?: number | null
          volume_usd?: number | null
          wallet_id: string
          win_rate?: number | null
          winning_trades?: number
        }
        Update: {
          average_trade_pnl_usd?: number | null
          calculated_at?: string
          closed_trade_count?: number
          data_completeness?: string
          id?: string
          largest_loss_usd?: number | null
          largest_win_usd?: number | null
          losing_trades?: number
          method?: string
          network_fees_usd?: number | null
          notes?: string[]
          period?: string
          priced_trade_count?: number
          realized_pnl_usd?: number | null
          total_pnl_usd?: number | null
          trade_count?: number
          unrealized_pnl_usd?: number | null
          volume_usd?: number | null
          wallet_id?: string
          win_rate?: number | null
          winning_trades?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_snapshots_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      position_lots: {
        Row: {
          acquired_at: string | null
          calculated_at: string
          cost_basis_usd: number
          id: string
          mint: string
          quantity: number
          remaining_cost_basis_usd: number
          remaining_quantity: number
          source_trade_id: string
          wallet_id: string
        }
        Insert: {
          acquired_at?: string | null
          calculated_at?: string
          cost_basis_usd: number
          id?: string
          mint: string
          quantity: number
          remaining_cost_basis_usd: number
          remaining_quantity: number
          source_trade_id: string
          wallet_id: string
        }
        Update: {
          acquired_at?: string | null
          calculated_at?: string
          cost_basis_usd?: number
          id?: string
          mint?: string
          quantity?: number
          remaining_cost_basis_usd?: number
          remaining_quantity?: number
          source_trade_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_lots_source_trade_id_fkey"
            columns: ["source_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_lots_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      price_snapshots: {
        Row: {
          created_at: string
          id: string
          mint: string
          observed_at: string | null
          price_usd: number | null
          requested_at: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          mint: string
          observed_at?: string | null
          price_usd?: number | null
          requested_at: string
          source: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          mint?: string
          observed_at?: string | null
          price_usd?: number | null
          requested_at?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
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
      realized_pnl: {
        Row: {
          calculated_at: string
          cost_basis_usd: number
          disposed_at: string | null
          fully_matched: boolean
          id: string
          matched_quantity: number
          mint: string
          pnl_usd: number
          price_source: string | null
          proceeds_usd: number
          quantity: number
          trade_id: string
          wallet_id: string
        }
        Insert: {
          calculated_at?: string
          cost_basis_usd: number
          disposed_at?: string | null
          fully_matched: boolean
          id?: string
          matched_quantity: number
          mint: string
          pnl_usd: number
          price_source?: string | null
          proceeds_usd: number
          quantity: number
          trade_id: string
          wallet_id: string
        }
        Update: {
          calculated_at?: string
          cost_basis_usd?: number
          disposed_at?: string | null
          fully_matched?: boolean
          id?: string
          matched_quantity?: number
          mint?: string
          pnl_usd?: number
          price_source?: string | null
          proceeds_usd?: number
          quantity?: number
          trade_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realized_pnl_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realized_pnl_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
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
      token_transfers: {
        Row: {
          amount_raw: number
          block_number: number
          block_time: string | null
          chain: string
          created_at: string
          from_address: string
          id: string
          log_index: number
          standard: string
          to_address: string
          token_address: string
          transaction_hash: string
          transaction_id: string
        }
        Insert: {
          amount_raw: number
          block_number: number
          block_time?: string | null
          chain: string
          created_at?: string
          from_address: string
          id?: string
          log_index: number
          standard?: string
          to_address: string
          token_address: string
          transaction_hash: string
          transaction_id: string
        }
        Update: {
          amount_raw?: number
          block_number?: number
          block_time?: string | null
          chain?: string
          created_at?: string
          from_address?: string
          id?: string
          log_index?: number
          standard?: string
          to_address?: string
          token_address?: string
          transaction_hash?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transfers_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "evm_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          block_time: string | null
          confidence: string
          created_at: string
          direction: string
          fee_lamports: number | null
          fee_usd: number | null
          id: string
          input_amount: number
          input_decimals: number
          input_mint: string
          input_value_usd: number | null
          output_amount: number
          output_decimals: number
          output_mint: string
          output_value_usd: number | null
          parser_version: number
          price_source: string | null
          price_timestamp: string | null
          protocol: string | null
          signature: string
          source: string | null
          trade_value_usd: number | null
          transaction_id: string
          updated_at: string
          valuation_status: string
          valued_at: string | null
          wallet_id: string
        }
        Insert: {
          block_time?: string | null
          confidence: string
          created_at?: string
          direction?: string
          fee_lamports?: number | null
          fee_usd?: number | null
          id?: string
          input_amount: number
          input_decimals: number
          input_mint: string
          input_value_usd?: number | null
          output_amount: number
          output_decimals: number
          output_mint: string
          output_value_usd?: number | null
          parser_version?: number
          price_source?: string | null
          price_timestamp?: string | null
          protocol?: string | null
          signature: string
          source?: string | null
          trade_value_usd?: number | null
          transaction_id: string
          updated_at?: string
          valuation_status?: string
          valued_at?: string | null
          wallet_id: string
        }
        Update: {
          block_time?: string | null
          confidence?: string
          created_at?: string
          direction?: string
          fee_lamports?: number | null
          fee_usd?: number | null
          id?: string
          input_amount?: number
          input_decimals?: number
          input_mint?: string
          input_value_usd?: number | null
          output_amount?: number
          output_decimals?: number
          output_mint?: string
          output_value_usd?: number | null
          parser_version?: number
          price_source?: string | null
          price_timestamp?: string | null
          protocol?: string | null
          signature?: string
          source?: string | null
          trade_value_usd?: number | null
          transaction_id?: string
          updated_at?: string
          valuation_status?: string
          valued_at?: string | null
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
      wallet_transactions: {
        Row: {
          block_number: number
          created_at: string
          id: string
          role: string
          transaction_id: string
          wallet_id: string
        }
        Insert: {
          block_number: number
          created_at?: string
          id?: string
          role: string
          transaction_id: string
          wallet_id: string
        }
        Update: {
          block_number?: number
          created_at?: string
          id?: string
          role?: string
          transaction_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "evm_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
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
          address_normalized: string | null
          backfill_complete: boolean
          blocks_processed: number
          chain: string
          created_at: string
          first_seen_at: string
          id: string
          is_primary: boolean
          last_indexed_block: number | null
          last_indexed_transaction: string | null
          last_signature: string | null
          last_synced_at: string | null
          newest_block_time: string | null
          newest_signature: string | null
          oldest_block_time: string | null
          oldest_indexed_block: number | null
          oldest_signature: string | null
          ownership_verified: boolean
          profile_id: string
          sync_error: string | null
          sync_started_at: string | null
          sync_status: string
          txs_discovered: number
          txs_stored: number
          updated_at: string
        }
        Insert: {
          address: string
          address_normalized?: string | null
          backfill_complete?: boolean
          blocks_processed?: number
          chain?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          is_primary?: boolean
          last_indexed_block?: number | null
          last_indexed_transaction?: string | null
          last_signature?: string | null
          last_synced_at?: string | null
          newest_block_time?: string | null
          newest_signature?: string | null
          oldest_block_time?: string | null
          oldest_indexed_block?: number | null
          oldest_signature?: string | null
          ownership_verified?: boolean
          profile_id: string
          sync_error?: string | null
          sync_started_at?: string | null
          sync_status?: string
          txs_discovered?: number
          txs_stored?: number
          updated_at?: string
        }
        Update: {
          address?: string
          address_normalized?: string | null
          backfill_complete?: boolean
          blocks_processed?: number
          chain?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          is_primary?: boolean
          last_indexed_block?: number | null
          last_indexed_transaction?: string | null
          last_signature?: string | null
          last_synced_at?: string | null
          newest_block_time?: string | null
          newest_signature?: string | null
          oldest_block_time?: string | null
          oldest_indexed_block?: number | null
          oldest_signature?: string | null
          ownership_verified?: boolean
          profile_id?: string
          sync_error?: string | null
          sync_started_at?: string | null
          sync_status?: string
          txs_discovered?: number
          txs_stored?: number
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
