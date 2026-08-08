'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { actionError, actionOk, type ActionResult } from '@/types/domain';
import { changePasswordSchema, signInSchema } from './schemas';

/**
 * Only relative, single-slash paths are accepted as a post-login destination.
 * Without this, `?next=https://evil.example` turns login into an open redirect.
 */
function safeRedirect(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/songs';
  return next;
}

export async function signIn(input: unknown, next?: string): Promise<ActionResult<never>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately generic: distinguishing "no such user" from "wrong password"
    // turns the login form into an account-enumeration oracle.
    return actionError('ელფოსტა ან პაროლი არასწორია');
  }

  revalidatePath('/', 'layout');
  // redirect() throws NEXT_REDIRECT, so it must be outside any try/catch.
  redirect(safeRedirect(next));
}

/**
 * Self-service password change. Runs on the user's own session — no admin
 * client involved, so it can only ever change the caller's own password.
 */
export async function changePassword(input: unknown): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError('შეამოწმეთ ქვემოთ მოცემული ველები', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError('სესიას ვადა გაუვიდა. შედით ხელახლა.');

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return actionError(error.message);

  return actionOk();
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  // Back to the public songbook, not the login screen — signing out of an
  // admin session should leave you where any visitor would be.
  redirect('/');
}
