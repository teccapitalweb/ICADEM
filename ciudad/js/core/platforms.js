// Ciudad ICADEM · plataformas con altura (para el Parque de retos). Módulo puro.
// El mundo de colisiones del juego es plano (2D); las plataformas agregan un piso a cierta altura:
// se puede subir saltando, caminar encima y caer por la orilla. Desde abajo funcionan como muro.
//   plataforma: { x, z, w, d, top }  (centro, ancho en x, fondo en z y altura de la cara superior)

const STEP = 0.3;   // escalón que se sube sin saltar

/** Altura del piso bajo (x, z) para alguien que está a la altura y (0 = suelo). */
export function groundHeight(platforms, x, z, y, r = 0.22) {
  let g = 0;
  for (const p of platforms) {
    if (Math.abs(x - p.x) <= p.w / 2 + r && Math.abs(z - p.z) <= p.d / 2 + r && p.top <= y + STEP && p.top > g) g = p.top;
  }
  return g;
}

/** Empuja al jugador fuera de las plataformas que tiene enfrente y que no alcanza (las choca de lado). */
export function pushOut(platforms, pos, radius) {
  let hit = false;
  for (const p of platforms) {
    if (pos.y >= p.top - STEP) continue;
    const hx = p.w / 2 + radius, hz = p.d / 2 + radius, dx = pos.x - p.x, dz = pos.z - p.z;
    if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;
    const px = hx - Math.abs(dx), pz = hz - Math.abs(dz);
    if (px < pz) pos.x = p.x + Math.sign(dx || 1) * hx; else pos.z = p.z + Math.sign(dz || 1) * hz;
    hit = true;
  }
  return hit;
}
