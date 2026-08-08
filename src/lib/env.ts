import { z } from 'zod';

/**
 * Environment validation.
 *
 * Two schemas, because the client bundle only ever contains NEXT_PUBLIC_ vars —
 * validating the server schema in the browser would fail on missing secrets.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only for *literal*
 * property access, which is why these are spelled out rather than looped over.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_VISION_MODEL: z.string().default('gpt-4o'),
});

/**
 * An env var that is present but blank means "not set".
 *
 * `.env.example` ships `OPENAI_API_KEY=` with no value, so a fresh checkout has
 * the key defined as `""`. Zod's `.optional()` admits `undefined` and rejects
 * `""`, so without this the whole server schema fails to parse — and because
 * `serverEnv()` is all-or-nothing, an unconfigured *optional* feature took down
 * `SUPABASE_SERVICE_ROLE_KEY` along with it.
 */
function blankAsUnset(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const missing = Object.keys(result.error.flatten().fieldErrors).join(', ');
    throw new Error(`Invalid ${label} environment variables: ${missing}. See .env.example.`);
  }
  return result.data;
}

export const clientEnv = parse(
  clientSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  'client',
);

/**
 * Lazy: reading this from a client component would throw. Server modules that
 * need secrets call `serverEnv()` inside the function body, not at module scope.
 */
let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  if (!cachedServerEnv) {
    cachedServerEnv = parse(
      serverSchema,
      {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        OPENAI_API_KEY: blankAsUnset(process.env.OPENAI_API_KEY),
        OPENAI_VISION_MODEL: blankAsUnset(process.env.OPENAI_VISION_MODEL),
      },
      'server',
    );
  }
  return cachedServerEnv;
}
