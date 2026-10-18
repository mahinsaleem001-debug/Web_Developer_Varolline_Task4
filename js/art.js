/*
 * art.js: product illustrations drawn as SVG, so the store needs no photo files.
 * Each product has an "art" kind and three colours: background 1, background 2, main colour.
 * If a product has an "image" URL, app.js shows that photo instead.
 */
(function (root) {
  'use strict';

  const NS = (root.Bazaarly = root.Bazaarly || {});
  const SVG = 'http://www.w3.org/2000/svg';

  function s(tag, attrs, kids) {
    const n = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    (kids || []).forEach((c) => n.appendChild(c));
    return n;
  }

  // Each drawer returns an array of SVG nodes on a 200 x 200 canvas.
  // c = main colour, l = a light tint, w = white-ish highlight.
  const DRAW = {
    headphones: (c, l) => [
      s('path', { d: 'M48 118 V100 a52 52 0 0 1 104 0 V118', fill: 'none', stroke: c, 'stroke-width': 10, 'stroke-linecap': 'round' }),
      s('rect', { x: 36, y: 108, width: 26, height: 50, rx: 13, fill: c }),
      s('rect', { x: 138, y: 108, width: 26, height: 50, rx: 13, fill: c }),
      s('rect', { x: 42, y: 118, width: 8, height: 30, rx: 4, fill: l, opacity: 0.6 }),
      s('rect', { x: 150, y: 118, width: 8, height: 30, rx: 4, fill: l, opacity: 0.6 }),
    ],
    watch: (c, l) => [
      s('rect', { x: 78, y: 26, width: 44, height: 148, rx: 14, fill: c, opacity: 0.85 }),
      s('rect', { x: 52, y: 62, width: 96, height: 76, rx: 22, fill: c }),
      s('rect', { x: 60, y: 70, width: 80, height: 60, rx: 16, fill: l }),
      s('path', { d: 'M100 80 V100 L114 108', fill: 'none', stroke: c, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      s('rect', { x: 148, y: 90, width: 6, height: 18, rx: 3, fill: c }),
    ],
    speaker: (c, l) => [
      s('rect', { x: 48, y: 46, width: 104, height: 112, rx: 26, fill: c }),
      s('circle', { cx: 100, cy: 82, r: 16, fill: l, opacity: 0.85 }),
      s('circle', { cx: 100, cy: 128, r: 20, fill: l, opacity: 0.85 }),
      s('circle', { cx: 100, cy: 128, r: 8, fill: c }),
    ],
    keyboard: (c, l) => {
      const keys = [];
      for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) {
        keys.push(s('rect', { x: 40 + k * 15.5, y: 70 + r * 17, width: 12, height: 13, rx: 3, fill: l, opacity: 0.9 }));
      }
      return [s('rect', { x: 30, y: 58, width: 140, height: 86, rx: 12, fill: c }), ...keys];
    },
    camera: (c, l) => [
      s('rect', { x: 36, y: 62, width: 128, height: 88, rx: 16, fill: c }),
      s('rect', { x: 70, y: 48, width: 36, height: 20, rx: 6, fill: c }),
      s('circle', { cx: 100, cy: 106, r: 30, fill: l }),
      s('circle', { cx: 100, cy: 106, r: 20, fill: c }),
      s('circle', { cx: 94, cy: 100, r: 5, fill: l, opacity: 0.8 }),
      s('circle', { cx: 144, cy: 80, r: 5, fill: l }),
    ],
    sneaker: (c, l) => [
      s('path', { d: 'M34 128 C34 96 56 90 70 84 L82 98 C96 104 116 100 124 88 C146 92 168 108 168 128 Z', fill: c }),
      s('path', { d: 'M30 128 H172 V142 a8 8 0 0 1 -8 8 H38 a8 8 0 0 1 -8 -8 Z', fill: l }),
      s('path', { d: 'M92 106 l10 -8 M104 110 l10 -8 M116 112 l10 -8', stroke: l, 'stroke-width': 4, 'stroke-linecap': 'round' }),
    ],
    tee: (c, l) => [
      s('path', { d: 'M70 44 L38 62 L52 92 L72 84 V158 H128 V84 L148 92 L162 62 L130 44 C124 58 76 58 70 44 Z', fill: c }),
      s('path', { d: 'M70 44 C76 58 124 58 130 44', fill: 'none', stroke: l, 'stroke-width': 5, opacity: 0.8 }),
    ],
    backpack: (c, l) => [
      s('path', { d: 'M78 52 a22 22 0 0 1 44 0', fill: 'none', stroke: c, 'stroke-width': 9 }),
      s('rect', { x: 52, y: 50, width: 96, height: 112, rx: 30, fill: c }),
      s('rect', { x: 68, y: 108, width: 64, height: 40, rx: 12, fill: l, opacity: 0.85 }),
      s('path', { d: 'M78 124 H122', stroke: c, 'stroke-width': 5, 'stroke-linecap': 'round' }),
      s('path', { d: 'M70 76 H130', stroke: l, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.7 }),
    ],
    sunglasses: (c, l) => [
      s('rect', { x: 28, y: 76, width: 60, height: 44, rx: 18, fill: c }),
      s('rect', { x: 112, y: 76, width: 60, height: 44, rx: 18, fill: c }),
      s('path', { d: 'M88 88 q12 -10 24 0', fill: 'none', stroke: c, 'stroke-width': 6, 'stroke-linecap': 'round' }),
      s('path', { d: 'M40 86 l14 -4', stroke: l, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.8 }),
      s('path', { d: 'M124 86 l14 -4', stroke: l, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.8 }),
    ],
    wallet: (c, l) => [
      s('rect', { x: 36, y: 56, width: 128, height: 92, rx: 16, fill: c }),
      s('path', { d: 'M36 78 H164', stroke: l, 'stroke-width': 4, opacity: 0.5 }),
      s('rect', { x: 120, y: 94, width: 56, height: 32, rx: 12, fill: l }),
      s('circle', { cx: 138, cy: 110, r: 5, fill: c }),
    ],
    lamp: (c, l) => [
      s('path', { d: 'M62 46 H138 L158 104 H42 Z', fill: c }),
      s('path', { d: 'M100 104 V152', stroke: c, 'stroke-width': 8, 'stroke-linecap': 'round' }),
      s('ellipse', { cx: 100, cy: 160, rx: 34, ry: 9, fill: c }),
      s('path', { d: 'M70 60 H130', stroke: l, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.7 }),
    ],
    mug: (c, l, hl) => [
      s('path', { d: 'M148 78 h8 a20 20 0 0 1 0 40 h-12', fill: 'none', stroke: c, 'stroke-width': 10 }),
      s('path', { d: 'M46 66 H152 V124 a28 28 0 0 1 -28 28 H74 a28 28 0 0 1 -28 -28 Z', fill: c }),
      s('rect', { x: 46, y: 66, width: 106, height: 12, rx: 6, fill: hl || l, opacity: 0.7 }),
      s('path', { d: 'M78 52 q6 -10 0 -18 M100 52 q6 -10 0 -18 M122 52 q6 -10 0 -18', fill: 'none', stroke: c, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.5 }),
    ],
    plant: (c, l) => [
      s('ellipse', { cx: 100, cy: 98, rx: 16, ry: 38, fill: c, transform: 'rotate(-35 100 120)' }),
      s('ellipse', { cx: 100, cy: 90, rx: 16, ry: 44, fill: c }),
      s('ellipse', { cx: 100, cy: 98, rx: 16, ry: 38, fill: c, transform: 'rotate(35 100 120)' }),
      s('path', { d: 'M100 62 V120', stroke: l, 'stroke-width': 3, opacity: 0.6 }),
      s('path', { d: 'M64 120 H136 L128 160 a6 6 0 0 1 -6 4 H78 a6 6 0 0 1 -6 -4 Z', fill: l }),
      s('rect', { x: 60, y: 116, width: 80, height: 10, rx: 5, fill: l }),
    ],
    candle: (c, l) => [
      s('path', { d: 'M100 40 C112 56 112 66 100 74 C88 66 88 56 100 40 Z', fill: l }),
      s('path', { d: 'M100 74 V84', stroke: c, 'stroke-width': 4, 'stroke-linecap': 'round' }),
      s('rect', { x: 62, y: 84, width: 76, height: 72, rx: 14, fill: c }),
      s('rect', { x: 72, y: 106, width: 56, height: 26, rx: 6, fill: l, opacity: 0.8 }),
    ],
    book: (c, l) => [
      s('rect', { x: 54, y: 34, width: 96, height: 132, rx: 8, fill: c }),
      s('rect', { x: 54, y: 34, width: 14, height: 132, rx: 6, fill: l, opacity: 0.6 }),
      s('rect', { x: 82, y: 58, width: 52, height: 8, rx: 4, fill: l }),
      s('rect', { x: 82, y: 74, width: 36, height: 6, rx: 3, fill: l, opacity: 0.7 }),
      s('path', { d: 'M132 166 V140 l8 6 l8 -6 V166', fill: l }),
    ],
    bottle: (c, l) => [
      s('rect', { x: 84, y: 24, width: 32, height: 22, rx: 6, fill: l }),
      s('rect', { x: 76, y: 44, width: 48, height: 12, rx: 5, fill: c }),
      s('rect', { x: 66, y: 54, width: 68, height: 116, rx: 22, fill: c }),
      s('rect', { x: 78, y: 82, width: 10, height: 64, rx: 5, fill: l, opacity: 0.55 }),
      s('rect', { x: 96, y: 98, width: 28, height: 28, rx: 8, fill: l, opacity: 0.85 }),
    ],
  };

  /** Build an <svg> for a product. `art` kind + colours [bg1, bg2, main, (extra)]. */
  function createArt(art, colors, label) {
    const safe = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : d);
    const bg1 = safe(colors && colors[0], '#e5e7eb');
    const bg2 = safe(colors && colors[1], '#d1d5db');
    const main = safe(colors && colors[2], '#374151');
    const extra = safe(colors && colors[3], null);
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    const draw = DRAW[art] || DRAW.book;

    const svg = s('svg', {
      viewBox: '0 0 200 200', class: 'art', role: 'img', 'aria-label': label || 'Product illustration',
      preserveAspectRatio: 'xMidYMid slice',
    });
    const grad = s('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, [
      s('stop', { offset: '0', 'stop-color': bg1 }),
      s('stop', { offset: '1', 'stop-color': bg2 }),
    ]);
    svg.appendChild(s('defs', {}, [grad]));
    svg.appendChild(s('rect', { width: 200, height: 200, fill: `url(#${id})` }));
    svg.appendChild(s('circle', { cx: 160, cy: 40, r: 46, fill: '#fff', opacity: 0.22 }));
    svg.appendChild(s('ellipse', { cx: 100, cy: 172, rx: 54, ry: 7, fill: '#000', opacity: 0.1 }));
    const g = s('g', {}, draw(main, '#ffffff', extra));
    svg.appendChild(g);
    return svg;
  }

  const api = { createArt, kinds: Object.keys(DRAW) };
  NS.art = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
