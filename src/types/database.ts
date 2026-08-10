/**
 * Database types.
 *
 * Hand-written to match supabase/migrations/*.sql so the app type-checks before
 * a Supabase project exists. Once linked, replace this file wholesale with:
 *
 *   supabase gen types typescript --linked > src/types/database.ts
 *
 * The shape below matches the generator's output, so that is a drop-in swap.
 * Never hand-edit the generated version.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: Database['public']['Enums']['user_role'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string;
          role?: Database['public']['Enums']['user_role'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: Database['public']['Enums']['user_role'];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: { id: string; name: string; slug: string; created_at: string };
        Insert: { id?: string; name: string; slug: string; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; created_at?: string };
        Relationships: [];
      };
      songs: {
        Row: {
          id: string;
          title: string;
          version_name: string;
          artist: string | null;
          language: string;
          lyrics_with_chords: string;
          lyrics_plain: string;
          notes: string | null;
          key: string | null;
          capo: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          version_name?: string;
          artist?: string | null;
          language?: string;
          lyrics_with_chords?: string;
          lyrics_plain?: string;
          notes?: string | null;
          key?: string | null;
          capo?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          version_name?: string;
          artist?: string | null;
          language?: string;
          lyrics_with_chords?: string;
          lyrics_plain?: string;
          notes?: string | null;
          key?: string | null;
          capo?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'songs_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      song_versions: {
        Row: {
          id: string;
          song_id: string;
          version_name: string;
          lyrics_with_chords: string;
          lyrics_plain: string;
          notes: string | null;
          key: string | null;
          capo: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          song_id: string;
          version_name: string;
          lyrics_with_chords?: string;
          lyrics_plain?: string;
          notes?: string | null;
          key?: string | null;
          capo?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          song_id?: string;
          version_name?: string;
          lyrics_with_chords?: string;
          lyrics_plain?: string;
          notes?: string | null;
          key?: string | null;
          capo?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'song_versions_song_id_fkey';
            columns: ['song_id'];
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      song_categories: {
        Row: { song_id: string; category_id: string };
        Insert: { song_id: string; category_id: string };
        Update: { song_id?: string; category_id?: string };
        Relationships: [
          {
            foreignKeyName: 'song_categories_song_id_fkey';
            columns: ['song_id'];
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'song_categories_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      search_songs: {
        Args: {
          p_query?: string | null;
          p_category_ids?: string[] | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          title: string;
          artist: string | null;
          key: string | null;
          capo: number | null;
          language: string;
          snippet: string;
          categories: Json;
          created_at: string;
          rank: number;
          total_count: number;
        }[];
      };
      find_similar_songs: {
        Args: { p_title: string; p_limit?: number };
        Returns: {
          id: string;
          title: string;
          artist: string | null;
          version_count: number;
          similarity: number;
        }[];
      };
    };
    Enums: {
      user_role: 'admin' | 'co_admin' | 'user';
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
