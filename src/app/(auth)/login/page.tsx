import type { Metadata } from 'next';
import Link from 'next/link';

import { Separator } from '@/components/ui/separator';
import { GoogleSignInButton } from '@/features/auth/components/google-sign-in-button';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'შესვლა',
  // The songbook should be indexed; the sign-in page has nothing to index.
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-3xl font-semibold">Worshipo</h1>
        <p className="text-sm text-muted-foreground">შედით ანგარიშში</p>
      </div>

      {error === 'oauth' && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          შესვლა არ დასრულდა. სცადეთ ხელახლა.
        </p>
      )}

      {/*
        Google first: it is how everyone but the original admins gets in, and it
        is one tap against a form with two fields.
      */}
      <GoogleSignInButton next={next} />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">ან</span>
        <Separator className="flex-1" />
      </div>

      <LoginForm next={next} />

      <p className="text-center text-xs text-balance text-muted-foreground">
        საგალობლების კრებული ყველასთვის ღიაა —{' '}
        <Link href="/songs" className="underline underline-offset-4 hover:text-foreground">
          დაათვალიერეთ შესვლის გარეშე
        </Link>
        .
      </p>
    </div>
  );
}
