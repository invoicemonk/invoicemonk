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
      accounting_preferences: {
        Row: {
          account_id: string
          account_type: string
          created_at: string
          default_accounting_period: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          account_type: string
          created_at?: string
          default_accounting_period?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          account_type?: string
          created_at?: string
          default_accounting_period?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          business_id: string | null
          entity_id: string | null
          entity_type: string
          event_hash: string | null
          event_type: Database["public"]["Enums"]["audit_event_type"]
          id: string
          metadata: Json | null
          new_state: Json | null
          previous_state: Json | null
          source_ip: unknown
          timestamp_utc: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          business_id?: string | null
          entity_id?: string | null
          entity_type: string
          event_hash?: string | null
          event_type: Database["public"]["Enums"]["audit_event_type"]
          id?: string
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          source_ip?: unknown
          timestamp_utc?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          business_id?: string | null
          entity_id?: string | null
          entity_type?: string
          event_hash?: string | null
          event_type?: Database["public"]["Enums"]["audit_event_type"]
          id?: string
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          source_ip?: unknown
          timestamp_utc?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      business_compliance_analytics: {
        Row: {
          artifact_count: number
          avg_score: number
          blocked_count: number
          business_id: string
          id: string
          last_updated: string
          period: string
          total_invoices: number
          warning_count: number
        }
        Insert: {
          artifact_count?: number
          avg_score?: number
          blocked_count?: number
          business_id: string
          id?: string
          last_updated?: string
          period?: string
          total_invoices?: number
          warning_count?: number
        }
        Update: {
          artifact_count?: number
          avg_score?: number
          blocked_count?: number
          business_id?: string
          id?: string
          last_updated?: string
          period?: string
          total_invoices?: number
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_compliance_analytics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: Json | null
          allowed_currencies: string[] | null
          brand_color: string | null
          business_identity_level: string | null
          business_type: string | null
          cac_number: string | null
          compliance_status: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          currency_locked: boolean | null
          currency_locked_at: string | null
          default_currency: string | null
          flag_reason: string | null
          id: string
          invoice_number_digits: number
          invoice_prefix: string | null
          is_default: boolean | null
          is_flagged: boolean
          is_vat_registered: boolean | null
          jurisdiction: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          next_invoice_number: number | null
          next_receipt_number: number
          registration_status: string | null
          regulator_code: string | null
          tax_id: string | null
          updated_at: string
          vat_registration_number: string | null
        }
        Insert: {
          address?: Json | null
          allowed_currencies?: string[] | null
          brand_color?: string | null
          business_identity_level?: string | null
          business_type?: string | null
          cac_number?: string | null
          compliance_status?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency_locked?: boolean | null
          currency_locked_at?: string | null
          default_currency?: string | null
          flag_reason?: string | null
          id?: string
          invoice_number_digits?: number
          invoice_prefix?: string | null
          is_default?: boolean | null
          is_flagged?: boolean
          is_vat_registered?: boolean | null
          jurisdiction?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          next_invoice_number?: number | null
          next_receipt_number?: number
          registration_status?: string | null
          regulator_code?: string | null
          tax_id?: string | null
          updated_at?: string
          vat_registration_number?: string | null
        }
        Update: {
          address?: Json | null
          allowed_currencies?: string[] | null
          brand_color?: string | null
          business_identity_level?: string | null
          business_type?: string | null
          cac_number?: string | null
          compliance_status?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency_locked?: boolean | null
          currency_locked_at?: string | null
          default_currency?: string | null
          flag_reason?: string | null
          id?: string
          invoice_number_digits?: number
          invoice_prefix?: string | null
          is_default?: boolean | null
          is_flagged?: boolean
          is_vat_registered?: boolean | null
          jurisdiction?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          next_invoice_number?: number | null
          next_receipt_number?: number
          registration_status?: string | null
          regulator_code?: string | null
          tax_id?: string | null
          updated_at?: string
          vat_registration_number?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: Json | null
          business_id: string | null
          cac_number: string | null
          client_type: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: Json | null
          business_id?: string | null
          cac_number?: string | null
          client_type?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: Json | null
          business_id?: string | null
          cac_number?: string | null
          client_type?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          billing_event_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          currency: string
          gross_amount: number
          id: string
          locked_at: string | null
          paid_at: string | null
          partner_id: string
          payout_batch_id: string | null
          referral_id: string
          status: Database["public"]["Enums"]["commission_status"]
          subscription_id: string
        }
        Insert: {
          billing_event_id: string
          commission_amount: number
          commission_rate: number
          created_at?: string
          currency: string
          gross_amount: number
          id?: string
          locked_at?: string | null
          paid_at?: string | null
          partner_id: string
          payout_batch_id?: string | null
          referral_id: string
          status?: Database["public"]["Enums"]["commission_status"]
          subscription_id: string
        }
        Update: {
          billing_event_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          locked_at?: string | null
          paid_at?: string | null
          partner_id?: string
          payout_batch_id?: string | null
          referral_id?: string
          status?: Database["public"]["Enums"]["commission_status"]
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_artifacts: {
        Row: {
          artifact_data: Json
          artifact_hash: string
          artifact_type: string
          business_id: string
          created_by: string | null
          generated_at: string
          id: string
          invoice_id: string
          schema_version: string | null
          xml_content: string | null
          xml_generated_at: string | null
          xml_hash: string | null
        }
        Insert: {
          artifact_data: Json
          artifact_hash: string
          artifact_type: string
          business_id: string
          created_by?: string | null
          generated_at?: string
          id?: string
          invoice_id: string
          schema_version?: string | null
          xml_content?: string | null
          xml_generated_at?: string | null
          xml_hash?: string | null
        }
        Update: {
          artifact_data?: Json
          artifact_hash?: string
          artifact_type?: string
          business_id?: string
          created_by?: string | null
          generated_at?: string
          id?: string
          invoice_id?: string
          schema_version?: string | null
          xml_content?: string | null
          xml_generated_at?: string | null
          xml_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_artifacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_artifacts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_risks: {
        Row: {
          business_id: string | null
          created_at: string
          details: Json | null
          id: string
          invoice_id: string
          resolved: boolean
          risk_severity: string
          risk_type: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          invoice_id: string
          resolved?: boolean
          risk_severity: string
          risk_type: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          invoice_id?: string
          resolved?: boolean
          risk_severity?: string
          risk_type?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_system_policy: {
        Row: {
          id: boolean
          require_rules_for_jurisdiction: boolean
        }
        Insert: {
          id?: boolean
          require_rules_for_jurisdiction?: boolean
        }
        Update: {
          id?: boolean
          require_rules_for_jurisdiction?: boolean
        }
        Relationships: []
      }
      compliance_validation_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          jurisdiction: string
          rule_definition: Json
          rule_key: string
          rule_type: string
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          jurisdiction: string
          rule_definition?: Json
          rule_key: string
          rule_type: string
          severity: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          jurisdiction?: string
          rule_definition?: Json
          rule_key?: string
          rule_type?: string
          severity?: string
        }
        Relationships: []
      }
      credit_notes: {
        Row: {
          amount: number
          business_id: string | null
          created_at: string
          credit_note_hash: string | null
          credit_note_number: string
          currency: string | null
          currency_account_id: string | null
          exchange_rate_to_primary: number | null
          id: string
          issued_at: string
          issued_by: string | null
          original_invoice_id: string
          reason: string
          retention_locked_until: string | null
          user_id: string | null
          verification_id: string | null
        }
        Insert: {
          amount: number
          business_id?: string | null
          created_at?: string
          credit_note_hash?: string | null
          credit_note_number: string
          currency?: string | null
          currency_account_id?: string | null
          exchange_rate_to_primary?: number | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          original_invoice_id: string
          reason: string
          retention_locked_until?: string | null
          user_id?: string | null
          verification_id?: string | null
        }
        Update: {
          amount?: number
          business_id?: string | null
          created_at?: string
          credit_note_hash?: string | null
          credit_note_number?: string
          currency?: string | null
          currency_account_id?: string | null
          exchange_rate_to_primary?: number | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          original_invoice_id?: string
          reason?: string
          retention_locked_until?: string | null
          user_id?: string | null
          verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_currency_account_id_fkey"
            columns: ["currency_account_id"]
            isOneToOne: false
            referencedRelation: "currency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_accounts: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          id: string
          is_default: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency: string
          id?: string
          is_default?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      disposable_email_domains: {
        Row: {
          domain: string
        }
        Insert: {
          domain: string
        }
        Update: {
          domain?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          business_id: string | null
          category: string
          created_at: string
          currency: string
          currency_account_id: string | null
          description: string | null
          exchange_rate_to_primary: number | null
          expense_date: string
          id: string
          notes: string | null
          primary_currency: string | null
          product_service_id: string | null
          receipt_url: string | null
          updated_at: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          business_id?: string | null
          category: string
          created_at?: string
          currency?: string
          currency_account_id?: string | null
          description?: string | null
          exchange_rate_to_primary?: number | null
          expense_date?: string
          id?: string
          notes?: string | null
          primary_currency?: string | null
          product_service_id?: string | null
          receipt_url?: string | null
          updated_at?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          business_id?: string | null
          category?: string
          created_at?: string
          currency?: string
          currency_account_id?: string | null
          description?: string | null
          exchange_rate_to_primary?: number | null
          expense_date?: string
          id?: string
          notes?: string | null
          primary_currency?: string | null
          product_service_id?: string | null
          receipt_url?: string | null
          updated_at?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_currency_account_id_fkey"
            columns: ["currency_account_id"]
            isOneToOne: false
            referencedRelation: "currency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      export_manifests: {
        Row: {
          actor_email: string
          actor_id: string
          actor_role: string | null
          business_id: string | null
          export_type: string
          format: string
          id: string
          integrity_hash: string
          record_count: number
          scope: Json
          source_ip: unknown
          timestamp_utc: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email: string
          actor_id: string
          actor_role?: string | null
          business_id?: string | null
          export_type: string
          format: string
          id?: string
          integrity_hash: string
          record_count: number
          scope: Json
          source_ip?: unknown
          timestamp_utc?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string
          actor_id?: string
          actor_role?: string | null
          business_id?: string | null
          export_type?: string
          format?: string
          id?: string
          integrity_hash?: string
          record_count?: number
          scope?: Json
          source_ip?: unknown
          timestamp_utc?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          discount_percent: number
          id: string
          invoice_id: string
          product_service_id: string | null
          quantity: number
          sort_order: number
          tax_amount: number
          tax_label: string | null
          tax_rate: number
          unit_price: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          discount_percent?: number
          id?: string
          invoice_id: string
          product_service_id?: string | null
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_label?: string | null
          tax_rate?: number
          unit_price: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          invoice_id?: string
          product_service_id?: string | null
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_label?: string | null
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          layout: Json
          name: string
          preview_url: string | null
          sort_order: number | null
          styles: Json | null
          supports_branding: boolean | null
          tier_required: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
          watermark_required: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          layout?: Json
          name: string
          preview_url?: string | null
          sort_order?: number | null
          styles?: Json | null
          supports_branding?: boolean | null
          tier_required?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          watermark_required?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          layout?: Json
          name?: string
          preview_url?: string | null
          sort_order?: number | null
          styles?: Json | null
          supports_branding?: boolean | null
          tier_required?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          watermark_required?: boolean | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_paid: number
          business_id: string | null
          client_id: string
          compliance_hash: string | null
          compliance_result: Json | null
          created_at: string
          currency: string
          currency_account_id: string | null
          currency_locked_at: string | null
          discount_amount: number
          due_date: string | null
          exchange_rate_snapshot: Json | null
          exchange_rate_to_primary: number | null
          id: string
          invoice_hash: string | null
          invoice_number: string
          is_reverse_charge: boolean
          issue_date: string | null
          issued_at: string | null
          issued_by: string | null
          issuer_snapshot: Json | null
          last_reminder_sent_at: string | null
          notes: string | null
          payment_method_id: string | null
          payment_method_snapshot: Json | null
          recipient_snapshot: Json | null
          regulatory_status: string
          reminder_count: number
          retention_locked_until: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          summary: string | null
          tax_amount: number
          tax_schema_id: string | null
          tax_schema_snapshot: Json | null
          tax_schema_version: string | null
          template_id: string | null
          template_snapshot: Json | null
          terms: string | null
          total_amount: number
          updated_at: string
          user_id: string | null
          verification_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid?: number
          business_id?: string | null
          client_id: string
          compliance_hash?: string | null
          compliance_result?: Json | null
          created_at?: string
          currency?: string
          currency_account_id?: string | null
          currency_locked_at?: string | null
          discount_amount?: number
          due_date?: string | null
          exchange_rate_snapshot?: Json | null
          exchange_rate_to_primary?: number | null
          id?: string
          invoice_hash?: string | null
          invoice_number: string
          is_reverse_charge?: boolean
          issue_date?: string | null
          issued_at?: string | null
          issued_by?: string | null
          issuer_snapshot?: Json | null
          last_reminder_sent_at?: string | null
          notes?: string | null
          payment_method_id?: string | null
          payment_method_snapshot?: Json | null
          recipient_snapshot?: Json | null
          regulatory_status?: string
          reminder_count?: number
          retention_locked_until?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          summary?: string | null
          tax_amount?: number
          tax_schema_id?: string | null
          tax_schema_snapshot?: Json | null
          tax_schema_version?: string | null
          template_id?: string | null
          template_snapshot?: Json | null
          terms?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
          verification_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number
          business_id?: string | null
          client_id?: string
          compliance_hash?: string | null
          compliance_result?: Json | null
          created_at?: string
          currency?: string
          currency_account_id?: string | null
          currency_locked_at?: string | null
          discount_amount?: number
          due_date?: string | null
          exchange_rate_snapshot?: Json | null
          exchange_rate_to_primary?: number | null
          id?: string
          invoice_hash?: string | null
          invoice_number?: string
          is_reverse_charge?: boolean
          issue_date?: string | null
          issued_at?: string | null
          issued_by?: string | null
          issuer_snapshot?: Json | null
          last_reminder_sent_at?: string | null
          notes?: string | null
          payment_method_id?: string | null
          payment_method_snapshot?: Json | null
          recipient_snapshot?: Json | null
          regulatory_status?: string
          reminder_count?: number
          retention_locked_until?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          summary?: string | null
          tax_amount?: number
          tax_schema_id?: string | null
          tax_schema_snapshot?: Json | null
          tax_schema_version?: string | null
          template_id?: string | null
          template_snapshot?: Json | null
          terms?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
          verification_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_currency_account_id_fkey"
            columns: ["currency_account_id"]
            isOneToOne: false
            referencedRelation: "currency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tax_schema_id_fkey"
            columns: ["tax_schema_id"]
            isOneToOne: false
            referencedRelation: "tax_schemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          business_id: string
          created_at: string
          currency_account_id: string
          display_name: string
          id: string
          instructions: Json
          is_default: boolean
          provider_type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency_account_id: string
          display_name: string
          id?: string
          instructions?: Json
          is_default?: boolean
          provider_type: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency_account_id?: string
          display_name?: string
          id?: string
          instructions?: Json
          is_default?: boolean
          provider_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_currency_account_id_fkey"
            columns: ["currency_account_id"]
            isOneToOne: false
            referencedRelation: "currency_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          business_id: string
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          invoice_id: string
          payment_id: string
          uploaded_by: string
        }
        Insert: {
          business_id: string
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          invoice_id: string
          payment_id: string
          uploaded_by: string
        }
        Update: {
          business_id?: string
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          invoice_id?: string
          payment_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency_account_id: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_reference: string | null
          recorded_by: string | null
          retention_locked_until: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency_account_id?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
          recorded_by?: string | null
          retention_locked_until?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency_account_id?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
          recorded_by?: string | null
          retention_locked_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_currency_account_id_fkey"
            columns: ["currency_account_id"]
            isOneToOne: false
            referencedRelation: "currency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batches: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          paid_at: string | null
          partner_id: string
          payment_method: string | null
          payment_reference: string | null
          status: Database["public"]["Enums"]["payout_batch_status"]
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          partner_id: string
          payment_method?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["payout_batch_status"]
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          partner_id?: string
          payment_method?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["payout_batch_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_regions: {
        Row: {
          country_code: string
          created_at: string | null
          currency: string
          id: string
          is_default: boolean | null
          monthly_price: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
          yearly_price: number | null
        }
        Insert: {
          country_code: string
          created_at?: string | null
          currency: string
          id?: string
          is_default?: boolean | null
          monthly_price: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          yearly_price?: number | null
        }
        Update: {
          country_code?: string
          created_at?: string | null
          currency?: string
          id?: string
          is_default?: boolean | null
          monthly_price?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          yearly_price?: number | null
        }
        Relationships: []
      }
      products_services: {
        Row: {
          business_id: string
          category: string | null
          created_at: string
          currency: string
          currency_account_id: string
          default_price: number
          description: string | null
          id: string
          income_account_id: string | null
          inventory_last_updated_at: string | null
          is_active: boolean
          low_stock_threshold: number | null
          name: string
          sku: string | null
          stock_quantity: number | null
          tax_applicable: boolean
          tax_rate: number | null
          track_inventory: boolean
          type: Database["public"]["Enums"]["product_service_type"]
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string
          currency: string
          currency_account_id: string
          default_price?: number
          description?: string | null
          id?: string
          income_account_id?: string | null
          inventory_last_updated_at?: string | null
          is_active?: boolean
          low_stock_threshold?: number | null
          name: string
          sku?: string | null
          stock_quantity?: number | null
          tax_applicable?: boolean
          tax_rate?: number | null
          track_inventory?: boolean
          type?: Database["public"]["Enums"]["product_service_type"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string
          currency?: string
          currency_account_id?: string
          default_price?: number
          description?: string | null
          id?: string
          income_account_id?: string | null
          inventory_last_updated_at?: string | null
          is_active?: boolean
          low_stock_threshold?: number | null
          name?: string
          sku?: string | null
          stock_quantity?: number | null
          tax_applicable?: boolean
          tax_rate?: number | null
          track_inventory?: boolean
          type?: Database["public"]["Enums"]["product_service_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_services_currency_account_id_fkey"
            columns: ["currency_account_id"]
            isOneToOne: false
            referencedRelation: "currency_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_closed_at: string | null
          account_status: string | null
          avatar_url: string | null
          closed_by: string | null
          closure_reason: string | null
          created_at: string | null
          email: string
          email_verified: boolean | null
          full_name: string | null
          has_selected_plan: boolean
          id: string
          updated_at: string | null
        }
        Insert: {
          account_closed_at?: string | null
          account_status?: string | null
          avatar_url?: string | null
          closed_by?: string | null
          closure_reason?: string | null
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          full_name?: string | null
          has_selected_plan?: boolean
          id: string
          updated_at?: string | null
        }
        Update: {
          account_closed_at?: string | null
          account_status?: string | null
          avatar_url?: string | null
          closed_by?: string | null
          closure_reason?: string | null
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          full_name?: string | null
          has_selected_plan?: boolean
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          currency: string
          currency_account_id: string | null
          id: string
          invoice_id: string
          invoice_snapshot: Json
          issued_at: string
          issuer_snapshot: Json
          payer_snapshot: Json
          payment_id: string
          payment_snapshot: Json
          receipt_hash: string
          receipt_number: string
          retention_locked_until: string
          verification_id: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          currency: string
          currency_account_id?: string | null
          id?: string
          invoice_id: string
          invoice_snapshot: Json
          issued_at?: string
          issuer_snapshot: Json
          payer_snapshot: Json
          payment_id: string
          payment_snapshot: Json
          receipt_hash: string
          receipt_number: string
          retention_locked_until: string
          verification_id?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          currency?: string
          currency_account_id?: string | null
          id?: string
          invoice_id?: string
          invoice_snapshot?: Json
          issued_at?: string
          issuer_snapshot?: Json
          payer_snapshot?: Json
          payment_id?: string
          payment_snapshot?: Json
          receipt_hash?: string
          receipt_number?: string
          retention_locked_until?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_currency_account_id_fkey"
            columns: ["currency_account_id"]
            isOneToOne: false
            referencedRelation: "currency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          link_id: string
          referrer_url: string | null
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          link_id: string
          referrer_url?: string | null
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          link_id?: string
          referrer_url?: string | null
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          landing_page: string | null
          partner_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          landing_page?: string | null
          partner_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          landing_page?: string | null
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_partners: {
        Row: {
          commission_rate: number
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          payout_details: Json | null
          payout_method: string | null
          status: Database["public"]["Enums"]["partner_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          name: string
          payout_details?: Json | null
          payout_method?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          payout_details?: Json | null
          payout_method?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_partners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          attributed_at: string
          commission_business_id: string | null
          created_at: string
          customer_ref: string
          first_click_at: string
          id: string
          is_self_referral: boolean
          link_id: string | null
          partner_id: string
          referred_user_id: string
        }
        Insert: {
          attributed_at?: string
          commission_business_id?: string | null
          created_at?: string
          customer_ref: string
          first_click_at: string
          id?: string
          is_self_referral?: boolean
          link_id?: string | null
          partner_id: string
          referred_user_id: string
        }
        Update: {
          attributed_at?: string
          commission_business_id?: string | null
          created_at?: string
          customer_ref?: string
          first_click_at?: string
          id?: string
          is_self_referral?: boolean
          link_id?: string | null
          partner_id?: string
          referred_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_commission_business_id_fkey"
            columns: ["commission_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regulator_submissions: {
        Row: {
          artifact_id: string
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          jurisdiction: string
          max_retries: number
          regulator_code: string
          resolved_at: string | null
          retry_count: number
          submission_reference: string | null
          submission_response: Json | null
          submission_status: string
          submitted_at: string | null
        }
        Insert: {
          artifact_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          jurisdiction: string
          max_retries?: number
          regulator_code: string
          resolved_at?: string | null
          retry_count?: number
          submission_reference?: string | null
          submission_response?: Json | null
          submission_status?: string
          submitted_at?: string | null
        }
        Update: {
          artifact_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          jurisdiction?: string
          max_retries?: number
          regulator_code?: string
          resolved_at?: string | null
          retry_count?: number
          submission_reference?: string | null
          submission_response?: Json | null
          submission_status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulator_submissions_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "compliance_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulator_submissions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulator_submissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_events: {
        Row: {
          business_id: string
          created_at: string
          event_payload: Json | null
          event_type: string
          id: string
          invoice_id: string | null
          submission_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          event_payload?: Json | null
          event_type: string
          id?: string
          invoice_id?: string | null
          submission_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          event_payload?: Json | null
          event_type?: string
          id?: string
          invoice_id?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "regulator_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          created_at: string | null
          entity_type: string
          id: string
          jurisdiction: string
          legal_basis: string | null
          retention_years: number
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          id?: string
          jurisdiction?: string
          legal_basis?: string | null
          retention_years?: number
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          id?: string
          jurisdiction?: string
          legal_basis?: string | null
          retention_years?: number
        }
        Relationships: []
      }
      submission_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          scheduled_at: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          scheduled_at?: string
          submission_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          scheduled_at?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_queue_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "regulator_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_currency: string | null
          business_id: string | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          pricing_region: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_currency?: string | null
          business_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          pricing_region?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_currency?: string | null
          business_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          pricing_region?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          attachments: string[] | null
          created_at: string
          id: string
          is_admin: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachments?: string[] | null
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_sender_id_profiles_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          attachments: string[] | null
          business_id: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: string[] | null
          business_id?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: string[] | null
          business_id?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_schemas: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean | null
          jurisdiction: string
          name: string
          rates: Json
          rules: Json | null
          version: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_from: string
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          jurisdiction: string
          name: string
          rates: Json
          rules?: Json | null
          version: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          jurisdiction?: string
          name?: string
          rates?: Json
          rules?: Json | null
          version?: string
        }
        Relationships: []
      }
      tier_limits: {
        Row: {
          created_at: string | null
          description: string | null
          feature: string
          id: string
          limit_type: string
          limit_value: number | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feature: string
          id?: string
          limit_type?: string
          limit_value?: number | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feature?: string
          id?: string
          limit_type?: string
          limit_value?: number | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
        }
        Relationships: []
      }
      user_activity_state: {
        Row: {
          created_at: string
          email_verified: boolean
          has_business: boolean
          last_abandoned_draft_email_at: string | null
          last_business_created_at: string | null
          last_first_invoice_email_at: string | null
          last_inactivity_email_at: string | null
          last_invoice_at: string | null
          last_login_at: string | null
          last_no_business_email_at: string | null
          last_no_invoice_email_at: string | null
          last_overdue_email_at: string | null
          last_unverified_email_at: string | null
          last_upgrade_cta_email_at: string | null
          last_weekly_summary_email_at: string | null
          overdue_count: number
          total_invoices: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_verified?: boolean
          has_business?: boolean
          last_abandoned_draft_email_at?: string | null
          last_business_created_at?: string | null
          last_first_invoice_email_at?: string | null
          last_inactivity_email_at?: string | null
          last_invoice_at?: string | null
          last_login_at?: string | null
          last_no_business_email_at?: string | null
          last_no_invoice_email_at?: string | null
          last_overdue_email_at?: string | null
          last_unverified_email_at?: string | null
          last_upgrade_cta_email_at?: string | null
          last_weekly_summary_email_at?: string | null
          overdue_count?: number
          total_invoices?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_verified?: boolean
          has_business?: boolean
          last_abandoned_draft_email_at?: string | null
          last_business_created_at?: string | null
          last_first_invoice_email_at?: string | null
          last_inactivity_email_at?: string | null
          last_invoice_at?: string | null
          last_login_at?: string | null
          last_no_business_email_at?: string | null
          last_no_invoice_email_at?: string | null
          last_overdue_email_at?: string | null
          last_unverified_email_at?: string | null
          last_upgrade_cta_email_at?: string | null
          last_weekly_summary_email_at?: string | null
          overdue_count?: number
          total_invoices?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_login_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          browser_notifications: boolean
          created_at: string
          email_invoice_issued: boolean
          email_overdue_alerts: boolean
          email_payment_received: boolean
          email_payment_reminders: boolean
          overdue_reminder_enabled: boolean | null
          overdue_reminder_schedule: Json | null
          reminder_days_before: number
          reminder_email_template: string | null
          reminder_schedule: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          browser_notifications?: boolean
          created_at?: string
          email_invoice_issued?: boolean
          email_overdue_alerts?: boolean
          email_payment_received?: boolean
          email_payment_reminders?: boolean
          overdue_reminder_enabled?: boolean | null
          overdue_reminder_schedule?: Json | null
          reminder_days_before?: number
          reminder_email_template?: string | null
          reminder_schedule?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          browser_notifications?: boolean
          created_at?: string
          email_invoice_issued?: boolean
          email_overdue_alerts?: boolean
          email_payment_received?: boolean
          email_payment_reminders?: boolean
          overdue_reminder_enabled?: boolean | null
          overdue_reminder_schedule?: Json | null
          reminder_days_before?: number
          reminder_email_template?: string | null
          reminder_schedule?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_access_logs: {
        Row: {
          accessed_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          verification_id: string
        }
        Insert: {
          accessed_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          verification_id: string
        }
        Update: {
          accessed_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          verification_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ban_user: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      canonicalize_jsonb: { Args: { p_input: Json }; Returns: string }
      check_currency_account_limit: {
        Args: { _business_id: string }
        Returns: Json
      }
      check_payment_method_limit: {
        Args: { _business_id: string; _currency_account_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_key: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      check_tier_limit: {
        Args: { _feature: string; _user_id: string }
        Returns: Json
      }
      check_tier_limit_business: {
        Args: { _business_id: string; _feature: string }
        Returns: Json
      }
      cleanup_rate_limit_log: { Args: never; Returns: number }
      close_account: {
        Args: { _reason?: string; _user_id: string }
        Returns: undefined
      }
      create_notification: {
        Args: {
          _business_id?: string
          _entity_id?: string
          _entity_type?: string
          _message: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      create_receipt_from_payment: {
        Args: { _payment_id: string }
        Returns: string
      }
      create_regulatory_submission: {
        Args: {
          p_artifact_id: string
          p_business_id: string
          p_created_by?: string
          p_invoice_id: string
          p_jurisdiction: string
          p_regulator_code: string
        }
        Returns: string
      }
      delete_empty_business: {
        Args: { _business_id: string }
        Returns: undefined
      }
      generate_invoice_number: {
        Args: { _business_id: string }
        Returns: string
      }
      get_accounting_stats: {
        Args: {
          _business_id: string
          _currency_account_id?: string
          _date_end?: string
          _date_start?: string
        }
        Returns: Json
      }
      get_dashboard_stats: {
        Args: {
          _business_id: string
          _currency_account_id?: string
          _date_end?: string
          _date_start?: string
        }
        Returns: Json
      }
      get_due_date_stats: {
        Args: { _business_id: string; _currency_account_id?: string }
        Returns: Json
      }
      get_expenses_by_category: {
        Args: {
          _business_id: string
          _currency_account_id?: string
          _date_end?: string
          _date_start?: string
        }
        Returns: {
          amount: number
          category: string
        }[]
      }
      get_platform_admin_emails: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_revenue_trend: {
        Args: {
          _business_id: string
          _currency_account_id?: string
          _months?: number
        }
        Returns: {
          invoice_count: number
          month: string
          revenue: number
        }[]
      }
      has_audit_access: { Args: { _user_id: string }; Returns: boolean }
      has_business_role: {
        Args: {
          _business_id: string
          _role: Database["public"]["Enums"]["business_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _org_id?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tier: {
        Args: {
          _required_tier: Database["public"]["Enums"]["subscription_tier"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      issue_invoice: { Args: { _invoice_id: string }; Returns: Json }
      log_audit_event: {
        Args: {
          _business_id?: string
          _entity_id?: string
          _entity_type: string
          _event_type: Database["public"]["Enums"]["audit_event_type"]
          _metadata?: Json
          _new_state?: Json
          _previous_state?: Json
          _user_id?: string
        }
        Returns: string
      }
      nextval: { Args: { seq_name: string }; Returns: number }
      notify_admin_first_invoice_issued: {
        Args: {
          _business_id: string
          _invoice_id: string
          _invoice_number: string
        }
        Returns: undefined
      }
      notify_admin_payment_failed: {
        Args: { _business_name: string; _subscription_id: string }
        Returns: undefined
      }
      unban_user: { Args: { _user_id: string }; Returns: undefined }
      update_compliance_analytics: {
        Args: { p_business_id: string; p_compliance_result: Json }
        Returns: undefined
      }
      update_submission_status: {
        Args: {
          p_new_status: string
          p_reference?: string
          p_response?: Json
          p_submission_id: string
        }
        Returns: undefined
      }
      validate_compliance: { Args: { p_invoice_id: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "user"
        | "business_admin"
        | "team_member"
        | "auditor"
        | "platform_admin"
        | "partner"
      audit_event_type:
        | "USER_LOGIN"
        | "USER_LOGOUT"
        | "USER_SIGNUP"
        | "EMAIL_VERIFIED"
        | "PASSWORD_RESET"
        | "INVOICE_CREATED"
        | "INVOICE_UPDATED"
        | "INVOICE_ISSUED"
        | "INVOICE_SENT"
        | "INVOICE_VIEWED"
        | "INVOICE_VOIDED"
        | "INVOICE_CREDITED"
        | "PAYMENT_RECORDED"
        | "CLIENT_CREATED"
        | "CLIENT_UPDATED"
        | "BUSINESS_CREATED"
        | "BUSINESS_UPDATED"
        | "TEAM_MEMBER_ADDED"
        | "TEAM_MEMBER_REMOVED"
        | "ROLE_CHANGED"
        | "DATA_EXPORTED"
        | "SUBSCRIPTION_CHANGED"
        | "SETTINGS_UPDATED"
        | "ACCOUNT_CLOSED"
        | "RECEIPT_ISSUED"
        | "RECEIPT_VIEWED"
        | "RECEIPT_EXPORTED"
        | "RETENTION_CLEANUP"
        | "BUSINESS_DELETED"
        | "SUPPORT_TICKET_CREATED"
        | "SUPPORT_TICKET_REPLY"
        | "PAYMENT_METHOD_CREATED"
        | "PAYMENT_METHOD_UPDATED"
        | "PAYMENT_METHOD_DELETED"
        | "PROOF_UPLOADED"
        | "PARTNER_CREATED"
        | "PARTNER_UPDATED"
        | "COMMISSION_CREATED"
        | "COMMISSION_LOCKED"
        | "COMMISSION_VOIDED"
        | "PAYOUT_CREATED"
        | "PAYOUT_PAID"
        | "REFERRAL_ATTRIBUTED"
        | "XML_ARTIFACT_GENERATED"
        | "REGULATORY_SUBMISSION_CREATED"
        | "REGULATORY_STATUS_CHANGED"
        | "USER_SUSPENDED"
        | "USER_REACTIVATED"
      business_role: "owner" | "admin" | "member" | "auditor"
      commission_status: "pending" | "locked" | "paid" | "voided"
      invoice_status:
        | "draft"
        | "issued"
        | "sent"
        | "viewed"
        | "paid"
        | "voided"
        | "credited"
      partner_status: "active" | "paused" | "suspended"
      payout_batch_status: "draft" | "processing" | "paid" | "cancelled"
      product_service_type: "product" | "service"
      subscription_status: "active" | "cancelled" | "past_due" | "trialing"
      subscription_tier:
        | "starter"
        | "starter_paid"
        | "professional"
        | "business"
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
      app_role: [
        "user",
        "business_admin",
        "team_member",
        "auditor",
        "platform_admin",
        "partner",
      ],
      audit_event_type: [
        "USER_LOGIN",
        "USER_LOGOUT",
        "USER_SIGNUP",
        "EMAIL_VERIFIED",
        "PASSWORD_RESET",
        "INVOICE_CREATED",
        "INVOICE_UPDATED",
        "INVOICE_ISSUED",
        "INVOICE_SENT",
        "INVOICE_VIEWED",
        "INVOICE_VOIDED",
        "INVOICE_CREDITED",
        "PAYMENT_RECORDED",
        "CLIENT_CREATED",
        "CLIENT_UPDATED",
        "BUSINESS_CREATED",
        "BUSINESS_UPDATED",
        "TEAM_MEMBER_ADDED",
        "TEAM_MEMBER_REMOVED",
        "ROLE_CHANGED",
        "DATA_EXPORTED",
        "SUBSCRIPTION_CHANGED",
        "SETTINGS_UPDATED",
        "ACCOUNT_CLOSED",
        "RECEIPT_ISSUED",
        "RECEIPT_VIEWED",
        "RECEIPT_EXPORTED",
        "RETENTION_CLEANUP",
        "BUSINESS_DELETED",
        "SUPPORT_TICKET_CREATED",
        "SUPPORT_TICKET_REPLY",
        "PAYMENT_METHOD_CREATED",
        "PAYMENT_METHOD_UPDATED",
        "PAYMENT_METHOD_DELETED",
        "PROOF_UPLOADED",
        "PARTNER_CREATED",
        "PARTNER_UPDATED",
        "COMMISSION_CREATED",
        "COMMISSION_LOCKED",
        "COMMISSION_VOIDED",
        "PAYOUT_CREATED",
        "PAYOUT_PAID",
        "REFERRAL_ATTRIBUTED",
        "XML_ARTIFACT_GENERATED",
        "REGULATORY_SUBMISSION_CREATED",
        "REGULATORY_STATUS_CHANGED",
        "USER_SUSPENDED",
        "USER_REACTIVATED",
      ],
      business_role: ["owner", "admin", "member", "auditor"],
      commission_status: ["pending", "locked", "paid", "voided"],
      invoice_status: [
        "draft",
        "issued",
        "sent",
        "viewed",
        "paid",
        "voided",
        "credited",
      ],
      partner_status: ["active", "paused", "suspended"],
      payout_batch_status: ["draft", "processing", "paid", "cancelled"],
      product_service_type: ["product", "service"],
      subscription_status: ["active", "cancelled", "past_due", "trialing"],
      subscription_tier: [
        "starter",
        "starter_paid",
        "professional",
        "business",
      ],
    },
  },
} as const
