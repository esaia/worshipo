import type { Enums, Tables } from './database';

/**
 * Hand-written view models composed from the generated row types.
 *
 * The point of composing rather than redeclaring: when a column changes,
 * `Pick` fails to compile here instead of producing `undefined` at runtime.
 */

export type UserRole = Enums<'user_role'>;

/** The session user as every server component sees it. Never includes secrets. */
export type Profile = Pick<Tables<'profiles'>, 'id' | 'email' | 'name' | 'role'>;

export type Category = Pick<Tables<'categories'>, 'id' | 'name' | 'slug'>;

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === 'admin';
}

/**
 * Discriminated result for Server Actions.
 *
 * Actions return this instead of throwing: an exception thrown across the
 * server-action boundary reaches the client as an opaque digest in production,
 * which is useless to the form that needs to render the message.
 */
export type FieldIssues = Record<string, string[] | undefined>;

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; issues?: FieldIssues };

export function actionError(error: string, issues?: FieldIssues): ActionResult<never> {
  return { ok: false, error, issues };
}

export function actionOk(): ActionResult<void>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}
