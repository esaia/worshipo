'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createUser } from '../actions';
import { createUserSchema, type CreateUserInput } from '../schemas';

/**
 * Readable rather than maximally random: the admin reads this aloud or writes
 * it down. Ambiguous glyphs (0/O, 1/l/I) are excluded on purpose.
 */
function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
}

export function CreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', name: '', password: generatePassword(), role: 'user' },
  });

  const role = watch('role');

  const onSubmit = (values: CreateUserInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createUser(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(`ანგარიში შეიქმნა: ${values.email}`);
      router.push('/users');
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-24" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">სახელი</Label>
        <Input id="name" autoFocus autoComplete="off" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">ელფოსტა</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">პაროლი</Label>
        <div className="flex gap-2">
          {/* Shown in plain text deliberately — the admin has to pass it on. */}
          <Input
            id="password"
            type="text"
            autoComplete="off"
            className="font-mono"
            {...register('password')}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="ახალი პაროლის გენერირება"
            onClick={() => setValue('password', generatePassword(), { shouldValidate: true })}
          >
            <RefreshCw />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          გადაეცით მომხმარებელს. მოგვიანებით მას პარამეტრებში შეცვლა შეუძლია.
        </p>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">როლი</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['user', 'admin'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('role', value, { shouldValidate: true })}
              aria-pressed={role === value}
              className={cn(
                'min-h-14 rounded-lg border px-4 text-left transition-colors',
                role === value
                  ? 'border-foreground bg-muted'
                  : 'border-border hover:border-muted-foreground',
              )}
            >
              <span className="block text-sm font-medium">
                {value === 'admin' ? 'ადმინი' : 'წევრი'}
              </span>
              <span className="block text-xs text-muted-foreground">
                {value === 'admin' ? 'ყველაფრის მართვა შეუძლია' : 'მხოლოდ კითხვა და ძებნა'}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      {/*
        Sticky footer: on a phone the save button must never be below the fold,
        and the safe-area padding keeps it clear of the home indicator.
      */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:pb-0">
        <div className="mx-auto flex w-full max-w-3xl gap-3 md:max-w-none md:px-0">
          <Button type="submit" size="lg" className="flex-1" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            ანგარიშის შექმნა
          </Button>
        </div>
      </div>
    </form>
  );
}
