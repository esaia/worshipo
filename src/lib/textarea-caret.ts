/**
 * Where the caret is, in pixels, inside a textarea.
 *
 * A textarea exposes the caret as a character offset and nothing else — there is
 * no API for its position on screen. The standard workaround, and the one used
 * here, is a mirror: an off-screen div styled identically to the textarea, filled
 * with the text up to the caret, with a marker element at the end. Whatever the
 * browser does with wrapping, tabs, and font metrics, it does the same to both,
 * so the marker lands where the caret is.
 *
 * Every property below has to be copied or the mirror lays text out differently
 * and the answer is quietly wrong — `white-space` and `tab-size` especially,
 * given this editor sets `whitespace-pre` and indents with spaces.
 */
const MIRRORED = [
  'box-sizing',
  'width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'letter-spacing',
  'line-height',
  'text-indent',
  'text-transform',
  'word-spacing',
  'tab-size',
  'white-space',
  'word-break',
  'overflow-wrap',
];

/** Caret position relative to the textarea's own top-left, scrolling included. */
export function caretPoint(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; lineHeight: number } {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');

  for (const property of MIRRORED) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '0';
  mirror.style.height = 'auto';
  mirror.style.overflow = 'hidden';

  mirror.textContent = textarea.value.slice(0, position);

  // The marker needs content or it collapses to zero height on its own line.
  const marker = document.createElement('span');
  marker.textContent = textarea.value.slice(position) || '.';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  const left = marker.offsetLeft;
  document.body.removeChild(mirror);

  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5;

  return {
    top: top - textarea.scrollTop,
    left: left - textarea.scrollLeft,
    lineHeight,
  };
}
