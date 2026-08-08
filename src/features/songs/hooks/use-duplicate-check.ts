'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const DEBOUNCE_MS = 400;
/** `find_similar_songs` itself returns nothing under 3 characters; matching it here saves the round trip. */
const MIN_LENGTH = 3;

export type SimilarSong = {
  id: string;
  title: string;
  artist: string | null;
  version_count: number;
  similarity: number;
};

/**
 * Looks for songs that already exist under a similar title, as the admin types.
 *
 * 400ms rather than the 250ms used for search: the admin is composing a title,
 * not scanning results, and a warning that appears mid-word is noise.
 */
export function useDuplicateCheck(title: string) {
  const debounced = useDebouncedValue(title.trim(), DEBOUNCE_MS);

  const { data } = useQuery({
    queryKey: ['songs', 'similar', debounced],
    queryFn: async (): Promise<SimilarSong[]> => {
      const supabase = createClient();

      const { data, error } = await supabase.rpc('find_similar_songs', {
        p_title: debounced,
        p_limit: 5,
      });

      if (error) throw error;
      return data ?? [];
    },
    enabled: debounced.length >= MIN_LENGTH,
    staleTime: 60_000,
  });

  // No error branch on purpose: a failed duplicate check should be invisible.
  // It is an advisory aid, and an error banner over the title field would be
  // more disruptive than the missed warning it is reporting.
  return data ?? [];
}
