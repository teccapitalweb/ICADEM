/* Session lifetime shared by Firebase hydration, logout and restored mobile pages. */
(() => {
  'use strict';
  window.ICADEMCreateSession = ({ auth, signOut }) => {
    let revision = 0, pending = null, closed = false;
    const emit = name => document.dispatchEvent(new CustomEvent(name));
    const begin = user => ({ revision:++revision, uid:user?.uid });
    const current = ticket => !closed && !window.__sessionEnding && ticket.revision === revision && !!ticket.uid && auth.currentUser?.uid === ticket.uid;
    function clearIdentity() {
      revision++; closed = true; window.__sessionEnding = true;
      window.__currentUser = null; window.memberData = null;
      window.UserState = { modo:'invitado', uid:null, identityReady:false };
      for (const key of ['icadem_profile','icadem_last_user']) {
        try { localStorage.removeItem(key); } catch (_) {}
      }
      document.querySelectorAll('video,audio').forEach(media => media.pause());
      emit('icadem:session-ended');
      document.body.style.visibility = 'hidden';
    }
    function signedOut() {
      if (pending) return; // Explicit logout owns its destination, including deleted-account recovery.
      clearIdentity(); window.location.replace('vip-auth.html?tab=login');
    }
    function logout(options = {}) {
      if (pending) return pending;
      const destination = options.redirect === 'vip-auth.html?tab=register&deleted=1' ? options.redirect : 'vip-auth.html?tab=login';
      window.__sessionEnding = true; revision++; emit('icadem:session-ending');
      pending = Promise.resolve().then(async () => {
        // A demo must never sign out a real account stored in this browser.
        if (!window.__isDemoMode) await signOut(auth);
        clearIdentity(); window.location.replace(destination);
        return true;
      }).catch(error => {
        pending = null; window.__sessionEnding = false;
        emit('icadem:session-exit-failed');
        throw error;
      });
      return pending;
    }
    window.addEventListener('pageshow', async event => {
      if (!event.persisted || window.__isDemoMode) return;
      document.body.style.visibility = 'hidden';
      try { await auth.authStateReady?.(); } catch (_) {}
      if (closed || !auth.currentUser) { clearIdentity(); window.location.replace('vip-auth.html?tab=login'); }
      else window.location.reload();
    });
    return { begin, current, signedOut, logout };
  };
})();
