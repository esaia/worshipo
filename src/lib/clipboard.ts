/**
 * Copy text to the clipboard, on the browsers this app actually runs in.
 *
 * `navigator.clipboard` only exists in a secure context. The songbook is opened
 * from a phone on the church wifi as often as from the public domain, and
 * `http://192.168.1.x:3000` is not secure by that definition — so on exactly
 * the device the copy button exists for, the modern API is simply absent.
 *
 * Hence the fallback. `document.execCommand('copy')` is deprecated and every
 * browser still implements it, because the whole web depends on it for this
 * case; it is the difference between a working button and a toast apologising.
 */

function isIOS(): boolean {
  // iPadOS 13+ reports itself as a Mac, and the touch-point count is what
  // still separates the two.
  return (
    /iphone|ipod|ipad/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * The pre-clipboard-API dance: put the text in an offscreen field, select it,
 * let the browser copy the selection.
 */
function copyViaSelection(value: string): boolean {
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');

  // Fixed and transparent rather than `display: none`: a hidden element has no
  // selection to copy. Top-left with zero opacity keeps it out of the way
  // without scrolling the page, which `position: absolute` far offscreen would.
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '0';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  // 16px stops iOS Safari zooming the viewport when the field takes focus.
  field.style.fontSize = '16px';

  document.body.appendChild(field);

  try {
    if (isIOS()) {
      // iOS ignores .select() on a readonly textarea. A Range over the node's
      // contents is what it does honour, and contentEditable is what makes the
      // textarea eligible for one.
      field.contentEditable = 'true';
      const range = document.createRange();
      range.selectNodeContents(field);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      field.setSelectionRange(0, value.length);
    } else {
      field.select();
    }

    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(field);
  }
}

/** Resolves true if the text made it to the clipboard by either route. */
export async function copyText(value: string): Promise<boolean> {
  // Present but rejecting is a real state — a denied permission, or a
  // Safari call that lost its user-gesture — so the fallback runs on a
  // rejection too, not only when the API is missing.
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fall through
    }
  }

  return copyViaSelection(value);
}
