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
console.log(`OK: ${checked} scripts inline validados en ${htmlFiles.length} páginas.`);
