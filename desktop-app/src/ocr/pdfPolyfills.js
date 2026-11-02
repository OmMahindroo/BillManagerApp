/**
 * Polyfills for modern JavaScript proposals used by pdfjs-dist v6+
 * Ensures 100% compatibility across Chrome, Edge, Safari, Firefox, and WebViews.
 */

export const POLYFILLS_SOURCE = `
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

export function applyPolyfills() {
  if (typeof globalThis !== 'undefined') {
    if (typeof globalThis.Uint8Array !== 'undefined' && typeof globalThis.Uint8Array.prototype.toHex !== 'function') {
      globalThis.Uint8Array.prototype.toHex = function() {
        return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('');
      };
    }
    if (typeof globalThis.Map !== 'undefined' && typeof globalThis.Map.prototype.getOrInsertComputed !== 'function') {
      globalThis.Map.prototype.getOrInsertComputed = function(key, callbackFn) {
        if (this.has(key)) return this.get(key);
        const value = callbackFn(key);
        this.set(key, value);
        return value;
      };
    }
    if (typeof globalThis.Map !== 'undefined' && typeof globalThis.Map.prototype.getOrInsert !== 'function') {
      globalThis.Map.prototype.getOrInsert = function(key, defaultValue) {
        if (this.has(key)) return this.get(key);
        this.set(key, defaultValue);
        return defaultValue;
      };
    }
    if (typeof Math.sumPrecise !== 'function') {
      Math.sumPrecise = function(items) {
        let sum = 0;
        for (const n of items) {
          sum += Number(n) || 0;
        }
        return sum;
      };
    }
    if (typeof Promise.withResolvers !== 'function') {
      Promise.withResolvers = function() {
        let a, b;
        const c = new Promise((res, rej) => { a = res; b = rej; });
        return { promise: c, resolve: a, reject: b };
      };
    }
  }
}

// Apply immediately in current execution scope
applyPolyfills();

