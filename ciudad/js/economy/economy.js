// Economía de Ciudad ICADEM.
//
// REGLA: el juego no crea una moneda nueva. En producción usará la cartera real de ICADEM
// a través del backend. Durante el prototipo (Fase 1) la economía es de PRUEBA y está aislada:
// no llama a ningún servicio de créditos y no puede modificar saldos reales.
//
// Las dos implementaciones cumplen la misma interfaz, así el resto del juego no cambia
// cuando se active la cartera real:
//   getBalance(): Promise<number>
//   grant({ key, amount, reason }): Promise<{ granted, amount, balance, duplicate }>
//   history(): Promise<Array>
//   readonly isTest: boolean

/** Recompensas del prototipo. En producción las define administración desde el backend. */
export const REWARDS = Object.freeze({
  tutorial: { amount: 10, xp: 40 },
  'banco-credito-correcto': { amount: 15, xp: 120, repeatXp: 30 },
  'tribunal-tu-eres-el-juez': { amount: 20, xp: 160, repeatXp: 40 },
  'super-rescate-inventario': { amount: 20, xp: 160, repeatXp: 40 },
  'obra-inspector-seguridad': { amount: 20, xp: 160, repeatXp: 40 },
  'hospital-turno-decisiones': { amount: 20, xp: 160, repeatXp: 40 },
  'vet-guardianes-bienestar': { amount: 20, xp: 160, repeatXp: 40 }
});

export class TestEconomy {
  constructor(store) {
    this.store = store;
    this.isTest = true;
  }

  async getBalance() { return this.store.state.economy.balance; }

  async history() { return [...this.store.state.economy.ledger]; }

  /**
   * Idempotente: la misma `key` nunca acredita dos veces, aunque se repita la llamada
   * (doble toque, reintento, recarga). Es el mismo contrato que tendrá el servidor.
   */
  async grant({ key, amount, reason }) {
    const eco = this.store.state.economy;
    const value = Math.round(Number(amount));
    if (!key || !Number.isFinite(value) || value <= 0 || value > 100) {
      return { granted: false, amount: 0, balance: eco.balance, duplicate: false, error: 'invalid' };
    }
    if (eco.ledger.some(entry => entry.key === key)) {
      return { granted: false, amount: 0, balance: eco.balance, duplicate: true };
    }
    eco.ledger.push({ key, amount: value, reason: String(reason || ''), at: new Date().toISOString(), test: true });
    eco.balance += value;
    this.store.save();
    return { granted: true, amount: value, balance: eco.balance, duplicate: false };
  }
}

/**
 * Cartera real de ICADEM. DESACTIVADA en el prototipo a propósito.
 *
 * Contrato que necesita el backend (icadem-webhook) antes de activarla:
 *   GET  /api/credits/wallet                      → saldo actual (ya existe)
 *   POST /api/ciudad/missions/complete            → el servidor valida la prueba de la misión,
 *        body { missionId, attemptId, proof }       acredita una sola vez con un id de ledger estable
 *                                                   (uid + missionId) y responde { granted, amount, balance }.
 * El navegador nunca envía el monto: lo decide el servidor.
 */
export class IcademWalletEconomy {
  constructor() { this.isTest = false; }
  async getBalance() { throw new Error('La cartera real está desactivada en el prototipo.'); }
  async history() { throw new Error('La cartera real está desactivada en el prototipo.'); }
  async grant() { throw new Error('La cartera real está desactivada en el prototipo.'); }
}

export function createEconomy(store, mode = 'test') {
  if (mode !== 'test') throw new Error('Solo la economía de prueba está habilitada en la Fase 1.');
  return new TestEconomy(store);
}
