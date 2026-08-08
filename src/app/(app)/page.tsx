import Link from 'next/link';
import { Library, Plus, Tags } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSessionProfile } from '@/features/auth/guards';
import { createClient } from '@/lib/supabase/server';

async function getCounts() {
  const supabase = await createClient();

  // head: true fetches the count without transferring a single row.
  const [songs, categories] = await Promise.all([
    supabase.from('songs').select('*', { count: 'exact', head: true }),
    supabase.from('categories').select('*', { count: 'exact', head: true }),
  ]);

  return { songs: songs.count ?? 0, categories: categories.count ?? 0 };
}

export default async function HomePage() {
  // profile is null for visitors — this page is public.
  const [profile, counts] = await Promise.all([getSessionProfile(), getCounts()]);
  const firstName = profile?.name?.split(' ')[0];
  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <PageHeader
        title={firstName ? `გამარჯობა, ${firstName}` : 'Worshipo'}
        description="ქართული საგალობლები და აკორდები."
      />

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="space-y-1">
            <Library className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-2xl font-semibold tabular-nums">{counts.songs}</p>
            <p className="text-sm text-muted-foreground">სიმღერა</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <Tags className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-2xl font-semibold tabular-nums">{counts.categories}</p>
            <p className="text-sm text-muted-foreground">კატეგორია</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {isAdmin ? (
          <>
            {/* Admins land here to add, not to browse — so adding is the primary action. */}
            <Button asChild size="lg" className="flex-1">
              <Link href="/songs/new">
                <Plus />
                სიმღერის დამატება
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="flex-1">
              <Link href="/songs">
                <Library />
                სიმღერების დათვალიერება
              </Link>
            </Button>
          </>
        ) : (
          <Button asChild size="lg" className="flex-1">
            <Link href="/songs">
              <Library />
              სიმღერების დათვალიერება
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}
