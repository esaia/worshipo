'use client';

import { useState, useTransition } from 'react';
import { Check, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, type ActionResult, type UserRole } from '@/types/domain';
import { deleteUser, setUserRole } from '../actions';
import type { UserListItem } from '../services';

/**
 * One line each, because the difference between the two privileged roles is
 * exactly one sentence and an admin picking between them should not have to
 * remember which.
 */
const ROLE_HINTS: Record<UserRole, string> = {
  admin: 'ყველაფერი, მომხმარებლების მართვის ჩათვლით',
  co_admin: 'სიმღერები და კატეგორიები — მომხმარებლების გარეშე',
  user: 'მხოლოდ კითხვა და ძებნა',
};

const ROLES: UserRole[] = ['admin', 'co_admin', 'user'];

export function UserRowActions({ user, isSelf }: { user: UserListItem; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const label = user.name || user.email;

  const run = (fn: () => Promise<ActionResult<unknown>>, success: string) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  };

  // Nothing here applies to your own row, and the actions reject self-edits
  // anyway — a menu that can only fail is noise.
  if (isSelf) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-label={`${label} — მოქმედებები`}
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>როლი</DropdownMenuLabel>
          {ROLES.map((role) => {
            const current = user.role === role;
            return (
              <DropdownMenuItem
                key={role}
                // Selecting the role somebody already has is a no-op round trip.
                disabled={current}
                onSelect={() =>
                  run(
                    () => setUserRole({ userId: user.id, role }),
                    `${label} — ${ROLE_LABELS[role]}`,
                  )
                }
              >
                <Check className={cn('shrink-0', !current && 'invisible')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{ROLE_LABELS[role]}</span>
                  {/* The item sets whitespace-nowrap; the hint is a sentence. */}
                  <span className="block text-xs whitespace-normal text-muted-foreground">
                    {ROLE_HINTS[role]}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            // preventDefault keeps the menu from unmounting the dialog with it.
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 />
            ანგარიშის წაშლა
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>წავშალოთ {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              როლს მაშინვე კარგავს. მის მიერ დამატებული სიმღერები კრებულში რჩება. Google-ით ხელახლა
              შესვლა შეუძლია — მაგრამ უკვე როგორც წევრს.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>გაუქმება</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => run(() => deleteUser({ userId: user.id }), `${label} წაიშალა`)}
            >
              წაშლა
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
