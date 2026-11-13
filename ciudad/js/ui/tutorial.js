// Tutorial de la primera vez: caminar, girar la cámara, interactuar y abrir el mapa.
// Se puede omitir y repetir desde Ajustes. La recompensa solo se entrega una vez.
import { REWARDS } from '../economy/economy.js';

const $ = id => document.getElementById(id);

export class Tutorial {
  constructor(api) {
    this.api = api;
    this.active = false;
    this.index = 0;
    this.base = null;
    $('coach-skip').addEventListener('click', () => this.finish(true));
  }

  #steps() {
    const touch = document.documentElement.classList.contains('is-touch');
    return [
      { title: 'Camina por tu habitación', text: touch ? 'Arrastra el dedo en la parte izquierda de la pantalla para moverte.' : 'Usa W, A, S, D o las flechas para moverte. Con Shift corres y con Espacio saltas.',
        done: s => s.walked > 1.8 },
      { title: 'Gira la cámara', text: touch ? 'Arrastra en la parte derecha de la pantalla para mirar alrededor.' : 'Mantén presionado el mouse y arrástralo para mirar alrededor. La rueda acerca y aleja.',
        done: s => s.turned > 1.1 },
      { title: 'Interactúa con algo', text: touch ? 'Acércate a un rombo dorado y toca el botón amarillo. Prueba con el espejo o el vestidor.' : 'Acércate a un rombo dorado y presiona E. Prueba con el espejo o el vestidor.',
        done: s => s.interactions > 0 },
      { title: 'Abre el mapa', text: touch ? 'Toca el botón de mapa, arriba a la derecha. Ahí eliges a dónde ir.' : 'Presiona M o el botón de mapa, arriba a la derecha. Ahí eliges a dónde ir.',
        done: s => s.maps > 0 }
    ];
  }

  start() {
    const a = this.api;
    this.active = true; this.index = 0;
    this.base = { walked: a.stats.walked, turned: a.camera.turned, interactions: a.stats.interactions, maps: a.stats.maps };
    this.steps = this.#steps(); this.touch = document.documentElement.classList.contains('is-touch');
    $('coach').hidden = false; this.#render();
  }

  #render() {
    const s = this.steps[this.index];
    $('coach-step').textContent = `Tutorial · paso ${this.index + 1} de ${this.steps.length}`;
    $('coach-title').textContent = s.title; $('coach-text').textContent = s.text;
  }

  update() {
    if (!this.active || this.api.ui.isBlocking) return;
    // Si el jugador resulta estar en pantalla táctil, las instrucciones cambian a las táctiles.
    const touch = document.documentElement.classList.contains('is-touch');
    if (touch !== this.touch) { this.touch = touch; this.steps = this.#steps(); this.#render(); }
    const a = this.api, b = this.base;
    const progress = { walked: a.stats.walked - b.walked, turned: a.camera.turned - b.turned, interactions: a.stats.interactions - b.interactions, maps: a.stats.maps - b.maps };
    if (!this.steps[this.index].done(progress)) return;
    this.index++;
    this.base = { walked: a.stats.walked, turned: a.camera.turned, interactions: a.stats.interactions, maps: a.stats.maps };
    if (this.index >= this.steps.length) this.finish(false); else this.#render();
  }

  async finish(skipped) {
    if (!this.active) return;
    this.active = false; $('coach').hidden = true;
    const { store, economy, ui } = this.api;
    const first = !store.state.tutorialDone;
    store.state.tutorialDone = true; store.save();
    if (this.api.net.isOnline) this.api.net.profile('tutorial');
    if (skipped) { ui.toast('Tutorial omitido. Puedes repetirlo desde Ajustes.'); return; }
    const grant = await economy.grant({ key: 'tutorial', amount: REWARDS.tutorial.amount, reason: 'Tutorial completado' });
    if (first) store.addXp(REWARDS.tutorial.xp);
    store.unlock('primeros-pasos');
    this.api.player.emote('celebrate', 2);
    ui.refreshHud();
    ui.toast(grant.granted ? `¡Tutorial completado! +${grant.amount} créditos de prueba` : '¡Tutorial completado!');
    ui.toast('Sal por la puerta roja para conocer la ciudad.', 5200);
  }
}
