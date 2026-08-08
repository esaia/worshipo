'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '../actions';
import { changePasswordSchema, type ChangePasswordInput } from '../schemas';

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  // Collapsed by default: most visits to Settings are for the theme toggle,
  // and two password fields at the top of the page is a lot of scroll to skip.
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        პაროლის შეცვლა
      </Button>
    );
  }

  const onSubmit = (values: ChangePasswordInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await changePassword(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success('პაროლი განახლდა');
      reset();
      setOpen(false);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="new-password">ახალი პაროლი</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          autoFocus
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">გაიმეორეთ</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          {...register('confirm')}
        />
        {errors.confirm && <p className="text-sm text-destructive">{errors.confirm.message}</p>}
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          შენახვა
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          გაუქმება
        </Button>
      </div>
    </form>
  );
}
