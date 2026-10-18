/*
 * catalog.js: pure product helpers (no DOM).
 * Search, category filter, sorting, related products, URL query and formatting.
 * Kept free of browser code so it can be unit-tested with Node.
 */
(function (root) {
  'use strict';

  const NS = (root.Bazaarly = root.Bazaarly || {});

  const SORTS = {
    featured: 'Featured',
    'price-asc': 'Price: Low to High',
    'price-desc': 'Price: High to Low',
    rating: 'Top rated',
    name: 'Name: A to Z',
  };

  const lower = (v) => String(v == null ? '' : v).toLowerCase();

  /** Turn the raw JSON list into clean product objects. Bad rows are skipped. */
  function normalizeProducts(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    raw.forEach((p, index) => {
      if (!p || typeof p !== 'object') return;
      const id = typeof p.id === 'string' ? p.id.trim() : '';
      const name = typeof p.name === 'string' ? p.name.trim() : '';
      const price = Number(p.price);
      if (!id || !name || !Number.isFinite(price) || price < 0 || seen.has(id)) return;
      seen.add(id);
      const compareAt = Number(p.compareAt);
      out.push({
        id,
        name,
        category: typeof p.category === 'string' && p.category.trim() ? p.category.trim() : 'Other',
        priceCents: Math.round(price * 100),
        compareAtCents: Number.isFinite(compareAt) && compareAt > price ? Math.round(compareAt * 100) : null,
        rating: Math.min(5, Math.max(0, Number(p.rating) || 0)),
        reviews: Math.max(0, Math.floor(Number(p.reviews) || 0)),
        stock: Math.max(0, Math.floor(Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0)),
        badge: typeof p.badge === 'string' ? p.badge : '',
        description: typeof p.description === 'string' ? p.description : '',
        features: Array.isArray(p.features) ? p.features.filter((f) => typeof f === 'string') : [],
        art: typeof p.art === 'string' ? p.art : '',
        colors: Array.isArray(p.colors) ? p.colors : [],
        image: typeof p.image === 'string' ? p.image : '',
        order: index, // keeps the "Featured" order stable
      });
    });
    return out;
  }

  function categoriesOf(list) {
    const seen = [];
    list.forEach((p) => { if (!seen.includes(p.category)) seen.push(p.category); });
    return seen;
  }

  /** Every word the shopper types must appear somewhere in the product text. */
  function matchesSearch(p, terms) {
    if (!terms.length) return true;
    const hay = lower([p.name, p.category, p.description, p.features.join(' ')].join(' '));
    return terms.every((t) => hay.includes(t));
  }

  function splitTerms(q) {
    return lower(q).split(/\s+/).filter(Boolean);
  }

  function sortProducts(list, sort) {
    const byName = (a, b) => a.name.localeCompare(b.name);
    const featured = (a, b) => a.order - b.order;
    const cmp = {
      featured,
      'price-asc': (a, b) => a.priceCents - b.priceCents || byName(a, b),
      'price-desc': (a, b) => b.priceCents - a.priceCents || byName(a, b),
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews || byName(a, b),
      name: byName,
    }[SORTS[sort] ? sort : 'featured'];
    return [...list].sort(cmp);
  }

  /** Search + category filter + sort, in that order. Returns a new array. */
  function queryProducts(list, { q = '', category = 'all', sort = 'featured' } = {}) {
    const terms = splitTerms(q);
    const filtered = list.filter(
      (p) => (category === 'all' || p.category === category) && matchesSearch(p, terms)
    );
    return sortProducts(filtered, sort);
  }

  /** Counts per category for the current search text (so chips show what you would get). */
  function categoryCounts(list, q = '') {
    const terms = splitTerms(q);
    const counts = { all: 0 };
    list.forEach((p) => {
      if (!matchesSearch(p, terms)) return;
      counts.all += 1;
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }

  /** Other products from the same category, best rated first. */
  function relatedProducts(list, product, n = 4) {
    return list
      .filter((p) => p.category === product.category && p.id !== product.id)
      .sort((a, b) => b.rating - a.rating || a.order - b.order)
      .slice(0, n);
  }

  /* ---------- URL query (#/?q=lamp&category=Home%20%26%20Living&sort=price-asc) ---------- */

  const DEFAULT_VIEW = { q: '', category: 'all', sort: 'featured' };

  function parseQuery(str, categories = []) {
    let params;
    try { params = new URLSearchParams(str || ''); } catch (e) { params = new URLSearchParams(''); }
    const category = params.get('category');
    const sort = params.get('sort');
    return {
      q: (params.get('q') || '').slice(0, 80),
      category: category && categories.includes(category) ? category : 'all',
      sort: sort && SORTS[sort] ? sort : 'featured',
    };
  }

  function buildQuery(view) {
    const params = new URLSearchParams();
    Object.keys(DEFAULT_VIEW).forEach((k) => {
      if (view[k] != null && String(view[k]).trim() !== '' && view[k] !== DEFAULT_VIEW[k]) params.set(k, view[k]);
    });
    return params.toString();
  }

  /* ---------- formatting ---------- */

  function formatPrice(cents) {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(Math.round(cents));
    const dollars = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
  }

  const starPercent = (rating) => Math.max(0, Math.min(5, rating)) * 20;

  const discountPercent = (p) =>
    p.compareAtCents ? Math.round(((p.compareAtCents - p.priceCents) / p.compareAtCents) * 100) : 0;

  const api = {
    SORTS,
    DEFAULT_VIEW,
    normalizeProducts,
    categoriesOf,
    queryProducts,
    categoryCounts,
    relatedProducts,
    parseQuery,
    buildQuery,
    formatPrice,
    starPercent,
    discountPercent,
  };

  NS.catalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
