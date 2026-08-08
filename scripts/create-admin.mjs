#!/usr/bin/env node
/**
 * Bootstraps the first admin.
 *
 * This exists because the app has no public sign-up and every admin action is
 * gated on already being an admin — a chicken-and-egg the SQL editor would
 * otherwise have to break by hand.
 *
 *   npm run create-admin -- admin@church.ge "Giorgi" 'a-strong-password'
 *
 * Deliberately uses plain `fetch` against the REST endpoints rather than
 * supabase-js: the SDK instantiates a Realtime client on construction, which
 * needs a global WebSocket and therefore Node 22+. This script is two HTTP
 * calls; pulling in that constraint to make them would be silly.
 *
 * Uses the service-role key, so it runs on your machine only. Never deploy it.
 */

const [email, name, password] = process.argv.slice(2);

if (!email || !name || !password) {
  console.error('Usage: npm run create-admin -- <email> <name> <password>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run via `npm run create-admin`, which loads .env.local.',
  );
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 1. Create the auth user.
//    app_metadata.role is what the handle_new_user trigger reads; it is not
//    writable by the user themselves, unlike user_metadata.
// -----------------------------------------------------------------------------
const createResponse = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role: 'admin' },
  }),
});

const created = await createResponse.json().catch(() => ({}));

if (!createResponse.ok) {
  fail(
    `Failed to create the user: ${created.msg ?? created.error_description ?? createResponse.status}`,
  );
}

// -----------------------------------------------------------------------------
// 2. Set the role on the profile directly.
//
//    Belt and braces rather than trusting the trigger. GoTrue does not write
//    custom app_metadata in the INSERT — it merges it in a follow-up UPDATE — so
//    an AFTER INSERT trigger alone races with that and silently leaves the
//    default 'user'. Migration 0005 adds an UPDATE trigger that closes the race,
//    but a bootstrap script should not depend on trigger timing to work.
//
//    Allowed because the service role has no JWT: `guard_profile_role` only
//    challenges requests that carry one.
// -----------------------------------------------------------------------------
const patchResponse = await fetch(`${url}/rest/v1/profiles?id=eq.${created.id}`, {
  method: 'PATCH',
  headers: { ...headers, Prefer: 'return=minimal' },
  body: JSON.stringify({ role: 'admin' }),
});

if (!patchResponse.ok) {
  const detail = await patchResponse.text();
  fail(
    `User created (${created.id}), but setting the admin role failed (${patchResponse.status}).\n` +
      `${detail}\n` +
      'Have all migrations been applied? See supabase/migrations/.',
  );
}

// -----------------------------------------------------------------------------
// 3. Verify rather than assume. A failure here means the account exists but
//    cannot administer anything, with nothing in the UI to explain why.
// -----------------------------------------------------------------------------
const profileResponse = await fetch(`${url}/rest/v1/profiles?id=eq.${created.id}&select=role`, {
  headers,
});

if (!profileResponse.ok) {
  fail(
    `User created (${created.id}), but the profiles table is unreachable (${profileResponse.status}).\n` +
      'Apply the migrations first: paste supabase/apply-all.sql into the SQL Editor.',
  );
}

const [profile] = await profileResponse.json();

if (profile?.role !== 'admin') {
  fail(
    `User created (${created.id}) but profile role is "${profile?.role ?? 'missing'}".\n` +
      'Check that migration 0001 ran and the on_auth_user_created trigger exists.',
  );
}

console.log(`Admin created: ${email}`);
