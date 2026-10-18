const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/catalog.js');
const K = require('../js/cart.js');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8'));
const products = C.normalizeProducts(raw);
const byId = Object.fromEntries(products.map((p) => [p.id, p]));

test('products.json loads fully and every product is valid', () => {
  assert.strictEqual(products.length, raw.length);
  assert.ok(products.length >= 20);
  products.forEach((p) => {
    assert.ok(p.priceCents > 0 && Number.isInteger(p.priceCents));
    assert.ok(p.rating >= 0 && p.rating <= 5);
  });
});

test('normalizeProducts skips bad rows and duplicate ids', () => {
  const out = C.normalizeProducts([
    { id: 'a', name: 'A', price: 10 },
    { id: 'a', name: 'Dup', price: 5 },
    { id: 'b', name: '', price: 5 },
    { id: 'c', name: 'C', price: 'abc' },
    null,
    { id: 'd', name: 'D', price: 1.1 },
  ]);
  assert.deepStrictEqual(out.map((p) => p.id), ['a', 'd']);
  assert.strictEqual(out[1].priceCents, 110);
  assert.deepStrictEqual(C.normalizeProducts('nope'), []);
});

test('search needs every word and looks at name, category and description', () => {
  assert.ok(C.queryProducts(products, { q: 'lamp' }).length >= 2);
  const both = C.queryProducts(products, { q: 'wireless headphones' });
  assert.ok(both.some((p) => p.id === 'p01'));
  assert.ok(both.every((p) => /wireless/i.test(p.name + p.description) && /headphones/i.test(p.name + p.description + p.features.join(' '))));
  assert.strictEqual(C.queryProducts(products, { q: 'zzzzqq' }).length, 0);
  assert.strictEqual(C.queryProducts(products, { q: '  LAMP  ' }).length, C.queryProducts(products, { q: 'lamp' }).length);
});

test('category filter and combination with search', () => {
  const cats = C.categoriesOf(products);
  assert.deepStrictEqual(cats, ['Electronics', 'Fashion', 'Home & Living', 'Accessories']);
  const el = C.queryProducts(products, { category: 'Electronics' });
  assert.ok(el.length > 0 && el.every((p) => p.category === 'Electronics'));
  const combo = C.queryProducts(products, { category: 'Home & Living', q: 'lamp' });
  assert.deepStrictEqual(combo.map((p) => p.id), ['p13']);
});

test('sorting by price both ways is correct and does not change the input', () => {
  const before = products.map((p) => p.id).join();
  const asc = C.queryProducts(products, { sort: 'price-asc' }).map((p) => p.priceCents);
  const desc = C.queryProducts(products, { sort: 'price-desc' }).map((p) => p.priceCents);
  assert.deepStrictEqual(asc, [...asc].sort((a, b) => a - b));
  assert.deepStrictEqual(desc, [...desc].sort((a, b) => b - a));
  assert.strictEqual(products.map((p) => p.id).join(), before);
  assert.strictEqual(C.queryProducts(products, { sort: 'bogus' })[0].id, products[0].id);
});

test('category counts follow the search text', () => {
  const all = C.categoryCounts(products);
  assert.strictEqual(all.all, products.length);
  const lamp = C.categoryCounts(products, 'lamp');
  assert.strictEqual(lamp.all, lamp['Home & Living'] + lamp.Accessories);
});

test('related products: same category, never the product itself', () => {
  const rel = C.relatedProducts(products, byId.p01, 4);
  assert.strictEqual(rel.length, 4);
  assert.ok(rel.every((p) => p.category === 'Electronics' && p.id !== 'p01'));
});

test('URL query round trip ignores invalid values', () => {
  const cats = C.categoriesOf(products);
  const view = { q: 'smart watch', category: 'Home & Living', sort: 'price-asc' };
  assert.deepStrictEqual(C.parseQuery(C.buildQuery(view), cats), view);
  assert.strictEqual(C.buildQuery(C.DEFAULT_VIEW), '');
  assert.deepStrictEqual(C.parseQuery('category=Nope&sort=x', cats), C.DEFAULT_VIEW);
});

test('formatPrice uses cents, commas and two decimals', () => {
  assert.strictEqual(C.formatPrice(12900), '$129.00');
  assert.strictEqual(C.formatPrice(5), '$0.05');
  assert.strictEqual(C.formatPrice(123456789), '$1,234,567.89');
  assert.strictEqual(C.discountPercent(byId.p01), 24);
});

test('addItem adds, merges and respects stock and MAX_QTY', () => {
  let r = K.addItem([], byId.p01);
  assert.deepStrictEqual(r.items, [{ id: 'p01', qty: 1 }]);
  r = K.addItem(r.items, byId.p01, 2);
  assert.strictEqual(r.items[0].qty, 3);
  r = K.addItem(r.items, byId.p01, 50);
  assert.strictEqual(r.items[0].qty, K.MAX_QTY);
  assert.ok(r.capped);
  assert.strictEqual(K.addItem(r.items, byId.p01).added, 0);
  // out of stock
  const none = K.addItem([], byId.p05);
  assert.strictEqual(none.added, 0);
  assert.deepStrictEqual(none.items, []);
  // low stock product (p22 has 9)
  assert.strictEqual(K.addItem([], byId.p22, 20).items[0].qty, 9);
});

test('addItem and setQty do not change the original cart', () => {
  const start = Object.freeze([Object.freeze({ id: 'p01', qty: 1 })]);
  K.addItem(start, byId.p01);
  K.setQty(start, byId.p01, 4);
  K.removeItem(start, 'p01');
  assert.strictEqual(start[0].qty, 1);
});

test('setQty clamps between 1 and the limit and ignores unknown items', () => {
  const items = [{ id: 'p01', qty: 2 }];
  assert.strictEqual(K.setQty(items, byId.p01, 5)[0].qty, 5);
  assert.strictEqual(K.setQty(items, byId.p01, 0)[0].qty, 1);
  assert.strictEqual(K.setQty(items, byId.p01, -3)[0].qty, 1);
  assert.strictEqual(K.setQty(items, byId.p01, 999)[0].qty, K.MAX_QTY);
  assert.strictEqual(K.setQty(items, byId.p01, 'x')[0].qty, 1);
  assert.strictEqual(K.setQty(items, byId.p02, 3), items);
});

test('removeItem removes only that line', () => {
  const items = [{ id: 'p01', qty: 1 }, { id: 'p02', qty: 2 }];
  assert.deepStrictEqual(K.removeItem(items, 'p01'), [{ id: 'p02', qty: 2 }]);
});

test('summarize: totals in cents, shipping rule and free-shipping progress', () => {
  const small = K.summarize([{ id: 'p14', qty: 2 }], byId); // 2 x $18
  assert.strictEqual(small.count, 2);
  assert.strictEqual(small.subtotalCents, 3600);
  assert.strictEqual(small.shippingCents, K.SHIPPING_CENTS);
  assert.strictEqual(small.totalCents, 3600 + K.SHIPPING_CENTS);
  assert.strictEqual(small.toFreeShippingCents, 10000 - 3600);
  const big = K.summarize([{ id: 'p01', qty: 1 }], byId); // $129
  assert.strictEqual(big.shippingCents, 0);
  assert.ok(big.freeShipping);
  const empty = K.summarize([], byId);
  assert.strictEqual(empty.totalCents, 0);
  assert.strictEqual(empty.shippingCents, 0);
  // classic float trap: 3 x $0.10 must be exactly 30 cents
  const tiny = { x: { id: 'x', priceCents: 10 } };
  assert.strictEqual(K.summarize([{ id: 'x', qty: 3 }], tiny).subtotalCents, 30);
});

test('summarize ignores products that are no longer in the catalogue', () => {
  const s = K.summarize([{ id: 'gone', qty: 2 }, { id: 'p14', qty: 1 }], byId);
  assert.strictEqual(s.lines.length, 1);
  assert.strictEqual(s.count, 1);
});

test('sanitize cleans up damaged saved carts', () => {
  assert.deepStrictEqual(K.sanitize('junk', byId), []);
  assert.deepStrictEqual(K.sanitize(null, byId), []);
  const cleaned = K.sanitize(
    [
      { id: 'p01', qty: 2 },
      { id: 'p01', qty: 3 },          // duplicate lines merge
      { id: 'nope', qty: 1 },         // unknown product
      { id: 'p05', qty: 1 },          // out of stock
      { id: 'p14', qty: 9999 },       // too many
      { id: 'p02', qty: -4 },         // negative
      { id: 'p03', qty: 'abc' },      // not a number
      { qty: 1 },
      null,
    ],
    byId
  );
  assert.deepStrictEqual(cleaned, [
    { id: 'p01', qty: 5 },
    { id: 'p14', qty: 10 },
    { id: 'p02', qty: 1 },
    { id: 'p03', qty: 1 },
  ]);
});
