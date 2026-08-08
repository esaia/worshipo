'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Library, LayoutGrid, LogIn, Settings, Tags, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Profile } from '@/types/domain';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Library;
  /**
   * 'all'   — everyone, including visitors with no account
   * 'auth'  — anyone signed in
   * 'admin' — signed-in admins
   * 'anon'  — visitors only
   */
  audience: 'all' | 'auth' | 'admin' | 'anon';
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'მთავარი', icon: LayoutGrid, audience: 'all' },
  { href: '/songs', label: 'სიმღერები', icon: Library, audience: 'all' },
  { href: '/categories', label: 'კატეგორიები', icon: Tags, audience: 'admin' },
  { href: '/users', label: 'მომხმარებლები', icon: Users, audience: 'admin' },
  { href: '/settings', label: 'პარამეტრები', icon: Settings, audience: 'auth' },
  { href: '/login', label: 'შესვლა', icon: LogIn, audience: 'anon' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * Create/edit screens are full-screen tasks: they own the bottom of the
 * viewport with their own sticky save bar, so the nav steps aside rather than
 * fighting it for the same 56px.
 */
function isTaskRoute(pathname: string) {
  return /\/(new|edit)$/.test(pathname);
}

/**
 * Bottom bar on phones, left rail from `md:` up.
 *
 * Bottom placement is the whole point on mobile — a top nav is out of thumb
 * reach one-handed, which is how this app is actually used.
 *
 * `profile` is null for visitors, who are the majority: the songbook is public
 * and only admins ever sign in.
 */
export function BottomNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const isAdmin = profile?.role === 'admin';
  const items = NAV_ITEMS.filter((item) => {
    switch (item.audience) {
      case 'all':
        return true;
      case 'auth':
        return !!profile;
      case 'admin':
        return isAdmin;
      case 'anon':
        return !profile;
    }
  });
  const taskRoute = isTaskRoute(pathname);

  return (
    <nav
      aria-label="მთავარი ნავიგაცია"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom)]',
        'md:inset-y-0 md:right-auto md:left-0 md:w-56 md:border-t-0 md:border-r md:pb-0',
        // Hidden on phones during a task, but kept on desktop where the rail
        // is beside the content rather than on top of it.
        taskRoute && 'hidden md:block',
      )}
    >
      <div className="md:flex md:h-full md:flex-col md:gap-1 md:p-3">
        <span className="hidden px-3 py-4 font-heading text-lg font-semibold md:block">
          Worshipo
        </span>

        {/*
          `min-w-0` on the item is what lets the label truncate instead of
          forcing the column wider: a flex child defaults to `min-width: auto`,
          so without it a long word pushes its neighbours over and the five tabs
          run into each other with no gutter at all.
        */}
        <ul className="flex items-stretch justify-around md:flex-col md:gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="min-w-0 flex-1 md:flex-none">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    // min-h-14 keeps the tap target well above 44px including
                    // the label, which is the real target on a phone.
                    'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[0.625rem] leading-tight font-medium transition-colors',
                    'md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-sm',
                    active
                      ? 'text-foreground md:bg-muted'
                      : 'text-muted-foreground hover:text-foreground md:hover:bg-muted/60',
                  )}
                >
                  <Icon className="size-5 shrink-0 md:size-4" aria-hidden />
                  {/*
                    10px is what fits "მომხმარებლები" — thirteen characters, the
                    longest label — inside a fifth of a 390px screen. Georgian
                    has no case and no ascenders to compress, so five tabs at the
                    12px this used to be simply cannot fit side by side.
                  */}
                  <span className="w-full truncate text-center md:w-auto md:text-left">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
