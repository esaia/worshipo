import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'შესვლა',
  // The songbook should be indexed; the admin door should not.
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-3xl font-semibold">Worshipo</h1>
        <p className="text-sm text-muted-foreground">ადმინისტრატორის შესვლა</p>
      </div>

      <LoginForm next={next} />

      {/*
        No "create an account" link, by design. Registration is closed, and
        reading the songbook needs no account at all.
      */}
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
