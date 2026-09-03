'use strict';

/* Force-directed link graph on a 2D canvas — no external libraries.
 *
 * Layout: Fruchterman-Reingold style repulsion (via a uniform spatial grid so
 * it stays O(n) rather than O(n²)) plus spring attraction along links and a
 * gentle pull toward the centre that keeps disconnected islands on screen.
 *
 * createGraphView(canvas, { onOpen }) -> controller
 */

function createGraphView(canvas, { onOpen } = {}) {
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------- state --
  let nodes = [];          // { id, label, x, y, vx, vy, r, deg, path }
  let links = [];          // { a, b }  (indices into nodes)
  let byId = new Map();
  let adjacency = new Map();  // id -> Set(id)

  let scale = 1, tx = 0, ty = 0;
  let alpha = 0;              // simulation "heat"; 0 = settled
  let raf = null;
  let hovered = null, selected = null, activeId = null;
  let dragNode = null, panning = false;
  let pointer = { x: 0, y: 0, downX: 0, downY: 0, moved: false };

  // Tuned for readable clusters at a typical vault size.
  const IDEAL = 58;        // preferred link length
  const CUTOFF = 220;      // ignore repulsion past this distance
  const SPRING = 0.020;
  const GRAVITY = 0.014;
  const DAMPING = 0.82;
  const CELL = CUTOFF / 2;

  // --------------------------------------------------------------- colours --
  let colors = readColors();
  function readColors() {
    const cs = getComputedStyle(document.body);
    const v = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
    return {
      edge:      v('--graph-edge', '#4a4a4a'),
      edgeHot:   v('--graph-edge-hot', '#4f8cff'),
      node:      v('--graph-node', '#6f7681'),
      nodeHot:   v('--graph-node-hot', '#4f8cff'),
      nodeDim:   v('--graph-node-dim', '#3a3d42'),
      active:    v('--accent', '#4f8cff'),
      text:      v('--text', '#e4e4e4'),
      textDim:   v('--text-muted', '#9aa0a6')
    };
  }

  // ------------------------------------------------------------ deterministic
  // Same vault -> same layout every time, so the map does not reshuffle on
  // every refresh.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  // ------------------------------------------------------------------ data --
  function setData(graph) {
    const prev = new Map(nodes.map((n) => [n.id, n]));
    const count = graph.nodes.length;
    const spread = Math.max(180, Math.sqrt(count) * 46);

    nodes = graph.nodes.map((n) => {
      const keep = prev.get(n.id);
      const a = hash(n.id) * Math.PI * 2;
      const rr = spread * (0.25 + 0.75 * hash(n.id + '#r'));
      return {
        id: n.id,
        label: n.label,
        path: n.path,
        dir: n.dir,
        out: n.out,
        in: n.in,
        deg: n.out + n.in,
        x: keep ? keep.x : Math.cos(a) * rr,
        y: keep ? keep.y : Math.sin(a) * rr,
        vx: 0, vy: 0,
        r: 3.5 + Math.sqrt(n.out + n.in) * 2.6
      };
    });

    byId = new Map(nodes.map((n, i) => [n.id, i]));
    links = [];
    adjacency = new Map(nodes.map((n) => [n.id, new Set()]));
    for (const e of graph.edges) {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (a === undefined || b === undefined) continue;
      links.push({ a, b });
      adjacency.get(e.source).add(e.target);
      adjacency.get(e.target).add(e.source);
    }

    hovered = selected = null;

    // Pre-warm the layout before the first paint. Without this, fit() would
    // frame the initial ring rather than the shape the graph settles into,
    // and the map would visibly explode outwards as it appeared.
    alpha = 1;
    const warm = nodes.length > 800 ? 120 : 260;
    for (let i = 0; i < warm; i++) tick();
    alpha = 0.05;              // barely-there residual motion; the layout is already settled
    start();
  }

  // ------------------------------------------------------------ simulation --
  function tick() {
    if (!nodes.length) return;

    // Bucket nodes so repulsion only looks at nearby cells.
    const grid = new Map();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const key = Math.round(n.x / CELL) + ',' + Math.round(n.y / CELL);
      let bucket = grid.get(key);
      if (!bucket) grid.set(key, (bucket = []));
      bucket.push(i);
    }

    const k2 = IDEAL * IDEAL;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const cx = Math.round(n.x / CELL), cy = Math.round(n.y / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(gx + ',' + gy);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j === i) continue;
            const m = nodes[j];
            let dx = n.x - m.x, dy = n.y - m.y;
            let d2 = dx * dx + dy * dy;
            if (d2 > CUTOFF * CUTOFF) continue;
            if (d2 < 0.01) {            // exactly overlapping: nudge apart
              dx = (hash(n.id + j) - 0.5) * 0.5;
              dy = (hash(m.id + i) - 0.5) * 0.5;
              d2 = dx * dx + dy * dy + 0.01;
            }
            const d = Math.sqrt(d2);
            const f = k2 / d2;          // Fruchterman-Reingold repulsion
            n.vx += (dx / d) * f;
            n.vy += (dy / d) * f;
          }
        }
      }
    }

    for (const l of links) {
      const a = nodes[l.a], b = nodes[l.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d - IDEAL) * SPRING;
      const ux = (dx / d) * f, uy = (dy / d) * f;
      a.vx += ux; a.vy += uy;
      b.vx -= ux; b.vy -= uy;
    }

    for (const n of nodes) {
      n.vx -= n.x * GRAVITY;
      n.vy -= n.y * GRAVITY;
      if (n === dragNode) { n.vx = n.vy = 0; continue; }
      n.vx *= DAMPING; n.vy *= DAMPING;
      // Clamp so a dense cluster cannot explode on the first few frames.
      const speed = Math.hypot(n.vx, n.vy);
      const max = 30;
      if (speed > max) { n.vx = (n.vx / speed) * max; n.vy = (n.vy / speed) * max; }
      n.x += n.vx * alpha;
      n.y += n.vy * alpha;
    }

    alpha *= 0.986;
    if (alpha < 0.004) alpha = 0;
  }

  // --------------------------------------------------------------- drawing --
  const toScreenX = (x) => x * scale + tx;
  const toScreenY = (y) => y * scale + ty;
  const toWorldX = (x) => (x - tx) / scale;
  const toWorldY = (y) => (y - ty) / scale;

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!nodes.length) return;

    const focus = hovered || selected;
    const near = focus ? adjacency.get(focus.id) : null;
    const isNear = (n) => !focus || n === focus || near.has(n.id);

    // Edges
    ctx.lineWidth = 1;
    for (const l of links) {
      const a = nodes[l.a], b = nodes[l.b];
      const hot = focus && (a === focus || b === focus);
      if (focus && !hot) continue;              // dimmed edges drawn in the pass below
      ctx.strokeStyle = hot ? colors.edgeHot : colors.edge;
      ctx.globalAlpha = hot ? 0.9 : 0.5;
      ctx.beginPath();
      ctx.moveTo(toScreenX(a.x), toScreenY(a.y));
      ctx.lineTo(toScreenX(b.x), toScreenY(b.y));
      ctx.stroke();
    }
    if (focus) {                                 // faint context behind the focus
      ctx.strokeStyle = colors.edge;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      for (const l of links) {
        const a = nodes[l.a], b = nodes[l.b];
        if (a === focus || b === focus) continue;
        ctx.moveTo(toScreenX(a.x), toScreenY(a.y));
        ctx.lineTo(toScreenX(b.x), toScreenY(b.y));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Nodes
    for (const n of nodes) {
      const sx = toScreenX(n.x), sy = toScreenY(n.y);
      const r = Math.max(2, n.r * Math.min(scale, 1.6));
      const lit = isNear(n);
      ctx.globalAlpha = lit ? 1 : 0.25;
      ctx.fillStyle = n === focus ? colors.nodeHot
        : n.id === activeId ? colors.active
        : lit ? colors.node : colors.nodeDim;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      if (n.id === activeId) {                   // ring marks the open file
        ctx.strokeStyle = colors.active;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Labels — only when there is room, so the map never turns into soup.
    const showAll = scale > 0.62;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const n of nodes) {
      const lit = isNear(n);
      const show = n === focus || n.id === activeId || (showAll && lit);
      if (!show) continue;
      const sx = toScreenX(n.x), sy = toScreenY(n.y);
      if (sx < -80 || sx > w + 80 || sy < -40 || sy > h + 40) continue;
      const r = Math.max(2, n.r * Math.min(scale, 1.6));
      ctx.fillStyle = (n === focus || n.id === activeId) ? colors.text : colors.textDim;
      ctx.fillText(n.label, sx, sy + r + 4);
    }
  }

  // The loop parks itself once the layout settles and nothing is interacting,
  // so an idle graph costs nothing. Any input calls invalidate() to wake it.
  let needsDraw = true;
  function frame() {
    if (alpha > 0) { tick(); needsDraw = true; }
    if (needsDraw) { draw(); needsDraw = false; }
    raf = (alpha > 0 || needsDraw) ? requestAnimationFrame(frame) : null;
  }
  function start() {
    needsDraw = true;
    if (raf === null) raf = requestAnimationFrame(frame);
  }
  const invalidate = start;

  new ResizeObserver(() => invalidate()).observe(canvas);

  // ---------------------------------------------------------- interaction --
  function nodeAt(px, py) {
    const wx = toWorldX(px), wy = toWorldY(py);
    let best = null, bestD = Infinity;
    for (const n of nodes) {
      const r = Math.max(2, n.r * Math.min(scale, 1.6)) / scale + 6 / scale;
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < r && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  function localPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('mousedown', (e) => {
    const p = localPoint(e);
    pointer.downX = p.x; pointer.downY = p.y; pointer.moved = false;
    const n = nodeAt(p.x, p.y);
    if (n) { dragNode = n; alpha = Math.max(alpha, 0.35); }
    else panning = true;
    canvas.style.cursor = n ? 'grabbing' : 'move';
    invalidate();
  });

  window.addEventListener('mousemove', (e) => {
    const p = localPoint(e);
    const dx = p.x - pointer.x, dy = p.y - pointer.y;
    pointer.x = p.x; pointer.y = p.y;
    if (Math.hypot(p.x - pointer.downX, p.y - pointer.downY) > 4) pointer.moved = true;

    if (dragNode) {
      dragNode.x = toWorldX(p.x);
      dragNode.y = toWorldY(p.y);
      alpha = Math.max(alpha, 0.25);
      invalidate();
    } else if (panning) {
      tx += dx; ty += dy;
      invalidate();
    } else {
      const inside = p.x >= 0 && p.y >= 0 && p.x <= canvas.clientWidth && p.y <= canvas.clientHeight;
      const n = inside ? nodeAt(p.x, p.y) : null;
      if (n !== hovered) {
        hovered = n;
        canvas.style.cursor = n ? 'pointer' : 'default';
        invalidate();
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (dragNode && !pointer.moved) {
      selected = selected === dragNode ? null : dragNode;   // click = focus
    } else if (panning && !pointer.moved) {
      selected = null;                                      // click empty space = clear
    }
    dragNode = null; panning = false;
    canvas.style.cursor = hovered ? 'pointer' : 'default';
    invalidate();
  });

  canvas.addEventListener('dblclick', (e) => {
    const p = localPoint(e);
    const n = nodeAt(p.x, p.y);
    if (n && onOpen) onOpen(n);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = localPoint(e);
    const factor = Math.exp(-e.deltaY * 0.0016);
    const next = Math.min(4, Math.max(0.08, scale * factor));
    // Keep the point under the cursor fixed while zooming.
    tx = p.x - (p.x - tx) * (next / scale);
    ty = p.y - (p.y - ty) * (next / scale);
    scale = next;
    invalidate();
  }, { passive: false });

  // -------------------------------------------------------------- controls --
  function fit(padding = 60) {
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
    // 0.9 leaves room for the node discs and the labels drawn beneath them,
    // which the bounding box above only covers to the node centres.
    const raw = Math.min((w - padding * 2) / bw, (h - padding * 2) / bh);
    scale = Math.min(4, Math.max(0.08, raw * 0.9));
    tx = w / 2 - ((minX + maxX) / 2) * scale;
    ty = h / 2 - ((minY + maxY) / 2) * scale;
    invalidate();
  }

  return {
    setData,
    fit,
    redraw: () => invalidate(),
    reheat() { alpha = 1; start(); },
    setActive(id) { activeId = id; invalidate(); },
    focusNode(id) {
      const i = byId.get(id);
      if (i === undefined) return false;
      selected = nodes[i];
      const n = nodes[i];
      scale = Math.max(scale, 0.9);
      tx = canvas.clientWidth / 2 - n.x * scale;
      ty = canvas.clientHeight / 2 - n.y * scale;
      invalidate();
      return true;
    },
    refreshTheme() { colors = readColors(); invalidate(); },
    get count() { return nodes.length; },
    destroy() { if (raf !== null) cancelAnimationFrame(raf); raf = null; }
  };
}

window.createGraphView = createGraphView;
