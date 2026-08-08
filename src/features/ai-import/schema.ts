import { z } from 'zod';

/**
 * What the vision model is asked to return, and the trust boundary for it.
 *
 * Structured outputs already guarantee the shape, so the Zod parse looks
 * redundant — it is not. The response is JSON from a third-party service that
 * goes straight into a form; parsing it here means a change in the model's
 * behaviour surfaces as a caught error rather than as `undefined` rendered into
 * an input.
 */
export const extractedSongSchema = z.object({
  title: z.string(),
  artist: z.string().nullable(),
  key: z.string().nullable(),
  capo: z.number().int().min(0).max(12).nullable(),
  lyrics_with_chords: z.string(),
  /** The model's own read on how much of this needs checking. */
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()),
});

export type ExtractedSong = z.infer<typeof extractedSongSchema>;

/**
 * The same shape as JSON Schema, for OpenAI structured outputs.
 *
 * `strict: true` requires every property to appear in `required` and
 * `additionalProperties: false` on every object — optionality is expressed as a
 * `["string", "null"]` union instead, which is why nothing here is omitted.
 */
export const extractedSongJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'artist', 'key', 'capo', 'lyrics_with_chords', 'confidence', 'warnings'],
  properties: {
    title: { type: 'string', description: 'Song title exactly as written.' },
    artist: { type: ['string', 'null'] },
    key: { type: ['string', 'null'], description: 'e.g. "G", "Am". Null if not written.' },
    capo: { type: ['integer', 'null'], minimum: 0, maximum: 12 },
    lyrics_with_chords: {
      type: 'string',
      description: 'Chord lines above lyric lines, alignment preserved with spaces.',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Unreadable regions or guessed content the admin should verify. Written in Georgian.',
    },
  },
} as const;
