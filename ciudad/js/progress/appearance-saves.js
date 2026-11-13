// Only one cosmetic snapshot travels at a time. Keep the latest local choice
// while its predecessor is being confirmed; unrelated profile actions stay free.
export class AppearanceSaves {
  constructor({ send, onFailure, timeoutMs = 12000, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) }) {
    this.send = send; this.onFailure = onFailure; this.timeoutMs = timeoutMs;
    this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.sequence = 0; this.current = null; this.next = null; this.timer = null;
  }

  get pending() { return this.next || this.current; }

  save(id, custom) {
    const snapshot = { id, custom: { ...custom } };
    if (this.current) this.next = snapshot;
    else this.#send(snapshot);
  }

  #send(snapshot) {
    const request = { ...snapshot, customVersion: 2, n: ++this.sequence };
    this.current = request;
    const fail = () => { this.clear(); this.onFailure(); };
    this.timer = this.setTimer(fail, this.timeoutMs);
    let sent = false;
    try { sent = this.send(request); } catch (_) { /* socket closed before its status event */ }
    if (!sent) fail();
  }

  /** False means this is an old confirmation, possibly from a closed socket. */
  receive(message) {
    if (message.op !== 'avatar') return true;
    if (!this.current || message.n !== this.current.n) return false;
    const previous = this.current, next = this.next;
    this.clear();
    if (message.ok === true && next && (next.id !== previous.id || JSON.stringify(next.custom) !== JSON.stringify(previous.custom))) this.#send(next);
    return true;
  }

  clear() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null; this.current = null; this.next = null;
  }
}
