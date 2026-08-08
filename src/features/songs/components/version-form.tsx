'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { StickyActionBar } from '@/components/shared/sticky-action-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { createVersion, updateVersion } from '../actions';
import { EMPTY_VERSION_FORM, KEYS, versionFormSchema, type VersionFormValues } from '../schemas';
import { ChordEditor } from './chord-editor';

export function VersionForm({
  songId,
  versionId,
  defaults,
}: {
  songId: string;
  /** Present when editing. Absent means create. */
  versionId?: string;
  defaults?: VersionFormValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<VersionFormValues>({
    resolver: zodResolver(versionFormSchema),
    defaultValues: defaults ?? EMPTY_VERSION_FORM,
  });

  const onSubmit = (values: VersionFormValues) => {
    setFormError(null);
    startTransition(async () => {
      const result = versionId
        ? await updateVersion(versionId, songId, values)
        : await createVersion(songId, values);

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      toast.success(versionId ? 'ვერსია განახლდა' : 'ვერსია დაემატა');
      router.push(`/songs/${songId}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-24 md:pb-0" noValidate>
      <div className="space-y-2">
        <Label htmlFor="version_name">ვერსიის სახელი</Label>
        <Input
          id="version_name"
          autoFocus
          autoComplete="off"
          placeholder="აკუსტიკური, ახალგაზრდული, D-ში…"
          {...register('version_name')}
        />
        {errors.version_name && (
          <p className="text-sm text-destructive">{errors.version_name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="version-key">ტონალობა</Label>
          {/* "" means inherit from the song, not "no key". */}
          <NativeSelect id="version-key" {...register('key')}>
            <option value="">როგორც სიმღერაში</option>
            {KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="version-capo">კაპო</Label>
          <NativeSelect id="version-capo" {...register('capo')}>
            <option value="">როგორც სიმღერაში</option>
            {Array.from({ length: 13 }, (_, fret) => (
              <option key={fret} value={fret}>
                {fret === 0 ? 'არა' : fret}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="version-lyrics">ტექსტი და აკორდები</Label>
        <Controller
          control={control}
          name="lyrics_with_chords"
          render={({ field }) => (
            <ChordEditor
              id="version-lyrics"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              // "" here means "same as the song", which tells us nothing about
              // the chords; the palette falls back to the common set.
              songKey={watch('key')}
              invalid={Boolean(errors.lyrics_with_chords)}
            />
          )}
        />
        {errors.lyrics_with_chords && (
          <p className="text-sm text-destructive">{errors.lyrics_with_chords.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="version-notes">შენიშვნები</Label>
        <Textarea id="version-notes" rows={3} {...register('notes')} />
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <StickyActionBar>
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {versionId ? 'ცვლილებების შენახვა' : 'ვერსიის დამატება'}
        </Button>
      </StickyActionBar>
    </form>
  );
}
