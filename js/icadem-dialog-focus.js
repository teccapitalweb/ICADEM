/* Keyboard focus for the shared confirmation dialogs and membership notice. */
(() => {
  'use strict';
  const stack = [];
  const selector = 'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex],[contenteditable="true"]';
  const visible = element => element.isConnected && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert]');
  const controls = root => Array.from(root.querySelectorAll(selector)).filter(element => element.tabIndex >= 0 && visible(element));
  function focusFirst(root) {
    const autofocus = root.querySelector('[autofocus]');
    const target = autofocus && visible(autofocus) ? autofocus : controls(root)[0] || root;
    target.focus({preventScroll:true});
  }
  function activate(root, onEscape) {
    if (!root || stack.some(entry => entry.root === root)) return;
    const entry = {root, onEscape, previous:document.activeElement};
    stack.push(entry);
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    focusFirst(root);
  }
  function release(root) {
    const index = stack.findIndex(entry => entry.root === root);
    if (index < 0) return;
    const top = index === stack.length - 1;
    const [entry] = stack.splice(index, 1);
    const focused = document.activeElement;
    if (!top || (focused && focused !== document.body && focused.isConnected && !root.contains(focused))) return;
    const parent = stack.at(-1)?.root;
    if (entry.previous && visible(entry.previous) && (!parent || parent.contains(entry.previous))) entry.previous.focus({preventScroll:true});
    else if (parent?.isConnected) focusFirst(parent);
  }
  document.addEventListener('keydown', event => {
    const entry = stack.at(-1);
    if (!entry?.root.isConnected || !['Tab','Escape'].includes(event.key)) return;
    const root = entry.root;
    // A separately managed/native overlay can temporarily sit above this dialog.
    const other = document.activeElement?.closest('dialog[open],[role="dialog"]');
    if (other && other !== root && !root.contains(other) && visible(other)) return;
    if (event.key === 'Escape') {
      if (entry.onEscape) { event.preventDefault(); event.stopImmediatePropagation(); entry.onEscape(); }
      return;
    }
    const items = controls(root), first = items[0], last = items.at(-1), focused = document.activeElement;
    if (!first || !root.contains(focused) || focused === root || (event.shiftKey ? focused === first : focused === last)) {
      event.preventDefault();
      (event.shiftKey ? last || root : first || root).focus({preventScroll:true});
    }
  }, true);
  window.ICADEMDialogFocus = {activate, release};
})();
