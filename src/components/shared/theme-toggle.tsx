'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'ღია', icon: Sun },
  { value: 'dark', label: 'მუქი', icon: Moon },
  { value: 'system', label: 'სისტემური', icon: Monitor },
] as const;

/**
 * Segmented control rather than a cycling icon button: on a phone, a
 * three-state toggle you have to tap repeatedly to discover is worse than
 * three visible targets.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // `theme` is undefined until hydration; rendering it early causes a mismatch.
  useEffect(() => setMounted(true), []);

  return (
    <div role="group" aria-label="თემა" className="inline-flex gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
