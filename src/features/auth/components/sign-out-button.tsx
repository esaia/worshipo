'use client';

import { useTransition } from 'react';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { signOut } from '../actions';

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      onClick={() =>
        startTransition(async () => {
          await signOut();
        })
      }
      disabled={pending}
    >
      <LogOut />
      გასვლა
    </Button>
  );
}
