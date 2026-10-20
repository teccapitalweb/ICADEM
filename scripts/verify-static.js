'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const htmlFiles = ['vip-panel.html', 'vip-admin.html', 'vip-auth.html'];
let checked = 0;

for (const relative of htmlFiles) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const scripts = source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi);
  let inlineIndex = 0;
  for (const match of scripts) {
    inlineIndex += 1;
    const attributes = match[1] || '';
    const code = match[2] || '';
    if (/\bsrc\s*=|\btype\s*=\s*["']module["']/i.test(attributes) || !code.trim()) continue;
    new vm.Script(code, { filename: `${relative}:inline-${inlineIndex}` });
    checked += 1;
  }
}

if (!checked) throw new Error('No se encontraron scripts clásicos para validar');

const panelSource = fs.readFileSync(path.join(root, 'vip-panel.html'), 'utf8');
const libraryStart = panelSource.indexOf('// LIBROS · catálogo canjeable');
const libraryEnd = panelSource.indexOf('// MATERIALES ·', libraryStart);
if (libraryStart < 0 || libraryEnd < 0) throw new Error('No se encontró el bloque de Biblioteca');
const librarySource = panelSource.slice(libraryStart, libraryEnd);
if (/Biblioteca VIP|Activa tu membresía para canjear|modo !== 'vip'/.test(librarySource)) {
  throw new Error('Biblioteca no debe exigir membresía VIP para canjear');
}
if (!/state\.balance < book\.costo/.test(librarySource)) {
  throw new Error('Biblioteca debe validar el saldo antes del canje');
}

console.log(`OK: ${checked} scripts inline validados en ${htmlFiles.length} páginas.`);
