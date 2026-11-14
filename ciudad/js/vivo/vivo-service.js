// Ciudad ICADEM 2.0 · servicio de «Mundo vivo» en el cliente.
//
// Es la capa que usan las interfaces (las de Codex y los paneles funcionales): no decide nada por
// su cuenta, solo pide al servidor y refleja lo que este confirma. Contrato en ciudad/MUNDO_VIVO.md.
//
//   api.vivo.state            → { coins, inv, pets, activePet, home, coinbook } | null (sin conexión)
//   api.vivo.on('change', fn) → se llama cada vez que el servidor confirma un cambio
//   await api.vivo.buy(item, qty)            await api.vivo.adopt(breed, name)
//   await api.vivo.setPet(id, { name, acc, active })    await api.vivo.rest()
//   await api.vivo.saveHome(layout)          await api.vivo.feed(petId, food)
//   await api.vivo.drink(flavor, 'self' | 'buy', steps) await api.vivo.walk(true | false)
// Todas devuelven { ok, reason?, message?, ... }: `message` es el texto listo para mostrar.
import { itemById, ITEMS, SHOPS, lockedWear, wearItemFor } from '../economy/catalog.js';
import { BREEDS, breedById, breedRequirement, breedAvailable, breedCost, slotFits, PET_SLOTS } from '../pets/pet-catalog.js';
import { VIVO_REASONS } from './vivo-rules.js';
import { HOME_REASONS } from '../home/home-rules.js';

const rid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const NET_REASONS = { 'sin-conexion': 'Necesitas conexión con la ciudad para esto.', 'sin-respuesta': 'La ciudad no respondió. Inténtalo de nuevo.', 'no-disponible': 'Esta función todavía no está disponible para tu perfil.', operacion: 'Esa acción no existe.' };
export const vivoMessage = reason => VIVO_REASONS[reason] || NET_REASONS[reason] || (reason && reason.startsWith('casa-') ? HOME_REASONS[reason.slice(5)] : null) || 'No se pudo completar la acción.';

export class VivoService {
  constructor(api) {
    this.api = api; this.listeners = new Set(); this.leash = false; this.busy = new Set();
    api.net.on('status', st => { if (st.status !== 'online' && this.leash) { this.leash = false; this.emit(); } });
  }
  get online() { return Boolean(this.api.net.isOnline && this.state); }
  get state() { return this.api.store.state.vivo || null; }
  get coins() { return this.state ? this.state.coins : 0; }
  get activePet() { const s = this.state; return s ? s.pets.find(p => p.id === s.activePet) || null : null; }
  owns(itemId) { return Boolean(this.state && this.state.inv[itemId]); }
  on(event, fn) { if (event === 'change') { this.listeners.add(fn); return () => this.listeners.delete(fn); } return () => {}; }
  emit() { this.listeners.forEach(fn => { try { fn(this.state); } catch (e) { console.error(e); } }); }
  /** Lo llama applyProfile cuando llega un perfil del servidor. */
  changed() { if (this.leash && !(this.activePet && this.activePet.acc.leash && breedById(this.activePet.breed).species === 'perro')) this.leash = false; this.emit(); }

  async #ask(op, payload, key = op) {
    if (this.busy.has(key)) return { ok: false, reason: 'en-curso', message: 'Espera un momento…' };
    this.busy.add(key);
    try {
      const r = await this.api.net.vivo(op, payload);
      return r.ok ? r : { ...r, message: vivoMessage(r.reason) };
    } finally { this.busy.delete(key); }
  }

  /* ---------- compras ---------- */
  buy(item, qty = 1) { return this.#ask('buy', { item, qty, rid: rid() }, 'buy:' + item); }
  /** Catálogo de una tienda con lo que la interfaz necesita mostrar. */
  shop(id) {
    const s = this.state, coins = s ? s.coins : 0;
    return ITEMS.filter(i => i.shop === id && i.price > 0).map(i => ({ ...i, owned: s ? s.inv[i.id] || 0 : 0, affordable: coins >= i.price, unique: !i.stack && i.kind !== 'furniture' }));
  }
  get shops() { return SHOPS; }

  /* ---------- mascotas ---------- */
  adopt(breed, name) { return this.#ask('adopt', { breed, name, rid: rid() }, 'adopt'); }
  setPet(id, change = {}) { return this.#ask('pet', { id, ...change }, 'pet:' + id); }
  rest() { return this.#ask('rest', {}); }
  feed(pet, food = 'croquetas') { return this.#ask('feed', { pet, food }, 'feed:' + pet); }
  /** Catálogo de adopción con el estado de cada raza para esta cuenta. */
  catalog() {
    const s = this.state, st = this.api.store.state, profile = { xp: st.xp, play: st.play, missions: st.missions, discovered: st.discovered };
    return BREEDS.map(b => ({ ...b, adopted: Boolean(s && s.pets.some(p => p.breed === b.id)), available: breedAvailable(b, profile), cost: breedCost(b), requirement: breedRequirement(b, profile) }));
  }
  /** Accesorios que tiene la cuenta y que le quedan a esa mascota, por ranura. */
  accessoriesFor(petId) {
    const s = this.state, pet = s && s.pets.find(p => p.id === petId); if (!pet) return {};
    const out = {}; for (const slot of Object.keys(PET_SLOTS)) if (slotFits(slot, pet.breed)) out[slot] = ITEMS.filter(i => i.slot === slot && s.inv[i.id]);
    return out;
  }
  /** Paseo con correa (solo perros con correa equipada). Los demás jugadores ven la correa. */
  async walk(on) {
    const pet = this.activePet;
    if (on && !(pet && breedById(pet.breed).species === 'perro')) return { ok: false, message: 'Solo los perros salen a pasear con correa.' };
    if (on && !pet.acc.leash) return { ok: false, message: 'Primero ponle una correa en «Mis mascotas».' };
    const r = await this.#ask('walk', { leash: Boolean(on) });
    if (r.ok) { this.leash = Boolean(r.leash); this.emit(); }
    return r;
  }

  /* ---------- casa y puestos ---------- */
  saveHome(layout) { return this.#ask('home', { layout }); }
  drink(flavor, mode, steps) { return this.#ask('drink', { flavor, mode, steps, rid: rid() }, 'drink'); }

  itemName(id) { return (itemById(id) || {}).name || id; }

  /* ---------- ropa de la tienda ---------- */
  /** Ranuras del equipamiento con una prenda de pago que la cuenta no tiene (vacío = se puede usar). */
  locked(custom) { return this.state ? lockedWear(custom, this.state.inv) : []; }
  /** Para el vestidor: { item, owned } de una prenda con precio, o null si es gratis. */
  wearInfo(slot, option) { const it = wearItemFor(slot, option); return it ? { item: it, owned: Boolean(this.state && this.state.inv[it.id]) } : null; }
}
