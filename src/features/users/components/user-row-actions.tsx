'use client';

import { useState, useTransition } from 'react';
import { MoreVertical, ShieldMinus, ShieldPlus, Trash2 } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ActionResult } from '@/types/domain';
import { deleteUser, setUserRole } from '../actions';
import type { UserListItem } from '../services';

export function UserRowActions({ user, isSelf }: { user: UserListItem; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const label = user.name || user.email;
  const nextRole = user.role === 'admin' ? 'user' : 'admin';

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
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              run(
                () => setUserRole({ userId: user.id, role: nextRole }),
                nextRole === 'admin' ? `${label} ახლა ადმინია` : `${label} ახლა წევრია`,
              )
            }
          >
            {nextRole === 'admin' ? <ShieldPlus /> : <ShieldMinus />}
            {nextRole === 'admin' ? 'ადმინად დანიშვნა' : 'წევრად გადაყვანა'}
          </DropdownMenuItem>
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
              წვდომას მაშინვე კარგავს. მის მიერ დამატებული სიმღერები კრებულში რჩება. ამის დაბრუნება
              შეუძლებელია.
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
