// FIȘIER GENERAT — nu edita manual. Regenerare: npm run db:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      alerts: {
        Row: {
          id: string;
          club_id: string;
          player_id: string;
          kind: string;
          severity: string;
          alert_date: string;
          message: string;
          data: Json;
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          player_id: string;
          kind: string;
          severity?: string;
          alert_date: string;
          message: string;
          data?: Json;
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          player_id?: string;
          kind?: string;
          severity?: string;
          alert_date?: string;
          message?: string;
          data?: Json;
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: "alerts_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "alerts_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "alerts_resolved_by_fkey"; columns: ["resolved_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      allocations: {
        Row: {
          id: string;
          payment_id: string;
          charge_id: string;
          amount: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          charge_id: string;
          amount: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          charge_id?: string;
          amount?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "allocations_charge_id_fkey"; columns: ["charge_id"]; isOneToOne: false; referencedRelation: "charges"; referencedColumns: ["id"] },
          { foreignKeyName: "allocations_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "allocations_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] },
        ];
      };
      anthropometrics: {
        Row: {
          id: string;
          player_id: string;
          measured_on: string;
          height_cm: number | null;
          weight_kg: number | null;
          body_fat_pct: number | null;
          muscle_mass_kg: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          measured_on?: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          body_fat_pct?: number | null;
          muscle_mass_kg?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          measured_on?: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          body_fat_pct?: number | null;
          muscle_mass_kg?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "anthropometrics_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "anthropometrics_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      attendance: {
        Row: {
          event_id: string;
          player_id: string;
          status: string;
          reason: string | null;
          note: string | null;
          recorded_by: string | null;
          recorded_at: string;
          synced_at: string;
        };
        Insert: {
          event_id: string;
          player_id: string;
          status: string;
          reason?: string | null;
          note?: string | null;
          recorded_by?: string | null;
          recorded_at?: string;
          synced_at?: string;
        };
        Update: {
          event_id?: string;
          player_id?: string;
          status?: string;
          reason?: string | null;
          note?: string | null;
          recorded_by?: string | null;
          recorded_at?: string;
          synced_at?: string;
        };
        Relationships: [
          { foreignKeyName: "attendance_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "attendance_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "attendance_recorded_by_fkey"; columns: ["recorded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          club_id: string | null;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          player_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          club_id?: string | null;
          actor_id?: string | null;
          actor_role?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          player_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          club_id?: string | null;
          actor_id?: string | null;
          actor_role?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          player_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "audit_log_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      bank_lines: {
        Row: {
          id: string;
          club_id: string;
          statement_id: string;
          booked_on: string;
          amount: number;
          description: string | null;
          counterparty: string | null;
          line_hash: string;
          status: string;
          payment_id: string | null;
          expense_id: string | null;
          matched_by: string | null;
          matched_at: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          statement_id: string;
          booked_on: string;
          amount: number;
          description?: string | null;
          counterparty?: string | null;
          line_hash: string;
          status?: string;
          payment_id?: string | null;
          expense_id?: string | null;
          matched_by?: string | null;
          matched_at?: string | null;
          note?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          statement_id?: string;
          booked_on?: string;
          amount?: number;
          description?: string | null;
          counterparty?: string | null;
          line_hash?: string;
          status?: string;
          payment_id?: string | null;
          expense_id?: string | null;
          matched_by?: string | null;
          matched_at?: string | null;
          note?: string | null;
        };
        Relationships: [
          { foreignKeyName: "bank_lines_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "bank_lines_expense_fk"; columns: ["expense_id"]; isOneToOne: false; referencedRelation: "expenses"; referencedColumns: ["id"] },
          { foreignKeyName: "bank_lines_matched_by_fkey"; columns: ["matched_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "bank_lines_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] },
          { foreignKeyName: "bank_lines_statement_id_fkey"; columns: ["statement_id"]; isOneToOne: false; referencedRelation: "bank_statements"; referencedColumns: ["id"] },
        ];
      };
      bank_statements: {
        Row: {
          id: string;
          club_id: string;
          file_name: string;
          bank: string | null;
          period_from: string | null;
          period_to: string | null;
          line_count: number;
          imported_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          file_name: string;
          bank?: string | null;
          period_from?: string | null;
          period_to?: string | null;
          line_count?: number;
          imported_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          file_name?: string;
          bank?: string | null;
          period_from?: string | null;
          period_to?: string | null;
          line_count?: number;
          imported_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "bank_statements_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "bank_statements_imported_by_fkey"; columns: ["imported_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      bonus_entries: {
        Row: {
          id: string;
          club_id: string;
          rule_id: string;
          event_id: string;
          player_id: string | null;
          profile_id: string | null;
          quantity: number;
          amount: number;
          status: string;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          rule_id: string;
          event_id: string;
          player_id?: string | null;
          profile_id?: string | null;
          quantity?: number;
          amount: number;
          status?: string;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          rule_id?: string;
          event_id?: string;
          player_id?: string | null;
          profile_id?: string | null;
          quantity?: number;
          amount?: number;
          status?: string;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "bonus_entries_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "bonus_entries_decided_by_fkey"; columns: ["decided_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "bonus_entries_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "bonus_entries_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "bonus_entries_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "bonus_entries_rule_id_fkey"; columns: ["rule_id"]; isOneToOne: false; referencedRelation: "bonus_rules"; referencedColumns: ["id"] },
        ];
      };
      bonus_rules: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          target: string;
          group_id: string | null;
          competition_id: string | null;
          trigger: string;
          amount: number;
          is_active: boolean;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          target: string;
          group_id?: string | null;
          competition_id?: string | null;
          trigger: string;
          amount: number;
          is_active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          target?: string;
          group_id?: string | null;
          competition_id?: string | null;
          trigger?: string;
          amount?: number;
          is_active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "bonus_rules_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "bonus_rules_competition_id_fkey"; columns: ["competition_id"]; isOneToOne: false; referencedRelation: "competitions"; referencedColumns: ["id"] },
          { foreignKeyName: "bonus_rules_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
        ];
      };
      budget_lines: {
        Row: {
          id: string;
          club_id: string;
          year: number;
          month: number;
          kind: string;
          department_id: string | null;
          amount: number;
        };
        Insert: {
          id?: string;
          club_id: string;
          year: number;
          month: number;
          kind: string;
          department_id?: string | null;
          amount: number;
        };
        Update: {
          id?: string;
          club_id?: string;
          year?: number;
          month?: number;
          kind?: string;
          department_id?: string | null;
          amount?: number;
        };
        Relationships: [
          { foreignKeyName: "budget_lines_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "budget_lines_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
        ];
      };
      camp_registrations: {
        Row: {
          id: string;
          camp_id: string;
          club_id: string;
          player_id: string | null;
          child_name: string;
          birth_date: string | null;
          parent_name: string | null;
          parent_email: string | null;
          parent_phone: string | null;
          notes: string | null;
          status: string;
          source: string;
          charge_id: string | null;
          paid_external: boolean;
          paid_note: string | null;
          cancel_reason: string | null;
          registered_by: string | null;
          consent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          camp_id: string;
          club_id: string;
          player_id?: string | null;
          child_name: string;
          birth_date?: string | null;
          parent_name?: string | null;
          parent_email?: string | null;
          parent_phone?: string | null;
          notes?: string | null;
          status?: string;
          source: string;
          charge_id?: string | null;
          paid_external?: boolean;
          paid_note?: string | null;
          cancel_reason?: string | null;
          registered_by?: string | null;
          consent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          camp_id?: string;
          club_id?: string;
          player_id?: string | null;
          child_name?: string;
          birth_date?: string | null;
          parent_name?: string | null;
          parent_email?: string | null;
          parent_phone?: string | null;
          notes?: string | null;
          status?: string;
          source?: string;
          charge_id?: string | null;
          paid_external?: boolean;
          paid_note?: string | null;
          cancel_reason?: string | null;
          registered_by?: string | null;
          consent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "camp_registrations_camp_id_fkey"; columns: ["camp_id"]; isOneToOne: false; referencedRelation: "camps"; referencedColumns: ["id"] },
          { foreignKeyName: "camp_registrations_charge_id_fkey"; columns: ["charge_id"]; isOneToOne: false; referencedRelation: "charges"; referencedColumns: ["id"] },
          { foreignKeyName: "camp_registrations_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "camp_registrations_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "camp_registrations_registered_by_fkey"; columns: ["registered_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      camps: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          description: string | null;
          location: string | null;
          starts_on: string;
          ends_on: string;
          price: number;
          capacity: number;
          birth_year_from: number | null;
          birth_year_to: number | null;
          deadline: string | null;
          status: string;
          is_public: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          description?: string | null;
          location?: string | null;
          starts_on: string;
          ends_on: string;
          price?: number;
          capacity: number;
          birth_year_from?: number | null;
          birth_year_to?: number | null;
          deadline?: string | null;
          status?: string;
          is_public?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          description?: string | null;
          location?: string | null;
          starts_on?: string;
          ends_on?: string;
          price?: number;
          capacity?: number;
          birth_year_from?: number | null;
          birth_year_to?: number | null;
          deadline?: string | null;
          status?: string;
          is_public?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "camps_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "camps_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      charge_requests: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          description: string | null;
          kind: string;
          amount: number;
          due_on: string;
          created_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          description?: string | null;
          kind?: string;
          amount: number;
          due_on: string;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          description?: string | null;
          kind?: string;
          amount?: number;
          due_on?: string;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "charge_requests_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "charge_requests_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      charges: {
        Row: {
          id: string;
          club_id: string;
          player_id: string;
          guardian_id: string | null;
          kind: string;
          request_id: string | null;
          period: string | null;
          title: string;
          amount: number;
          discount: number;
          discount_note: string | null;
          due_on: string;
          status: string;
          cancel_reason: string | null;
          issued_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          player_id: string;
          guardian_id?: string | null;
          kind: string;
          request_id?: string | null;
          period?: string | null;
          title: string;
          amount: number;
          discount?: number;
          discount_note?: string | null;
          due_on: string;
          status?: string;
          cancel_reason?: string | null;
          issued_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          player_id?: string;
          guardian_id?: string | null;
          kind?: string;
          request_id?: string | null;
          period?: string | null;
          title?: string;
          amount?: number;
          discount?: number;
          discount_note?: string | null;
          due_on?: string;
          status?: string;
          cancel_reason?: string | null;
          issued_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: "charges_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "charges_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "charges_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
          { foreignKeyName: "charges_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "charges_request_id_fkey"; columns: ["request_id"]; isOneToOne: false; referencedRelation: "charge_requests"; referencedColumns: ["id"] },
        ];
      };
      club_counters: {
        Row: {
          club_id: string;
          name: string;
          value: number;
        };
        Insert: {
          club_id: string;
          name: string;
          value?: number;
        };
        Update: {
          club_id?: string;
          name?: string;
          value?: number;
        };
        Relationships: [
          { foreignKeyName: "club_counters_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_statuses: {
        Row: {
          id: string;
          club_id: string;
          code: string;
          label: string;
          short_label: string;
          tone: string;
          icon: string;
          availability: string;
          sort: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          club_id: string;
          code: string;
          label: string;
          short_label: string;
          tone?: string;
          icon?: string;
          availability?: string;
          sort?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          club_id?: string;
          code?: string;
          label?: string;
          short_label?: string;
          tone?: string;
          icon?: string;
          availability?: string;
          sort?: number;
          is_active?: boolean;
        };
        Relationships: [
          { foreignKeyName: "club_statuses_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      clubs: {
        Row: {
          id: string;
          slug: string;
          name: string;
          short_name: string | null;
          logo_path: string | null;
          primary_color: string;
          accent_color: string;
          settings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          short_name?: string | null;
          logo_path?: string | null;
          primary_color?: string;
          accent_color?: string;
          settings?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          short_name?: string | null;
          logo_path?: string | null;
          primary_color?: string;
          accent_color?: string;
          settings?: Json;
          created_at?: string;
        };
        Relationships: [
        ];
      };
      competition_standings: {
        Row: {
          competition_id: string;
          position: number;
          team_name: string;
          played: number;
          won: number;
          drawn: number;
          lost: number;
          goals_for: number;
          goals_against: number;
          points: number;
          is_own: boolean;
          updated_at: string;
        };
        Insert: {
          competition_id: string;
          position: number;
          team_name: string;
          played?: number;
          won?: number;
          drawn?: number;
          lost?: number;
          goals_for?: number;
          goals_against?: number;
          points?: number;
          is_own?: boolean;
          updated_at?: string;
        };
        Update: {
          competition_id?: string;
          position?: number;
          team_name?: string;
          played?: number;
          won?: number;
          drawn?: number;
          lost?: number;
          goals_for?: number;
          goals_against?: number;
          points?: number;
          is_own?: boolean;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "competition_standings_competition_id_fkey"; columns: ["competition_id"]; isOneToOne: false; referencedRelation: "competitions"; referencedColumns: ["id"] },
        ];
      };
      competitions: {
        Row: {
          id: string;
          club_id: string;
          season_id: string | null;
          group_id: string | null;
          name: string;
          source: string;
          external_id: string | null;
          half_minutes: number | null;
          yellow_limit: number;
          own_name: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          season_id?: string | null;
          group_id?: string | null;
          name: string;
          source?: string;
          external_id?: string | null;
          half_minutes?: number | null;
          yellow_limit?: number;
          own_name?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          season_id?: string | null;
          group_id?: string | null;
          name?: string;
          source?: string;
          external_id?: string | null;
          half_minutes?: number | null;
          yellow_limit?: number;
          own_name?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "competitions_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "competitions_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "competitions_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ];
      };
      consents: {
        Row: {
          id: string;
          user_id: string | null;
          player_id: string | null;
          kind: string;
          text_version: string;
          guardian_name: string | null;
          guardian_relation: string | null;
          document_id: string | null;
          accepted_at: string;
          recorded_by: string | null;
          withdrawn_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          player_id?: string | null;
          kind: string;
          text_version: string;
          guardian_name?: string | null;
          guardian_relation?: string | null;
          document_id?: string | null;
          accepted_at?: string;
          recorded_by?: string | null;
          withdrawn_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          player_id?: string | null;
          kind?: string;
          text_version?: string;
          guardian_name?: string | null;
          guardian_relation?: string | null;
          document_id?: string | null;
          accepted_at?: string;
          recorded_by?: string | null;
          withdrawn_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "consents_document_id_fkey"; columns: ["document_id"]; isOneToOne: false; referencedRelation: "medical_documents"; referencedColumns: ["id"] },
          { foreignKeyName: "consents_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "consents_recorded_by_fkey"; columns: ["recorded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "consents_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      contract_events: {
        Row: {
          id: number;
          contract_id: string;
          at: string;
          actor_id: string | null;
          action: string;
          ip: string | null;
          details: string | null;
        };
        Insert: {
          id?: never;
          contract_id: string;
          at?: string;
          actor_id?: string | null;
          action: string;
          ip?: string | null;
          details?: string | null;
        };
        Update: {
          id?: never;
          contract_id?: string;
          at?: string;
          actor_id?: string | null;
          action?: string;
          ip?: string | null;
          details?: string | null;
        };
        Relationships: [
          { foreignKeyName: "contract_events_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "contract_events_contract_id_fkey"; columns: ["contract_id"]; isOneToOne: false; referencedRelation: "contracts"; referencedColumns: ["id"] },
        ];
      };
      contract_template_versions: {
        Row: {
          id: string;
          template_id: string;
          version: number;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          version: number;
          body: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          version?: number;
          body?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "contract_template_versions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "contract_template_versions_template_id_fkey"; columns: ["template_id"]; isOneToOne: false; referencedRelation: "contract_templates"; referencedColumns: ["id"] },
        ];
      };
      contract_templates: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          kind: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          kind?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          kind?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "contract_templates_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      contracts: {
        Row: {
          id: string;
          club_id: string;
          template_version_id: string;
          title: string;
          player_id: string | null;
          signer_user_id: string | null;
          signer_name: string;
          body: string;
          status: string;
          due_on: string | null;
          sent_at: string;
          sent_by: string | null;
          signed_at: string | null;
          signed_name: string | null;
          signature_path: string | null;
          signed_ip: string | null;
          signed_user_agent: string | null;
          document_hash: string | null;
          decline_reason: string | null;
          void_reason: string | null;
          reminders_sent: number;
          last_reminded_at: string | null;
          kind: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          template_version_id: string;
          title: string;
          player_id?: string | null;
          signer_user_id?: string | null;
          signer_name: string;
          body: string;
          status?: string;
          due_on?: string | null;
          sent_at?: string;
          sent_by?: string | null;
          signed_at?: string | null;
          signed_name?: string | null;
          signature_path?: string | null;
          signed_ip?: string | null;
          signed_user_agent?: string | null;
          document_hash?: string | null;
          decline_reason?: string | null;
          void_reason?: string | null;
          reminders_sent?: number;
          last_reminded_at?: string | null;
          kind?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          template_version_id?: string;
          title?: string;
          player_id?: string | null;
          signer_user_id?: string | null;
          signer_name?: string;
          body?: string;
          status?: string;
          due_on?: string | null;
          sent_at?: string;
          sent_by?: string | null;
          signed_at?: string | null;
          signed_name?: string | null;
          signature_path?: string | null;
          signed_ip?: string | null;
          signed_user_agent?: string | null;
          document_hash?: string | null;
          decline_reason?: string | null;
          void_reason?: string | null;
          reminders_sent?: number;
          last_reminded_at?: string | null;
          kind?: string | null;
        };
        Relationships: [
          { foreignKeyName: "contracts_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "contracts_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "contracts_sent_by_fkey"; columns: ["sent_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "contracts_signer_user_id_fkey"; columns: ["signer_user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "contracts_template_version_id_fkey"; columns: ["template_version_id"]; isOneToOne: false; referencedRelation: "contract_template_versions"; referencedColumns: ["id"] },
        ];
      };
      daily_plan_items: {
        Row: {
          id: string;
          plan_id: string;
          exercise_id: string;
          sort: number;
          sets: number | null;
          reps: string | null;
          duration_sec: number | null;
          rest_sec: number | null;
          tempo: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          plan_id: string;
          exercise_id: string;
          sort?: number;
          sets?: number | null;
          reps?: string | null;
          duration_sec?: number | null;
          rest_sec?: number | null;
          tempo?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          plan_id?: string;
          exercise_id?: string;
          sort?: number;
          sets?: number | null;
          reps?: string | null;
          duration_sec?: number | null;
          rest_sec?: number | null;
          tempo?: string | null;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: "daily_plan_items_exercise_id_fkey"; columns: ["exercise_id"]; isOneToOne: false; referencedRelation: "exercises"; referencedColumns: ["id"] },
          { foreignKeyName: "daily_plan_items_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "daily_plans"; referencedColumns: ["id"] },
        ];
      };
      daily_plans: {
        Row: {
          id: string;
          player_id: string;
          plan_date: string;
          title: string | null;
          notes: string | null;
          injury_id: string | null;
          rtp_stage: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          plan_date: string;
          title?: string | null;
          notes?: string | null;
          injury_id?: string | null;
          rtp_stage?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          plan_date?: string;
          title?: string | null;
          notes?: string | null;
          injury_id?: string | null;
          rtp_stage?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "daily_plans_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "daily_plans_injury_id_fkey"; columns: ["injury_id"]; isOneToOne: false; referencedRelation: "injuries"; referencedColumns: ["id"] },
          { foreignKeyName: "daily_plans_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      data_requests: {
        Row: {
          id: string;
          club_id: string;
          user_id: string | null;
          player_id: string | null;
          kind: string;
          message: string | null;
          status: string;
          handled_by: string | null;
          handled_at: string | null;
          response: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id?: string | null;
          player_id?: string | null;
          kind: string;
          message?: string | null;
          status?: string;
          handled_by?: string | null;
          handled_at?: string | null;
          response?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string | null;
          player_id?: string | null;
          kind?: string;
          message?: string | null;
          status?: string;
          handled_by?: string | null;
          handled_at?: string | null;
          response?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "data_requests_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "data_requests_handled_by_fkey"; columns: ["handled_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "data_requests_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "data_requests_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      departments: {
        Row: {
          id: string;
          club_id: string;
          parent_id: string | null;
          name: string;
          sort: number;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          parent_id?: string | null;
          name: string;
          sort?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          parent_id?: string | null;
          name?: string;
          sort?: number;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "departments_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "departments_parent_id_fkey"; columns: ["parent_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
        ];
      };
      drills: {
        Row: {
          id: string;
          club_id: string;
          created_by: string | null;
          name: string;
          age_group: string | null;
          kind: string | null;
          category: string | null;
          visibility: string;
          players: number | null;
          goalkeepers: number | null;
          intensity: number | null;
          work_min: number | null;
          rest_sec: number | null;
          reps: number | null;
          area: string | null;
          equipment: string | null;
          organization: string | null;
          criteria: string | null;
          video_url: string | null;
          diagram: Json | null;
          image_paths: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          created_by?: string | null;
          name: string;
          age_group?: string | null;
          kind?: string | null;
          category?: string | null;
          visibility?: string;
          players?: number | null;
          goalkeepers?: number | null;
          intensity?: number | null;
          work_min?: number | null;
          rest_sec?: number | null;
          reps?: number | null;
          area?: string | null;
          equipment?: string | null;
          organization?: string | null;
          criteria?: string | null;
          video_url?: string | null;
          diagram?: Json | null;
          image_paths?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          created_by?: string | null;
          name?: string;
          age_group?: string | null;
          kind?: string | null;
          category?: string | null;
          visibility?: string;
          players?: number | null;
          goalkeepers?: number | null;
          intensity?: number | null;
          work_min?: number | null;
          rest_sec?: number | null;
          reps?: number | null;
          area?: string | null;
          equipment?: string | null;
          organization?: string | null;
          criteria?: string | null;
          video_url?: string | null;
          diagram?: Json | null;
          image_paths?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "drills_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "drills_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      enrolment_events: {
        Row: {
          id: number;
          request_id: string;
          at: string;
          actor_id: string | null;
          action: string;
          note: string | null;
        };
        Insert: {
          id?: never;
          request_id: string;
          at?: string;
          actor_id?: string | null;
          action: string;
          note?: string | null;
        };
        Update: {
          id?: never;
          request_id?: string;
          at?: string;
          actor_id?: string | null;
          action?: string;
          note?: string | null;
        };
        Relationships: [
          { foreignKeyName: "enrolment_events_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "enrolment_events_request_id_fkey"; columns: ["request_id"]; isOneToOne: false; referencedRelation: "enrolment_requests"; referencedColumns: ["id"] },
        ];
      };
      enrolment_requests: {
        Row: {
          id: string;
          club_id: string;
          status: string;
          child_name: string;
          birth_date: string;
          group_id: string | null;
          previous_club: string | null;
          position: string | null;
          notes: string | null;
          parent_name: string;
          parent_email: string | null;
          parent_phone: string | null;
          relation: string;
          source: string;
          consent_at: string | null;
          trial_event_id: string | null;
          trial_at: string | null;
          trial_rating: number | null;
          trial_note: string | null;
          decline_reason: string | null;
          player_id: string | null;
          guardian_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          status?: string;
          child_name: string;
          birth_date: string;
          group_id?: string | null;
          previous_club?: string | null;
          position?: string | null;
          notes?: string | null;
          parent_name: string;
          parent_email?: string | null;
          parent_phone?: string | null;
          relation?: string;
          source?: string;
          consent_at?: string | null;
          trial_event_id?: string | null;
          trial_at?: string | null;
          trial_rating?: number | null;
          trial_note?: string | null;
          decline_reason?: string | null;
          player_id?: string | null;
          guardian_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          status?: string;
          child_name?: string;
          birth_date?: string;
          group_id?: string | null;
          previous_club?: string | null;
          position?: string | null;
          notes?: string | null;
          parent_name?: string;
          parent_email?: string | null;
          parent_phone?: string | null;
          relation?: string;
          source?: string;
          consent_at?: string | null;
          trial_event_id?: string | null;
          trial_at?: string | null;
          trial_rating?: number | null;
          trial_note?: string | null;
          decline_reason?: string | null;
          player_id?: string | null;
          guardian_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "enrolment_requests_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "enrolment_requests_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "enrolment_requests_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "enrolment_requests_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
          { foreignKeyName: "enrolment_requests_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "enrolment_requests_trial_event_id_fkey"; columns: ["trial_event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
        ];
      };
      evaluation_criteria: {
        Row: {
          id: string;
          template_id: string;
          category: string;
          name: string;
          description: string | null;
          sort: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          template_id: string;
          category: string;
          name: string;
          description?: string | null;
          sort?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          template_id?: string;
          category?: string;
          name?: string;
          description?: string | null;
          sort?: number;
          is_active?: boolean;
        };
        Relationships: [
          { foreignKeyName: "evaluation_criteria_template_id_fkey"; columns: ["template_id"]; isOneToOne: false; referencedRelation: "evaluation_templates"; referencedColumns: ["id"] },
        ];
      };
      evaluation_round_groups: {
        Row: {
          round_id: string;
          group_id: string;
        };
        Insert: {
          round_id: string;
          group_id: string;
        };
        Update: {
          round_id?: string;
          group_id?: string;
        };
        Relationships: [
          { foreignKeyName: "evaluation_round_groups_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "evaluation_round_groups_round_id_fkey"; columns: ["round_id"]; isOneToOne: false; referencedRelation: "evaluation_rounds"; referencedColumns: ["id"] },
        ];
      };
      evaluation_rounds: {
        Row: {
          id: string;
          club_id: string;
          template_id: string;
          name: string;
          due_on: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
          published_at: string | null;
          published_by: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          template_id: string;
          name: string;
          due_on?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          published_at?: string | null;
          published_by?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          template_id?: string;
          name?: string;
          due_on?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          published_at?: string | null;
          published_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: "evaluation_rounds_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "evaluation_rounds_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "evaluation_rounds_published_by_fkey"; columns: ["published_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "evaluation_rounds_template_id_fkey"; columns: ["template_id"]; isOneToOne: false; referencedRelation: "evaluation_templates"; referencedColumns: ["id"] },
        ];
      };
      evaluation_scores: {
        Row: {
          evaluation_id: string;
          criterion_id: string;
          score: number;
        };
        Insert: {
          evaluation_id: string;
          criterion_id: string;
          score: number;
        };
        Update: {
          evaluation_id?: string;
          criterion_id?: string;
          score?: number;
        };
        Relationships: [
          { foreignKeyName: "evaluation_scores_criterion_id_fkey"; columns: ["criterion_id"]; isOneToOne: false; referencedRelation: "evaluation_criteria"; referencedColumns: ["id"] },
          { foreignKeyName: "evaluation_scores_evaluation_id_fkey"; columns: ["evaluation_id"]; isOneToOne: false; referencedRelation: "evaluations"; referencedColumns: ["id"] },
        ];
      };
      evaluation_templates: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          age_label: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          age_label?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          age_label?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "evaluation_templates_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      evaluations: {
        Row: {
          id: string;
          round_id: string;
          player_id: string;
          evaluator_id: string | null;
          status: string;
          strengths: string | null;
          next_goals: string | null;
          comment: string | null;
          updated_at: string;
          submitted_at: string | null;
        };
        Insert: {
          id?: string;
          round_id: string;
          player_id: string;
          evaluator_id?: string | null;
          status?: string;
          strengths?: string | null;
          next_goals?: string | null;
          comment?: string | null;
          updated_at?: string;
          submitted_at?: string | null;
        };
        Update: {
          id?: string;
          round_id?: string;
          player_id?: string;
          evaluator_id?: string | null;
          status?: string;
          strengths?: string | null;
          next_goals?: string | null;
          comment?: string | null;
          updated_at?: string;
          submitted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "evaluations_evaluator_id_fkey"; columns: ["evaluator_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "evaluations_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "evaluations_round_id_fkey"; columns: ["round_id"]; isOneToOne: false; referencedRelation: "evaluation_rounds"; referencedColumns: ["id"] },
        ];
      };
      event_series: {
        Row: {
          id: string;
          club_id: string;
          kind: string;
          title: string;
          weekdays: number[];
          start_time: string;
          duration_min: number;
          venue_id: string | null;
          starts_on: string;
          until: string;
          skip_dates: string[];
          group_ids: string[];
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          kind: string;
          title: string;
          weekdays: number[];
          start_time: string;
          duration_min: number;
          venue_id?: string | null;
          starts_on: string;
          until: string;
          skip_dates?: string[];
          group_ids?: string[];
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          kind?: string;
          title?: string;
          weekdays?: number[];
          start_time?: string;
          duration_min?: number;
          venue_id?: string | null;
          starts_on?: string;
          until?: string;
          skip_dates?: string[];
          group_ids?: string[];
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "event_series_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "event_series_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "event_series_venue_id_fkey"; columns: ["venue_id"]; isOneToOne: false; referencedRelation: "venues"; referencedColumns: ["id"] },
        ];
      };
      event_teams: {
        Row: {
          event_id: string;
          group_id: string;
        };
        Insert: {
          event_id: string;
          group_id: string;
        };
        Update: {
          event_id?: string;
          group_id?: string;
        };
        Relationships: [
          { foreignKeyName: "event_teams_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "event_teams_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
        ];
      };
      events: {
        Row: {
          id: string;
          club_id: string;
          kind: string;
          title: string;
          starts_at: string;
          ends_at: string;
          venue_id: string | null;
          status: string;
          series_id: string | null;
          notes: string | null;
          attendance_saved_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          kind: string;
          title: string;
          starts_at: string;
          ends_at: string;
          venue_id?: string | null;
          status?: string;
          series_id?: string | null;
          notes?: string | null;
          attendance_saved_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          kind?: string;
          title?: string;
          starts_at?: string;
          ends_at?: string;
          venue_id?: string | null;
          status?: string;
          series_id?: string | null;
          notes?: string | null;
          attendance_saved_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "events_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "events_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "events_series_id_fkey"; columns: ["series_id"]; isOneToOne: false; referencedRelation: "event_series"; referencedColumns: ["id"] },
          { foreignKeyName: "events_venue_id_fkey"; columns: ["venue_id"]; isOneToOne: false; referencedRelation: "venues"; referencedColumns: ["id"] },
        ];
      };
      exercise_completions: {
        Row: {
          id: string;
          player_id: string;
          done_on: string;
          assignment_id: string | null;
          program_exercise_id: string | null;
          plan_item_id: string | null;
          done: boolean;
          comment: string | null;
          pain: boolean;
          pain_intensity: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          done_on: string;
          assignment_id?: string | null;
          program_exercise_id?: string | null;
          plan_item_id?: string | null;
          done?: boolean;
          comment?: string | null;
          pain?: boolean;
          pain_intensity?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          done_on?: string;
          assignment_id?: string | null;
          program_exercise_id?: string | null;
          plan_item_id?: string | null;
          done?: boolean;
          comment?: string | null;
          pain?: boolean;
          pain_intensity?: number | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "exercise_completions_assignment_id_fkey"; columns: ["assignment_id"]; isOneToOne: false; referencedRelation: "program_assignments"; referencedColumns: ["id"] },
          { foreignKeyName: "exercise_completions_plan_item_id_fkey"; columns: ["plan_item_id"]; isOneToOne: false; referencedRelation: "daily_plan_items"; referencedColumns: ["id"] },
          { foreignKeyName: "exercise_completions_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "exercise_completions_program_exercise_id_fkey"; columns: ["program_exercise_id"]; isOneToOne: false; referencedRelation: "program_exercises"; referencedColumns: ["id"] },
        ];
      };
      exercises: {
        Row: {
          id: string;
          club_id: string;
          slug: string | null;
          name: string;
          description: string | null;
          steps: string[];
          category: string;
          zones: string[];
          equipment: string[];
          level: string;
          contraindications: string | null;
          video_url: string | null;
          video_path: string | null;
          image_url: string | null;
          source: string | null;
          license: string | null;
          attribution: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          slug?: string | null;
          name: string;
          description?: string | null;
          steps?: string[];
          category?: string;
          zones?: string[];
          equipment?: string[];
          level?: string;
          contraindications?: string | null;
          video_url?: string | null;
          video_path?: string | null;
          image_url?: string | null;
          source?: string | null;
          license?: string | null;
          attribution?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          slug?: string | null;
          name?: string;
          description?: string | null;
          steps?: string[];
          category?: string;
          zones?: string[];
          equipment?: string[];
          level?: string;
          contraindications?: string | null;
          video_url?: string | null;
          video_path?: string | null;
          image_url?: string | null;
          source?: string | null;
          license?: string | null;
          attribution?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "exercises_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "exercises_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      expenses: {
        Row: {
          id: string;
          club_id: string;
          department_id: string | null;
          description: string;
          supplier: string | null;
          invoice_no: string | null;
          amount: number;
          spent_on: string;
          method: string;
          purchase_request_id: string | null;
          group_id: string | null;
          player_id: string | null;
          event_id: string | null;
          document_path: string | null;
          bank_line_id: string | null;
          created_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          department_id?: string | null;
          description: string;
          supplier?: string | null;
          invoice_no?: string | null;
          amount: number;
          spent_on: string;
          method?: string;
          purchase_request_id?: string | null;
          group_id?: string | null;
          player_id?: string | null;
          event_id?: string | null;
          document_path?: string | null;
          bank_line_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          department_id?: string | null;
          description?: string;
          supplier?: string | null;
          invoice_no?: string | null;
          amount?: number;
          spent_on?: string;
          method?: string;
          purchase_request_id?: string | null;
          group_id?: string | null;
          player_id?: string | null;
          event_id?: string | null;
          document_path?: string | null;
          bank_line_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "expenses_bank_line_id_fkey"; columns: ["bank_line_id"]; isOneToOne: false; referencedRelation: "bank_lines"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_purchase_request_id_fkey"; columns: ["purchase_request_id"]; isOneToOne: false; referencedRelation: "purchase_requests"; referencedColumns: ["id"] },
        ];
      };
      fee_adjustments: {
        Row: {
          id: string;
          club_id: string;
          player_id: string;
          kind: string;
          value: number;
          reason: string;
          note: string | null;
          from_month: string;
          to_month: string | null;
          created_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          player_id: string;
          kind: string;
          value?: number;
          reason: string;
          note?: string | null;
          from_month: string;
          to_month?: string | null;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          player_id?: string;
          kind?: string;
          value?: number;
          reason?: string;
          note?: string | null;
          from_month?: string;
          to_month?: string | null;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "fee_adjustments_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "fee_adjustments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "fee_adjustments_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      fee_plans: {
        Row: {
          id: string;
          club_id: string;
          group_id: string | null;
          player_id: string | null;
          amount: number;
          valid_from: string;
          valid_to: string | null;
          reason: string | null;
          created_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          group_id?: string | null;
          player_id?: string | null;
          amount: number;
          valid_from: string;
          valid_to?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          group_id?: string | null;
          player_id?: string | null;
          amount?: number;
          valid_from?: string;
          valid_to?: string | null;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "fee_plans_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "fee_plans_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "fee_plans_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "fee_plans_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      finance_settings: {
        Row: {
          club_id: string;
          currency: string;
          issue_day: number;
          due_day: number;
          reminder_days: number[];
          fee_months: number[];
          sibling_discount_pct: number;
          auto_issue: boolean;
          beneficiary: string | null;
          fiscal_code: string | null;
          address: string | null;
          iban: string | null;
          bank_name: string | null;
          receipt_prefix: string;
          ref_prefix: string;
          provider: string;
          online_enabled: boolean;
          vat_rates: number[];
          approver_roles: Database["public"]["Enums"]["app_role"][];
          updated_at: string;
          last_auto_issue: string | null;
        };
        Insert: {
          club_id: string;
          currency?: string;
          issue_day?: number;
          due_day?: number;
          reminder_days?: number[];
          fee_months?: number[];
          sibling_discount_pct?: number;
          auto_issue?: boolean;
          beneficiary?: string | null;
          fiscal_code?: string | null;
          address?: string | null;
          iban?: string | null;
          bank_name?: string | null;
          receipt_prefix?: string;
          ref_prefix?: string;
          provider?: string;
          online_enabled?: boolean;
          vat_rates?: number[];
          approver_roles?: Database["public"]["Enums"]["app_role"][];
          updated_at?: string;
          last_auto_issue?: string | null;
        };
        Update: {
          club_id?: string;
          currency?: string;
          issue_day?: number;
          due_day?: number;
          reminder_days?: number[];
          fee_months?: number[];
          sibling_discount_pct?: number;
          auto_issue?: boolean;
          beneficiary?: string | null;
          fiscal_code?: string | null;
          address?: string | null;
          iban?: string | null;
          bank_name?: string | null;
          receipt_prefix?: string;
          ref_prefix?: string;
          provider?: string;
          online_enabled?: boolean;
          vat_rates?: number[];
          approver_roles?: Database["public"]["Enums"]["app_role"][];
          updated_at?: string;
          last_auto_issue?: string | null;
        };
        Relationships: [
          { foreignKeyName: "finance_settings_club_id_fkey"; columns: ["club_id"]; isOneToOne: true; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      fitness_batteries: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          description: string | null;
          sort: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          description?: string | null;
          sort?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          description?: string | null;
          sort?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "fitness_batteries_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      fitness_battery_tests: {
        Row: {
          battery_id: string;
          test_id: string;
          sort: number;
        };
        Insert: {
          battery_id: string;
          test_id: string;
          sort?: number;
        };
        Update: {
          battery_id?: string;
          test_id?: string;
          sort?: number;
        };
        Relationships: [
          { foreignKeyName: "fitness_battery_tests_battery_id_fkey"; columns: ["battery_id"]; isOneToOne: false; referencedRelation: "fitness_batteries"; referencedColumns: ["id"] },
          { foreignKeyName: "fitness_battery_tests_test_id_fkey"; columns: ["test_id"]; isOneToOne: false; referencedRelation: "fitness_tests"; referencedColumns: ["id"] },
        ];
      };
      fitness_test_results: {
        Row: {
          id: string;
          test_id: string;
          player_id: string;
          tested_on: string;
          value: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_id: string;
          player_id: string;
          tested_on?: string;
          value: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_id?: string;
          player_id?: string;
          tested_on?: string;
          value?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "fitness_test_results_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "fitness_test_results_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "fitness_test_results_test_id_fkey"; columns: ["test_id"]; isOneToOne: false; referencedRelation: "fitness_tests"; referencedColumns: ["id"] },
        ];
      };
      fitness_tests: {
        Row: {
          id: string;
          club_id: string;
          code: string;
          name: string;
          unit: string;
          lower_is_better: boolean;
          sort: number;
          is_active: boolean;
          description: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          code: string;
          name: string;
          unit: string;
          lower_is_better?: boolean;
          sort?: number;
          is_active?: boolean;
          description?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          code?: string;
          name?: string;
          unit?: string;
          lower_is_better?: boolean;
          sort?: number;
          is_active?: boolean;
          description?: string | null;
        };
        Relationships: [
          { foreignKeyName: "fitness_tests_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      groups: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          sort: number;
          is_active: boolean;
          wellness_config: Json;
          reminder_hour: number | null;
          created_at: string;
          season_id: string | null;
          programme: string | null;
          birth_year_from: number | null;
          birth_year_to: number | null;
          gender: string | null;
          players_on_pitch: number | null;
          half_minutes: number | null;
          color: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          sort?: number;
          is_active?: boolean;
          wellness_config?: Json;
          reminder_hour?: number | null;
          created_at?: string;
          season_id?: string | null;
          programme?: string | null;
          birth_year_from?: number | null;
          birth_year_to?: number | null;
          gender?: string | null;
          players_on_pitch?: number | null;
          half_minutes?: number | null;
          color?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          sort?: number;
          is_active?: boolean;
          wellness_config?: Json;
          reminder_hour?: number | null;
          created_at?: string;
          season_id?: string | null;
          programme?: string | null;
          birth_year_from?: number | null;
          birth_year_to?: number | null;
          gender?: string | null;
          players_on_pitch?: number | null;
          half_minutes?: number | null;
          color?: string | null;
        };
        Relationships: [
          { foreignKeyName: "groups_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "groups_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] },
        ];
      };
      guardian_players: {
        Row: {
          guardian_id: string;
          player_id: string;
          relation: string;
          is_billing: boolean;
          is_emergency: boolean;
        };
        Insert: {
          guardian_id: string;
          player_id: string;
          relation?: string;
          is_billing?: boolean;
          is_emergency?: boolean;
        };
        Update: {
          guardian_id?: string;
          player_id?: string;
          relation?: string;
          is_billing?: boolean;
          is_emergency?: boolean;
        };
        Relationships: [
          { foreignKeyName: "guardian_players_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
          { foreignKeyName: "guardian_players_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      guardians: {
        Row: {
          id: string;
          club_id: string;
          user_id: string | null;
          full_name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          payment_ref: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id?: string | null;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          payment_ref?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string | null;
          full_name?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          payment_ref?: string | null;
        };
        Relationships: [
          { foreignKeyName: "guardians_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      import_templates: {
        Row: {
          id: string;
          club_id: string;
          kind: string;
          name: string;
          mapping: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          kind: string;
          name: string;
          mapping: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          kind?: string;
          name?: string;
          mapping?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "import_templates_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "import_templates_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      imports: {
        Row: {
          id: string;
          club_id: string;
          kind: string;
          filename: string | null;
          file_hash: string | null;
          mapping: Json | null;
          report: Json | null;
          rows_imported: number;
          rows_skipped: number;
          rows_flagged: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          kind: string;
          filename?: string | null;
          file_hash?: string | null;
          mapping?: Json | null;
          report?: Json | null;
          rows_imported?: number;
          rows_skipped?: number;
          rows_flagged?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          kind?: string;
          filename?: string | null;
          file_hash?: string | null;
          mapping?: Json | null;
          report?: Json | null;
          rows_imported?: number;
          rows_skipped?: number;
          rows_flagged?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "imports_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "imports_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      injuries: {
        Row: {
          id: string;
          player_id: string;
          zone: string | null;
          side: string | null;
          zone_detail: string | null;
          zone_uncertain: boolean;
          injury_type: string | null;
          contact: string | null;
          context: string | null;
          occurred_on: string;
          diagnosis: string | null;
          severity: string | null;
          expected_return_on: string | null;
          actual_return_on: string | null;
          rtp_stage: number;
          notes: string | null;
          recurrence_of: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          zone?: string | null;
          side?: string | null;
          zone_detail?: string | null;
          zone_uncertain?: boolean;
          injury_type?: string | null;
          contact?: string | null;
          context?: string | null;
          occurred_on?: string;
          diagnosis?: string | null;
          severity?: string | null;
          expected_return_on?: string | null;
          actual_return_on?: string | null;
          rtp_stage?: number;
          notes?: string | null;
          recurrence_of?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          zone?: string | null;
          side?: string | null;
          zone_detail?: string | null;
          zone_uncertain?: boolean;
          injury_type?: string | null;
          contact?: string | null;
          context?: string | null;
          occurred_on?: string;
          diagnosis?: string | null;
          severity?: string | null;
          expected_return_on?: string | null;
          actual_return_on?: string | null;
          rtp_stage?: number;
          notes?: string | null;
          recurrence_of?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "injuries_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "injuries_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "injuries_recurrence_of_fkey"; columns: ["recurrence_of"]; isOneToOne: false; referencedRelation: "injuries"; referencedColumns: ["id"] },
        ];
      };
      injury_treatments: {
        Row: {
          id: string;
          injury_id: string;
          treated_on: string;
          description: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          injury_id: string;
          treated_on?: string;
          description: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          injury_id?: string;
          treated_on?: string;
          description?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "injury_treatments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "injury_treatments_injury_id_fkey"; columns: ["injury_id"]; isOneToOne: false; referencedRelation: "injuries"; referencedColumns: ["id"] },
        ];
      };
      match_events: {
        Row: {
          id: string;
          event_id: string;
          minute: number;
          kind: string;
          player_id: string | null;
          related_player_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          minute: number;
          kind: string;
          player_id?: string | null;
          related_player_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          minute?: number;
          kind?: string;
          player_id?: string | null;
          related_player_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "match_events_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "match_events_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "matches"; referencedColumns: ["event_id"] },
          { foreignKeyName: "match_events_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "match_events_related_player_id_fkey"; columns: ["related_player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      match_ratings: {
        Row: {
          event_id: string;
          player_id: string;
          rating: number;
          rated_by: string | null;
          created_at: string;
        };
        Insert: {
          event_id: string;
          player_id: string;
          rating: number;
          rated_by?: string | null;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          player_id?: string;
          rating?: number;
          rated_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "match_ratings_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "matches"; referencedColumns: ["event_id"] },
          { foreignKeyName: "match_ratings_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "match_ratings_rated_by_fkey"; columns: ["rated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      match_squad: {
        Row: {
          event_id: string;
          player_id: string;
          role: string;
          slot: number | null;
          is_captain: boolean;
          minutes: number | null;
        };
        Insert: {
          event_id: string;
          player_id: string;
          role: string;
          slot?: number | null;
          is_captain?: boolean;
          minutes?: number | null;
        };
        Update: {
          event_id?: string;
          player_id?: string;
          role?: string;
          slot?: number | null;
          is_captain?: boolean;
          minutes?: number | null;
        };
        Relationships: [
          { foreignKeyName: "match_squad_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "matches"; referencedColumns: ["event_id"] },
          { foreignKeyName: "match_squad_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      matches: {
        Row: {
          event_id: string;
          competition_id: string | null;
          opponent_id: string | null;
          round: string | null;
          is_home: boolean;
          external_key: string | null;
          goals_for: number;
          goals_against: number;
          status: string;
          formation: string | null;
          report: string | null;
          closed_at: string | null;
          closed_by: string | null;
        };
        Insert: {
          event_id: string;
          competition_id?: string | null;
          opponent_id?: string | null;
          round?: string | null;
          is_home?: boolean;
          external_key?: string | null;
          goals_for?: number;
          goals_against?: number;
          status?: string;
          formation?: string | null;
          report?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
        };
        Update: {
          event_id?: string;
          competition_id?: string | null;
          opponent_id?: string | null;
          round?: string | null;
          is_home?: boolean;
          external_key?: string | null;
          goals_for?: number;
          goals_against?: number;
          status?: string;
          formation?: string | null;
          report?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: "matches_closed_by_fkey"; columns: ["closed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "matches_competition_id_fkey"; columns: ["competition_id"]; isOneToOne: false; referencedRelation: "competitions"; referencedColumns: ["id"] },
          { foreignKeyName: "matches_event_id_fkey"; columns: ["event_id"]; isOneToOne: true; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "matches_opponent_id_fkey"; columns: ["opponent_id"]; isOneToOne: false; referencedRelation: "opponents"; referencedColumns: ["id"] },
        ];
      };
      medical_documents: {
        Row: {
          id: string;
          player_id: string;
          injury_id: string | null;
          title: string;
          kind: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          injury_id?: string | null;
          title: string;
          kind?: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          injury_id?: string | null;
          title?: string;
          kind?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "medical_documents_injury_id_fkey"; columns: ["injury_id"]; isOneToOne: false; referencedRelation: "injuries"; referencedColumns: ["id"] },
          { foreignKeyName: "medical_documents_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "medical_documents_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          club_id: string;
          role: Database["public"]["Enums"]["app_role"];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          club_id: string;
          role: Database["public"]["Enums"]["app_role"];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          club_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "memberships_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      message_recipients: {
        Row: {
          message_id: string;
          user_id: string;
          reason: string | null;
          read_at: string | null;
          name: string | null;
        };
        Insert: {
          message_id: string;
          user_id: string;
          reason?: string | null;
          read_at?: string | null;
          name?: string | null;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          reason?: string | null;
          read_at?: string | null;
          name?: string | null;
        };
        Relationships: [
          { foreignKeyName: "message_recipients_message_id_fkey"; columns: ["message_id"]; isOneToOne: false; referencedRelation: "messages"; referencedColumns: ["id"] },
          { foreignKeyName: "message_recipients_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      message_templates: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          title: string;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          title: string;
          body: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          title?: string;
          body?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "message_templates_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "message_templates_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      messages: {
        Row: {
          id: string;
          club_id: string;
          author_id: string | null;
          title: string;
          body: string;
          audience: Json;
          status: string;
          scheduled_at: string;
          sent_at: string | null;
          recipient_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          author_id?: string | null;
          title: string;
          body: string;
          audience: Json;
          status?: string;
          scheduled_at?: string;
          sent_at?: string | null;
          recipient_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          author_id?: string | null;
          title?: string;
          body?: string;
          audience?: Json;
          status?: string;
          scheduled_at?: string;
          sent_at?: string | null;
          recipient_count?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "messages_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      name_matches: {
        Row: {
          id: string;
          club_id: string;
          source_name: string;
          group_id: string | null;
          player_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          source_name: string;
          group_id?: string | null;
          player_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          source_name?: string;
          group_id?: string | null;
          player_id?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "name_matches_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "name_matches_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "name_matches_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "name_matches_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          title: string;
          body: string | null;
          link: string | null;
          dedupe_key: string | null;
          read_at: string | null;
          emailed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          title: string;
          body?: string | null;
          link?: string | null;
          dedupe_key?: string | null;
          read_at?: string | null;
          emailed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          dedupe_key?: string | null;
          read_at?: string | null;
          emailed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "notifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      opponents: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          short_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          short_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          short_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "opponents_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      partner_notes: {
        Row: {
          id: string;
          referral_id: string;
          author_id: string | null;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          author_id?: string | null;
          note: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          referral_id?: string;
          author_id?: string | null;
          note?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "partner_notes_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "partner_notes_referral_id_fkey"; columns: ["referral_id"]; isOneToOne: false; referencedRelation: "referrals"; referencedColumns: ["id"] },
        ];
      };
      payment_intents: {
        Row: {
          id: string;
          club_id: string;
          guardian_id: string | null;
          player_id: string | null;
          provider: string;
          provider_ref: string | null;
          amount: number;
          charge_ids: string[];
          status: string;
          checkout_url: string | null;
          save_method: boolean;
          payment_id: string | null;
          failure: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          guardian_id?: string | null;
          player_id?: string | null;
          provider: string;
          provider_ref?: string | null;
          amount: number;
          charge_ids?: string[];
          status?: string;
          checkout_url?: string | null;
          save_method?: boolean;
          payment_id?: string | null;
          failure?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          guardian_id?: string | null;
          player_id?: string | null;
          provider?: string;
          provider_ref?: string | null;
          amount?: number;
          charge_ids?: string[];
          status?: string;
          checkout_url?: string | null;
          save_method?: boolean;
          payment_id?: string | null;
          failure?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "payment_intents_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_intents_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_intents_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_intents_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_intents_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      payment_methods: {
        Row: {
          id: string;
          club_id: string;
          guardian_id: string;
          provider: string;
          provider_ref: string;
          label: string;
          auto_pay: boolean;
          created_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          guardian_id: string;
          provider: string;
          provider_ref: string;
          label: string;
          auto_pay?: boolean;
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          guardian_id?: string;
          provider?: string;
          provider_ref?: string;
          label?: string;
          auto_pay?: boolean;
          created_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "payment_methods_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_methods_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
        ];
      };
      payments: {
        Row: {
          id: string;
          club_id: string;
          guardian_id: string | null;
          player_id: string | null;
          amount: number;
          method: string;
          provider: string | null;
          provider_ref: string | null;
          received_on: string;
          payer_name: string | null;
          reference: string | null;
          note: string | null;
          status: string;
          refunded_amount: number;
          void_reason: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          guardian_id?: string | null;
          player_id?: string | null;
          amount: number;
          method: string;
          provider?: string | null;
          provider_ref?: string | null;
          received_on: string;
          payer_name?: string | null;
          reference?: string | null;
          note?: string | null;
          status?: string;
          refunded_amount?: number;
          void_reason?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          guardian_id?: string | null;
          player_id?: string | null;
          amount?: number;
          method?: string;
          provider?: string | null;
          provider_ref?: string | null;
          received_on?: string;
          payer_name?: string | null;
          reference?: string | null;
          note?: string | null;
          status?: string;
          refunded_amount?: number;
          void_reason?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "payments_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_recorded_by_fkey"; columns: ["recorded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      physical_metrics: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          duration_min: number | null;
          total_distance_m: number | null;
          hsr_distance_m: number | null;
          sprint_distance_m: number | null;
          sprint_count: number | null;
          max_speed_kmh: number | null;
          accelerations: number | null;
          decelerations: number | null;
          player_load: number | null;
          hr_avg: number | null;
          hr_max: number | null;
          extra: Json;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          duration_min?: number | null;
          total_distance_m?: number | null;
          hsr_distance_m?: number | null;
          sprint_distance_m?: number | null;
          sprint_count?: number | null;
          max_speed_kmh?: number | null;
          accelerations?: number | null;
          decelerations?: number | null;
          player_load?: number | null;
          hr_avg?: number | null;
          hr_max?: number | null;
          extra?: Json;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string;
          duration_min?: number | null;
          total_distance_m?: number | null;
          hsr_distance_m?: number | null;
          sprint_distance_m?: number | null;
          sprint_count?: number | null;
          max_speed_kmh?: number | null;
          accelerations?: number | null;
          decelerations?: number | null;
          player_load?: number | null;
          hr_avg?: number | null;
          hr_max?: number | null;
          extra?: Json;
        };
        Relationships: [
          { foreignKeyName: "physical_metrics_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "physical_metrics_session_id_fkey"; columns: ["session_id"]; isOneToOne: false; referencedRelation: "physical_sessions"; referencedColumns: ["id"] },
        ];
      };
      physical_sessions: {
        Row: {
          id: string;
          club_id: string;
          group_id: string | null;
          session_date: string;
          session_type: string;
          name: string;
          duration_min: number | null;
          source: string;
          import_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          group_id?: string | null;
          session_date: string;
          session_type?: string;
          name?: string;
          duration_min?: number | null;
          source?: string;
          import_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          group_id?: string | null;
          session_date?: string;
          session_type?: string;
          name?: string;
          duration_min?: number | null;
          source?: string;
          import_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "physical_sessions_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "physical_sessions_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
        ];
      };
      player_contacts: {
        Row: {
          player_id: string;
          phone: string | null;
          email: string | null;
          guardian_name: string | null;
          guardian_phone: string | null;
          guardian_email: string | null;
          updated_at: string;
        };
        Insert: {
          player_id: string;
          phone?: string | null;
          email?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          guardian_email?: string | null;
          updated_at?: string;
        };
        Update: {
          player_id?: string;
          phone?: string | null;
          email?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          guardian_email?: string | null;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "player_contacts_player_id_fkey"; columns: ["player_id"]; isOneToOne: true; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      player_group_history: {
        Row: {
          id: string;
          player_id: string;
          group_id: string | null;
          from_date: string;
          to_date: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          group_id?: string | null;
          from_date?: string;
          to_date?: string | null;
        };
        Update: {
          id?: string;
          player_id?: string;
          group_id?: string | null;
          from_date?: string;
          to_date?: string | null;
        };
        Relationships: [
          { foreignKeyName: "player_group_history_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "player_group_history_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      players: {
        Row: {
          id: string;
          club_id: string;
          user_id: string | null;
          group_id: string | null;
          full_name: string;
          display_name: string;
          birth_date: string | null;
          position: string | null;
          position_detail: string | null;
          dominant_foot: string | null;
          shirt_number: number | null;
          photo_path: string | null;
          medical_visa_expires_on: string | null;
          status_id: string | null;
          status_note: string | null;
          status_zone: string | null;
          status_side: string | null;
          status_zone_detail: string | null;
          status_zone_uncertain: boolean;
          status_return_on: string | null;
          training_restrictions: string | null;
          status_updated_at: string | null;
          needs_review: boolean;
          review_note: string | null;
          is_active: boolean;
          anonymized_at: string | null;
          created_at: string;
          nationality: string | null;
          registration_number: string | null;
          fifa_id: string | null;
          enrolled_on: string | null;
          photo_consent: boolean;
          kit_size: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id?: string | null;
          group_id?: string | null;
          full_name: string;
          display_name: string;
          birth_date?: string | null;
          position?: string | null;
          position_detail?: string | null;
          dominant_foot?: string | null;
          shirt_number?: number | null;
          photo_path?: string | null;
          medical_visa_expires_on?: string | null;
          status_id?: string | null;
          status_note?: string | null;
          status_zone?: string | null;
          status_side?: string | null;
          status_zone_detail?: string | null;
          status_zone_uncertain?: boolean;
          status_return_on?: string | null;
          training_restrictions?: string | null;
          status_updated_at?: string | null;
          needs_review?: boolean;
          review_note?: string | null;
          is_active?: boolean;
          anonymized_at?: string | null;
          created_at?: string;
          nationality?: string | null;
          registration_number?: string | null;
          fifa_id?: string | null;
          enrolled_on?: string | null;
          photo_consent?: boolean;
          kit_size?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string | null;
          group_id?: string | null;
          full_name?: string;
          display_name?: string;
          birth_date?: string | null;
          position?: string | null;
          position_detail?: string | null;
          dominant_foot?: string | null;
          shirt_number?: number | null;
          photo_path?: string | null;
          medical_visa_expires_on?: string | null;
          status_id?: string | null;
          status_note?: string | null;
          status_zone?: string | null;
          status_side?: string | null;
          status_zone_detail?: string | null;
          status_zone_uncertain?: boolean;
          status_return_on?: string | null;
          training_restrictions?: string | null;
          status_updated_at?: string | null;
          needs_review?: boolean;
          review_note?: string | null;
          is_active?: boolean;
          anonymized_at?: string | null;
          created_at?: string;
          nationality?: string | null;
          registration_number?: string | null;
          fifa_id?: string | null;
          enrolled_on?: string | null;
          photo_consent?: boolean;
          kit_size?: string | null;
        };
        Relationships: [
          { foreignKeyName: "players_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "players_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "players_status_id_fkey"; columns: ["status_id"]; isOneToOne: false; referencedRelation: "club_statuses"; referencedColumns: ["id"] },
          { foreignKeyName: "players_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: {
          id: string;
          club_id: string;
          role: Database["public"]["Enums"]["app_role"];
          full_name: string;
          email: string | null;
          phone: string | null;
          is_active: boolean;
          email_notifications: boolean;
          must_change_password: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          club_id: string;
          role: Database["public"]["Enums"]["app_role"];
          full_name: string;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          email_notifications?: boolean;
          must_change_password?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          is_active?: boolean;
          email_notifications?: boolean;
          must_change_password?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "profiles_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      program_assignment_players: {
        Row: {
          assignment_id: string;
          player_id: string;
        };
        Insert: {
          assignment_id: string;
          player_id: string;
        };
        Update: {
          assignment_id?: string;
          player_id?: string;
        };
        Relationships: [
          { foreignKeyName: "program_assignment_players_assignment_id_fkey"; columns: ["assignment_id"]; isOneToOne: false; referencedRelation: "program_assignments"; referencedColumns: ["id"] },
          { foreignKeyName: "program_assignment_players_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      program_assignments: {
        Row: {
          id: string;
          club_id: string;
          program_id: string;
          target_type: string;
          group_id: string | null;
          position: string | null;
          start_date: string;
          end_date: string | null;
          weekdays: number[];
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          program_id: string;
          target_type: string;
          group_id?: string | null;
          position?: string | null;
          start_date?: string;
          end_date?: string | null;
          weekdays?: number[];
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          program_id?: string;
          target_type?: string;
          group_id?: string | null;
          position?: string | null;
          start_date?: string;
          end_date?: string | null;
          weekdays?: number[];
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "program_assignments_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "program_assignments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "program_assignments_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "program_assignments_program_id_fkey"; columns: ["program_id"]; isOneToOne: false; referencedRelation: "programs"; referencedColumns: ["id"] },
        ];
      };
      program_exercises: {
        Row: {
          id: string;
          program_id: string;
          exercise_id: string;
          sort: number;
          sets: number | null;
          reps: string | null;
          duration_sec: number | null;
          rest_sec: number | null;
          tempo: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          program_id: string;
          exercise_id: string;
          sort?: number;
          sets?: number | null;
          reps?: string | null;
          duration_sec?: number | null;
          rest_sec?: number | null;
          tempo?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          program_id?: string;
          exercise_id?: string;
          sort?: number;
          sets?: number | null;
          reps?: string | null;
          duration_sec?: number | null;
          rest_sec?: number | null;
          tempo?: string | null;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: "program_exercises_exercise_id_fkey"; columns: ["exercise_id"]; isOneToOne: false; referencedRelation: "exercises"; referencedColumns: ["id"] },
          { foreignKeyName: "program_exercises_program_id_fkey"; columns: ["program_id"]; isOneToOne: false; referencedRelation: "programs"; referencedColumns: ["id"] },
        ];
      };
      programs: {
        Row: {
          id: string;
          club_id: string;
          slug: string | null;
          name: string;
          description: string | null;
          kind: string;
          is_template: boolean;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          slug?: string | null;
          name: string;
          description?: string | null;
          kind?: string;
          is_template?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          slug?: string | null;
          name?: string;
          description?: string | null;
          kind?: string;
          is_template?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "programs_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "programs_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      provider_events: {
        Row: {
          id: string;
          club_id: string | null;
          provider: string;
          event_id: string;
          type: string;
          payload: Json;
          received_at: string;
          processed_at: string | null;
          error: string | null;
        };
        Insert: {
          id?: string;
          club_id?: string | null;
          provider: string;
          event_id: string;
          type: string;
          payload: Json;
          received_at?: string;
          processed_at?: string | null;
          error?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string | null;
          provider?: string;
          event_id?: string;
          type?: string;
          payload?: Json;
          received_at?: string;
          processed_at?: string | null;
          error?: string | null;
        };
        Relationships: [
          { foreignKeyName: "provider_events_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      purchase_request_items: {
        Row: {
          id: string;
          request_id: string;
          position: number;
          name: string;
          details: string | null;
          unit: string;
          quantity: number;
          unit_price: number;
          vat_rate: number;
          price_includes_vat: boolean;
          line_net: number;
          line_vat: number;
        };
        Insert: {
          id?: string;
          request_id: string;
          position: number;
          name: string;
          details?: string | null;
          unit?: string;
          quantity: number;
          unit_price: number;
          vat_rate: number;
          price_includes_vat?: boolean;
          line_net: number;
          line_vat: number;
        };
        Update: {
          id?: string;
          request_id?: string;
          position?: number;
          name?: string;
          details?: string | null;
          unit?: string;
          quantity?: number;
          unit_price?: number;
          vat_rate?: number;
          price_includes_vat?: boolean;
          line_net?: number;
          line_vat?: number;
        };
        Relationships: [
          { foreignKeyName: "purchase_request_items_request_id_fkey"; columns: ["request_id"]; isOneToOne: false; referencedRelation: "purchase_requests"; referencedColumns: ["id"] },
        ];
      };
      purchase_requests: {
        Row: {
          id: string;
          club_id: string;
          number: number;
          department_id: string | null;
          group_id: string | null;
          justification: string;
          needed_by: string | null;
          status: string;
          total_net: number;
          total_vat: number;
          total: number;
          spec_path: string | null;
          requested_by: string | null;
          submitted_at: string | null;
          decided_by: string | null;
          decided_at: string | null;
          decision_note: string | null;
          created_at: string;
          updated_at: string;
          last_edited_by: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          number: number;
          department_id?: string | null;
          group_id?: string | null;
          justification: string;
          needed_by?: string | null;
          status?: string;
          total_net?: number;
          total_vat?: number;
          total?: number;
          spec_path?: string | null;
          requested_by?: string | null;
          submitted_at?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          created_at?: string;
          updated_at?: string;
          last_edited_by?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          number?: number;
          department_id?: string | null;
          group_id?: string | null;
          justification?: string;
          needed_by?: string | null;
          status?: string;
          total_net?: number;
          total_vat?: number;
          total?: number;
          spec_path?: string | null;
          requested_by?: string | null;
          submitted_at?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          created_at?: string;
          updated_at?: string;
          last_edited_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: "purchase_requests_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "purchase_requests_decided_by_fkey"; columns: ["decided_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "purchase_requests_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
          { foreignKeyName: "purchase_requests_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "purchase_requests_last_edited_by_fkey"; columns: ["last_edited_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "purchase_requests_requested_by_fkey"; columns: ["requested_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "push_tokens_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      receipts: {
        Row: {
          id: string;
          club_id: string;
          payment_id: string;
          series: string;
          number: number;
          issued_on: string;
          payer_name: string;
          amount: number;
          description: string;
          issued_by: string | null;
          cancelled_at: string | null;
          cancel_reason: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          payment_id: string;
          series: string;
          number: number;
          issued_on: string;
          payer_name: string;
          amount: number;
          description: string;
          issued_by?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          payment_id?: string;
          series?: string;
          number?: number;
          issued_on?: string;
          payer_name?: string;
          amount?: number;
          description?: string;
          issued_by?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
        };
        Relationships: [
          { foreignKeyName: "receipts_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "receipts_issued_by_fkey"; columns: ["issued_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "receipts_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: true; referencedRelation: "payments"; referencedColumns: ["id"] },
        ];
      };
      referrals: {
        Row: {
          id: string;
          player_id: string;
          partner_user_id: string;
          injury_id: string | null;
          reason: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          partner_user_id: string;
          injury_id?: string | null;
          reason?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          player_id?: string;
          partner_user_id?: string;
          injury_id?: string | null;
          reason?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "referrals_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "referrals_injury_id_fkey"; columns: ["injury_id"]; isOneToOne: false; referencedRelation: "injuries"; referencedColumns: ["id"] },
          { foreignKeyName: "referrals_partner_user_id_fkey"; columns: ["partner_user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "referrals_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      rpe_entries: {
        Row: {
          id: string;
          player_id: string;
          entry_date: string;
          session_type: string;
          rpe: number;
          duration_min: number;
          load: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          entry_date: string;
          session_type?: string;
          rpe: number;
          duration_min: number;
          load?: never;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          entry_date?: string;
          session_type?: string;
          rpe?: number;
          duration_min?: number;
          load?: never;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "rpe_entries_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      seasons: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          is_current: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          is_current?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          starts_on?: string;
          ends_on?: string;
          is_current?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "seasons_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      shop_bundle_items: {
        Row: {
          bundle_id: string;
          product_id: string;
        };
        Insert: {
          bundle_id: string;
          product_id: string;
        };
        Update: {
          bundle_id?: string;
          product_id?: string;
        };
        Relationships: [
          { foreignKeyName: "shop_bundle_items_bundle_id_fkey"; columns: ["bundle_id"]; isOneToOne: false; referencedRelation: "shop_products"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_bundle_items_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "shop_products"; referencedColumns: ["id"] },
        ];
      };
      shop_order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          parent_id: string | null;
          title: string;
          size: string | null;
          qty: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          parent_id?: string | null;
          title: string;
          size?: string | null;
          qty: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          parent_id?: string | null;
          title?: string;
          size?: string | null;
          qty?: number;
          unit_price?: number;
        };
        Relationships: [
          { foreignKeyName: "shop_order_items_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "shop_orders"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_order_items_parent_id_fkey"; columns: ["parent_id"]; isOneToOne: false; referencedRelation: "shop_order_items"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_order_items_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "shop_products"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_order_items_variant_id_fkey"; columns: ["variant_id"]; isOneToOne: false; referencedRelation: "shop_variants"; referencedColumns: ["id"] },
        ];
      };
      shop_orders: {
        Row: {
          id: string;
          club_id: string;
          number: number;
          player_id: string | null;
          guardian_id: string | null;
          child_name: string;
          status: string;
          total: number;
          charge_id: string | null;
          note: string | null;
          cancel_reason: string | null;
          placed_by: string | null;
          created_at: string;
          ready_at: string | null;
          picked_up_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          number: number;
          player_id?: string | null;
          guardian_id?: string | null;
          child_name: string;
          status?: string;
          total: number;
          charge_id?: string | null;
          note?: string | null;
          cancel_reason?: string | null;
          placed_by?: string | null;
          created_at?: string;
          ready_at?: string | null;
          picked_up_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          number?: number;
          player_id?: string | null;
          guardian_id?: string | null;
          child_name?: string;
          status?: string;
          total?: number;
          charge_id?: string | null;
          note?: string | null;
          cancel_reason?: string | null;
          placed_by?: string | null;
          created_at?: string;
          ready_at?: string | null;
          picked_up_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "shop_orders_charge_id_fkey"; columns: ["charge_id"]; isOneToOne: false; referencedRelation: "charges"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_orders_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_orders_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_orders_placed_by_fkey"; columns: ["placed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_orders_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      shop_products: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          description: string | null;
          category: string;
          price: number;
          photo_paths: string[];
          kind: string;
          size_kind: string;
          is_active: boolean;
          sort: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          description?: string | null;
          category?: string;
          price: number;
          photo_paths?: string[];
          kind?: string;
          size_kind?: string;
          is_active?: boolean;
          sort?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          description?: string | null;
          category?: string;
          price?: number;
          photo_paths?: string[];
          kind?: string;
          size_kind?: string;
          is_active?: boolean;
          sort?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "shop_products_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      shop_stock_moves: {
        Row: {
          id: number;
          club_id: string;
          variant_id: string;
          delta: number;
          reason: string;
          order_id: string | null;
          note: string | null;
          actor_id: string | null;
          at: string;
        };
        Insert: {
          id?: never;
          club_id: string;
          variant_id: string;
          delta: number;
          reason: string;
          order_id?: string | null;
          note?: string | null;
          actor_id?: string | null;
          at?: string;
        };
        Update: {
          id?: never;
          club_id?: string;
          variant_id?: string;
          delta?: number;
          reason?: string;
          order_id?: string | null;
          note?: string | null;
          actor_id?: string | null;
          at?: string;
        };
        Relationships: [
          { foreignKeyName: "shop_stock_moves_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_stock_moves_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_stock_moves_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "shop_orders"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_stock_moves_variant_id_fkey"; columns: ["variant_id"]; isOneToOne: false; referencedRelation: "shop_variants"; referencedColumns: ["id"] },
        ];
      };
      shop_variants: {
        Row: {
          id: string;
          product_id: string;
          club_id: string;
          size: string | null;
          stock: number;
          sort: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          club_id: string;
          size?: string | null;
          stock?: number;
          sort?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          club_id?: string;
          size?: string | null;
          stock?: number;
          sort?: number;
        };
        Relationships: [
          { foreignKeyName: "shop_variants_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "shop_variants_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "shop_products"; referencedColumns: ["id"] },
        ];
      };
      site_albums: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          taken_on: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          taken_on?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          taken_on?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "site_albums_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "site_albums_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      site_changes: {
        Row: {
          id: number;
          club_id: string;
          at: string;
          actor_id: string | null;
          field: string;
          old_value: Json | null;
          new_value: Json | null;
        };
        Insert: {
          id?: never;
          club_id: string;
          at?: string;
          actor_id?: string | null;
          field: string;
          old_value?: Json | null;
          new_value?: Json | null;
        };
        Update: {
          id?: never;
          club_id?: string;
          at?: string;
          actor_id?: string | null;
          field?: string;
          old_value?: Json | null;
          new_value?: Json | null;
        };
        Relationships: [
          { foreignKeyName: "site_changes_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "site_changes_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      site_photos: {
        Row: {
          id: string;
          album_id: string;
          club_id: string;
          path: string;
          caption: string | null;
          player_ids: string[];
          sort: number;
          created_at: string;
          reviewed: boolean;
        };
        Insert: {
          id?: string;
          album_id: string;
          club_id: string;
          path: string;
          caption?: string | null;
          player_ids?: string[];
          sort?: number;
          created_at?: string;
          reviewed?: boolean;
        };
        Update: {
          id?: string;
          album_id?: string;
          club_id?: string;
          path?: string;
          caption?: string | null;
          player_ids?: string[];
          sort?: number;
          created_at?: string;
          reviewed?: boolean;
        };
        Relationships: [
          { foreignKeyName: "site_photos_album_id_fkey"; columns: ["album_id"]; isOneToOne: false; referencedRelation: "site_albums"; referencedColumns: ["id"] },
          { foreignKeyName: "site_photos_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      site_policies: {
        Row: {
          id: string;
          club_id: string;
          version: number;
          body: string;
          published_at: string;
          published_by: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          version: number;
          body: string;
          published_at?: string;
          published_by?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          version?: number;
          body?: string;
          published_at?: string;
          published_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: "site_policies_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "site_policies_published_by_fkey"; columns: ["published_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      site_posts: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          blocks: Json;
          cover_path: string | null;
          status: string;
          to_site: boolean;
          to_app: boolean;
          app_group_ids: string[];
          published_at: string | null;
          notified_at: string | null;
          author_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          slug: string;
          excerpt?: string | null;
          blocks?: Json;
          cover_path?: string | null;
          status?: string;
          to_site?: boolean;
          to_app?: boolean;
          app_group_ids?: string[];
          published_at?: string | null;
          notified_at?: string | null;
          author_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          slug?: string;
          excerpt?: string | null;
          blocks?: Json;
          cover_path?: string | null;
          status?: string;
          to_site?: boolean;
          to_app?: boolean;
          app_group_ids?: string[];
          published_at?: string | null;
          notified_at?: string | null;
          author_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "site_posts_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "site_posts_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      sponsors: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          fiscal_code: string | null;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          kind: string;
          amount: number | null;
          status: string;
          starts_on: string | null;
          ends_on: string | null;
          tier: string;
          url: string | null;
          logo_path: string | null;
          show_on_site: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          fiscal_code?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          kind?: string;
          amount?: number | null;
          status?: string;
          starts_on?: string | null;
          ends_on?: string | null;
          tier?: string;
          url?: string | null;
          logo_path?: string | null;
          show_on_site?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          name?: string;
          fiscal_code?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          kind?: string;
          amount?: number | null;
          status?: string;
          starts_on?: string | null;
          ends_on?: string | null;
          tier?: string;
          url?: string | null;
          logo_path?: string | null;
          show_on_site?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "sponsors_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      staff_groups: {
        Row: {
          user_id: string;
          group_id: string;
        };
        Insert: {
          user_id: string;
          group_id: string;
        };
        Update: {
          user_id?: string;
          group_id?: string;
        };
        Relationships: [
          { foreignKeyName: "staff_groups_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
          { foreignKeyName: "staff_groups_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      status_history: {
        Row: {
          id: string;
          player_id: string;
          status_id: string | null;
          note: string | null;
          zone: string | null;
          side: string | null;
          zone_detail: string | null;
          zone_uncertain: boolean;
          return_on: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          status_id?: string | null;
          note?: string | null;
          zone?: string | null;
          side?: string | null;
          zone_detail?: string | null;
          zone_uncertain?: boolean;
          return_on?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          status_id?: string | null;
          note?: string | null;
          zone?: string | null;
          side?: string | null;
          zone_detail?: string | null;
          zone_uncertain?: boolean;
          return_on?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "status_history_changed_by_fkey"; columns: ["changed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "status_history_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "status_history_status_id_fkey"; columns: ["status_id"]; isOneToOne: false; referencedRelation: "club_statuses"; referencedColumns: ["id"] },
        ];
      };
      support_campaigns: {
        Row: {
          id: string;
          club_id: string;
          income_year: number;
          title: string;
          goal: number | null;
          deadline: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          income_year: number;
          title: string;
          goal?: number | null;
          deadline?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          income_year?: number;
          title?: string;
          goal?: number | null;
          deadline?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "support_campaigns_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      support_pledges: {
        Row: {
          id: string;
          club_id: string;
          campaign_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          two_years: boolean;
          source: string;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          campaign_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          two_years?: boolean;
          source: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          campaign_id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          two_years?: boolean;
          source?: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "support_pledges_campaign_id_fkey"; columns: ["campaign_id"]; isOneToOne: false; referencedRelation: "support_campaigns"; referencedColumns: ["id"] },
          { foreignKeyName: "support_pledges_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      suspensions: {
        Row: {
          id: string;
          club_id: string;
          player_id: string;
          competition_id: string | null;
          reason: string;
          matches_total: number;
          matches_remaining: number;
          source_event_id: string | null;
          created_at: string;
          served_event_ids: string[];
        };
        Insert: {
          id?: string;
          club_id: string;
          player_id: string;
          competition_id?: string | null;
          reason: string;
          matches_total?: number;
          matches_remaining?: number;
          source_event_id?: string | null;
          created_at?: string;
          served_event_ids?: string[];
        };
        Update: {
          id?: string;
          club_id?: string;
          player_id?: string;
          competition_id?: string | null;
          reason?: string;
          matches_total?: number;
          matches_remaining?: number;
          source_event_id?: string | null;
          created_at?: string;
          served_event_ids?: string[];
        };
        Relationships: [
          { foreignKeyName: "suspensions_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "suspensions_competition_id_fkey"; columns: ["competition_id"]; isOneToOne: false; referencedRelation: "competitions"; referencedColumns: ["id"] },
          { foreignKeyName: "suspensions_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "suspensions_source_event_id_fkey"; columns: ["source_event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
        ];
      };
      training_plan_items: {
        Row: {
          id: string;
          event_id: string;
          drill_id: string | null;
          position: number;
          title: string;
          duration_min: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          drill_id?: string | null;
          position: number;
          title: string;
          duration_min?: number | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          drill_id?: string | null;
          position?: number;
          title?: string;
          duration_min?: number | null;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: "training_plan_items_drill_id_fkey"; columns: ["drill_id"]; isOneToOne: false; referencedRelation: "drills"; referencedColumns: ["id"] },
          { foreignKeyName: "training_plan_items_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "training_plans"; referencedColumns: ["event_id"] },
        ];
      };
      training_plans: {
        Row: {
          event_id: string;
          theme: string | null;
          objectives: string | null;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          theme?: string | null;
          objectives?: string | null;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          event_id?: string;
          theme?: string | null;
          objectives?: string | null;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "training_plans_event_id_fkey"; columns: ["event_id"]; isOneToOne: true; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "training_plans_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      training_ratings: {
        Row: {
          event_id: string;
          player_id: string;
          rating: number;
          rated_by: string | null;
          created_at: string;
        };
        Insert: {
          event_id: string;
          player_id: string;
          rating: number;
          rated_by?: string | null;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          player_id?: string;
          rating?: number;
          rated_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "training_ratings_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "training_ratings_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "training_ratings_rated_by_fkey"; columns: ["rated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      venues: {
        Row: {
          id: string;
          club_id: string;
          parent_id: string | null;
          name: string;
          is_own: boolean;
          address: string | null;
          surface: string | null;
          has_lights: boolean;
          is_active: boolean;
          sort: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          parent_id?: string | null;
          name: string;
          is_own?: boolean;
          address?: string | null;
          surface?: string | null;
          has_lights?: boolean;
          is_active?: boolean;
          sort?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          parent_id?: string | null;
          name?: string;
          is_own?: boolean;
          address?: string | null;
          surface?: string | null;
          has_lights?: boolean;
          is_active?: boolean;
          sort?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "venues_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "venues_parent_id_fkey"; columns: ["parent_id"]; isOneToOne: false; referencedRelation: "venues"; referencedColumns: ["id"] },
        ];
      };
      video_marker_players: {
        Row: {
          marker_id: string;
          player_id: string;
        };
        Insert: {
          marker_id: string;
          player_id: string;
        };
        Update: {
          marker_id?: string;
          player_id?: string;
        };
        Relationships: [
          { foreignKeyName: "video_marker_players_marker_id_fkey"; columns: ["marker_id"]; isOneToOne: false; referencedRelation: "video_markers"; referencedColumns: ["id"] },
          { foreignKeyName: "video_marker_players_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
      video_markers: {
        Row: {
          id: string;
          video_id: string;
          t_sec: number;
          end_sec: number | null;
          tag: string;
          label: string | null;
          shared: boolean;
          shared_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          t_sec: number;
          end_sec?: number | null;
          tag?: string;
          label?: string | null;
          shared?: boolean;
          shared_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          t_sec?: number;
          end_sec?: number | null;
          tag?: string;
          label?: string | null;
          shared?: boolean;
          shared_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "video_markers_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "video_markers_video_id_fkey"; columns: ["video_id"]; isOneToOne: false; referencedRelation: "videos"; referencedColumns: ["id"] },
        ];
      };
      videos: {
        Row: {
          id: string;
          club_id: string;
          group_id: string | null;
          event_id: string | null;
          title: string;
          source: string;
          url: string | null;
          storage_path: string | null;
          recorded_on: string;
          duration_sec: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          group_id?: string | null;
          event_id?: string | null;
          title: string;
          source: string;
          url?: string | null;
          storage_path?: string | null;
          recorded_on: string;
          duration_sec?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          group_id?: string | null;
          event_id?: string | null;
          title?: string;
          source?: string;
          url?: string | null;
          storage_path?: string | null;
          recorded_on?: string;
          duration_sec?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "videos_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "videos_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "videos_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "videos_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "groups"; referencedColumns: ["id"] },
        ];
      };
      visa_documents: {
        Row: {
          id: string;
          club_id: string;
          player_id: string;
          storage_path: string;
          file_name: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          issued_on: string | null;
          status: string;
          valid_until: string | null;
          reject_reason: string | null;
          uploaded_by: string | null;
          uploaded_at: string;
          decided_by: string | null;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          player_id: string;
          storage_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          issued_on?: string | null;
          status?: string;
          valid_until?: string | null;
          reject_reason?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          decided_by?: string | null;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          player_id?: string;
          storage_path?: string;
          file_name?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          issued_on?: string | null;
          status?: string;
          valid_until?: string | null;
          reject_reason?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
          decided_by?: string | null;
          decided_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "visa_documents_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "visa_documents_decided_by_fkey"; columns: ["decided_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "visa_documents_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "visa_documents_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      wellness_entries: {
        Row: {
          id: string;
          player_id: string;
          entry_date: string;
          fatigue: number | null;
          muscle_load: number | null;
          pain_zone: string | null;
          pain_side: string | null;
          pain_intensity: number | null;
          pain_note: string | null;
          sleep_quality: number | null;
          sleep_hours: number | null;
          stress: number | null;
          mood: number | null;
          source: string;
          needs_review: boolean;
          review_note: string | null;
          raw: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          entry_date: string;
          fatigue?: number | null;
          muscle_load?: number | null;
          pain_zone?: string | null;
          pain_side?: string | null;
          pain_intensity?: number | null;
          pain_note?: string | null;
          sleep_quality?: number | null;
          sleep_hours?: number | null;
          stress?: number | null;
          mood?: number | null;
          source?: string;
          needs_review?: boolean;
          review_note?: string | null;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          entry_date?: string;
          fatigue?: number | null;
          muscle_load?: number | null;
          pain_zone?: string | null;
          pain_side?: string | null;
          pain_intensity?: number | null;
          pain_note?: string | null;
          sleep_quality?: number | null;
          sleep_hours?: number | null;
          stress?: number | null;
          mood?: number | null;
          source?: string;
          needs_review?: boolean;
          review_note?: string | null;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "wellness_entries_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      charge_balances: {
        Row: {
          id: string;
          club_id: string;
          player_id: string;
          guardian_id: string | null;
          kind: string;
          request_id: string | null;
          period: string | null;
          title: string;
          amount: number;
          discount: number;
          discount_note: string | null;
          net: number;
          due_on: string;
          status: string;
          issued_at: string;
          paid: number;
          balance: number;
          state: string;
          last_paid_on: string | null;
        };
        Relationships: [
          { foreignKeyName: "charge_balances_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "charge_balances_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
          { foreignKeyName: "charge_balances_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "charge_balances_request_id_fkey"; columns: ["request_id"]; isOneToOne: false; referencedRelation: "charge_requests"; referencedColumns: ["id"] },
        ];
      };
      payment_balances: {
        Row: {
          id: string;
          club_id: string;
          guardian_id: string | null;
          player_id: string | null;
          amount: number;
          method: string;
          provider: string | null;
          provider_ref: string | null;
          received_on: string;
          payer_name: string | null;
          reference: string | null;
          note: string | null;
          status: string;
          refunded_amount: number;
          created_at: string;
          allocated: number;
          unallocated: number;
        };
        Relationships: [
          { foreignKeyName: "payment_balances_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_balances_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "guardians"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_balances_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
        ];
      };
    };
    Functions: {
      add_match_event: { Args: { p_event: string | null; p: Json | null }; Returns: string };
      admin_accounts: { Args: Record<PropertyKey, never>; Returns: { user_id: string; has_password: boolean; disabled: boolean; anonymized: boolean; last_sign_in_at: string; invite_expires_at: string }[] };
      allocate_payment: { Args: { p_payment: string | null; p_rows: Json | null; p_guardian?: string | null; p_player?: string | null }; Returns: number };
      anonymize_player: { Args: { p_player: string | null }; Returns: undefined };
      apply_provider_event: { Args: { p: Json | null }; Returns: Json };
      assign_program: { Args: { p_program: string | null; p_target_type: string | null; p_group: string | null; p_position: string | null; p_player_ids: string[] | null; p_start: string | null; p_end: string | null; p_weekdays: number[] | null; p_notes: string | null }; Returns: string };
      attach_intent_checkout: { Args: { p_intent: string | null; p_provider_ref: string | null; p_url: string | null }; Returns: undefined };
      auto_issue_due: { Args: Record<PropertyKey, never>; Returns: Json };
      auto_pay_candidates: { Args: { p_club: string | null }; Returns: { guardian_id: string; method_ref: string; provider: string; charge_ids: string[]; amount: number }[] };
      book_trial: { Args: { p_id: string | null; p_event: string | null }; Returns: undefined };
      budget_report: { Args: { p_year: number | null }; Returns: Json };
      camp_spots: { Args: { p_camp: string | null }; Returns: number };
      cancel_camp_registration: { Args: { p_id: string | null; p_reason?: string | null }; Returns: undefined };
      cancel_charge: { Args: { p_charge: string | null; p_reason: string | null }; Returns: undefined };
      cancel_message: { Args: { p_id: string | null }; Returns: undefined };
      cancel_order: { Args: { p_id: string | null; p_reason?: string | null }; Returns: undefined };
      cancel_purchase_request: { Args: { p_id: string | null }; Returns: undefined };
      clear_must_change_password: { Args: Record<PropertyKey, never>; Returns: undefined };
      close_match: { Args: { p_event: string | null; p_ratings?: Json | null; p_report?: string | null }; Returns: undefined };
      club_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      complete_purchase_request: { Args: { p_id: string | null; p: Json | null }; Returns: string };
      compute_bonuses: { Args: { p_from: string | null; p_to: string | null }; Returns: number };
      confirm_camp_registration: { Args: { p_id: string | null; p_player?: string | null }; Returns: undefined };
      copy_daily_plan: { Args: { p_plan: string | null; p_dates: string[] | null; p_players?: string[] | null }; Returns: number };
      create_auto_pay_intent: { Args: { p_guardian: string | null; p_charge_ids: string[] | null }; Returns: Json };
      create_enrolment_request: { Args: { p: Json | null }; Returns: string };
      create_fitness_battery: { Args: { p: Json | null }; Returns: string };
      create_payment_intent: { Args: { p_charge_ids: string[] | null; p_save_method?: boolean | null }; Returns: Json };
      decide_bonus_entries: { Args: { p_ids: string[] | null; p_status: string | null }; Returns: number };
      decide_purchase_request: { Args: { p_id: string | null; p_decision: string | null; p_note?: string | null }; Returns: undefined };
      decide_visa_document: { Args: { p_id: string | null; p_approve: boolean | null; p_valid_until?: string | null; p_issued_on?: string | null; p_reason?: string | null }; Returns: undefined };
      decline_contract: { Args: { p_id: string | null; p_reason: string | null }; Returns: undefined };
      decline_enrolment: { Args: { p_id: string | null; p_reason: string | null; p_withdrawn?: boolean | null }; Returns: undefined };
      delete_album: { Args: { p_id: string | null }; Returns: string[] };
      delete_charge_request: { Args: { p_id: string | null }; Returns: undefined };
      delete_evaluation_round: { Args: { p_round: string | null }; Returns: undefined };
      delete_match_event: { Args: { p_id: string | null }; Returns: undefined };
      delete_photo: { Args: { p_id: string | null }; Returns: string };
      delete_pledge: { Args: { p_id: string | null }; Returns: undefined };
      delete_site_post: { Args: { p_id: string | null }; Returns: undefined };
      delete_sponsor: { Args: { p_id: string | null }; Returns: string };
      enrol_request: { Args: { p_id: string | null; p: Json | null }; Returns: Json };
      erase_player: { Args: { p_player: string | null }; Returns: string };
      evaluation_comment: { Args: { p_eval: string | null }; Returns: string };
      expense_from_bank_line: { Args: { p_line: string | null; p: Json | null }; Returns: string };
      export_player_data: { Args: { p_player?: string | null }; Returns: Json };
      family_payment_info: { Args: Record<PropertyKey, never>; Returns: Json };
      fee_roster: { Args: { p_period: string | null }; Returns: { player_id: string; full_name: string; group_id: string; is_active: boolean; fee: number; own_plan: boolean; adjustments: string; guardian_id: string; guardian_name: string; payment_ref: string; charge_id: string; net: number; paid: number; state: string; due_on: string }[] };
      file_access: { Args: { p_bucket: string | null; p_path: string | null; p_action: string | null }; Returns: boolean };
      group_fee_now: { Args: { p_group: string | null }; Returns: number };
      group_test_averages: { Args: { p_group: string | null }; Returns: { test_id: string; average: number; best: number; players: number }[] };
      import_bank_statement: { Args: { p: Json | null }; Returns: Json };
      import_fixtures: { Args: { p_competition: string | null; p_rows: Json | null; p_duration_min?: number | null }; Returns: Json };
      import_health_status: { Args: { p_payload: Json | null }; Returns: Json };
      import_physical: { Args: { p_payload: Json | null }; Returns: Json };
      import_roster: { Args: { p_payload: Json | null }; Returns: Json };
      import_standings: { Args: { p_competition: string | null; p_rows: Json | null }; Returns: number };
      import_tests: { Args: { p_payload: Json | null }; Returns: Json };
      import_tfb: { Args: { p: Json | null; p_report?: Json | null }; Returns: Json };
      import_wellness: { Args: { p_payload: Json | null }; Returns: Json };
      issue_monthly_charges: { Args: { p_period: string | null; p_club?: string | null }; Returns: Json };
      log_event: { Args: { p_action: string | null; p_entity: string | null; p_details?: Json | null }; Returns: undefined };
      log_medical_access: { Args: { p_player: string | null; p_section?: string | null }; Returns: undefined };
      mark_message_read: { Args: { p_id: string | null }; Returns: undefined };
      match_eligibility: { Args: { p_event: string | null }; Returns: { player_id: string; reason: string; detail: string; until_date: string }[] };
      money_summary: { Args: { p_year: number | null; p_month?: number | null }; Returns: Json };
      my_clips: { Args: Record<PropertyKey, never>; Returns: { marker_id: string; player_id: string; player_name: string; video_title: string; recorded_on: string; source: string; url: string; storage_path: string; t_sec: number; end_sec: number; tag: string; label: string; shared_at: string }[] };
      my_trials: { Args: { p_event?: string | null }; Returns: { id: string; child_name: string; birth_year: number; pos: string; previous_club: string; event_id: string; trial_at: string; status: string; trial_rating: number; trial_note: string }[] };
      note_enrolment: { Args: { p_id: string | null; p_note: string | null }; Returns: undefined };
      photo_consent_state: { Args: { p_album: string | null }; Returns: { photo_id: string; is_public: boolean; missing: string[]; reviewed: boolean }[] };
      place_order: { Args: { p_player: string | null; p_items: Json | null; p_note?: string | null }; Returns: Json };
      player_file_paths: { Args: { p_player: string | null }; Returns: { bucket: string; path: string }[] };
      players_past_retention: { Args: Record<PropertyKey, never>; Returns: { player_id: string; display_name: string; inactive_since: string }[] };
      preview_bank_lines: { Args: { p_lines: Json | null }; Returns: Json };
      preview_message_audience: { Args: { p_audience: Json | null }; Returns: { user_id: string; full_name: string; role: Database["public"]["Enums"]["app_role"]; reason: string }[] };
      preview_monthly_charges: { Args: { p_period: string | null }; Returns: Json };
      public_album: { Args: { p_slug: string | null; p_album: string | null }; Returns: { title: string; taken_on: string; path: string; caption: string }[] };
      public_albums: { Args: { p_slug: string | null }; Returns: { id: string; title: string; taken_on: string; cover_path: string; photos: number }[] };
      public_camps: { Args: { p_slug: string | null }; Returns: { id: string; title: string; description: string; location: string; starts_on: string; ends_on: string; price: number; birth_year_from: number; birth_year_to: number; deadline: string; spots_left: number }[] };
      public_club: { Args: { p_slug: string | null }; Returns: Json };
      public_logo_path: { Args: { p_slug: string | null }; Returns: string };
      public_policy: { Args: { p_slug: string | null }; Returns: { version: number; body: string; published_at: string }[] };
      public_post: { Args: { p_slug: string | null; p_post: string | null }; Returns: { id: string; title: string; slug: string; excerpt: string; cover_path: string; blocks: Json; published_at: string }[] };
      public_posts: { Args: { p_slug: string | null; p_limit?: number | null; p_offset?: number | null }; Returns: { id: string; title: string; slug: string; excerpt: string; cover_path: string; published_at: string }[] };
      public_support: { Args: { p_slug: string | null }; Returns: Json };
      public_teams: { Args: { p_slug: string | null }; Returns: Json };
      publish_evaluation_round: { Args: { p_round: string | null }; Returns: number };
      publish_site_policy: { Args: { p_body: string | null }; Returns: number };
      publish_site_post: { Args: { p_id: string | null; p_publish: boolean | null }; Returns: number };
      purge_camp_data: { Args: Record<PropertyKey, never>; Returns: number };
      purge_enrolment_requests: { Args: Record<PropertyKey, never>; Returns: number };
      record_payment: { Args: { p: Json | null }; Returns: Json };
      record_support_pledge: { Args: { p_slug: string | null; p: Json | null; p_ip?: string | null }; Returns: Json };
      record_trial: { Args: { p_id: string | null; p_rating: number | null; p_note: string | null }; Returns: undefined };
      refresh_daily_alerts: { Args: { p_club?: string | null }; Returns: number };
      register_camp: { Args: { p_camp: string | null; p_player: string | null; p_notes?: string | null }; Returns: string };
      remind_contracts: { Args: { p_ids: string[] | null }; Returns: number };
      remind_overdue_families: { Args: Record<PropertyKey, never>; Returns: number };
      reopen_enrolment: { Args: { p_id: string | null }; Returns: undefined };
      reopen_match: { Args: { p_event: string | null }; Returns: undefined };
      resolve_bank_line: { Args: { p_line: string | null; p: Json | null }; Returns: undefined };
      revoke_payment_method: { Args: { p_method: string | null }; Returns: undefined };
      run_contract_reminders: { Args: Record<PropertyKey, never>; Returns: number };
      run_rpe_requests: { Args: Record<PropertyKey, never>; Returns: number };
      run_scheduled_messages: { Args: Record<PropertyKey, never>; Returns: number };
      run_visa_reminders: { Args: Record<PropertyKey, never>; Returns: number };
      save_album: { Args: { p: Json | null }; Returns: string };
      save_attendance: { Args: { p_event: string | null; p_rows: Json | null }; Returns: number };
      save_body_measurements: { Args: { p_date: string | null; p_rows: Json | null }; Returns: number };
      save_budget_lines: { Args: { p_year: number | null; p_kind: string | null; p_department: string | null; p_amounts: number[] | null }; Returns: undefined };
      save_camp: { Args: { p: Json | null }; Returns: string };
      save_campaign: { Args: { p: Json | null }; Returns: string };
      save_charge_request: { Args: { p: Json | null }; Returns: Json };
      save_contract_template: { Args: { p: Json | null }; Returns: string };
      save_daily_plan: { Args: { p_player: string | null; p_date: string | null; p_title: string | null; p_notes: string | null; p_injury: string | null; p_rtp_stage: number | null; p_items: Json | null }; Returns: string };
      save_evaluation: { Args: { p_round: string | null; p_player: string | null; p_scores: Json | null; p_strengths?: string | null; p_next_goals?: string | null; p_comment?: string | null; p_submit?: boolean | null }; Returns: string };
      save_evaluation_template: { Args: { p: Json | null }; Returns: string };
      save_event: { Args: { p: Json | null }; Returns: string };
      save_match_squad: { Args: { p_event: string | null; p_formation: string | null; p_rows: Json | null }; Returns: number };
      save_photo: { Args: { p: Json | null }; Returns: string };
      save_pledge: { Args: { p: Json | null }; Returns: string };
      save_product: { Args: { p: Json | null }; Returns: string };
      save_program: { Args: { p_id: string | null; p_name: string | null; p_description: string | null; p_kind: string | null; p_is_template: boolean | null; p_items: Json | null }; Returns: string };
      save_purchase_request: { Args: { p: Json | null }; Returns: Json };
      save_site_post: { Args: { p: Json | null }; Returns: string };
      save_site_settings: { Args: { p: Json | null }; Returns: number };
      save_sponsor: { Args: { p: Json | null }; Returns: string };
      save_test_grid: { Args: { p_date: string | null; p_rows: Json | null }; Returns: number };
      save_training_plan: { Args: { p_event: string | null; p: Json | null }; Returns: undefined };
      save_training_ratings: { Args: { p_event: string | null; p_ratings: Json | null }; Returns: number };
      search_club: { Args: { p_query: string | null; p_limit?: number | null }; Returns: Json };
      send_contracts: { Args: { p_template: string | null; p_players: string[] | null; p_due_on?: string | null }; Returns: Json };
      send_fee_reminders: { Args: Record<PropertyKey, never>; Returns: number };
      send_message: { Args: { p: Json | null }; Returns: Json };
      send_visa_reminders: { Args: { p_players: string[] | null }; Returns: number };
      send_wellness_reminders: { Args: Record<PropertyKey, never>; Returns: number };
      set_approver_roles: { Args: { p_roles: Database["public"]["Enums"]["app_role"][] | null }; Returns: undefined };
      set_auto_pay: { Args: { p_method: string | null; p_on: boolean | null }; Returns: undefined };
      set_camp_paid: { Args: { p_id: string | null; p_paid: boolean | null; p_note?: string | null }; Returns: undefined };
      set_charge_discount: { Args: { p_charge: string | null; p_discount: number | null; p_note: string | null }; Returns: undefined };
      set_event_state: { Args: { p_event: string | null; p_state: string | null; p_scope?: string | null }; Returns: number };
      set_fee_plan: { Args: { p_group: string | null; p_player: string | null; p_amount: number | null; p_from: string | null; p_reason?: string | null }; Returns: string };
      set_kit_size: { Args: { p_player: string | null; p_size: string | null }; Returns: undefined };
      set_my_photo: { Args: { p_path: string | null }; Returns: undefined };
      set_order_status: { Args: { p_id: string | null; p_status: string | null }; Returns: undefined };
      set_pledges_status: { Args: { p_ids: string[] | null; p_status: string | null }; Returns: number };
      setup_club: { Args: { p_slug: string | null; p_name: string | null; p_short_name: string | null; p_groups: string[] | null; p_settings?: Json | null }; Returns: string };
      share_video_marker: { Args: { p_marker: string | null; p_share: boolean | null }; Returns: number };
      sign_contract: { Args: { p_id: string | null; p_name: string | null; p_signature_path: string | null; p_ip?: string | null; p_user_agent?: string | null }; Returns: string };
      site_public_file: { Args: { p_slug: string | null; p_path: string | null }; Returns: boolean };
      start_evaluation_round: { Args: { p: Json | null }; Returns: string };
      submit_camp_registration: { Args: { p_slug: string | null; p_camp: string | null; p: Json | null; p_ip?: string | null }; Returns: boolean };
      submit_enrolment_request: { Args: { p_slug: string | null; p: Json | null; p_ip?: string | null }; Returns: boolean };
      submit_visa_document: { Args: { p_player: string | null; p_path: string | null; p_file_name: string | null; p_mime: string | null; p_size: number | null; p_issued_on?: string | null }; Returns: string };
      switch_membership: { Args: { p_membership: string | null }; Returns: undefined };
      unaccent_ro: { Args: { p: string | null }; Returns: string };
      update_enrolment_request: { Args: { p_id: string | null; p: Json | null }; Returns: undefined };
      update_my_profile: { Args: { p_full_name?: string | null; p_phone?: string | null; p_email_notifications?: boolean | null }; Returns: undefined };
      view_contract: { Args: { p_id: string | null; p_ip?: string | null }; Returns: undefined };
      void_contract: { Args: { p_id: string | null; p_reason: string | null }; Returns: undefined };
      void_payment: { Args: { p_payment: string | null; p_reason: string | null }; Returns: undefined };
      waitlist_camp_registration: { Args: { p_id: string | null }; Returns: undefined };
      withdraw_photo_consent: { Args: { p_player: string | null }; Returns: undefined };
    };
    Enums: {
      app_role: "owner" | "sporting_director" | "physio" | "coach" | "player" | "medical_partner" | "admin" | "secretary" | "accountant" | "guardian";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
