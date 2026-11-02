import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POLYFILL = `
// Antigravity TC39 proposal polyfills for pdfjs-dist
if (typeof Uint8Array !== 'undefined' && typeof Uint8Array.prototype.toHex !== 'function') {
  Uint8Array.prototype.toHex = function() {
    return Array.from(this, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  };
}
if (typeof Map !== 'undefined' && typeof Map.prototype.getOrInsertComputed !== 'function') {
  Map.prototype.getOrInsertComputed = function(key, callbackFn) {
    if (this.has(key)) return this.get(key);
    var value = callbackFn(key);
    this.set(key, value);
    return value;
  };
}
if (typeof Map !== 'undefined' && typeof Map.prototype.getOrInsert !== 'function') {
  Map.prototype.getOrInsert = function(key, defaultValue) {
    if (this.has(key)) return this.get(key);
    this.set(key, defaultValue);
    return defaultValue;
  };
}
if (typeof Math !== 'undefined' && typeof Math.sumPrecise !== 'function') {
  Math.sumPrecise = function(items) {
    var sum = 0;
    if (items && typeof items[Symbol.iterator] === 'function') {
      var it = items[Symbol.iterator]();
      var step;
      while (!(step = it.next()).done) {
        sum += Number(step.value) || 0;
      }
    } else if (Array.isArray(items)) {
      for (var i = 0; i < items.length; i++) {
        sum += Number(items[i]) || 0;
      }
    }
    return sum;
  };
}
if (typeof Promise !== 'undefined' && typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function() {
    var a, b;
    var c = new Promise(function(res, rej) { a = res; b = rej; });
    return { promise: c, resolve: a, reject: b };
  };
}
`;

const filesToPatch = [
  path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
  path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs'),
  path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.mjs'),
  path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.mjs'),
];

for (const filePath of filesToPatch) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('Antigravity TC39 proposal polyfills')) {
      fs.writeFileSync(filePath, POLYFILL + '\n' + content, 'utf8');
      console.log(`[patch-pdfjs] Patched ${path.basename(filePath)}`);
    } else {
      console.log(`[patch-pdfjs] Already patched ${path.basename(filePath)}`);
    }
  }
}

