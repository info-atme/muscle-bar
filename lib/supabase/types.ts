// この型定義は supabase gen types typescript --linked で自動生成するのが推奨。
// Supabase連携前の開発用に手動で定義しておく。

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      staff: {
        Row: {
          id: string
          auth_user_id: string | null
          name: string
          role: 'owner' | 'manager' | 'staff'
          back_op: number
          back_kanpai: number
          back_tip: number
          back_champagne: number
          back_orichan: number
          line_user_id: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          name: string
          role: 'owner' | 'manager' | 'staff'
          back_op?: number
          back_kanpai?: number
          back_tip?: number
          back_champagne?: number
          back_orichan?: number
          line_user_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          name?: string
          role?: 'owner' | 'manager' | 'staff'
          back_op?: number
          back_kanpai?: number
          back_tip?: number
          back_champagne?: number
          back_orichan?: number
          line_user_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      daily_summary: {
        Row: {
          id: string
          date: string
          cash_amount: number
          card_amount: number
          total_amount: number
          group_count: number
          guest_count: number
          male_count: number
          female_count: number
          new_count: number
          repeat_count: number
          weather: string | null
          entered_by: string | null
          approved_by: string | null
          approved_at: string | null
          status: 'draft' | 'approved'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          cash_amount?: number
          card_amount?: number
          group_count?: number
          guest_count?: number
          male_count?: number
          female_count?: number
          new_count?: number
          repeat_count?: number
          weather?: string | null
          entered_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: 'draft' | 'approved'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          cash_amount?: number
          card_amount?: number
          group_count?: number
          guest_count?: number
          male_count?: number
          female_count?: number
          new_count?: number
          repeat_count?: number
          weather?: string | null
          entered_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: 'draft' | 'approved'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'daily_summary_entered_by_fkey'
            columns: ['entered_by']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'daily_summary_approved_by_fkey'
            columns: ['approved_by']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          }
        ]
      }
      staff_performance: {
        Row: {
          id: string
          daily_summary_id: string
          staff_id: string
          op_count: number
          kanpai_count: number
          tip_amount: number
          champagne_amount: number
          orichan_amount: number
          back_total: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          daily_summary_id: string
          staff_id: string
          op_count?: number
          kanpai_count?: number
          tip_amount?: number
          champagne_amount?: number
          orichan_amount?: number
          back_total?: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          daily_summary_id?: string
          staff_id?: string
          op_count?: number
          kanpai_count?: number
          tip_amount?: number
          champagne_amount?: number
          orichan_amount?: number
          back_total?: number
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'staff_performance_daily_summary_id_fkey'
            columns: ['daily_summary_id']
            isOneToOne: false
            referencedRelation: 'daily_summary'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staff_performance_staff_id_fkey'
            columns: ['staff_id']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          }
        ]
      }
      events: {
        Row: {
          id: string
          title: string
          event_date: string | null
          budget: number | null
          kpi: Json | null
          checklist: Json | null
          notify_recipients: Json | null
          status: 'planning' | 'active' | 'done'
          is_template: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          event_date?: string | null
          budget?: number | null
          kpi?: Json | null
          checklist?: Json | null
          notify_recipients?: Json | null
          status?: 'planning' | 'active' | 'done'
          is_template?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          event_date?: string | null
          budget?: number | null
          kpi?: Json | null
          checklist?: Json | null
          notify_recipients?: Json | null
          status?: 'planning' | 'active' | 'done'
          is_template?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          title: string
          assigned_to: string | null
          event_id: string | null
          due_date: string | null
          priority: 'urgent' | 'high' | 'normal'
          status: 'todo' | 'in_progress' | 'done'
          notify_recipients: Json | null
          note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          assigned_to?: string | null
          event_id?: string | null
          due_date?: string | null
          priority?: 'urgent' | 'high' | 'normal'
          status?: 'todo' | 'in_progress' | 'done'
          notify_recipients?: Json | null
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          assigned_to?: string | null
          event_id?: string | null
          due_date?: string | null
          priority?: 'urgent' | 'high' | 'normal'
          status?: 'todo' | 'in_progress' | 'done'
          notify_recipients?: Json | null
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'staff'
            referencedColumns: ['id']
          }
        ]
      }
      notification_rules: {
        Row: {
          id: string
          trigger_type: string
          trigger_value: Json | null
          send_time: string | null
          recipients: Json
          message_template: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          trigger_type: string
          trigger_value?: Json | null
          send_time?: string | null
          recipients: Json
          message_template: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          trigger_type?: string
          trigger_value?: Json | null
          send_time?: string | null
          recipients?: Json
          message_template?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      staff_performance_public: {
        Row: {
          id: string
          daily_summary_id: string
          staff_id: string
          op_count: number
          kanpai_count: number
          tip_amount: number
          champagne_amount: number
          orichan_amount: number
          back_total: number | null
          note: string | null
          created_at: string
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
