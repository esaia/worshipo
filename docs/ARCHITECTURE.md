# Worshipo — Architecture

Georgian worship songs & chords. **Public songbook, private admin**: anyone can
search and read songs on their phone with no account at all; a small set of admins
sign in to add and edit them. There is no public registration and no member tier —
an account exists only to grant write access.

---

## 1. Architecture overview

### The shape of the system

```
┌─────────────────────────────────────────────────┐
│  Phone browser (90% of traffic)                 │
│  Next.js 15 App Router — mostly RSC             │
└───────────────┬─────────────────────────────────┘
                │
       ┌────────┴────────┐
       │                 │
  Server Components   Client Components
  + Server Actions    + TanStack Query
       │                 │
       │                 │  anon key, user JWT, RLS enforced
       │                 └──────────────► Supabase (Postgres)
       │
       │  service-role key, never leaves the server
       ├──────────────────────────────────► Supabase Auth Admin API
       └──────────────────────────────────► OpenAI Vision
```

### The three decisions everything else follows from

**1. Postgres is the application.** Search, duplicate detection, authorization, and
referential integrity all live in the database. There is no separate search service,
no cache layer, no background worker. This is what keeps operating cost near zero
(Supabase free/Pro tier + Vercel Hobby/Pro) and keeps the codebase small enough for
one person to maintain.

**2. RLS is the authorization boundary, not the UI.** Every table is deny-by-default,
then opened deliberately: the songbook tables grant `select` to `anon`, `profiles`
never does, and every write is admin-only. Server code and client code hit the same
policies. A bug in a React component cannot become a data breach, and I never have to
audit "did I remember to check the role here?" — the answer is that the database
checked it.

The asymmetry is the important part. Because reads are public, the thing worth
protecting is *writes* and *who the admins are* — not the song content. That is why
`profiles` is the one table `anon` cannot touch.

**3. Server Components read, Server Actions write, TanStack Query handles only the
interactive surfaces.** Song lists and song detail pages are pure RSC: no client
bundle, no loading spinner, no hydration cost. TanStack Query appears in exactly
three places where the interaction is genuinely client-side — live search, duplicate
detection while typing, and AI import progress. This is the difference between a
fast app and a React app that renders skeletons on 4G.

### Why not the alternatives

| Considered | Rejected because |
|---|---|
| Separate NestJS/Express API | A second deployable, a second auth story, and no capability Supabase + Server Actions doesn't already provide. |
| Prisma / Drizzle | RLS is the security model, and an ORM that bypasses `auth.uid()` context invites mistakes. `supabase-js` carries the user JWT on every query by construction. Types come from `supabase gen types`. |
| Algolia / Typesense for search | Real cost, real sync complexity, for a catalogue that will plateau in the low thousands of rows. Postgres FTS + trigram is instant at this scale and is already paid for. |
| Client-side Supabase for everything (SPA) | Fails the mobile-first goal. First paint would wait on JS → auth → query → render. RSC ships HTML. |
| Redux / Zustand | There is almost no client state. URL params hold search/filter state (shareable, back-button-correct), TanStack Query holds server state. Nothing is left over. |

---

## 2. Folder structure

Feature-based. A feature owns its components, hooks, services, actions, and schemas;
`lib/` holds only things two or more features share.

```
worshipo/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx           # admin door, noindex
│   │   ├── (app)/                       # public shell — NOT a guard
│   │   │   ├── layout.tsx               # nav + theme; profile may be null
│   │   │   ├── page.tsx                 # home (public)
│   │   │   ├── songs/
│   │   │   │   ├── page.tsx             # list + search  (RSC + client island)
│   │   │   │   ├── new/page.tsx         # create (admin)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx         # detail / performance view
│   │   │   │       ├── edit/page.tsx    # admin
│   │   │   │       └── versions/new/page.tsx
│   │   │   ├── categories/page.tsx      # admin
│   │   │   ├── users/page.tsx           # admin
│   │   │   └── settings/page.tsx
│   │   ├── api/
│   │   │   └── ai/extract-song/route.ts # multipart image → structured JSON
│   │   ├── auth/callback/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── actions.ts               # 'use server' — signIn, signOut
│   │   │   ├── components/login-form.tsx
│   │   │   ├── schemas.ts
│   │   │   └── guards.ts                # requireUser, requireAdmin
│   │   ├── songs/
│   │   │   ├── actions.ts               # create/update/delete + versions
│   │   │   ├── services.ts              # data access, server-only
│   │   │   ├── schemas.ts               # Zod, shared by form + action
│   │   │   ├── hooks/
│   │   │   │   ├── use-song-search.ts
│   │   │   │   └── use-duplicate-check.ts
│   │   │   └── components/
│   │   │       ├── song-card.tsx
│   │   │       ├── song-actions.tsx     # admin edit/delete menu
│   │   │       ├── song-form.tsx
│   │   │       ├── version-form.tsx
│   │   │       ├── version-switcher.tsx # arrangements + fallback
│   │   │       ├── version-admin-list.tsx
│   │   │       ├── category-picker.tsx
│   │   │       ├── chord-editor.tsx     # plain textarea
│   │   │       ├── chord-sheet.tsx      # aligned read-only renderer
│   │   │       ├── song-search-bar.tsx  # phase 3
│   │   │       └── duplicate-warning.tsx # phase 3
│   │   ├── ai-import/
│   │   │   ├── prompt.ts
│   │   │   ├── schema.ts                # OpenAI structured-output schema + Zod
│   │   │   ├── service.ts               # server-only OpenAI client
│   │   │   ├── hooks/use-song-import.ts
│   │   │   └── components/
│   │   │       ├── photo-capture-sheet.tsx
│   │   │       └── import-progress.tsx
│   │   ├── categories/
│   │   └── users/                       # admin-only user provisioning
│   │
│   ├── components/
│   │   ├── ui/                          # shadcn primitives; button/input carry
│   │   │                                # the 44px touch-target override
│   │   └── shared/                      # app-wide: AppShell, BottomNav, Fab,
│   │                                    # StickyActionBar, EmptyState, PageHeader
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                # browser client
│   │   │   ├── server.ts                # RSC/action client (cookies)
│   │   │   ├── admin.ts                 # service role — import 'server-only'
│   │   │   └── middleware.ts            # session refresh
│   │   ├── chords/
│   │   │   ├── detect.ts                # is this line a chord line?
│   │   │   ├── strip.ts                 # lyrics_with_chords → lyrics_plain
│   │   │   ├── parse.ts                 # chord/lyric pairs → aligned columns
│   │   │   └── chords.test.ts
│   │   ├── env.ts                       # Zod-validated env, fails at build
│   │   └── utils.ts
│   ├── types/
│   │   ├── database.ts                  # generated — never hand-edited
│   │   └── domain.ts                    # hand-written view models
│   └── middleware.ts
│
├── scripts/
│   └── create-admin.mjs                 # bootstraps the first admin
├── supabase/
│   └── migrations/                      # 0001 schema, 0002 RLS, 0003 search
└── docs/ARCHITECTURE.md
```

**Rule:** `features/*/services.ts` and `lib/supabase/admin.ts` start with
`import 'server-only'`. If a client component ever imports them, the build breaks
instead of leaking the service key into the browser bundle.

**Rule:** `(app)/layout.tsx` calls `getSessionProfile()`, never `requireUser()`.
Guarding in the shared layout would be one line shorter and would put the entire
public songbook behind a login. Private pages guard themselves.

---

## 3. Database schema

Migrations are in `supabase/migrations/` and are the authoritative version. Summary:

```
auth.users ──1:1── profiles ──┬─< songs ──┬─< song_versions
                              │           └─< song_categories >── categories
                              └─ created_by
```

**`profiles`** — `id` (FK to `auth.users`, cascade), `email` (citext, unique),
`name`, `role` (`admin | user`), timestamps. Created only by the
`on_auth_user_created` trigger. There is no client path that inserts here.

**`songs`** — the fields from the spec, plus:
- `lyrics_plain` — chord-stripped projection, written by the app on save.
- `updated_at` — trigger-maintained.
- `search_vector tsvector GENERATED ALWAYS AS (...) STORED` — weighted A/B/C over
  title / artist / lyrics_plain.

**`song_versions`** — `unique (song_id, version_name)`. Same lyric/key/capo columns
as the parent; null means "inherit from the song". The song row itself is the
default arrangement, so a song with zero versions is still complete — no
`is_primary` flag, no empty-version bootstrapping.

**`song_categories`** — composite PK `(song_id, category_id)`, plus a reverse index
on `(category_id, song_id)` for category browsing.

### Schema decisions worth defending

**`lyrics_plain` is stored, not computed in SQL.** Chord-line detection is a
heuristic (a line is a chord line if every token parses as a chord). Encoding that
as an immutable SQL function would freeze it — and any change would require
rewriting every row inside a migration. Keeping it in TypeScript (`lib/chords/strip.ts`)
means it is unit-testable, and a backfill is a script, not a schema change. The
generated `search_vector` then depends only on stored columns, which is what makes
it legal as a generated column.

**`search_vector` is generated, not trigger-maintained.** A generated column cannot
drift. A trigger can be bypassed by `COPY`, disabled during a restore, or forgotten
in a bulk update.

**FTS config is `'simple'`, not `'english'`.** Postgres ships no Georgian dictionary.
`'simple'` does unicode-aware lowercasing and token splitting with no stemming and
no stopword removal — exactly right for Georgian, and harmless for the English songs
in the catalogue. Trigram similarity covers the fuzziness that stemming would have
provided.

**`capo` is `smallint` with a `0..12` check.** Cheap constraint, prevents the class
of bug where a bad AI extraction writes `capo: 200`.

---

## 4. Supabase SQL

Three migrations, applied in order:

| File | Contents |
|---|---|
| `20260807000001_init.sql` | extensions, enum, tables, indexes, `updated_at` triggers, `handle_new_user`, seed categories |
| `20260807000002_rls.sql` | `is_admin()`, RLS policies on all tables, role-escalation and last-admin guards, storage bucket |
| `20260807000003_search.sql` | `build_prefix_tsquery`, `search_songs`, `find_similar_songs` |

```bash
supabase link --project-ref <ref>
supabase db push
supabase gen types typescript --linked > src/types/database.ts
```

Indexes and why each exists:

| Index | Serves |
|---|---|
| `songs_search_vector_idx` (GIN) | full-text search |
| `songs_title_trgm_idx` (GIN trgm) | duplicate detection + typo-tolerant search |
| `songs_created_at_idx` | default "recently added" ordering |
| `song_categories_category_id_idx` | category filter |
| `song_versions_song_id_idx` | version list on the detail page |

---

## 5. Authentication

Reading the songbook requires no account. Everything below is about the admin
door, which is the only thing authentication protects.

### Provisioning flow

```
Admin fills "Add user" sheet
        ↓  Server Action (admin-guarded)
supabase.auth.admin.createUser({ email, password, app_metadata: { role } })
        ↓  DB trigger
profiles row materialised with role
        ↓
Admin shares credentials out-of-band
        ↓
User signs in with password
```

**Public registration is disabled in the Supabase dashboard** (Auth → Providers →
Email → "Allow new users to sign up" = off). That is the real lock. The absence of a
signup page is convenience, not security — the `/auth/v1/signup` endpoint would still
be reachable with the anon key otherwise.

**Role lives in `profiles.role` and is mirrored into `app_metadata`.**
`app_metadata` is not user-writable and rides along in the JWT, so middleware can
gate routes without a database round trip. But `profiles` is the source of truth for
RLS, because a JWT is stale for up to an hour after a role change — an admin
demoting a user needs that to take effect immediately at the data layer, and
`is_admin()` reads the table.

### `src/lib/env.ts`

Split into two schemas. `clientEnv` is parsed eagerly at module scope — a missing
Supabase URL should fail the build, not the 3am request. `serverEnv()` is a lazy
function because the client bundle contains no secrets, so parsing the server schema
in the browser would always fail.

```ts
export const clientEnv = parse(clientSchema, { /* NEXT_PUBLIC_* */ }, 'client');
export function serverEnv() { /* memoised parse of secrets */ }
```

Next.js only inlines `process.env.NEXT_PUBLIC_*` for literal property access, which
is why the keys are spelled out rather than looped over.

### `src/lib/supabase/server.ts`

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { clientEnv } from '@/lib/env';

export async function createClient() {
  const store = await cookies();
  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookies) => {
          try {
            cookies.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component; middleware already refreshed the session.
          }
        },
      },
    },
  );
}
```

### `src/lib/supabase/admin.ts`

```ts
import 'server-only';

/**
 * Service role: bypasses RLS entirely. Only reachable from admin-guarded
 * Server Actions. `server-only` makes an accidental client import a build error.
 *
 * Lazy singleton rather than a module-scope const: constructing at import time
 * would read the secret during `next build` even for routes that never touch it.
 */
export function createAdminClient() { /* memoised createClient(url, serviceKey) */ }
```

Only two things legitimately need it: the Auth Admin API (creating and deleting
users), and reading `auth.users`, which the anon key cannot see at all. Everything
else goes through the user's client so RLS applies.

### `src/features/auth/guards.ts`

```ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/domain';

/** React `cache` dedupes this across every component in one render pass. */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .eq('id', user.id)
    .single();

  return data ?? null;
});

export async function requireUser(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== 'admin') redirect('/songs');
  return profile;
}
```

`getUser()` — never `getSession()` — in server code. `getSession()` trusts the
cookie without verifying the JWT signature.

### `src/middleware.ts`

Split in two: `lib/supabase/middleware.ts` owns the cookie dance and returns
`{ user, response }`; `src/middleware.ts` decides where to send the request.

```ts
export async function middleware(request: NextRequest) {
  const { user, response } = await updateSession(request);
  const isPublic = PUBLIC_ROUTES.some((r) => request.nextUrl.pathname.startsWith(r));

  if (!user && !isPublic) {
    // Preserve the destination so login can bounce the user back to it.
    // `safeRedirect` in the sign-in action rejects anything not a relative path,
    // so `?next=https://evil.example` cannot turn login into an open redirect.
    ...redirect to /login?next=<pathname>
  }
  if (user && isPublic) ...redirect to /songs

  return response;   // <- must be THIS response, see below
}
```

The returned `response` is the one carrying the refreshed auth cookies. Building a
fresh `NextResponse` after calling `updateSession` silently drops them and logs
everyone out roughly every hour — the single easiest thing to get wrong here.

Middleware refreshes the session on every request — an admin browsing public pages
still needs their token renewed — and deny-lists the private routes. Deny-listing is
the right way round for a public-by-default site: adding a public page requires no
change, and adding a private one is a deliberate edit to `PRIVATE_PREFIXES`.

It is **not** the authorization check — that is `requireAdmin()` in the page and RLS in the database.
Middleware runs on the edge and can be misconfigured by a matcher typo; the other
two cannot.

### User provisioning action

`src/features/users/actions.ts` — every action in the file opens the same way:

```ts
export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();                              // 1. guard
  const parsed = createUserSchema.safeParse(input);  // 2. validate
  if (!parsed.success) {
    return actionError('Check the form below', parsed.error.flatten().fieldErrors);
  }

  const { data, error } = await createAdminClient().auth.admin.createUser({
    email, password,
    email_confirm: true,     // no inbox round trip; the admin hands over credentials
    user_metadata: { name },
    app_metadata: { role },  // not user-writable; handle_new_user reads it
  });
  // ...
}
```

Guard, validate, work — in that order, every time. A Server Action is a public HTTP
endpoint; the fact that only an admin UI renders the button is worth nothing.

`setUserRole` writes `app_metadata` *and* `profiles.role`. RLS reads the table, so the
table is what matters for correctness — but leaving the JWT claim stale would make any
middleware-level check wrong for up to an hour after a change. Both `setUserRole` and
`deleteUser` refuse to act on the caller's own row; `guard_last_admin` catches the
cases that slip past that.

---

## 6. RLS policies

Full SQL in `20260807000002_rls.sql`. The model:

| Table | `select` | `insert` / `update` / `delete` |
|---|---|---|
| `profiles` | authenticated — **never `anon`** | update: self or admin (role change trigger-guarded); delete: admin; **no insert policy** |
| `categories` | anon + authenticated | admin |
| `songs` | anon + authenticated | admin |
| `song_versions` | anon + authenticated | admin |
| `song_categories` | anon + authenticated | admin |
| `storage.objects` (`song-imports`) | admin | admin |

Policies name `anon, authenticated` explicitly rather than using `to public`. The
`public` role also covers `service_role` and any role added later; an explicit list is
what makes "who can read this" answerable by reading one line.

Four decisions to highlight:

**`is_admin()` is `SECURITY DEFINER`.** A policy on `profiles` that queries
`profiles` re-enters RLS and recurses forever. `SECURITY DEFINER` breaks the cycle.
It is also `STABLE`, so the planner evaluates it once per statement rather than once
per row — the difference between a fast list query and a sequential scan with a
subquery per row.

**No `INSERT` policy on `profiles`.** Profiles come from the `handle_new_user`
trigger only. Omitting the policy is stronger than writing a restrictive one: there
is no expression to get wrong.

**Role escalation is blocked by a trigger, not the policy.** The self-update policy
has to allow users to rename themselves, and a `WITH CHECK` that compares against the
row's own prior value is awkward and easy to write incorrectly. `profiles_guard_role`
compares `OLD.role` to `NEW.role` directly and raises `42501` unless the caller is an
admin. Unambiguous, and it also protects service-role paths that bypass RLS.

**`guard_last_admin` prevents lockout.** Demoting or deleting the final admin raises.
Recovering from that state otherwise means opening the SQL editor in production.

**Anonymous reads the songbook and nothing else.** `anon` gets `select` on the four
song tables and `execute` on `search_songs`, which is SECURITY INVOKER and therefore
still bound by those same policies. It gets no access to `profiles`, no write path
anywhere, and no `is_admin()` grant.

### Test the policies, don't assume them

```sql
-- as a non-admin user
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';

select count(*) from songs;                    -- expect: all rows
insert into songs (title) values ('nope');     -- expect: RLS violation
update profiles set role = 'admin' where id = '<user-uuid>'; -- expect: 42501
```

---

## 7. AI import

### Flow

```
Admin taps ＋  →  "Take photo"
        ↓  <input type="file" accept="image/*" capture="environment">
Client downscales to max 1600px, JPEG q0.8   (≈12MB → ≈300KB)
        ↓  POST multipart to /api/ai/extract-song
Server: requireAdmin() → base64 data URL → OpenAI Vision (structured outputs)
        ↓
{ title, artist, key, capo, lyrics_with_chords, confidence, warnings }
        ↓
Form is populated, every field editable, duplicate check fires on the title
        ↓
Admin reviews → Save
```

### Decision: the photo is never persisted

The brief specifies "upload to temporary storage → send to OpenAI → after saving,
delete the temporary image." I've built the equivalent flow without the storage hop:
the image goes from the browser straight to the route handler and from there to
OpenAI as a base64 data URL, in one request. It never touches disk.

Why this is the better version of the same flow:

- **The cleanup step cannot fail.** A delete-after-save has a failure mode — the
  admin abandons the form, the tab closes, the save errors — and every one of those
  leaves an orphaned image in a paid bucket. You would then need a scheduled sweeper.
  Not writing the file removes the entire class.
- **It's a round trip faster.** Upload → OpenAI-fetches-URL → response becomes
  upload → response. On a phone on 4G that is the difference the admin actually feels.
- **Fewer moving parts:** no signed URLs, no bucket lifecycle policy, no cron.

The `song-imports` bucket **is** provisioned in migration 0002, because two things
would need it and both are plausible: attaching the original scan to a song as an
archival record, and a deferred/queued processing variant for very large batches. If
you want the literal temp-storage flow, the change is confined to
`features/ai-import/service.ts` — upload first, pass the signed URL to OpenAI, and
delete in the `createSong` action's success branch plus a daily sweep of objects
older than 24h. The rest of the pipeline is unchanged.

### `src/features/ai-import/schema.ts`

```ts
import { z } from 'zod';

export const extractedSongSchema = z.object({
  title: z.string(),
  artist: z.string().nullable(),
  key: z.string().nullable(),
  capo: z.number().int().min(0).max(12).nullable(),
  lyrics_with_chords: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()),
});

export type ExtractedSong = z.infer<typeof extractedSongSchema>;

/** OpenAI structured-output schema. `strict` requires every key in `required`. */
export const extractedSongJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'artist', 'key', 'capo', 'lyrics_with_chords', 'confidence', 'warnings'],
  properties: {
    title:  { type: 'string', description: 'Song title exactly as printed.' },
    artist: { type: ['string', 'null'] },
    key:    { type: ['string', 'null'], description: 'e.g. "G", "Am". Null if not printed.' },
    capo:   { type: ['integer', 'null'], minimum: 0, maximum: 12 },
    lyrics_with_chords: {
      type: 'string',
      description: 'Chord lines above lyric lines, alignment preserved with spaces.',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Unreadable regions or guessed content the admin should verify.',
    },
  },
} as const;
```

### `src/features/ai-import/prompt.ts`

```ts
export const EXTRACT_SONG_PROMPT = `
You extract Georgian (and occasionally English) worship song sheets from photos.

Return JSON matching the provided schema.

RULES

1. Preserve chord alignment. Chords go on their own line directly above the lyric
   line they belong to, positioned with spaces so each chord sits above the syllable
   it is written above in the photo. Use spaces only — never tabs.

       G           Em
   დიდია ღმერთი ჩვენი

2. Transcribe Georgian text exactly as printed. Do not translate, transliterate,
   correct spelling, or "improve" wording. Georgian has no letter case — never
   capitalise.

3. Chords are Latin: A-G, with # b m maj min sus add dim aug and slash bass
   (e.g. D/F#). If a token could be a chord or a Georgian word, it is a word.

4. Structure markers (Verse, Chorus, Bridge, ლექსი, გუნდი, ხიდი) stay on their own
   line, exactly as written.

5. Blank line between sections. Never invent or complete lyrics you cannot read.

6. If part of the image is blurred, cropped, or ambiguous, transcribe what is legible
   and add a specific entry to "warnings" (e.g. "Chorus line 3 partially cut off at
   the right edge"). Do not guess to fill a gap.

7. confidence: "high" = clean, fully legible. "medium" = readable with some
   uncertainty. "low" = significant portions unclear.
`.trim();
```

The rules exist because of specific failure modes: models translate Georgian to
English unprompted, they normalise chord spacing into a neat but wrong grid, they
hallucinate plausible worship lyrics over illegible regions, and they read Georgian
words containing Latin-looking substrings as chords. `warnings` and `confidence` are
the honest channel — they let the UI point the admin at what to double-check rather
than presenting an even wall of text that all looks equally trustworthy.

### `src/features/ai-import/service.ts`

```ts
import 'server-only';
import OpenAI from 'openai';
import { clientEnv } from '@/lib/env';
import { EXTRACT_SONG_PROMPT } from './prompt';
import { extractedSongSchema, extractedSongJsonSchema, type ExtractedSong } from './schema';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function extractSongFromImage(file: File): Promise<ExtractedSong> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const dataUrl = `data:${file.type};base64,${base64}`;

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_VISION_MODEL,
    temperature: 0,                      // transcription, not composition
    max_tokens: 4096,
    messages: [
      { role: 'system', content: EXTRACT_SONG_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract this song sheet.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'extracted_song', strict: true, schema: extractedSongJsonSchema },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from vision model');

  // Structured outputs guarantee the shape; Zod is the trust boundary anyway.
  return extractedSongSchema.parse(JSON.parse(raw));
}
```

`detail: 'high'` is required — small Georgian glyphs and chord positions are lost at
low detail. `temperature: 0` because any creativity here is a defect.

### `src/app/api/ai/extract-song/route.ts`

```ts
import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/features/auth/guards';
import { extractSongFromImage } from '@/features/ai-import/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('image');

  if (!(file instanceof File))      return NextResponse.json({ error: 'No image' }, { status: 400 });
  if (!ALLOWED.has(file.type))      return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
  if (file.size > MAX_BYTES)        return NextResponse.json({ error: 'Image too large' }, { status: 413 });

  try {
    return NextResponse.json({ data: await extractSongFromImage(file) });
  } catch (error) {
    console.error('[ai-import] extraction failed', error);
    return NextResponse.json({ error: 'Extraction failed. Enter the song manually.' }, { status: 502 });
  }
}
```

A route handler rather than a Server Action: multipart upload, a real progress
signal, and abort-on-navigate all work naturally here. Server Actions are the wrong
tool for file upload with feedback.

### Client-side downscale — `features/ai-import/hooks/use-song-import.ts`

```ts
async function downscale(file: File, maxEdge = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
}
```

This is not an optimisation, it's a requirement: a modern phone camera produces
8–12MB HEIC/JPEG. Downscaled to 1600px it is ~300KB — well inside Vercel's request
limit, several seconds faster to upload on mobile data, and 1600px is still more
resolution than the vision model consumes at `detail: 'high'`.

### Cost

One extraction ≈ 1.5k image tokens + ~1k output. At `gpt-4o` rates that is roughly
US$0.01–0.02 per song. A 500-song catalogue costs under $10 to import. No caching or
batching needed at this volume; `OPENAI_VISION_MODEL` is an env var so the model can
be swapped without a code change.

---

## 8. Mobile-first UI plan

Ninety percent phone traffic means the phone layout is the design and desktop is the
adaptation — not the other way round.

### Layout

- **Bottom navigation** (Songs / Search / Add / Settings) — thumb-reachable. Top nav
  bars on a phone are a stretch for one-handed use.
- **Desktop (`md:`)** promotes the bottom bar to a left sidebar. Same components,
  different container.
- **Bottom sheets, not dialogs** for filters, category pickers, version switching,
  song actions. A centred modal on a phone puts controls under the keyboard.
- **Sticky action bar** for Save/Cancel, `sticky bottom-0` with
  `pb-[env(safe-area-inset-bottom)]`. Save is never below the fold.
- **Touch targets ≥ 44px.** shadcn's default `size="sm"` is too small; the project
  overrides the button `size` defaults once rather than fixing it per usage.
- **`text-base` (16px) minimum on inputs.** Anything smaller triggers iOS's
  auto-zoom on focus, which is jarring and hard to undo one-handed.

### The Add Song flow — tap budget

```
Tap 1   ＋ FAB
Tap 2   "Take photo"          (bottom sheet, two options)
Tap 3   shutter               (native camera)
Tap 4   use photo             (native)
        → 3–8s extraction, skeleton over the form, warnings surfaced inline
Tap 5   Save                  (sticky, always visible)
```

Five taps, one of which is the camera shutter. Categories default to the last-used
set and are adjustable after saving — nothing that can be deferred blocks the save.

### Song detail — the performance view

This is the screen someone is looking at while holding a guitar, so it gets specific
treatment:

- Monospace chord sheet, horizontally scrollable in its own container, `text-sm`
  with an in-page A−/A+ that persists to `localStorage`.
- **Wake lock** while the page is open (`navigator.wakeLock`) — the screen must not
  sleep mid-song.
- Version switcher as a segmented control when ≤3 versions, bottom sheet beyond that.
- Transpose (phase 2) as +/− stepper, applied client-side, never persisted.

### Performance budget

- Songs list and detail are RSC — no client JS for the primary read path.
- `next/font` with `display: swap`, subset for Georgian.
- Search input debounced 250ms; TanStack Query `placeholderData: keepPreviousData`
  so results never flash empty between keystrokes.
- Route-level `loading.tsx` with skeletons matching final layout height — no CLS.
- Targets: LCP < 1.5s on 4G, interaction to next paint < 100ms, initial JS < 120KB.

### Dark mode

`next-themes`, class strategy, with `defaultTheme="system"`. Dark is the common case
in a dim sanctuary. Colours are defined as CSS variables in `globals.css` so both
themes come from one token set.

---

## 9. Component hierarchy

`[S]` = Server Component (default), `[C]` = Client Component (justified individually).

```
RootLayout [S]
└── AppLayout [S]                        requireUser(); fetches profile once
    ├── AppShell [S]
    │   ├── TopBar [S]
    │   ├── BottomNav [C]                needs usePathname for active state
    │   └── AddSongFab [C]               opens a sheet
    │
    ├── SongsPage [S]                    reads searchParams, renders first page server-side
    │   ├── SongSearchBar [C]            input + debounce + URL sync
    │   ├── CategoryFilterSheet [C]      bottom sheet, multi-select
    │   └── SongList [S] | SongListClient [C]
    │       └── SongCard [S]             title, artist, category chips, snippet
    │
    ├── SongDetailPage [S]
    │   ├── SongHeader [S]               title, artist, key, capo, categories
    │   ├── VersionSwitcher [C]          local selection state
    │   ├── ChordSheet [C]               font size, wake lock, transpose
    │   └── SongActions [C]              admin only: edit / add version / delete
    │
    ├── SongFormPage [S]                 requireAdmin(); loads categories
    │   └── SongForm [C]                 RHF + zodResolver
    │       ├── PhotoCaptureSheet [C]    camera input, upload, progress
    │       ├── DuplicateWarning [C]     debounced find_similar_songs
    │       ├── ChordEditor [C]          textarea + toolbar
    │       ├── CategoryPicker [C]
    │       └── StickyActionBar [C]      useFormStatus for pending state
    │
    ├── CategoriesPage [S] → CategoryList [S] → CategoryRow [C]
    ├── UsersPage [S]      → UserList [S]     → CreateUserSheet [C]
    └── SettingsPage [S]   → ThemeToggle [C]
```

**`SongList` server-renders page one and `SongListClient` takes over on
interaction.** The first paint is HTML from the server; once the user types or
filters, TanStack Query drives the same `SongCard` markup with `initialData` seeded
from the server render. No double fetch, no spinner on arrival.

**Two client components warrant a note.** `ChordSheet` is client-only for wake lock
and font-size persistence, both of which are browser APIs. `DuplicateWarning` is
client-only because it queries on every debounced keystroke.

### Duplicate detection — `hooks/use-duplicate-check.ts`

```ts
export function useDuplicateCheck(title: string) {
  const debounced = useDebouncedValue(title, 400);

  return useQuery({
    queryKey: ['similar-songs', debounced],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('find_similar_songs', {
        p_title: debounced,
        p_limit: 5,
      });
      if (error) throw error;
      return data;
    },
    enabled: debounced.trim().length >= 3,
    staleTime: 60_000,
  });
}
```

400ms rather than the 250ms used for search: the admin is composing a title, not
scanning results, and a warning that appears mid-word is noise. Results render as a
non-blocking amber banner offering three actions — **Open existing**, **Add a version
to it**, **Create new anyway** — with the third always available. The warning never
blocks the save; a false positive that stops work is worse than a duplicate.

### Chord alignment — the part that needed rethinking

The obvious renderer is one `<pre>` in a monospace font. It does not work here.
Monospace alignment assumes every glyph has the same advance width, and **no
monospace font covers Georgian** — Geist Mono, Noto Sans Mono, JetBrains Mono all
stop at Latin/Cyrillic/Greek. Georgian falls back to a proportional face, and the
chords drift further right with every character in the line.

So `lib/chords/parse.ts` pairs each chord line with the lyric line beneath it and
splits the lyric at the chords' **column offsets**:

```
  G   C                 ┌──────┬──────┬──────────┐
დიდია ღმერთი    ──►     │      │  G   │    C     │
                        │ დი   │ დია  │ ღმერთი   │
                        └──────┴──────┴──────────┘
```

Each column renders as an inline-block with the chord stacked above its own slice
of text, so the browser lays them out side by side and alignment becomes
independent of font metrics. It survives any font, any size, and the reader
bumping the text up two steps mid-service — which the monospace approach does not.

A chord line with no lyric under it (an intro, an instrumental break) stays a plain
`<pre>`; section headers and blank lines pass through untouched.

### Chord stripping — `lib/chords/detect.ts`

```ts
const CHORD_RE = /^[A-G](b|#)?(maj|min|m|sus|add|dim|aug|M)?\d*(\/[A-G](b|#)?)?$/;

/** A chord line is a non-empty line whose every token parses as a chord. */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => CHORD_RE.test(t));
}

export function stripChords(lyricsWithChords: string): string {
  return lyricsWithChords
    .split('\n')
    .filter((line) => !isChordLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

Georgian text can never satisfy `CHORD_RE` (different Unicode block), which makes
this heuristic essentially exact for this catalogue — the reason chord-line detection
is safe to do with a regex here and would not be in a Latin-script app.

---

## 10. Development roadmap

**Phase 1 — Foundation (week 1). ✅ Built.** Next.js 15 + TS strict
(`noUncheckedIndexedAccess`) + Tailwind v4 + shadcn. Three migrations ready to push.
Auth: middleware session refresh, `requireUser`/`requireAdmin` guards, login,
sign-out, self-service password change. Admin user management (create, promote,
demote, delete) through the Auth Admin API behind `requireAdmin()`. App shell with
bottom nav, dark mode, error boundary. First admin bootstrapped by
`npm run create-admin`.
*Done when:* an admin logs in and lands on an empty songs page, and a non-admin
cannot reach `/users`. — met; see the manual security checks in `README.md`.

**Phase 2 — Core CRUD (week 2). ✅ Built.** Song list and detail as pure RSC;
chord sheet with column-anchored alignment, font sizing and wake lock; plain
textarea chord editor; create/edit/delete for songs and versions; version
switcher with song-level fallback; inline category management with usage counts;
`lib/chords` with unit tests.
*Done when:* songs can be entered manually end to end on a phone. — met once the
migrations are applied.

**Phase 3 — Search & duplicates (week 3).** `search_songs` wired to the search bar,
category filter, URL-synced state, `find_similar_songs` in the create form.
*Done when:* search returns in under 100ms against ~300 seeded rows.

**Phase 4 — AI import (week 4).** Route handler, prompt, structured outputs, capture
sheet, downscaling, warnings UI. Calibrate the prompt against 20 real photos of the
actual songbooks — this is where the real work is, not in the code.
*Done when:* a typical page extracts with correct chord alignment and needs only
minor edits.

**Phase 5 — Polish (week 5).** Versions, wake lock, font sizing and dark mode
landed early in Phases 1–2. What remains: transpose, offline-ish caching of
recently viewed songs, richer empty and error states, and a real 404 for
missing songs.

**Phase 6 — Hardening & launch (week 6).** RLS test suite, rate limit on
`/api/ai/extract-song`, Sentry, seed the real catalogue, create the real users,
onboard the team.

**Deferred on purpose:** transpose, setlists, PDF export, offline PWA, song
history/audit, multi-church tenancy. Each is a real feature; none is needed to make
the app useful on day one, and shipping without them keeps the schema free to move.

---

## 11. Recommended libraries

**Committed:**

| Package | Role |
|---|---|
| `next` 15, `react` 19 | App Router, RSC, Server Actions |
| `@supabase/supabase-js`, `@supabase/ssr` | data, auth, cookie-based sessions |
| `@tanstack/react-query` v5 | client-side server state — search, duplicates, import |
| `react-hook-form` + `@hookform/resolvers` | forms; uncontrolled inputs matter on low-end phones |
| `zod` v4 | one schema shared by form, Server Action, and API route |
| `tailwindcss` v4 + `shadcn/ui` | owned components, no runtime dependency |
| `openai` | Vision + structured outputs |
| `next-themes` | dark mode without a flash |
| `server-only` | build-time enforcement of the server boundary |
| `sonner` | toasts (shadcn default) |
| `vaul` | bottom sheets (shadcn Drawer) |
| `lucide-react` | icons |

**Dev:** `typescript` strict, `eslint` + `eslint-config-next`, `prettier` +
`prettier-plugin-tailwindcss`, `vitest` for `lib/chords` and schemas, `playwright`
for the critical paths (login, create song, search).

**Deliberately not used:** any ORM (RLS is the boundary); `zustand`/`redux` (URL +
Query cover it); `framer-motion` (the brief asks for no unnecessary animation, and
CSS transitions cover what's left); a form library beyond RHF; `date-fns` (`Intl` is
enough).

---

## 12. Best practices

**TypeScript.** `strict: true`, plus `noUncheckedIndexedAccess` — the setting that
actually catches bugs in list handling. `types/database.ts` is generated and never
edited; hand-written view models in `types/domain.ts` compose from it, so a schema
change surfaces as a type error rather than a runtime undefined.

**Every Server Action starts with a guard.** `requireAdmin()` or `requireUser()` on
line one, Zod parse on line two, work on line three. A Server Action is a public
endpoint. RLS is the second line of defence, and both are needed — the guard gives a
clean error, RLS makes the mistake harmless.

**Validate at the boundary, trust inside.** Zod at Server Action entry, API route
entry, and on the AI response. Once past the boundary, values are typed and not
re-checked.

**Never `select('*')`.** Name columns. It keeps payloads small on mobile and makes
the generated types narrow enough to be useful.

**`revalidatePath` after every mutation.** Server Actions that change songs
revalidate `/songs` and `/songs/[id]`; TanStack Query invalidation covers the client
islands.

**Errors surface, they don't vanish.** Actions return a discriminated
`{ ok: true, data } | { ok: false, error }` instead of throwing across the network
boundary. Route-level `error.tsx` catches the rest. The AI import failure path always
offers manual entry — the feature degrades to the flow that already works.

**No duplicated logic.** Chord stripping lives in `lib/chords`. Auth guards live in
`features/auth/guards.ts`. Zod schemas are declared once and imported by both the
form and the action. If a rule needs to exist in two places, it belongs in `lib/`.

**Client Components need a stated reason.** Browser API, event handler, or hook. If
none applies, it stays a Server Component. `'use client'` goes as far down the tree
as possible — a client leaf inside a server parent, not a client page.

**Secrets.** `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only and
guarded by `import 'server-only'`. Anything prefixed `NEXT_PUBLIC_` is public — the
anon key is, and that is fine, because RLS assumes it.

**Accessibility is not optional here.** Real contrast in both themes, focus-visible
rings intact, form labels bound, error text tied by `aria-describedby`. A worship
team spans a wide age range and the chord sheet is read at arm's length in low light.
