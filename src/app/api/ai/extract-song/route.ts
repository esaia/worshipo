import { NextResponse } from 'next/server';

import { getSessionProfile } from '@/features/auth/guards';
import { extractSongFromImage, ImportNotConfiguredError } from '@/features/ai-import/service';
import { canEdit } from '@/types/domain';

/**
 * A route handler rather than a Server Action.
 *
 * Multipart upload, a real progress signal, and abort-on-navigate all work
 * naturally here. Server Actions are the wrong tool for a file upload that needs
 * feedback while it runs.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  // `requireEditor()` redirects, which is right for a page and wrong for fetch —
  // an API caller needs a status code, not a 307 to /songs.
  const profile = await getSessionProfile();
  if (!canEdit(profile)) {
    return NextResponse.json({ error: 'წვდომა აკრძალულია' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('image');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'სურათი არ არის' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'სურათის მხარდაუჭერელი ტიპი' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'სურათი ძალიან დიდია' }, { status: 413 });
  }

  try {
    return NextResponse.json({ data: await extractSongFromImage(file) });
  } catch (error) {
    if (error instanceof ImportNotConfiguredError) {
      return NextResponse.json(
        { error: 'ფოტოთი იმპორტი ამ სერვერზე კონფიგურირებული არ არის.' },
        { status: 501 },
      );
    }

    console.error('[ai-import] extraction failed', error);
    return NextResponse.json(
      { error: 'ფოტოს წაკითხვა ვერ მოხერხდა. სცადეთ ხელახლა, ან შეიყვანეთ სიმღერა ხელით.' },
      { status: 502 },
    );
  }
}
