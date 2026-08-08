'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { StickyActionBar } from '@/components/shared/sticky-action-bar';
import { PhotoImport } from '@/features/ai-import/components/photo-import';
import type { ExtractedSong } from '@/features/ai-import/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { Category } from '@/types/domain';
import { createSong, updateSong } from '../actions';
import {
  EMPTY_SONG_FORM,
  KEYS,
  LANGUAGE_LABELS,
  songFormSchema,
  type SongFormValues,
} from '../schemas';
import { CategoryPicker } from './category-picker';
import { DuplicateWarning } from './duplicate-warning';
import { ChordEditor } from './chord-editor';

export function SongForm({
  categories,
  songId,
  defaults,
  allowPhotoImport = false,
}: {
  categories: Category[];
  /** Present when editing. Absent means create. */
  songId?: string;
  defaults?: SongFormValues;
  /**
   * Offer photo import. Available when editing too, where it overwrites the
   * song rather than filling it in — so it asks first.
   */
  allowPhotoImport?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<SongFormValues>({
    resolver: zodResolver(songFormSchema),
    defaultValues: defaults ?? EMPTY_SONG_FORM,
  });

  /**
   * Merge rather than replace: language and categories are the admin's choice,
   * and the photo says nothing about either. `reset` (not per-field `setValue`)
   * so the fields the extraction filled read as pristine — the admin is
   * reviewing a draft, not recovering from having typed it.
   */
  const applyExtraction = useCallback(
    (song: ExtractedSong) => {
      reset({
        ...getValues(),
        title: song.title,
        artist: song.artist ?? '',
        key: song.key ?? '',
        capo: song.capo === null ? '' : String(song.capo),
        lyrics_with_chords: song.lyrics_with_chords,
      });
    },
    [reset, getValues],
  );

  // The editor's chord palette follows the key picker above it, so choosing
  // "Em" puts that song's six chords under the admin's thumb.
  const songKey = watch('key');
  const language = watch('language');
  const title = watch('title');

  const onSubmit = (values: SongFormValues) => {
    setFormError(null);
    startTransition(async () => {
      const result = songId ? await updateSong(songId, values) : await createSong(values);

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      toast.success(songId ? 'სიმღერა განახლდა' : 'სიმღერა დაემატა');
      router.push(`/songs/${result.data.id}`);
      // The action revalidated the cache; refresh so the detail page renders
      // the new data rather than a stale RSC payload.
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-24 md:pb-0" noValidate>
      {allowPhotoImport && (
        <PhotoImport onExtracted={applyExtraction} confirmReplace={songId !== undefined} />
      )}

      <div className="space-y-2">
        <Label htmlFor="title">სათაური</Label>
        <Input id="title" autoFocus autoComplete="off" {...register('title')} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        {/* Creating only — every title matches itself when editing. */}
        {!songId && <DuplicateWarning title={title} />}
      </div>

      <div className="space-y-2">
        <Label htmlFor="artist">შემსრულებელი</Label>
        <Input id="artist" autoComplete="off" {...register('artist')} />
      </div>

      {/*
        Names this song's own arrangement — the first tab in the switcher, the
        one the sheet below belongs to. Sits next to the artist rather than up by
        the title because it is not the song's identity: most songs have one
        arrangement and the admin will leave this alone.
      */}
      <div className="space-y-2">
        <Label htmlFor="version_name">ვერსიის სახელი</Label>
        <Input id="version_name" autoComplete="off" {...register('version_name')} />
        {errors.version_name && (
          <p className="text-sm text-destructive">{errors.version_name.message}</p>
        )}
      </div>

      {/* Key / capo / language on one row: three narrow pickers, no scrolling. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="key">ტონალობა</Label>
          <NativeSelect id="key" {...register('key')}>
            <option value="">—</option>
            {KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="capo">კაპო</Label>
          <NativeSelect id="capo" {...register('capo')}>
            <option value="">—</option>
            {Array.from({ length: 13 }, (_, fret) => (
              <option key={fret} value={fret}>
                {fret === 0 ? 'არა' : fret}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">ენა</Label>
          <NativeSelect id="language" {...register('language')}>
            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lyrics">ტექსტი და აკორდები</Label>
        <Controller
          control={control}
          name="lyrics_with_chords"
          render={({ field }) => (
            <ChordEditor
              id="lyrics"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              songKey={songKey}
              language={language}
              invalid={Boolean(errors.lyrics_with_chords)}
            />
          )}
        />
        {errors.lyrics_with_chords && (
          <p className="text-sm text-destructive">{errors.lyrics_with_chords.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>კატეგორიები</Label>
        <Controller
          control={control}
          name="categoryIds"
          render={({ field }) => (
            <CategoryPicker categories={categories} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">შენიშვნები</Label>
        <Textarea id="notes" rows={3} {...register('notes')} />
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <StickyActionBar>
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {songId ? 'ცვლილებების შენახვა' : 'სიმღერის დამატება'}
        </Button>
      </StickyActionBar>
    </form>
  );
}
