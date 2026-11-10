// Colisiones 2D sobre el plano XZ: el jugador es un círculo que se empuja fuera de
// cajas alineadas a los ejes y de círculos. Módulo puro (sin Three.js) para poder probarlo.

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.circles = [];
    this.bounds = null;
  }

  addBox(minX, minZ, maxX, maxZ) {
    this.boxes.push({ minX: Math.min(minX, maxX), minZ: Math.min(minZ, maxZ), maxX: Math.max(minX, maxX), maxZ: Math.max(minZ, maxZ) });
    return this;
  }

  /** Caja a partir de su centro y tamaño. */
  addBoxAt(cx, cz, w, d) {
    return this.addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
  }

  addCircle(x, z, r) {
    this.circles.push({ x, z, r });
    return this;
  }

  setBounds(minX, minZ, maxX, maxZ) {
    this.bounds = { minX, minZ, maxX, maxZ };
    return this;
  }

  /** Devuelve la posición corregida para un círculo de radio r. */
  resolve(x, z, r) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const b of this.boxes) {
        const cx = Math.max(b.minX, Math.min(x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        let dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = r - d;
          x += (dx / d) * push; z += (dz / d) * push;
        } else {
          // El centro quedó dentro de la caja: salir por el lado más cercano.
          const left = x - b.minX, right = b.maxX - x, top = z - b.minZ, bottom = b.maxZ - z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) x = b.minX - r; else if (m === right) x = b.maxX + r;
          else if (m === top) z = b.minZ - r; else z = b.maxZ + r;
        }
        moved = true;
      }
      for (const c of this.circles) {
        let dx = x - c.x, dz = z - c.z;
        const min = r + c.r, d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        if (d2 < 1e-10) { dx = 1; dz = 0; }
        const d = Math.sqrt(dx * dx + dz * dz);
        x = c.x + (dx / d) * min; z = c.z + (dz / d) * min;
        moved = true;
      }
      if (!moved) break;
    }
    if (this.bounds) {
      x = Math.max(this.bounds.minX + r, Math.min(this.bounds.maxX - r, x));
      z = Math.max(this.bounds.minZ + r, Math.min(this.bounds.maxZ - r, z));
    }
    return { x, z };
  }

  /** ¿El punto (con radio) está libre? Útil para pruebas y para colocar objetos. */
  isFree(x, z, r) {
    const p = this.resolve(x, z, r);
    return Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6;
  }
}
