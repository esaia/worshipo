import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A styled native `<select>`, deliberately not the shadcn/Radix Select.
 *
 * On a phone the native control opens the OS picker — a scroll wheel on iOS, a
 * full-screen list on Android — which is faster one-handed, works with the
 * keyboard already open, and needs no JavaScript. The Radix version is a better
 * desktop widget and a worse mobile one, and this app is 90% phones.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          'h-11 w-full appearance-none rounded-lg border border-input bg-transparent px-3 pr-9 text-base transition-colors outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:opacity-50',
          'md:h-9 md:text-sm dark:bg-input/30',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

export { NativeSelect };
