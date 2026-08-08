import type { Metadata, Viewport } from 'next';
import { Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';

import { Providers } from '@/components/shared/providers';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

/**
 * FiraGO is the body face, and it is self-hosted rather than pulled from Google
 * Fonts because it has to be: exactly two Google fonts ship a `georgian`
 * subset — Noto Sans Georgian and Noto Serif Georgian — and Noto is a fallback
 * face by design. Its brief is coverage, not voice, so a whole app set in it
 * reads as unstyled rather than as anything.
 *
 * FiraGO is Fira Sans extended to Georgian by the original designers, so the
 * Georgian and the Latin were drawn to sit together instead of being bolted
 * into one file. It is a humanist sans with real character in the terminals and
 * a tall x-height, which is what keeps lyrics legible at arm's length on a music
 * stand — the one reading condition this app is actually for.
 *
 * The files in `public/fonts` are subset to Latin + Georgian (U+10A0-10FF) and
 * are ~40KB each; see `scripts/build-fonts.sh` for how they were made. OFL-1.1,
 * license retained alongside them.
 *
 * Caveat: FiraGO covers Mkhedruli but not Mtavruli (U+1C90-1CBF). Nothing in the
 * app sets Georgian in caps — `SheetLines` deliberately avoids `uppercase` — so
 * nothing hits that gap today, but pasted Mtavruli text would fall back.
 */
const sans = localFont({
  variable: '--font-sans',
  display: 'swap',
  // Georgian has no uppercase to lean on, so hierarchy here is carried almost
  // entirely by weight. Four are loaded because four are used: regular body,
  // medium for UI labels, semibold for headings, bold for the rare loud thing.
  src: [
    { path: '../../public/fonts/FiraGO-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/FiraGO-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/FiraGO-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/FiraGO-Bold.woff2', weight: '700', style: 'normal' },
  ],
  // Named so the metric-matched fallback Next generates is measured against a
  // face that actually exists on the device, which is what stops the swap from
  // shifting a whole page of lyrics.
  fallback: ['system-ui', 'sans-serif'],
});

const mono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Worshipo', template: '%s · Worshipo' },
  description: 'ქართული საგალობლები და აკორდები.',
};

export const viewport: Viewport = {
  // viewportFit: cover is what makes env(safe-area-inset-*) resolve to real
  // values on notched iPhones — without it the bottom nav sits under the
  // home indicator.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning is required by next-themes: it writes the theme
    // class on <html> before React hydrates, which is what prevents the flash.
    <html lang="ka" suppressHydrationWarning>
      {/* Browser extensions (ColorZilla, password managers) inject attributes on
          <body> before React hydrates, which reads as a mismatch we cannot fix. */}
      <body className={`${sans.variable} ${mono.variable} antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
