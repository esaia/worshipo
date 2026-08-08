# Worshipo

Georgian worship songs & chords. **Public songbook, private admin**: anyone can browse
and search without an account; admins sign in to add and edit songs.

Architecture and decisions: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Setup

### 1. Create the Supabase project

Then **turn off public sign-up** — this is the real lock, not the absence of a signup page:

> Authentication → Sign In / Providers → Email → **Allow new users to sign up: off**

Without this, anyone with the publishable key (which ships in the browser bundle) can
create their own account. Reading the songbook needs no account, so nobody legitimate
is inconvenienced by this being off.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in from Supabase → Project Settings → API. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS —
server-only, never prefixed `NEXT_PUBLIC_`.

### 3. Apply the schema

```bash
npx supabase link --project-ref <your-ref>
npm run db:push        # runs supabase/migrations in order
npm run db:types       # regenerates src/types/database.ts from the live schema
```

`src/types/database.ts` is hand-written until you run `db:types`; that command replaces it
wholesale. Do not hand-edit it afterwards.

### 4. Create the first admin

Every admin action requires already being an admin, so the first one is bootstrapped
outside the app:

```bash
npm run create-admin -- you@church.ge "Your Name" 'a-strong-password'
```

### 5. Run

```bash
npm run dev
```

Sign in at `/login`. Add further accounts from **Users → +**.

---

## Scripts

| Command                        |                               |
| ------------------------------ | ----------------------------- |
| `npm run dev`                  | dev server                    |
| `npm run build`                | production build              |
| `npm run typecheck`            | `tsc --noEmit`                |
| `npm test`                     | vitest (chord logic)          |
| `npm run lint`                 | eslint                        |
| `npm run format`               | prettier                      |
| `npm run db:push` / `db:types` | migrations / regenerate types |
| `npm run create-admin`         | bootstrap the first admin     |

---

## Status

**Phases 1–2 are complete.** Working: public browsing with no account,
admin login/logout, session refresh, route guards, admin user management (create,
promote/demote, delete), self-service password change, dark mode, the app shell, and
RLS-backed reads of songs and categories.

**Access model.** `/` and `/songs` are public. `/users`, `/categories`, `/settings`
and the song create/edit routes require a session; the admin-only ones additionally
require `role = 'admin'`.

**Phase 2 adds:** song list and detail (pure RSC), the aligned chord sheet with
font sizing and wake lock, the plain-textarea chord editor, create/edit/delete for
songs and versions, the version switcher, and inline category management.

Search, duplicate detection and AI import are Phases 3–4 — see the roadmap in
`docs/ARCHITECTURE.md` §10.

## Verifying the security model

The parts worth testing by hand before trusting them:

1. **Signed out**, `/songs` renders the catalogue; `/users` redirects to `/login`.
2. **Signed out**, in the browser console:
   `await supabase.from('profiles').select('*')` → empty. Song content is public;
   who the admins are is not.
3. **Signed out**: `await supabase.from('songs').insert({ title: 'x' })` → RLS violation.
4. Sign in as a member → `/users` and `/categories` redirect to `/songs`, and neither
   appears in the nav.
5. As a member: `await supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)`
   → error 42501 from the `profiles_guard_role` trigger.
6. As the only admin, try to demote yourself → blocked by `guard_last_admin`.
# worshipo
