/*
 * app.js: the Bazaarly storefront UI.
 * Routes (hash based, so it works on GitHub Pages without a server):
 *   #/                 product listing   (#/?q=lamp&category=Fashion&sort=price-asc)
 *   #/product/<id>     product details
 *   #/cart             shopping cart
 * All text goes in through textContent (the el() helper), never innerHTML.
 */
(function () {
  'use strict';

  const { catalog: C, cart: K, art: ART } = window.Bazaarly;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------------- tiny DOM helpers ---------------- */

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => { if (c != null && c !== false) n.append(c); });
    return n;
  }

  function icon(name, cls) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const money = C.formatPrice;

  /* ---------------- state ---------------- */

  const state = {
    products: [],
    byId: {},
    categories: [],
    view: { ...C.DEFAULT_VIEW },
    cart: [],
    loaded: false,
    error: '',
  };

  const main = $('#main');
  let listRefs = null; // pieces of the listing page that are updated in place
  let detailQty = 1;

  /* ---------------- storage (safe: can fail in private mode) ---------------- */

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(K.STORAGE_KEY) || '[]');
      return K.sanitize(raw, state.byId);
    } catch (e) { return []; }
  }

  function saveCart() {
    try { localStorage.setItem(K.STORAGE_KEY, JSON.stringify(state.cart)); } catch (e) { /* ignore */ }
  }

  function setCart(items) {
    state.cart = items;
    saveCart();
    onCartChanged();
  }

  /* ---------------- announcements ---------------- */

  function announce(msg) {
    const sr = $('#sr-live');
    sr.textContent = '';
    setTimeout(() => { sr.textContent = msg; }, 30);
  }

  let toastTimer = 0;
  function toast(message, action) {
    const box = $('#toasts');
    box.textContent = '';
    clearTimeout(toastTimer);
    const t = el('div', { class: 'toast' }, el('span', { text: message }));
    if (action) {
      t.append(el('button', { type: 'button', class: 'toast-action', text: action.label, onclick: () => { action.run(); box.textContent = ''; } }));
    }
    t.append(el('button', { type: 'button', class: 'toast-x', 'aria-label': 'Dismiss', onclick: () => { box.textContent = ''; } }, icon('x')));
    box.append(t);
    toastTimer = setTimeout(() => { box.textContent = ''; }, 5000);
    announce(message);
  }

  /* ---------------- reusable pieces ---------------- */

  function productArt(p, cls) {
    const wrap = el('div', { class: 'art-wrap' + (cls ? ' ' + cls : '') });
    if (p.image) {
      const img = el('img', { src: p.image, alt: p.name, loading: 'lazy' });
      img.addEventListener('error', () => { wrap.textContent = ''; wrap.append(ART.createArt(p.art, p.colors, p.name)); });
      wrap.append(img);
    } else {
      wrap.append(ART.createArt(p.art, p.colors, p.name));
    }
    return wrap;
  }

  function stars(rating, reviews) {
    return el('div', { class: 'rating', role: 'img', 'aria-label': `Rated ${rating.toFixed(1)} out of 5 from ${reviews} reviews` },
      el('span', { class: 'stars', 'aria-hidden': 'true', style: `--pct:${C.starPercent(rating)}%` }),
      el('span', { class: 'rating-text', text: `${rating.toFixed(1)} (${reviews.toLocaleString('en-US')})` })
    );
  }

  function priceBlock(p, big) {
    const off = C.discountPercent(p);
    return el('div', { class: 'price' + (big ? ' price-big' : '') },
      el('span', { class: 'price-now', text: money(p.priceCents) }),
      p.compareAtCents ? el('s', { class: 'price-was', text: money(p.compareAtCents) }) : null,
      off ? el('span', { class: 'off', text: `-${off}%` }) : null
    );
  }

  function badgeFor(p) {
    if (p.stock === 0) return el('span', { class: 'tag tag-out', text: 'Sold out' });
    if (p.badge) return el('span', { class: 'tag tag-' + p.badge.toLowerCase().replace(/\s+/g, '-'), text: p.badge });
    return null;
  }

  function inCartQty(id) {
    const line = state.cart.find((i) => i.id === id);
    return line ? line.qty : 0;
  }

  function addToCart(p, qty = 1) {
    const r = K.addItem(state.cart, p, qty);
    if (r.added === 0) {
      toast(p.stock === 0 ? `${p.name} is sold out.` : `You already have the most you can order of ${p.name} (${K.maxFor(p)}).`);
      return;
    }
    setCart(r.items);
    toast(
      r.capped ? `Added ${r.added} (limit reached): ${p.name}` : `Added to cart: ${p.name}`,
      { label: 'View cart', run: () => { location.hash = '#/cart'; } }
    );
  }

  function stepper(value, max, onChange, keyPrefix, label) {
    const input = el('input', {
      class: 'qty-input', type: 'number', inputmode: 'numeric', min: 1, max, value,
      'aria-label': `Quantity${label ? ' of ' + label : ''}`, 'data-key': keyPrefix + '-input',
    });
    const commit = () => {
      const n = Math.floor(Number(input.value));
      onChange(Number.isFinite(n) ? n : value);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    return el('div', { class: 'stepper' },
      el('button', {
        type: 'button', class: 'step-btn', 'aria-label': `Decrease quantity${label ? ' of ' + label : ''}`,
        'data-key': keyPrefix + '-dec', disabled: value <= 1, onclick: () => onChange(value - 1),
      }, icon('minus')),
      input,
      el('button', {
        type: 'button', class: 'step-btn', 'aria-label': `Increase quantity${label ? ' of ' + label : ''}`,
        'data-key': keyPrefix + '-inc', disabled: value >= max, onclick: () => onChange(value + 1),
      }, icon('plus'))
    );
  }

  /* ---------------- header ---------------- */

  function cartSummary() { return K.summarize(state.cart, state.byId); }

  function updateHeader() {
    const { count } = cartSummary();
    const badge = $('#cart-badge');
    const link = $('#cart-link');
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? '99+' : String(count);
    link.setAttribute('aria-label', `Cart, ${count} ${count === 1 ? 'item' : 'items'}`);
  }

  function bumpBadge() {
    const badge = $('#cart-badge');
    badge.classList.remove('bump');
    void badge.offsetWidth; // restart the animation
    badge.classList.add('bump');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('bazaarly-theme', theme); } catch (e) { /* ignore */ }
    const btn = $('#theme-btn');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    btn.textContent = '';
    btn.append(icon(theme === 'dark' ? 'sun' : 'moon'));
  }

  /* ---------------- listing page ---------------- */

  function currentRoute() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const qi = hash.indexOf('?');
    const path = qi === -1 ? hash : hash.slice(0, qi);
    const query = qi === -1 ? '' : hash.slice(qi + 1);
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'product' && parts[1]) return { name: 'product', id: decodeURIComponent(parts[1]) };
    if (parts[0] === 'cart') return { name: 'cart' };
    return { name: 'list', query };
  }

  function writeViewToUrl() {
    const qs = C.buildQuery(state.view);
    const next = '#/' + (qs ? '?' + qs : '');
    if (location.hash !== next) history.replaceState(null, '', next); // no re-render, keeps typing focus
  }

  function setView(patch) {
    state.view = { ...state.view, ...patch };
    if (currentRoute().name !== 'list') {
      const qs = C.buildQuery(state.view);
      location.hash = '#/' + (qs ? '?' + qs : ''); // router will render the list
      return;
    }
    writeViewToUrl();
    updateResults();
  }

  function buildList() {
    main.textContent = '';
    main.setAttribute('data-view', 'list');

    const hero = el('section', { class: 'hero' },
      el('div', { class: 'hero-copy' },
        el('p', { class: 'eyebrow', text: 'New season · Free shipping over $100' }),
        el('h1', { id: 'page-title', tabindex: '-1', text: 'Everyday things, beautifully chosen.' }),
        el('p', { class: 'lead', text: 'Electronics, fashion, home and accessories. Search, filter and sort to find what you need, then add it to your cart.' })
      ),
      el('ul', { class: 'perks' },
        el('li', {}, icon('truck'), el('span', { text: 'Free shipping over $100' })),
        el('li', {}, icon('return'), el('span', { text: '30-day easy returns' })),
        el('li', {}, icon('shield'), el('span', { text: 'Secure checkout' }))
      )
    );

    const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by category' });
    const sortSelect = el('select', { id: 'sort', onchange: (e) => setView({ sort: e.target.value }) },
      Object.keys(C.SORTS).map((k) => el('option', { value: k, text: C.SORTS[k] }))
    );
    const count = el('p', { class: 'count', 'aria-live': 'polite' });
    const clear = el('button', { type: 'button', class: 'link-btn', text: 'Clear all filters', onclick: resetFilters, hidden: true });
    const grid = el('div', { class: 'grid', role: 'list', 'aria-label': 'Products' });
    const empty = el('div', { class: 'empty', hidden: true },
      ART.createArt('sunglasses', ['#e0e7ff', '#c7d2fe', '#4338ca'], ''),
      el('h2', { text: 'No products found' }),
      el('p', { text: 'Try a different word, or remove a filter.' }),
      el('button', { type: 'button', class: 'btn btn-primary', text: 'Show all products', onclick: resetFilters })
    );
    empty.firstChild.setAttribute('aria-hidden', 'true');

    const toolbar = el('div', { class: 'toolbar' },
      chips,
      el('div', { class: 'sort' }, el('label', { for: 'sort', text: 'Sort by' }), sortSelect)
    );
    main.append(hero, toolbar, el('div', { class: 'results-bar' }, count, clear), grid, empty);

    // One card per product, created once. Filtering only shows/reorders them.
    const cards = new Map();
    state.products.forEach((p) => cards.set(p.id, buildCard(p)));
    listRefs = { chips, sortSelect, count, clear, grid, empty, cards };
  }

  function buildCard(p) {
    const pill = el('span', { class: 'in-cart', hidden: true });
    const btn = el('button', { type: 'button', class: 'btn btn-add', onclick: () => addToCart(p) });
    const link = el('a', { class: 'card-link', href: '#/product/' + encodeURIComponent(p.id), 'aria-label': `${p.name}, ${money(p.priceCents)}` },
      productArt(p), badgeFor(p));
    const card = el('article', { class: 'card', role: 'listitem' },
      link,
      el('div', { class: 'card-body' },
        el('p', { class: 'card-cat', text: p.category }),
        el('h3', { class: 'card-name' }, el('a', { href: '#/product/' + encodeURIComponent(p.id), text: p.name })),
        stars(p.rating, p.reviews),
        el('div', { class: 'card-foot' }, priceBlock(p), btn)
      ),
      pill
    );
    card._refs = { btn, pill };
    return card;
  }

  function syncCardState(card, p) {
    const q = inCartQty(p.id);
    const { btn, pill } = card._refs;
    const out = p.stock === 0;
    const full = !out && q >= K.maxFor(p);
    btn.disabled = out || full;
    btn.textContent = '';
    if (out) btn.append('Sold out');
    else if (full) btn.append(icon('check'), 'Max in cart');
    else btn.append(icon('plus'), 'Add');
    btn.setAttribute('aria-label', out ? `${p.name} is sold out` : full ? `Maximum quantity of ${p.name} is in your cart` : `Add ${p.name} to cart`);
    pill.hidden = q === 0;
    pill.textContent = q ? `${q} in cart` : '';
  }

  function resetFilters() {
    state.view = { ...C.DEFAULT_VIEW };
    $('#search').value = '';
    writeViewToUrl();
    updateResults();
  }

  function updateResults() {
    if (!listRefs) return;
    const { chips, sortSelect, count, clear, grid, empty, cards } = listRefs;
    const v = state.view;
    const results = C.queryProducts(state.products, v);
    const counts = C.categoryCounts(state.products, v.q);

    chips.textContent = '';
    ['all', ...state.categories].forEach((cat) => {
      const active = v.category === cat;
      chips.append(el('button', {
        type: 'button', class: 'chip' + (active ? ' active' : ''), 'aria-pressed': String(active),
        onclick: () => setView({ category: cat }),
      }, cat === 'all' ? 'All' : cat, el('span', { class: 'chip-n', text: String(counts[cat] || 0) })));
    });

    sortSelect.value = v.sort;
    grid.textContent = '';
    results.forEach((p) => {
      const card = cards.get(p.id);
      syncCardState(card, p);
      grid.append(card);
    });
    const filtering = v.q.trim() !== '' || v.category !== 'all';
    empty.hidden = results.length > 0;
    grid.hidden = results.length === 0;
    clear.hidden = !filtering;
    count.textContent = `${results.length} ${results.length === 1 ? 'product' : 'products'}` +
      (v.q.trim() ? ` for “${v.q.trim()}”` : '') + (v.category !== 'all' ? ` in ${v.category}` : '');
  }

  /* ---------------- product page ---------------- */

  function renderProduct(id) {
    const p = state.byId[id];
    main.textContent = '';
    main.setAttribute('data-view', 'product');
    listRefs = null;

    if (!p) {
      main.append(notFound('Product not found', 'That product does not exist or was removed.'));
      document.title = 'Product not found | Bazaarly';
      return;
    }
    document.title = `${p.name} | Bazaarly`;
    const max = K.maxFor(p);
    const owned = inCartQty(p.id);
    const room = Math.max(0, max - owned);
    detailQty = Math.min(Math.max(1, detailQty), Math.max(1, room));

    const crumbs = el('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      el('a', { href: '#/', text: 'Shop' }), el('span', { 'aria-hidden': 'true', text: '/' }),
      el('a', { href: '#/?category=' + encodeURIComponent(p.category), text: p.category }), el('span', { 'aria-hidden': 'true', text: '/' }),
      el('span', { 'aria-current': 'page', text: p.name })
    );

    let stock;
    if (p.stock === 0) stock = el('p', { class: 'stock stock-out', text: 'Out of stock' });
    else if (p.stock <= 10) stock = el('p', { class: 'stock stock-low', text: `Only ${p.stock} left, order soon` });
    else stock = el('p', { class: 'stock stock-ok' }, icon('check'), 'In stock, ships in 1 to 2 days');

    const buy = el('div', { class: 'buy' });
    const qtyHolder = el('div', { class: 'qty-holder' });
    const addBtn = el('button', { type: 'button', class: 'btn btn-primary btn-lg' });

    const refreshBuy = () => {
      qtyHolder.textContent = '';
      if (p.stock === 0 || room === 0) {
        addBtn.disabled = true;
        addBtn.textContent = p.stock === 0 ? 'Sold out' : 'Maximum already in cart';
        return;
      }
      addBtn.disabled = false;
      addBtn.textContent = '';
      addBtn.append(icon('bag'), `Add to cart · ${money(p.priceCents * detailQty)}`);
      qtyHolder.append(stepper(detailQty, room, (n) => {
        detailQty = Math.min(room, Math.max(1, n));
        refreshBuy();
        const key = document.activeElement && document.activeElement.getAttribute('data-key');
        const target = $(`[data-key="${key}"]`, qtyHolder) || $('[data-key="detail-input"]', qtyHolder);
        if (target && key) target.focus();
      }, 'detail', p.name));
    };
    addBtn.addEventListener('click', () => {
      addToCart(p, detailQty);
      detailQty = 1;
      renderProduct(p.id);
      const again = $('.buy .btn');
      if (again) again.focus();
    });
    refreshBuy();

    buy.append(qtyHolder, addBtn);

    const info = el('div', { class: 'detail-info' },
      el('p', { class: 'card-cat', text: p.category }),
      el('h1', { id: 'page-title', tabindex: '-1', text: p.name }),
      stars(p.rating, p.reviews),
      priceBlock(p, true),
      el('p', { class: 'desc', text: p.description }),
      p.features.length ? el('ul', { class: 'features' }, p.features.map((f) => el('li', {}, icon('check'), f))) : null,
      stock,
      buy,
      owned ? el('p', { class: 'owned' }, `${owned} already in your cart · `, el('a', { href: '#/cart', text: 'View cart' })) : null,
      el('ul', { class: 'perks perks-col' },
        el('li', {}, icon('truck'), el('span', { text: 'Free shipping on orders over $100' })),
        el('li', {}, icon('return'), el('span', { text: '30-day easy returns' })),
        el('li', {}, icon('shield'), el('span', { text: 'Secure checkout' }))
      )
    );

    const gallery = el('div', { class: 'gallery' }, productArt(p, 'art-lg'), badgeFor(p));
    main.append(crumbs, el('section', { class: 'detail' }, gallery, info));

    const rel = C.relatedProducts(state.products, p, 4);
    if (rel.length) {
      const grid = el('div', { class: 'grid', role: 'list' });
      rel.forEach((r) => { const c = buildCard(r); syncCardState(c, r); grid.append(c); });
      main.append(el('section', { class: 'related' }, el('h2', { text: 'You might also like' }), grid));
    }
  }

  /* ---------------- cart page ---------------- */

  function renderCart(focusKey) {
    main.textContent = '';
    main.setAttribute('data-view', 'cart');
    listRefs = null;
    document.title = 'Your cart | Bazaarly';
    const s = cartSummary();

    if (s.lines.length === 0) {
      main.append(el('section', { class: 'empty empty-cart' },
        ART.createArt('backpack', ['#e0e7ff', '#c7d2fe', '#4338ca'], ''),
        el('h1', { id: 'page-title', tabindex: '-1', text: 'Your cart is empty' }),
        el('p', { text: 'Looks like you have not added anything yet.' }),
        el('a', { class: 'btn btn-primary btn-lg', href: '#/', text: 'Start shopping' })
      ));
      main.querySelector('svg.art').setAttribute('aria-hidden', 'true');
      return;
    }

    const list = el('ul', { class: 'lines' });
    s.lines.forEach(({ product: p, qty, lineCents }) => {
      const max = K.maxFor(p);
      list.append(el('li', { class: 'line' },
        el('a', { class: 'line-art', href: '#/product/' + encodeURIComponent(p.id), 'aria-hidden': 'true', tabindex: '-1' }, productArt(p)),
        el('div', { class: 'line-main' },
          el('p', { class: 'card-cat', text: p.category }),
          el('a', { class: 'line-name', href: '#/product/' + encodeURIComponent(p.id), text: p.name }),
          el('p', { class: 'muted', text: `${money(p.priceCents)} each` }),
          qty >= max ? el('p', { class: 'limit', text: qty >= p.stock ? 'All available stock is in your cart' : `Limit of ${K.MAX_QTY} per order` }) : null
        ),
        stepper(qty, max, (n) => setCart(K.setQty(state.cart, p, n)), 'q-' + p.id, p.name),
        el('p', { class: 'line-total', text: money(lineCents) }),
        el('button', {
          type: 'button', class: 'remove', 'data-key': 'rm-' + p.id, 'aria-label': `Remove ${p.name} from cart`,
          onclick: () => removeLine(p),
        }, icon('trash'), el('span', { text: 'Remove' }))
      ));
    });

    const pct = Math.min(100, Math.round((s.subtotalCents / K.FREE_SHIPPING_CENTS) * 100));
    const ship = el('div', { class: 'ship' },
      el('p', { class: 'ship-text' }, s.freeShipping
        ? [icon('check'), 'You have unlocked free shipping!']
        : ['Add ', el('strong', { text: money(s.toFreeShippingCents) }), ' more for free shipping']),
      el('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Progress to free shipping', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct },
        el('span', { style: `width:${pct}%` }))
    );

    const row = (label, value, cls) => el('div', { class: 'sum-row' + (cls ? ' ' + cls : '') }, el('dt', { text: label }), el('dd', { text: value }));
    const summary = el('aside', { class: 'summary', 'aria-label': 'Order summary' },
      el('h2', { text: 'Order summary' }),
      ship,
      el('dl', {},
        row(`Subtotal (${s.count} ${s.count === 1 ? 'item' : 'items'})`, money(s.subtotalCents)),
        row('Shipping', s.shippingCents === 0 ? 'Free' : money(s.shippingCents)),
        row('Total', money(s.totalCents), 'sum-total')
      ),
      el('button', { type: 'button', class: 'btn btn-primary btn-lg btn-block', text: 'Checkout', onclick: openCheckout }),
      el('a', { class: 'btn btn-ghost btn-block', href: '#/', text: 'Continue shopping' })
    );

    main.append(
      el('div', { class: 'cart-head' },
        el('h1', { id: 'page-title', tabindex: '-1', text: `Your cart (${s.count} ${s.count === 1 ? 'item' : 'items'})` }),
        el('button', { type: 'button', class: 'link-btn', text: 'Clear cart', onclick: clearCart })
      ),
      el('div', { class: 'cart-layout' }, list, summary)
    );

    if (focusKey) {
      const t = $(`[data-key="${focusKey}"]`) || $('.remove') || $('#page-title');
      if (t) t.focus();
    }
  }

  function removeLine(p) {
    const before = state.cart;
    const idx = before.findIndex((i) => i.id === p.id);
    setCart(K.removeItem(before, p.id));
    const next = state.cart[Math.min(idx, state.cart.length - 1)];
    if (next) { const k = $(`[data-key="rm-${next.id}"]`); if (k) k.focus(); }
    toast(`Removed ${p.name}`, { label: 'Undo', run: () => setCart(before) });
  }

  function clearCart() {
    const before = state.cart;
    setCart([]);
    toast('Cart cleared', { label: 'Undo', run: () => setCart(before) });
  }

  /* ---------------- checkout dialog (demo) ---------------- */

  function openCheckout() {
    const dlg = $('#checkout-dialog');
    const s = cartSummary();
    if (!s.lines.length) return;
    dlg.textContent = '';
    const lines = el('ul', { class: 'dlg-lines' }, s.lines.map((l) =>
      el('li', {}, el('span', { text: `${l.qty} × ${l.product.name}` }), el('span', { text: money(l.lineCents) }))));
    const close = () => dlg.close();
    dlg.append(
      el('div', { class: 'dlg-in' },
        el('h2', { id: 'dlg-title', text: 'Review your order' }),
        el('p', { class: 'muted', text: 'This is a demo store. No payment is taken and nothing is shipped.' }),
        lines,
        el('div', { class: 'sum-row sum-total' }, el('span', { text: 'Total' }), el('span', { text: money(s.totalCents) })),
        el('div', { class: 'dlg-actions' },
          el('button', { type: 'button', class: 'btn btn-ghost', text: 'Back', onclick: close }),
          el('button', { type: 'button', class: 'btn btn-primary', text: 'Place demo order', onclick: () => placeOrder(dlg, s) })
        )
      )
    );
    dlg.showModal();
  }

  function placeOrder(dlg, s) {
    const ref = 'BZ-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    setCart([]);
    dlg.textContent = '';
    dlg.append(el('div', { class: 'dlg-in dlg-done' },
      el('span', { class: 'done-mark', 'aria-hidden': 'true' }, icon('check')),
      el('h2', { id: 'dlg-title', text: 'Thank you for your order!' }),
      el('p', { text: `Order ${ref} for ${money(s.totalCents)} is confirmed (demo). Your cart is now empty.` }),
      el('button', { type: 'button', class: 'btn btn-primary', text: 'Keep shopping', onclick: () => { dlg.close(); location.hash = '#/'; } })
    ));
    announce('Order placed');
  }

  /* ---------------- misc views ---------------- */

  function notFound(title, text) {
    return el('section', { class: 'empty' },
      el('h1', { id: 'page-title', tabindex: '-1', text: title }),
      el('p', { text }),
      el('a', { class: 'btn btn-primary', href: '#/', text: 'Back to the shop' })
    );
  }

  function renderLoading() {
    main.textContent = '';
    main.setAttribute('data-view', 'loading');
    const grid = el('div', { class: 'grid', 'aria-hidden': 'true' });
    for (let i = 0; i < 8; i++) grid.append(el('div', { class: 'card skeleton' }, el('div', { class: 'sk-art' }), el('div', { class: 'sk-line' }), el('div', { class: 'sk-line short' })));
    main.append(el('div', { class: 'hero hero-sk' }), grid);
  }

  function renderError() {
    main.textContent = '';
    main.setAttribute('data-view', 'error');
    const onFile = location.protocol === 'file:';
    main.append(el('section', { class: 'empty error' },
      el('h1', { id: 'page-title', tabindex: '-1', text: 'We could not load the products' }),
      el('p', { text: onFile
        ? 'Browsers block reading data/products.json when the page is opened by double-clicking the file. Start the project with Live Server in VS Code (or run "npm start") and open it through http://localhost.'
        : 'Please check your connection and try again.' }),
      el('p', { class: 'muted', text: state.error }),
      el('button', { type: 'button', class: 'btn btn-primary', text: 'Try again', onclick: boot })
    ));
  }

  /* ---------------- router ---------------- */

  function render(isFirst) {
    const route = currentRoute();
    if (!state.loaded) return;
    if (route.name === 'list') {
      const fromUrl = C.parseQuery(route.query, state.categories);
      state.view = fromUrl; // the URL is the source of truth for the listing
      document.title = 'Bazaarly | Everyday things, beautifully chosen';
      if (main.getAttribute('data-view') !== 'list' || !listRefs) buildList();
      $('#search').value = state.view.q;
      updateResults();
    } else if (route.name === 'product') {
      renderProduct(route.id);
    } else {
      renderCart();
    }
    if (!isFirst) {
      window.scrollTo(0, 0);
      const h = $('#page-title');
      if (h) h.focus({ preventScroll: true });
    }
  }

  function onCartChanged() {
    updateHeader();
    bumpBadge();
    const route = currentRoute();
    if (route.name === 'list' && listRefs) {
      listRefs.cards.forEach((card, id) => syncCardState(card, state.byId[id]));
    } else if (route.name === 'cart') {
      const key = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-key');
      renderCart(key);
    } else if (route.name === 'product') {
      // the product page re-renders itself after Add; just refresh the related cards
      $$related();
    }
  }

  function $$related() {
    document.querySelectorAll('.related .card').forEach((c, i) => {
      const rel = C.relatedProducts(state.products, state.byId[currentRoute().id], 4)[i];
      if (rel) syncCardState(c, rel);
    });
  }

  /* ---------------- boot ---------------- */

  async function boot() {
    renderLoading();
    try {
      const res = await fetch('data/products.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const products = C.normalizeProducts(await res.json());
      if (!products.length) throw new Error('The product list is empty.');
      state.products = products;
      state.byId = Object.fromEntries(products.map((p) => [p.id, p]));
      state.categories = C.categoriesOf(products);
      state.cart = loadCart();
      saveCart(); // writes back the cleaned-up cart
      state.loaded = true;
      updateHeader();
      render(true);
    } catch (e) {
      state.error = e && e.message ? e.message : String(e);
      renderError();
    }
  }

  function init() {
    setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    $('#theme-btn').addEventListener('click', () => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    const input = $('#search');
    $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); setView({ q: input.value }); });
    input.addEventListener('input', () => { if (state.loaded) setView({ q: input.value }); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) { input.value = ''; setView({ q: '' }); }
    });
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && !['input', 'textarea', 'select'].includes(tag)) { e.preventDefault(); input.focus(); }
    });

    window.addEventListener('hashchange', () => render(false));

    // Keep several open tabs in sync.
    window.addEventListener('storage', (e) => {
      if (e.key === K.STORAGE_KEY && state.loaded) {
        try { state.cart = K.sanitize(JSON.parse(e.newValue || '[]'), state.byId); } catch (err) { state.cart = []; }
        updateHeader();
        onCartChanged();
      }
    });

    boot();
  }

  init();
})();
