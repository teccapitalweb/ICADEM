/* Optional audio cues. Only server-confirmed activity is passed to this module. */
(function () {
  'use strict';

  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const prefix = 'icadem:panel-sounds:';
  const cues = {
    credit: [[587.33, 0, 0.09], [880, 0.07, 0.12]],
    notification: [[659.25, 0, 0.08], [783.99, 0.06, 0.08]],
    like: [[783.99, 0, 0.065]],
    comment: [[523.25, 0, 0.09]],
    connection: [[523.25, 0, 0.07], [659.25, 0.045, 0.09]]
  };
  const heard = new Set();
  const baselines = new Map();
  let owner = '', enabled = false, engine = null, output = null, nextSoundAt = 0;

  function currentUid() {
    if (window.__isDemoMode || window.__sessionEnding) return '';
    return (window.__auth ? window.__auth.currentUser?.uid : window.__currentUser?.uid) || '';
  }

  function foreground() {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  function mute() {
    if (!output) return;
    output.gain.value = 0;
  }

  function reset() {
    mute();
    if (engine) engine.close().catch(() => {});
    owner = '';
    enabled = false;
    engine = null;
    output = null;
    nextSoundAt = 0;
    heard.clear();
    baselines.clear();
  }

  function scope() {
    const uid = currentUid();
    if (owner !== uid) {
      reset();
      owner = uid;
      if (uid) {
        try { enabled = localStorage.getItem(prefix + uid) === 'on'; } catch (_) {}
      }
    }
    return uid;
  }

  function unlock(event) {
    if (!AudioEngine || !event.isTrusted || !scope() || !enabled || !foreground()) return;
    try {
      if (!engine) {
        engine = new AudioEngine();
        output = engine.createGain();
        output.gain.value = 0;
        output.connect(engine.destination);
      }
      if (engine.state === 'suspended' || engine.state === 'interrupted') engine.resume().catch(() => {});
    } catch (_) {}
  }

  function confirmed(kind, keys, expectedUid) {
    const uid = scope();
    if (!uid || uid !== expectedUid || !Object.hasOwn(cues, kind)) return false;
    if (keys != null) {
      const eventIds = (Array.isArray(keys) ? keys : [keys]).filter(key => typeof key === 'string' && key.length);
      const unseen = eventIds.some(key => !heard.has(kind + ':' + key));
      eventIds.forEach(key => heard.add(kind + ':' + key));
      while (heard.size > 240) heard.delete(heard.values().next().value);
      if (!unseen) return false;
    }
    if (!foreground() || !enabled || engine?.state !== 'running' || !output || engine.currentTime < nextSoundAt) return false;
    try {
      const start = engine.currentTime;
      nextSoundAt = start + 0.32;
      output.gain.value = 0.65;
      for (const [frequency, delay, length] of cues[kind]) {
        const oscillator = engine.createOscillator();
        const envelope = engine.createGain();
        const at = start + delay;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(envelope);
        envelope.connect(output);
        envelope.gain.setValueAtTime(0.0001, at);
        envelope.gain.exponentialRampToValueAtTime(0.07, at + 0.014);
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
        oscillator.start(at);
        oscillator.stop(at + length);
      }
      return true;
    } catch (_) { return false; }
  }

  function inbox(kind, items, serverNow, expectedUid) {
    if (scope() !== expectedUid || !expectedUid || !Number.isFinite(serverNow) || !Array.isArray(items)) return;
    if (!foreground()) { baselines.delete(kind); return; }
    const previous = baselines.get(kind);
    if (previous !== undefined && previous > serverNow) return;
    baselines.set(kind, serverNow);
    if (previous === undefined) return;
    const arrivals = items.filter(item => !item.seen && !item.read && item.createdAtMs > previous && item.createdAtMs <= serverNow);
    confirmed(kind, arrivals.map(item => item.id), expectedUid);
  }

  function mount(root) {
    const input = root.querySelector('[data-panel-sounds]');
    if (!input) return;
    const uid = scope();
    input.disabled = !AudioEngine || !uid;
    input.checked = Boolean(uid && enabled && AudioEngine);
    input.addEventListener('change', event => {
      if (scope() !== uid || !uid || !event.isTrusted || !AudioEngine) return;
      enabled = input.checked;
      try { localStorage.setItem(prefix + uid, enabled ? 'on' : 'off'); } catch (_) {}
      if (enabled) unlock(event);
      else mute();
    });
  }

  function loseForeground() {
    mute();
    baselines.clear();
  }

  document.addEventListener('click', unlock, {capture: true, passive: true});
  document.addEventListener('keydown', unlock, {capture: true, passive: true});
  document.addEventListener('visibilitychange', () => { if (!foreground()) loseForeground(); });
  document.addEventListener('icadem:session-ending', reset);
  document.addEventListener('icadem:session-ended', reset);
  document.addEventListener('icadem:user-ready', scope);
  window.addEventListener('blur', loseForeground);
  window.addEventListener('storage', event => {
    if (!scope() || event.key !== prefix + owner) return;
    enabled = event.newValue === 'on';
    if (!enabled) mute();
    const control = document.querySelector('[data-panel-sounds]');
    if (control) control.checked = enabled;
  });
  window.ICADEMPanelSounds = { mount, confirmed, inbox };
})();
