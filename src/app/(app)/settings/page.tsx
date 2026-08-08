import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { requireUser } from '@/features/auth/guards';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { SignOutButton } from '@/features/auth/components/sign-out-button';

export const metadata: Metadata = { title: 'პარამეტრები' };

export default async function SettingsPage() {
  const profile = await requireUser();

  return (
    <>
      <PageHeader title="პარამეტრები" />

      <section className="space-y-1">
        <h2 className="text-sm font-medium text-muted-foreground">ანგარიში</h2>
        <p className="font-medium">{profile.name || '—'}</p>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        <p className="text-sm text-muted-foreground">
          {profile.role === 'admin' ? 'ადმინისტრატორი' : 'წევრი'}
        </p>
      </section>

      <Separator className="my-6" />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">პაროლი</h2>
        <ChangePasswordForm />
      </section>

      <Separator className="my-6" />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">გარეგნობა</h2>
        <ThemeToggle />
      </section>

      <Separator className="my-6" />

      <SignOutButton />
    </>
  );
}
