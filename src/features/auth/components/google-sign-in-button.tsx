'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

/** Google's mark, inlined: four paths beat a network request and a CSP entry. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.26a12 12 0 0 0 0 10.74l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.63l4.01 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

/**
 * Client-side on purpose. `signInWithOAuth` generates the PKCE verifier and
 * stores it in a cookie the browser must own; doing the redirect from a Server
 * Action would leave the verifier on the wrong side of the exchange.
 *
 * The state is never unset on success — the browser is leaving for Google, and
 * a button that goes back to idle mid-navigation just looks broken.
 */
export function GoogleSignInButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setPending(true);
    setError(null);

    const callback = new URL('/auth/callback', window.location.origin);
    if (next) callback.searchParams.set('next', next);

    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callback.toString(),
        // Ask for a chooser rather than silently reusing whichever Google
        // account the phone happens to be signed into.
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      setError('Google-ით შესვლა ვერ მოხერხდა. სცადეთ ხელახლა.');
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={signIn}
      >
        {pending ? <Loader2 className="animate-spin" /> : <GoogleMark />}
        Google-ით შესვლა
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
