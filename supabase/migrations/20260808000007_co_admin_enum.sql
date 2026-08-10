-- =============================================================================
-- Worshipo — 0007 — add the 'co_admin' role
--
-- Alone in its own migration on purpose. Postgres allows `alter type ... add
-- value` inside a transaction block, but the new label cannot be *used* until
-- that transaction commits — so a single file that both adds 'co_admin' and
-- writes `role = 'co_admin'` in a function body fails with
-- "unsafe use of new value of enum type". 0008 is where it gets used.
--
-- Role model after this pair of migrations:
--   user      member. Signs in (Google or password), reads the songbook.
--   co_admin  everything an admin can do EXCEPT user management.
--   admin     co_admin + promoting/demoting/deleting accounts.
-- =============================================================================

alter type public.user_role add value if not exists 'co_admin';
