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
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
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
          id: string
          invoice_prefix: string | null
          is_default: boolean | null
          is_vat_registered: boolean | null
          jurisdiction: string
          legal_name: string | null
          logo_url: string | null
          name: string
          next_invoice_number: number | null
          registration_status: string | null
          tax_id: string | null
          updated_at: string
          vat_registration_number: string | null
        }
        Insert: {
          address?: Json | null
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
          id?: string
          invoice_prefix?: string | null
          is_default?: boolean | null
          is_vat_registered?: boolean | null
          jurisdiction?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          next_invoice_number?: number | null
          registration_status?: string | null
          tax_id?: string | null
          updated_at?: string
          vat_registration_number?: string | null
        }
        Update: {
          address?: Json | null
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
          id?: string
          invoice_prefix?: string | null
          is_default?: boolean | null
          is_vat_registered?: boolean | null
          jurisdiction?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          next_invoice_number?: number | null
          registration_status?: string | null
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
      credit_notes: {
        Row: {
          amount: number
          business_id: string | null
          created_at: string
          credit_note_hash: string | null
          credit_note_number: string
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
            foreignKeyName: "credit_notes_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string | null
          category: string
          created_at: string
          currency: string
          description: string | null
          expense_date: string
          id: string
          notes: string | null
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
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
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
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
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
          quantity: number
          sort_order: number
          tax_amount: number
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
          quantity?: number
          sort_order?: number
          tax_amount?: number
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
          quantity?: number
          sort_order?: number
          tax_amount?: number
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
          created_at: string
          currency: string
          currency_locked_at: string | null
          discount_amount: number
          due_date: string | null
          id: string
          invoice_hash: string | null
          invoice_number: string
          issue_date: string | null
          issued_at: string | null
          issued_by: string | null
          issuer_snapshot: Json | null
          notes: string | null
          recipient_snapshot: Json | null
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
          created_at?: string
          currency?: string
          currency_locked_at?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_hash?: string | null
          invoice_number: string
          issue_date?: string | null
          issued_at?: string | null
          issued_by?: string | null
          issuer_snapshot?: Json | null
          notes?: string | null
          recipient_snapshot?: Json | null
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
          created_at?: string
          currency?: string
          currency_locked_at?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_hash?: string | null
          invoice_number?: string
          issue_date?: string | null
          issued_at?: string | null
          issued_by?: string | null
          issuer_snapshot?: Json | null
          notes?: string | null
          recipient_snapshot?: Json | null
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
      payments: {
        Row: {
          amount: number
          created_at: string
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
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
          id?: string
          updated_at?: string | null
        }
        Relationships: []
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
          priority_support: boolean | null
          sla_response_hours: number | null
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
          priority_support?: boolean | null
          sla_response_hours?: number | null
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
          priority_support?: boolean | null
          sla_response_hours?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_tier_limit: {
        Args: { _feature: string; _user_id: string }
        Returns: Json
      }
      check_tier_limit_business: {
        Args: { _business_id: string; _feature: string }
        Returns: Json
      }
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
      issue_invoice: {
        Args: { _invoice_id: string }
        Returns: {
          amount_paid: number
          business_id: string | null
          client_id: string
          created_at: string
          currency: string
          currency_locked_at: string | null
          discount_amount: number
          due_date: string | null
          id: string
          invoice_hash: string | null
          invoice_number: string
          issue_date: string | null
          issued_at: string | null
          issued_by: string | null
          issuer_snapshot: Json | null
          notes: string | null
          recipient_snapshot: Json | null
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
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
    }
    Enums: {
      app_role:
        | "user"
        | "business_admin"
        | "team_member"
        | "auditor"
        | "platform_admin"
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
      business_role: "owner" | "admin" | "member" | "auditor"
      invoice_status:
        | "draft"
        | "issued"
        | "sent"
        | "viewed"
        | "paid"
        | "voided"
        | "credited"
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
      ],
      business_role: ["owner", "admin", "member", "auditor"],
      invoice_status: [
        "draft",
        "issued",
        "sent",
        "viewed",
        "paid",
        "voided",
        "credited",
      ],
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
