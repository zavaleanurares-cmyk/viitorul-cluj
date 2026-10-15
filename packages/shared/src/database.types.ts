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
      match_squad: {
        Row: {
          event_id: string;
          player_id: string;
          role: string;
          slot: number | null;
          is_captain: boolean;
          minutes: number | null;
          rating: number | null;
        };
        Insert: {
          event_id: string;
          player_id: string;
          role: string;
          slot?: number | null;
          is_captain?: boolean;
          minutes?: number | null;
          rating?: number | null;
        };
        Update: {
          event_id?: string;
          player_id?: string;
          role?: string;
          slot?: number | null;
          is_captain?: boolean;
          minutes?: number | null;
          rating?: number | null;
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
        };
        Relationships: [
          { foreignKeyName: "suspensions_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "suspensions_competition_id_fkey"; columns: ["competition_id"]; isOneToOne: false; referencedRelation: "competitions"; referencedColumns: ["id"] },
          { foreignKeyName: "suspensions_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "players"; referencedColumns: ["id"] },
          { foreignKeyName: "suspensions_source_event_id_fkey"; columns: ["source_event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
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
    Views: { [_ in never]: never };
    Functions: {
      add_match_event: { Args: { p_event: string | null; p: Json | null }; Returns: string };
      admin_accounts: { Args: Record<PropertyKey, never>; Returns: { user_id: string; has_password: boolean; disabled: boolean; anonymized: boolean; last_sign_in_at: string; invite_expires_at: string }[] };
      anonymize_player: { Args: { p_player: string | null }; Returns: undefined };
      assign_program: { Args: { p_program: string | null; p_target_type: string | null; p_group: string | null; p_position: string | null; p_player_ids: string[] | null; p_start: string | null; p_end: string | null; p_weekdays: number[] | null; p_notes: string | null }; Returns: string };
      clear_must_change_password: { Args: Record<PropertyKey, never>; Returns: undefined };
      close_match: { Args: { p_event: string | null; p_ratings?: Json | null; p_report?: string | null }; Returns: undefined };
      club_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      copy_daily_plan: { Args: { p_plan: string | null; p_dates: string[] | null; p_players?: string[] | null }; Returns: number };
      delete_match_event: { Args: { p_id: string | null }; Returns: undefined };
      erase_player: { Args: { p_player: string | null }; Returns: string };
      export_player_data: { Args: { p_player?: string | null }; Returns: Json };
      file_access: { Args: { p_bucket: string | null; p_path: string | null; p_action: string | null }; Returns: boolean };
      group_test_averages: { Args: { p_group: string | null }; Returns: { test_id: string; average: number; best: number; players: number }[] };
      import_fixtures: { Args: { p_competition: string | null; p_rows: Json | null; p_duration_min?: number | null }; Returns: Json };
      import_health_status: { Args: { p_payload: Json | null }; Returns: Json };
      import_physical: { Args: { p_payload: Json | null }; Returns: Json };
      import_roster: { Args: { p_payload: Json | null }; Returns: Json };
      import_standings: { Args: { p_competition: string | null; p_rows: Json | null }; Returns: number };
      import_tests: { Args: { p_payload: Json | null }; Returns: Json };
      import_wellness: { Args: { p_payload: Json | null }; Returns: Json };
      log_event: { Args: { p_action: string | null; p_entity: string | null; p_details?: Json | null }; Returns: undefined };
      log_medical_access: { Args: { p_player: string | null; p_section?: string | null }; Returns: undefined };
      match_eligibility: { Args: { p_event: string | null }; Returns: { player_id: string; reason: string; detail: string; until_date: string }[] };
      players_past_retention: { Args: Record<PropertyKey, never>; Returns: { player_id: string; display_name: string; inactive_since: string }[] };
      refresh_daily_alerts: { Args: { p_club?: string | null }; Returns: number };
      reopen_match: { Args: { p_event: string | null }; Returns: undefined };
      save_attendance: { Args: { p_event: string | null; p_rows: Json | null }; Returns: number };
      save_daily_plan: { Args: { p_player: string | null; p_date: string | null; p_title: string | null; p_notes: string | null; p_injury: string | null; p_rtp_stage: number | null; p_items: Json | null }; Returns: string };
      save_event: { Args: { p: Json | null }; Returns: string };
      save_match_squad: { Args: { p_event: string | null; p_formation: string | null; p_rows: Json | null }; Returns: number };
      save_program: { Args: { p_id: string | null; p_name: string | null; p_description: string | null; p_kind: string | null; p_is_template: boolean | null; p_items: Json | null }; Returns: string };
      send_wellness_reminders: { Args: Record<PropertyKey, never>; Returns: number };
      set_event_state: { Args: { p_event: string | null; p_state: string | null; p_scope?: string | null }; Returns: number };
      set_my_photo: { Args: { p_path: string | null }; Returns: undefined };
      setup_club: { Args: { p_slug: string | null; p_name: string | null; p_short_name: string | null; p_groups: string[] | null; p_settings?: Json | null }; Returns: string };
      switch_membership: { Args: { p_membership: string | null }; Returns: undefined };
      unaccent_ro: { Args: { p: string | null }; Returns: string };
      update_my_profile: { Args: { p_full_name?: string | null; p_phone?: string | null; p_email_notifications?: boolean | null }; Returns: undefined };
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
