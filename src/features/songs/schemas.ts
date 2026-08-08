import { z } from 'zod';

import { normalizeSheet } from '@/lib/chords/normalize';

/**
 * Two schemas per form, on purpose.
 *
 * `*FormSchema` describes what the DOM actually produces: strings, with "" for
 * "not set". React Hook Form binds to this, so its inferred types match the
 * inputs and field-level messages come from the same rules the server enforces.
 *
 * `*InputSchema` is the trust boundary. It re-validates the same rules and then
 * transforms into the database shape ("" → null, "5" → 5). The action parses
 * with this and never trusts the client to have done the conversion.
 *
 * The earlier single-schema version used `z.preprocess`, which types its input
 * as `unknown` and left RHF with no field types at all. This is the version
 * that actually type-checks.
 */

/** ISO 639-1. Two entries today; the column is `text` so adding one is not a migration. */
export const languageSchema = z.enum(['ka', 'en']);
export type Language = z.infer<typeof languageSchema>;

export const LANGUAGE_LABELS: Record<Language, string> = {
  ka: 'ქართული',
  en: 'English',
};

/** "" (not set), or 0–12. Validated as a string because that is what a <select> gives. */
const capoField = z.string().regex(/^$|^(?:\d|1[0-2])$/, 'კაპო უნდა იყოს 0-დან 12-მდე');

const emptyToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());
const capoToNumber = (value: string): number | null => (value === '' ? null : Number(value));

// -----------------------------------------------------------------------------
// Song
// -----------------------------------------------------------------------------

/**
 * The name of an arrangement, shared by both tables.
 *
 * A song's own arrangement and a `song_versions` row are the same thing to a
 * reader — two tabs in one switcher — so they validate identically. Declaring
 * the rule twice is how the two drift into behaving differently.
 */
const versionNameField = z.string().trim().min(1, 'მიუთითეთ ვერსიის სახელი').max(120);

export const songFormSchema = z.object({
  title: z.string().trim().min(1, 'სათაური სავალდებულოა').max(200),
  version_name: versionNameField,
  artist: z.string().max(200),
  language: languageSchema,
  key: z.string().max(20),
  capo: capoField,
  lyrics_with_chords: z.string().max(20_000, 'ეს ნებისმიერ სიმღერის ფურცელზე გრძელია'),
  notes: z.string().max(2_000),
  categoryIds: z.array(z.string().uuid()),
});

export type SongFormValues = z.infer<typeof songFormSchema>;

export const songInputSchema = songFormSchema.transform((values) => ({
  title: values.title,
  version_name: values.version_name,
  artist: emptyToNull(values.artist),
  language: values.language,
  key: emptyToNull(values.key),
  capo: capoToNumber(values.capo),
  // Normalised on the way in, not on the way out: trailing spaces reach the
  // form from pasted sheets and the photo importer, and once stored they are
  // indistinguishable from typed ones. Leading whitespace is untouched — on a
  // chord line it *is* the chord position.
  lyrics_with_chords: normalizeSheet(values.lyrics_with_chords),
  notes: emptyToNull(values.notes),
  categoryIds: values.categoryIds,
}));

export const EMPTY_SONG_FORM: SongFormValues = {
  title: '',
  // Matches the column default in migration 0006 — a new song is named the same
  // way whether the row is created here or straight in SQL.
  version_name: 'მთავარი',
  artist: '',
  language: 'ka',
  key: '',
  capo: '',
  lyrics_with_chords: '',
  notes: '',
  categoryIds: [],
};

/** Database row → form values. The inverse of the transform above. */
export function toSongFormValues(song: {
  title: string;
  version_name: string;
  artist: string | null;
  language: string;
  key: string | null;
  capo: number | null;
  lyrics_with_chords: string;
  notes: string | null;
  categoryIds: string[];
}): SongFormValues {
  return {
    title: song.title,
    version_name: song.version_name,
    artist: song.artist ?? '',
    // The column is `text`, so a row could hold a language the form does not
    // offer. Fall back rather than rendering an empty select.
    language: languageSchema.catch('ka').parse(song.language),
    key: song.key ?? '',
    capo: song.capo === null ? '' : String(song.capo),
    lyrics_with_chords: song.lyrics_with_chords,
    notes: song.notes ?? '',
    categoryIds: song.categoryIds,
  };
}

// -----------------------------------------------------------------------------
// Version
// -----------------------------------------------------------------------------

export const versionFormSchema = z.object({
  version_name: versionNameField,
  key: z.string().max(20),
  capo: capoField,
  lyrics_with_chords: z.string().max(20_000),
  notes: z.string().max(2_000),
});

export type VersionFormValues = z.infer<typeof versionFormSchema>;

/** Null key/capo on a version means "inherit from the song", so "" must survive as null. */
export const versionInputSchema = versionFormSchema.transform((values) => ({
  version_name: values.version_name,
  key: emptyToNull(values.key),
  capo: capoToNumber(values.capo),
  lyrics_with_chords: normalizeSheet(values.lyrics_with_chords),
  notes: emptyToNull(values.notes),
}));

export const EMPTY_VERSION_FORM: VersionFormValues = {
  version_name: '',
  key: '',
  capo: '',
  lyrics_with_chords: '',
  notes: '',
};

export function toVersionFormValues(version: {
  version_name: string;
  key: string | null;
  capo: number | null;
  lyrics_with_chords: string;
  notes: string | null;
}): VersionFormValues {
  return {
    version_name: version.version_name,
    key: version.key ?? '',
    capo: version.capo === null ? '' : String(version.capo),
    lyrics_with_chords: version.lyrics_with_chords,
    notes: version.notes ?? '',
  };
}

/** Ids travel as separate action arguments rather than as form fields. */
export const uuidSchema = z.string().uuid();

/** Musical keys offered in the picker. */
export const KEYS = [
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
  'A',
  'A#',
  'Bb',
  'B',
  'Am',
  'Bm',
  'Cm',
  'Dm',
  'Em',
  'Fm',
  'Gm',
] as const;
