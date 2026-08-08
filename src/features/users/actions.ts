'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/features/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { actionError, actionOk, type ActionResult } from '@/types/domain';
import { createUserSchema, deleteUserSchema, setRoleSchema } from './schemas';

/**
 * Creates an account. There is no public sign-up: this action, behind
 * `requireAdmin()`, is the only path into the system.
 *
 * `requireAdmin()` runs first in every action here. A Server Action is a public
 * HTTP endpoint — the fact that only the admin UI renders a button that calls
 * it is worth exactly nothing.
 */
export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const { email, name, password, role } = parsed.data;

  const { data, error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    // No inbox round trip: the admin hands the credentials over in person.
    email_confirm: true,
    user_metadata: { name },
    // app_metadata is not user-writable. The handle_new_user trigger reads
    // `role` from here to seed profiles.role.
    app_metadata: { role },
  });

  if (error || !data.user) {
    const message = error?.message ?? 'მომხმარებლის შექმნა ვერ მოხერხდა';
    return actionError(/already/i.test(message) ? 'ამ ელფოსტით ანგარიში უკვე არსებობს' : message);
  }

  revalidatePath('/users');
  return actionOk({ id: data.user.id });
}

export async function setUserRole(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = setRoleSchema.safeParse(input);
  if (!parsed.success) return actionError('არასწორი მოთხოვნა');

  const { userId, role } = parsed.data;
  if (userId === admin.id) return actionError('საკუთარი როლის შეცვლა შეუძლებელია');

  const client = createAdminClient();

  // Keep the JWT claim in step with the table. profiles.role is what RLS reads,
  // but a stale app_metadata would make middleware-level checks wrong for up to
  // an hour after a change.
  const { error: authError } = await client.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (authError) return actionError(authError.message);

  // The guard_last_admin trigger raises here if this would demote the final admin.
  const { error } = await client.from('profiles').update({ role }).eq('id', userId);
  if (error) return actionError(error.message);

  revalidatePath('/users');
  return actionOk();
}

export async function deleteUser(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = deleteUserSchema.safeParse(input);
  if (!parsed.success) return actionError('არასწორი მოთხოვნა');

  const { userId } = parsed.data;
  if (userId === admin.id) return actionError('საკუთარი ანგარიშის წაშლა შეუძლებელია');

  // Deleting the auth user cascades to profiles via the FK.
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) return actionError(error.message);

  revalidatePath('/users');
  return actionOk();
}
