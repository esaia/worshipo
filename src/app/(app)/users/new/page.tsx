import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/features/auth/guards';
import { CreateUserForm } from '@/features/users/components/create-user-form';

export const metadata: Metadata = { title: 'ახალი მომხმარებელი' };

export default async function NewUserPage() {
  await requireAdmin();

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="მომხმარებლებთან დაბრუნება">
          <Link href="/users">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="font-heading text-xl font-semibold">ახალი მომხმარებელი</h1>
      </div>

      <CreateUserForm />
    </>
  );
}
