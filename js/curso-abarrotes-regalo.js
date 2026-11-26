const gift = document.querySelector('#regalo-curso');
const sessionKey = 'icadem:abarrotes:regalo-v1';
let shown = false;

function alreadyShown() {
  try {
    return shown || sessionStorage.getItem(sessionKey) === 'yes';
  } catch {
    return shown;
  }
}

function showGift() {
  if (document.querySelector('dialog[open]')) return;
  gift.showModal();
  shown = true;
  try {
    sessionStorage.setItem(sessionKey, 'yes');
  } catch {
    // The current document still remembers the popup when browser storage is unavailable.
  }
}

function showAutomatically() {
  if (alreadyShown() || location.hash === '#mi-curso' || new URLSearchParams(location.search).has('checkout')) return;
  if (document.hidden) {
    document.addEventListener('visibilitychange', showAutomatically, { once: true });
    return;
  }
  showGift();
}

function showLinkedGift() {
  if (location.hash === '#regalo-curso' && !new URLSearchParams(location.search).has('checkout')) showGift();
}

document.querySelector('[data-gift-open]').addEventListener('click', showGift);
gift.querySelector('[data-gift-claim]').addEventListener('click', () => gift.close());
window.addEventListener('hashchange', showLinkedGift);
showLinkedGift();
window.setTimeout(showAutomatically, 2100);
