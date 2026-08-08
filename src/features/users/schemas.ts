import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'user']);

export const createUserSchema = z.object({
  email: z.string().min(1, 'ელფოსტა სავალდებულოა').email('შეიყვანეთ სწორი ელფოსტა'),
  name: z.string().trim().min(1, 'სახელი სავალდებულოა').max(80),
  // Supabase enforces a minimum of 6; 10 is the project's own floor, since
  // these passwords are handed over verbally and then rarely changed.
  password: z.string().min(10, 'გამოიყენეთ სულ მცირე 10 სიმბოლო'),
  role: roleSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: roleSchema,
});

export const deleteUserSchema = z.object({
  userId: z.string().uuid(),
});
