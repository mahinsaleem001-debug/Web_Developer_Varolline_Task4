/*
 * cart.js: pure shopping-cart logic (no DOM, no storage).
 * A cart is just an array of { id, qty }. Every function returns a NEW array,
 * so the UI can never end up with a half-changed cart.
 * Money is handled in whole cents to avoid floating point mistakes (0.1 + 0.2).
 */
(function (root) {
  'use strict';

  const NS = (root.Bazaarly = root.Bazaarly || {});

  const STORAGE_KEY = 'bazaarly-cart-v1';
  const MAX_QTY = 10;                  // most of one product per order
  const FREE_SHIPPING_CENTS = 10000;   // free shipping from $100
  const SHIPPING_CENTS = 699;          // flat rate below that

  /** How many of this product can go in the cart: limited by stock and by MAX_QTY. */
  const maxFor = (product) => Math.max(0, Math.min(product.stock, MAX_QTY));

  /**
   * Add `qty` of a product. Never goes above maxFor(product).
   * Returns { items, added, capped }: `added` is how many were really added,
   * `capped` is true when the limit stopped us from adding all of them.
   */
  function addItem(items, product, qty = 1) {
    const max = maxFor(product);
    const want = Math.max(1, Math.floor(qty) || 1);
    const existing = items.find((i) => i.id === product.id);
    const current = existing ? existing.qty : 0;
    const next = Math.min(max, current + want);
    const added = next - current;
    if (added <= 0) return { items, added: 0, capped: true };
    const updated = existing
      ? items.map((i) => (i.id === product.id ? { ...i, qty: next } : i))
      : [...items, { id: product.id, qty: next }];
    return { items: updated, added, capped: added < want };
  }

  /** Set an exact quantity (clamped between 1 and the limit). Unknown ids are ignored. */
  function setQty(items, product, qty) {
    if (!items.some((i) => i.id === product.id)) return items;
    const max = maxFor(product);
    if (max === 0) return removeItem(items, product.id);
    const next = Math.min(max, Math.max(1, Math.floor(qty) || 1));
    return items.map((i) => (i.id === product.id ? { ...i, qty: next } : i));
  }

  const removeItem = (items, id) => items.filter((i) => i.id !== id);

  /**
   * Work out what the shopper sees: lines, item count, subtotal, shipping, total.
   * Lines for products that no longer exist in the catalogue are ignored.
   */
  function summarize(items, byId) {
    const lines = [];
    items.forEach((i) => {
      const product = byId[i.id];
      if (product) lines.push({ product, qty: i.qty, lineCents: product.priceCents * i.qty });
    });
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotalCents = lines.reduce((n, l) => n + l.lineCents, 0);
    const shippingCents = subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_CENTS;
    return {
      lines,
      count,
      subtotalCents,
      shippingCents,
      totalCents: subtotalCents + shippingCents,
      toFreeShippingCents: subtotalCents === 0 ? FREE_SHIPPING_CENTS : Math.max(0, FREE_SHIPPING_CENTS - subtotalCents),
      freeShipping: subtotalCents >= FREE_SHIPPING_CENTS,
    };
  }

  /**
   * Make saved data safe to use. localStorage can hold anything (old versions,
   * edited by hand, corrupted), so we keep only valid lines for known products
   * and fix their quantities.
   */
  function sanitize(raw, byId) {
    if (!Array.isArray(raw)) return [];
    const merged = new Map();
    raw.forEach((entry) => {
      if (!entry || typeof entry.id !== 'string') return;
      const product = byId[entry.id];
      if (!product) return;
      const max = maxFor(product);
      if (max === 0) return;
      const qty = Math.min(max, Math.max(1, Math.floor(Number(entry.qty)) || 1));
      merged.set(entry.id, Math.min(max, (merged.get(entry.id) || 0) + qty));
    });
    return [...merged].map(([id, qty]) => ({ id, qty }));
  }

  const api = {
    STORAGE_KEY,
    MAX_QTY,
    FREE_SHIPPING_CENTS,
    SHIPPING_CENTS,
    maxFor,
    addItem,
    setQty,
    removeItem,
    summarize,
    sanitize,
  };

  NS.cart = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
