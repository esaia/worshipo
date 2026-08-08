'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertTriangle, Camera, ImageUp, Loader2, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSongImport } from '../use-song-import';
import type { ExtractedSong } from '../schema';

const CONFIDENCE: Record<ExtractedSong['confidence'], { label: string; className: string }> = {
  high: { label: 'სუფთად იკითხება', className: 'text-muted-foreground' },
  medium: { label: 'გადაამოწმეთ', className: 'text-foreground' },
  low: { label: 'ყურადღებით წაიკითხეთ', className: 'text-destructive' },
};

/**
 * Fill the form from a photo of a paper sheet.
 *
 * Two inputs rather than one, because they are two different acts. `capture`
 * opens the camera directly on a phone — no gallery, no picker — which is the
 * whole point when someone is standing over a folder of handwritten sheets. The
 * same attribute is meaningless on a desktop, where the admin has scans on disk,
 * so the second input is a plain file picker.
 *
 * What comes back is never saved directly. It lands in the form as a draft and
 * the admin corrects it — handwriting, mixed Georgian and Latin, and chord
 * columns are exactly the things a vision model gets subtly wrong, and a chord
 * one syllable off is worse than no chord at all. `confidence` and `warnings`
 * exist to point at what to check rather than presenting an even wall of text
 * that all looks equally trustworthy.
 */
export function PhotoImport({
  onExtracted,
  /**
   * Ask before opening the picker. Set when the form already holds a song, so
   * an import would overwrite work rather than fill in blanks.
   */
  confirmReplace = false,
}: {
  onExtracted: (song: ExtractedSong) => void;
  confirmReplace?: boolean;
}) {
  const { state, importFile, reset } = useSongImport(onExtracted);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /**
   * What to do once the replace warning is accepted: open a picker, or import a
   * file that was already dropped on us.
   */
  const [confirming, setConfirming] = useState<
    { source: 'camera' | 'file' } | { source: 'drop'; file: File } | null
  >(null);

  const inputFor = (source: 'camera' | 'file') =>
    source === 'camera' ? cameraRef.current : fileRef.current;

  /**
   * Confirmation happens *before* the picker, not after extraction.
   *
   * Warning afterwards would mean the admin waits ten seconds for a result they
   * are then told they cannot have. It works because the dialog's own button is
   * a user gesture — Safari refuses a programmatic `input.click()` that is not
   * traceable to one, which is what makes "confirm, then open" the only ordering
   * that actually opens the camera on iOS.
   */
  const open = (source: 'camera' | 'file') => {
    if (confirmReplace) {
      setConfirming({ source });
      return;
    }
    inputFor(source)?.click();
  };

  const proceed = () => {
    const pending = confirming;
    setConfirming(null);
    if (!pending) return;

    if (pending.source === 'drop') {
      setRejected(null);
      void importFile(pending.file);
      return;
    }
    inputFor(pending.source)?.click();
  };

  /** A drop we refused before it ever reached the network. */
  const [rejected, setRejected] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;
    setRejected(null);
    void importFile(file);
  };

  const working = state.status === 'working';

  /**
   * `dragenter` and `dragleave` fire for every child element the pointer
   * crosses, so a plain boolean flickers off the moment the cursor moves from
   * the panel onto the button inside it. Counting entries against leaves is the
   * fix: the drag is over us until as many leaves have fired as enters.
   */
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);

  // Only react to a drag carrying files. Dragging selected text across the page
  // otherwise lights up the dropzone for something it cannot accept.
  const hasFiles = (event: DragEvent<HTMLDivElement>) => event.dataTransfer.types.includes('Files');

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (working || !hasFiles(event)) return;
    depth.current += 1;
    setDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (working || !hasFiles(event)) return;
    // Without preventDefault the browser navigates to the dropped file instead
    // of letting the page handle it — the classic silent-failure of drop zones.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    if (working) return;

    const file = event.dataTransfer.files[0];
    if (!file) return;

    // Caught here rather than at the server so the message names what was
    // wrong with *this* drop, not a generic 415.
    if (!file.type.startsWith('image/')) {
      setRejected(`${file.name || 'ეს ფაილი'} სურათი არ არის.`);
      return;
    }

    if (confirmReplace) {
      setConfirming({ source: 'drop', file });
      return;
    }

    setRejected(null);
    void importFile(file);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'rounded-xl border border-dashed p-3 transition-colors',
        dragging ? 'border-foreground bg-muted' : 'border-border bg-muted/30',
      )}
    >
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
      />

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {confirmReplace ? 'ფოტოთი ჩანაცვლება' : 'ფოტოთი დაწყება'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {working ? (
              'ფურცელი იკითხება…'
            ) : dragging ? (
              'ჩააგდეთ, რომ ფურცელი წავიკითხოთ.'
            ) : (
              <>
                {confirmReplace
                  ? 'ქვემოთ მოცემულ ველებს გადააწერს. შენახვამდე თქვენ ამოწმებთ.'
                  : 'ქვემოთ მოცემულ ველებს შეავსებს. შენახვამდე თქვენ ამოწმებთ.'}
                {/* Drag and drop is meaningless on a touch device. */}
                <span className="hidden md:inline"> ან ჩააგდეთ სურათი აქ.</span>
              </>
            )}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={working}
          onClick={() => open('camera')}
        >
          {working ? <Loader2 className="animate-spin" /> : <Camera />}
          ფოტო
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="სურათის ატვირთვა"
          disabled={working}
          onClick={() => open('file')}
        >
          <ImageUp />
        </Button>
      </div>

      {(rejected !== null || state.status === 'error') && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {rejected ?? (state.status === 'error' ? state.message : null)}
        </p>
      )}

      {state.status === 'done' && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex items-start gap-2">
            <p className={cn('flex-1 text-xs', CONFIDENCE[state.song.confidence].className)}>
              {CONFIDENCE[state.song.confidence].label}. გადაამოწმეთ აკორდების პოზიციები ფოტოსთან —
              სწორედ ისინი იცვლება ყველაზე ადვილად ერთი სვეტით.
            </p>
            <button
              type="button"
              aria-label="დახურვა"
              onClick={reset}
              className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {state.song.warnings.length > 0 && (
            <ul className="space-y-1">
              {state.song.warnings.map((warning, index) => (
                <li key={index} className="flex gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle
                    className="mt-0.5 size-3.5 shrink-0 text-destructive"
                    aria-hidden
                  />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ჩავანაცვლოთ ეს სიმღერა ფოტოთი?</AlertDialogTitle>
            <AlertDialogDescription>
              სათაური, შემსრულებელი, ტონალობა, კაპო და მთელი ტექსტი აკორდებთან ერთად ჩანაცვლდება
              იმით, რასაც ფოტო წაიკითხავს. კატეგორიები და ენა შენარჩუნდება.
              <br />
              <br />
              სანამ „ცვლილებების შენახვას“ არ დააჭერთ, არაფერი ინახება — შედეგის გარეშეც შეგიძლიათ
              გახვიდეთ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>გაუქმება</AlertDialogCancel>
            <AlertDialogAction onClick={proceed}>ჩანაცვლება</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
