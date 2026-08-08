import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/features/auth/guards';
import { UserRowActions } from '@/features/users/components/user-row-actions';
import { listUsers } from '@/features/users/services';

export const metadata: Metadata = { title: 'მომხმარებლები' };

export default async function UsersPage() {
  // Admin-only. Non-admins are redirected to /songs before anything renders.
  const admin = await requireAdmin();
  const users = await listUsers();

  return (
    <>
      <PageHeader
        title="მომხმარებლები"
        description="საჯარო რეგისტრაცია არ არსებობს — ანგარიშები აქ იქმნება."
        action={
          <Button asChild size="icon" aria-label="მომხმარებლის დამატება">
            <Link href="/users/new">
              <Plus />
            </Link>
          </Button>
        }
      />

      <ul className="divide-y divide-border rounded-xl border border-border">
        {users.map((user) => (
          <li key={user.id} className="flex min-h-16 items-center gap-3 py-2 pr-2 pl-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-medium">
                {user.name || user.email}
                {user.id === admin.id && (
                  <span className="text-xs font-normal text-muted-foreground">თქვენ</span>
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
              {user.role === 'admin' ? 'ადმინი' : 'წევრი'}
            </Badge>
            <UserRowActions user={user} isSelf={user.id === admin.id} />
          </li>
        ))}
      </ul>
    </>
  );
}
