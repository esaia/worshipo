'use client';

import { useCallback, useRef, useState } from 'react';

import { extractedSongSchema, type ExtractedSong } from './schema';

const MAX_EDGE = 1600;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Shrinks a camera photo before upload.
 *
 * This is not an optimisation, it is a requirement: a modern phone camera
 * produces an 8–12MB image. At 1600px it is ~300KB — inside the request limit,
 * several seconds faster on mobile data, and still more resolution than the
 * vision model consumes at `detail: 'high'`.
 */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    // OffscreenCanvas is the cheap path; Safari only grew `convertToBlob`
    // recently, so a plain canvas is the fallback rather than a failure.
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(bitmap, 0, 0, width, height);
        return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    });
    if (!blob) throw new Error('Canvas encoding failed');
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Prepares the file to send.
 *
 * If the browser cannot decode the image at all — HEIC on a browser without
 * support is the realistic case — fall back to the original bytes and let the
 * server decide. Refusing to try locally would be a worse outcome than an
 * upload that the route rejects with a clear message.
 */
async function prepare(file: File): Promise<Blob> {
  try {
    return await downscale(file);
  } catch {
    return file;
  }
}

export type ImportState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'error'; message: string }
  | { status: 'done'; song: ExtractedSong };

export function useSongImport(onExtracted: (song: ExtractedSong) => void) {
  const [state, setState] = useState<ImportState>({ status: 'idle' });
  // Abort an in-flight extraction when a second photo is picked, so a slow first
  // request can never overwrite the form after the second one has landed.
  const inFlight = useRef<AbortController | null>(null);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const importFile = useCallback(
    async (file: File) => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setState({ status: 'working' });

      try {
        const blob = await prepare(file);

        if (blob.size > MAX_BYTES) {
          setState({ status: 'error', message: 'ეს ფოტო გასაგზავნად ძალიან დიდია.' });
          return;
        }

        const body = new FormData();
        body.append('image', blob, 'song.jpg');

        const response = await fetch('/api/ai/extract-song', {
          method: 'POST',
          body,
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : 'ფოტოს წაკითხვა ვერ მოხერხდა.';
          setState({ status: 'error', message });
          return;
        }

        const song = extractedSongSchema.parse((payload as { data: unknown }).data);
        setState({ status: 'done', song });
        onExtracted(song);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('[ai-import]', error);
        setState({ status: 'error', message: 'ფოტოს წაკითხვა ვერ მოხერხდა.' });
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [onExtracted],
  );

  return { state, importFile, reset };
}
