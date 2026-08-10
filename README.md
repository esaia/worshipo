# Worshipo

Georgian worship songs & chords. **Public songbook, granted privileges**: anyone can
browse and search without an account, anyone can sign in with Google, and an admin
decides who may edit.

Architecture and decisions: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Setup

### 1. Create the Supabase project

Then enable Google sign-in:

1. **Google Cloud console** → APIs & Services → Credentials → _Create OAuth client ID_
   → Web application. Authorised redirect URI:
   `https://<your-ref>.supabase.co/auth/v1/callback`.
2. **Supabase** → Authentication → Sign In / Providers → **Google**: on, and paste the
   client ID and secret.
3. **Supabase** → Authentication → URL Configuration → add both callbacks to the
   redirect allow list: `http://localhost:3000/auth/callback` and
   `https://<your-domain>/auth/callback`.

Sign-up is deliberately **open** — if you previously set
Authentication → Sign In / Providers → **Allow new users to sign up: off**, turn it
back on, or Google sign-in fails for everyone who does not already have an account.

That is safe here, and it is the RLS model that makes it safe rather than the setting:
a new account lands on `role = 'user'`, which grants exactly what an anonymous visitor
already had — read the songbook. Editing is a privilege an admin grants afterwards
from **Users**, so an open door costs nothing.

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

Applying by hand in the SQL Editor instead? Paste `supabase/apply-all.sql` for a fresh
database, or `supabase/apply-0007.sql` **and then, as a separate query**,
`supabase/apply-0008.sql` for one that is already live. Those two cannot share a
transaction: Postgres will not let a statement use an enum label that the same
transaction added, and running them together fails with `55P04`.

### 4. Create the first admin

Every admin action requires already being an admin, so the first one is bootstrapped
outside the app:

```bash
npm run create-admin -- you@church.ge "Your Name" 'a-strong-password'
```

Signing in with Google gets you a _member_ account, not this one — promote further
accounts from **Users** once you are in.

### 5. Run

```bash
npm run dev
```

Sign in at `/login` — Google, or the bootstrapped password account. Promote members
to **თანაადმინი** (co-admin) or **ადმინი** from **Users**; password accounts can also
be created there with **+**.

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

**Phases 1–2 are complete.** Working: public browsing with no account, Google
sign-in and password login, logout, session refresh, route guards, admin user
management (create, assign any of the three roles, delete), self-service password
change, dark mode, the app shell, and RLS-backed reads of songs and categories.

**Access model.** `/` and `/songs` are public. `/settings` needs any session.
`/categories` and the song create/edit routes need `requireEditor()` — admin or
co-admin. `/users` needs `requireAdmin()`, and that single difference is what
co-admin means.

| Role             | Browse | Edit songs & categories | Manage accounts |
| ---------------- | ------ | ----------------------- | --------------- |
| visitor / `user` | ✅     | —                       | —               |
| `co_admin`       | ✅     | ✅                      | —               |
| `admin`          | ✅     | ✅                      | ✅              |

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
4. Sign in with Google as a fresh account → it is a member: `/users` and `/categories`
   redirect to `/songs`, neither appears in the nav, and no add-song button renders.
5. As a **co-admin**: `/categories` and `/songs/new` work; `/users` still redirects to
   `/songs`, and `await supabase.from('profiles').select('*')` returns only your own
   row.
6. As a member: `await supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)`
   → error 42501 from the `profiles_guard_role` trigger.
7. As the only admin, try to demote yourself → blocked by `guard_last_admin`.

# worshipo
