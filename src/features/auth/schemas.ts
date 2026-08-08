import { z } from 'zod';

/** Shared by the login form (client validation) and the action (trust boundary). */
export const signInSchema = z.object({
  email: z.string().min(1, 'ელფოსტა სავალდებულოა').email('შეიყვანეთ სწორი ელფოსტა'),
  password: z.string().min(1, 'პაროლი სავალდებულოა'),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const changePasswordSchema = z
  .object({
    password: z.string().min(10, 'გამოიყენეთ სულ მცირე 10 სიმბოლო'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'პაროლები არ ემთხვევა',
    path: ['confirm'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
