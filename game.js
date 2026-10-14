'use strict';

(() => {
  // ---------- Brettet ----------
  // 7 kolonner. Rad 0–1: månedene (6 per rad), rad 2–6: datoene 1–31.
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BOARD_SIZE = 7;
  const BOARD = [];
  MONTH_LABELS.forEach((label, i) =>
    BOARD.push({ x: i % 6, y: Math.floor(i / 6), label, kind: 'month', value: i }));
  for (let d = 1; d <= 31; d++) {
    BOARD.push({ x: (d - 1) % 7, y: 2 + Math.floor((d - 1) / 7), label: String(d), kind: 'day', value: d });
  }
  const key = (x, y) => x + ',' + y;
  const BOARD_BY_KEY = new Map(BOARD.map(c => [key(c.x, c.y), c]));

  // ---------- Brikkene (fra bildet) ----------
  const PIECE_DEFS = [
    { id: 'V', name: 'V-brikke', the: 'V-brikken', color: '#9a6a3e', grain: 'h', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]] },
    { id: 'L', name: 'L-brikke', the: 'L-brikken', color: '#4f3526', grain: 'h', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]] },
    { id: 'O', name: 'rektangel', the: 'rektangelet', color: '#6e4d3a', grain: 'h', cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
    { id: 'N', name: 'N-brikke', the: 'N-brikken', color: '#b39283', grain: 'v', cells: [[1, 0], [1, 1], [0, 1], [0, 2], [0, 3]] },
    { id: 'Y', name: 'Y-brikke', the: 'Y-brikken', color: '#7a5034', grain: 'v', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]] },
    { id: 'Z', name: 'Z-brikke', the: 'Z-brikken', color: '#3f2c22', grain: 'h', cells: [[1, 0], [2, 0], [1, 1], [0, 2], [1, 2]] },
    { id: 'U', name: 'U-brikke', the: 'U-brikken', color: '#8c6a5c', grain: 'h', cells: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
    { id: 'P', name: 'P-brikke', the: 'P-brikken', color: '#5f3f2e', grain: 'v', cells: [[1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  ];

  // Orientering: speilvend først (x → -x), deretter roter `rot` ganger 90° med klokka.
  // Rekkefølgen på rutene bevares, slik at rute i alltid er "samme" rute på brikken.
  function transform(cells, { rot, flip }) {
    let pts = cells.map(([x, y]) => (flip ? [-x, y] : [x, y]));
    for (let i = 0; i < rot; i++) pts = pts.map(([x, y]) => [-y, x]);
    const minX = Math.min(...pts.map(p => p[0]));
    const minY = Math.min(...pts.map(p => p[1]));
    return pts.map(([x, y]) => [x - minX, y - minY]);
  }
  const rotated = o => ({ rot: (o.rot + 1) % 4, flip: o.flip });
  // Speilvending om den loddrette aksen, uansett hvordan brikken er rotert.
  const flipped = o => ({ rot: (4 - o.rot) % 4, flip: !o.flip });
  const sizeOf = cells => ({
    w: Math.max(...cells.map(c => c[0])) + 1,
    h: Math.max(...cells.map(c => c[1])) + 1,
  });

  // ---------- Dato ----------
  const MONTHS_NO = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli',
    'august', 'september', 'oktober', 'november', 'desember'];

  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  // Går via kalenderdatoer, ikke millisekunder, så sommertid ikke gir hull.
  const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return isoDate(d); };

  // ?dato=2026-12-24 i URL-en overstyrer dagens dato (nyttig for testing).
  function today() {
    const param = new URLSearchParams(location.search).get('dato');
    const override = !!param && /^\d{4}-\d{2}-\d{2}$/.test(param);
    const d = override ? parseIso(param) : new Date();
    return {
      month: d.getMonth(),
      day: d.getDate(),
      key: isoDate(d),
      override,
      text: d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }),
      short: `${d.getDate()}. ${MONTHS_NO[d.getMonth()]}`,
    };
  }

  // ---------- Tilstand ----------
  let date = today();
  const pieces = PIECE_DEFS.map((def, i) => ({ ...def, index: i, orient: { rot: 0, flip: false }, board: null, z: i }));
  let startedAt = null;
  let solvedAt = null;
  const MAX_HINTS = 3;
  let hintsUsed = 0;    // teller for hele dagen – nullstilles ikke av «Start på nytt»
  let solvedHints = 0;  // antall hint brukt da oppgaven ble løst
  let selected = null;
  let drag = null;   // musedraing som pågår
  let kbd = null;    // tastaturflytting som pågår
  let layout = null;
  let zCounter = pieces.length;
  let syncDirty = false; // noe er lagret lokalt siden forrige synkronisering

  const cellsOf = (p, orient = p.orient) => transform(p.cells, orient);

  // Er plasseringen innenfor brettet og uten overlapp med andre brikker?
  function canPlace(p, orient, bx, by) {
    const occupied = new Set();
    for (const q of pieces) {
      if (q === p || !q.board) continue;
      for (const [x, y] of cellsOf(q)) occupied.add(key(q.board.x + x, q.board.y + y));
    }
    return cellsOf(p, orient).every(([x, y]) => {
      const k = key(bx + x, by + y);
      return BOARD_BY_KEY.has(k) && !occupied.has(k);
    });
  }

  const isGoal = c => (c.kind === 'month' && c.value === date.month) || (c.kind === 'day' && c.value === date.day);

  // Rutene en brikke dekker på brettet, som en sammenlignbar streng (null hvis den ikke ligger på brettet).
  const placedKey = (cells, bx, by) => cells.map(([x, y]) => key(bx + x, by + y)).sort().join(' ');
  const pieceKey = p => (p.board ? placedKey(cellsOf(p), p.board.x, p.board.y) : null);

  // ---------- Løser (for hint) ----------
  // Finner alle løsninger for dagens dato. Tar under et halvt sekund, og gjøres bare én gang per dag.
  let solutionCache = { key: null, list: [] };

  function allSolutions() {
    if (solutionCache.key === date.key) return solutionCache.list;
    const orients = pieces.map(p => {
      const unique = new Map();
      for (const flip of [false, true]) {
        for (let rot = 0; rot < 4; rot++) {
          const orient = { rot, flip };
          const cells = transform(p.cells, orient);
          const id = placedKey(cells, 0, 0);
          // Ankeret er brikkens første rute lest rad for rad – den må dekke første ledige rute.
          const anchor = cells.reduce((a, c) => (c[1] < a[1] || (c[1] === a[1] && c[0] < a[0]) ? c : a));
          if (!unique.has(id)) unique.set(id, { orient, cells, anchor });
        }
      }
      return [...unique.values()];
    });
    const open = BOARD.filter(c => !isGoal(c)).sort((a, b) => a.y - b.y || a.x - b.x);
    const free = new Set(open.map(c => key(c.x, c.y)));
    const used = pieces.map(() => null);
    const list = [];
    (function search() {
      const target = open.find(c => free.has(key(c.x, c.y)));
      if (!target) { list.push(used.slice()); return; }
      pieces.forEach((p, i) => {
        if (used[i]) return;
        for (const o of orients[i]) {
          const bx = target.x - o.anchor[0], by = target.y - o.anchor[1];
          const ks = o.cells.map(([x, y]) => key(bx + x, by + y));
          if (!ks.every(k => free.has(k))) continue;
          ks.forEach(k => free.delete(k));
          used[i] = { orient: o.orient, board: { x: bx, y: by }, cellsKey: ks.slice().sort().join(' ') };
          search();
          used[i] = null;
          ks.forEach(k => free.add(k));
        }
      });
    })();
    solutionCache = { key: date.key, list };
    return list;
  }

  // ---------- Lagring (per dag) ----------
  const storageKey = () => 'apad:v1:' + date.key;

  function save() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        pieces: pieces.map(p => ({ id: p.id, orient: p.orient, board: p.board, hintKey: p.hintKey })),
        startedAt, solvedAt, hintsUsed, solvedHints,
        // Dager spilt med ?dato= telles ikke med i statistikken.
        ...(date.override && { test: true }),
      }));
      syncDirty = true;
    } catch { /* lagring er bare en bonus */ }
  }

  function load() {
    pieces.forEach(p => { p.orient = { rot: 0, flip: false }; p.board = null; p.hintKey = null; });
    startedAt = null;
    solvedAt = null;
    hintsUsed = 0;
    solvedHints = 0;
    try {
      const data = JSON.parse(localStorage.getItem(storageKey()));
      if (!data) return;
      for (const saved of data.pieces || []) {
        const p = pieces.find(q => q.id === saved.id);
        if (!p) continue;
        p.orient = { rot: (saved.orient.rot | 0) % 4, flip: !!saved.orient.flip };
        p.board = null;
        if (saved.board && canPlace(p, p.orient, saved.board.x, saved.board.y)) p.board = saved.board;
        p.hintKey = saved.hintKey || null;
      }
      startedAt = data.startedAt || null;
      solvedAt = data.solvedAt || null;
      hintsUsed = Math.min(MAX_HINTS, data.hintsUsed | 0);
      solvedHints = data.solvedHints | 0;
    } catch { /* ignorer ødelagt lagring */ }
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const playfield = $('playfield');
  const statusEl = $('status');
  const timerEl = $('timer');
  const showGoal = $('show-goal');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Felles mønster for treårer, referert fra alle brikkene.
  const defs = document.createElementNS(SVG_NS, 'svg');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML = `
    <defs>
      <pattern id="grain-h" patternUnits="userSpaceOnUse" width="1" height="0.11">
        <rect width="1" height="0.035" fill="rgba(0,0,0,0.13)"/>
        <rect y="0.06" width="1" height="0.015" fill="rgba(255,255,255,0.06)"/>
      </pattern>
      <pattern id="grain-v" patternUnits="userSpaceOnUse" width="0.11" height="1">
        <rect width="0.035" height="1" fill="rgba(0,0,0,0.13)"/>
        <rect x="0.06" width="0.015" height="1" fill="rgba(255,255,255,0.06)"/>
      </pattern>
      <linearGradient id="shine-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.45"/>
        <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.2"/>
      </linearGradient>
      <pattern id="tex-shine" patternUnits="userSpaceOnUse" width="1" height="1">
        <rect width="1" height="1" fill="url(#shine-grad)"/>
      </pattern>
      <pattern id="tex-speckle" patternUnits="userSpaceOnUse" width="0.5" height="0.5">
        <circle cx="0.1" cy="0.12" r="0.025" fill="rgba(255,255,255,0.2)"/>
        <circle cx="0.33" cy="0.3" r="0.018" fill="rgba(0,0,0,0.22)"/>
        <circle cx="0.42" cy="0.07" r="0.012" fill="rgba(255,255,255,0.15)"/>
        <circle cx="0.18" cy="0.42" r="0.02" fill="rgba(0,0,0,0.16)"/>
      </pattern>
    </defs>`;
  document.body.appendChild(defs);

  const boardEl = document.createElement('div');
  boardEl.className = 'board';
  const cellEls = new Map();
  for (const c of BOARD) {
    const el = document.createElement('div');
    el.className = 'cell ' + c.kind;
    el.textContent = c.label;
    el.style.gridColumn = c.x + 1;
    el.style.gridRow = c.y + 1;
    boardEl.appendChild(el);
    cellEls.set(c, el);
  }
  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.textContent = 'A-PUZZLE-A-DAY';
  boardEl.appendChild(brand);

  const trayEl = document.createElement('div');
  trayEl.className = 'tray';

  const ghostEl = document.createElementNS(SVG_NS, 'svg');
  ghostEl.classList.add('ghost');

  playfield.append(trayEl, boardEl, ghostEl);

  for (const p of pieces) {
    const el = document.createElement('div');
    el.className = 'piece';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Brikke ${p.index + 1}: ${p.name}`);
    el.addEventListener('pointerdown', e => onPointerDown(e, p));
    el.addEventListener('contextmenu', e => onContextMenu(e, p));
    el.addEventListener('keydown', e => onPieceKey(e, p));
    el.addEventListener('focus', () => select(p));
    el.addEventListener('animationend', () => el.classList.remove('shake', 'flash-in', 'flash-out'));
    // Hindrer at siden scroller når du drar en brikke på mobil.
    el.addEventListener('touchstart', e => { if (e.target.closest('.hit')) e.preventDefault(); }, { passive: false });
    playfield.appendChild(el);
    p.el = el;
  }

  // ---------- Layout ----------
  // Alle posisjoner regnes i "ruter" og ganges med rutestørrelsen ved tegning.
  const SLOT = 4.6; // hver brikke har en plass på 4×4 ruter i brikkeområdet
  const COMPACT_SCALE = 0.5; // på mobil vises brikkene i halv størrelse til du drar dem

  function computeLayout() {
    const availW = Math.max(240, document.getElementById('stage').clientWidth);
    const availH = Math.max(320, window.innerHeight - document.querySelector('.top').offsetHeight - 70);
    // `s` er hvor store brikkene er i brikkeområdet, i forhold til på brettet.
    const make = (where, cols, rows, s = 1) => {
      const slot = SLOT * s, trayW = cols * slot, trayH = rows * slot;
      if (where === 'right') {
        const W = 8 + 0.5 + trayW, H = Math.max(8, trayH);
        return { cols, s, W, H, board: { x: 0.5, y: (H - 8) / 2 + 0.5 }, tray: { x: 8.5, y: (H - trayH) / 2, w: trayW, h: trayH } };
      }
      const W = Math.max(8, trayW), H = 8 + 0.5 + trayH;
      return { cols, s, W, H, board: { x: (W - 8) / 2 + 0.5, y: 0.5 }, tray: { x: (W - trayW) / 2, y: 8.5, w: trayW, h: trayH } };
    };
    for (const l of [make('right', 4, 2), make('below', 4, 2)]) {
      l.u = Math.floor(Math.min(64, availW / l.W, availH / l.H));
      if (l.u >= 34) return l;
    }
    // Smal skjerm (mobil): små brikker tett under brettet, så brett og brikker får plass samtidig.
    const l = make('below', 4, 2, COMPACT_SCALE);
    l.u = Math.floor(Math.min(56, availW / l.W, availH / l.H));
    // Er skjermen for lav, holder det at selve spillflaten får plass – overskriften kan scrolles bort.
    if (l.u < 32) l.u = Math.floor(Math.min(56, availW / l.W, Math.max(32, (window.innerHeight - 24) / l.H)));
    return l;
  }

  // Brikker i brikkeområdet vises mindre på mobil; brikka du drar eller flytter, er alltid full størrelse.
  const pieceScale = p =>
    p.board || (drag && drag.p === p && drag.moved) || (kbd && kbd.p === p) ? 1 : layout.s;

  function homePos(p) {
    const { w, h } = sizeOf(cellsOf(p));
    const col = p.index % layout.cols, row = Math.floor(p.index / layout.cols);
    const s = layout.s;
    return {
      x: layout.tray.x + (col * SLOT + (SLOT - w) / 2) * s,
      y: layout.tray.y + (row * SLOT + (SLOT - h) / 2) * s,
    };
  }

  function displayPos(p) {
    if (drag && drag.p === p && drag.moved) return drag.pos;
    if (kbd && kbd.p === p) return { x: layout.board.x + kbd.x, y: layout.board.y + kbd.y };
    if (p.board) return { x: layout.board.x + p.board.x, y: layout.board.y + p.board.y };
    return homePos(p);
  }

  // ---------- Tegning ----------
  function pieceSvg(p, scale) {
    const cells = cellsOf(p);
    const { w, h } = sizeOf(cells);
    const set = new Set(cells.map(([x, y]) => key(x, y)));
    const e = 0.012; // litt overlapp så det ikke blir sømmer mellom rutene
    const skin = currentSkin();
    const tex = textureOf(skin, p.index);
    let fill = '', grain = '', hit = '', edges = '';
    cells.forEach(([x, y], i) => {
      const r = `x="${x - e}" y="${y - e}" width="${1 + 2 * e}" height="${1 + 2 * e}"`;
      fill += `<rect ${r} fill="${skin.colors[p.index]}"/>`;
      if (tex) grain += `<rect ${r} fill="url(#${tex})"/>`;
      hit += `<rect class="hit" data-i="${i}" ${r} fill="transparent"/>`;
      if (!set.has(key(x, y - 1))) edges += `M${x} ${y}H${x + 1}`;
      if (!set.has(key(x, y + 1))) edges += `M${x} ${y + 1}H${x + 1}`;
      if (!set.has(key(x - 1, y))) edges += `M${x} ${y}V${y + 1}`;
      if (!set.has(key(x + 1, y))) edges += `M${x + 1} ${y}V${y + 1}`;
    });
    return `<svg width="${w * layout.u * scale}" height="${h * layout.u * scale}" viewBox="0 0 ${w} ${h}">` +
      fill + grain + `<path class="edge" d="${edges}"/>` + hintBadge(p, cells) + hit + '</svg>';
  }

  // Brikker som ligger der et hint la dem, får en liten lyspære.
  const hasBadge = p => !!p.hintKey && p.hintKey === pieceKey(p);

  function hintBadge(p, cells) {
    if (!hasBadge(p)) return '';
    const [x, y] = cells[centerCell(p)];
    return `<text class="badge" x="${x + 0.5}" y="${y + 0.5}">💡</text>`;
  }

  function render() {
    const u = layout.u;
    playfield.style.setProperty('--u', u + 'px');
    playfield.style.width = layout.W * u + 'px';
    playfield.style.height = layout.H * u + 'px';
    playfield.classList.toggle('show-goal', showGoal.checked);

    boardEl.style.left = (layout.board.x - 0.35) * u + 'px';
    boardEl.style.top = (layout.board.y - 0.35) * u + 'px';
    Object.assign(trayEl.style, {
      left: layout.tray.x * u + 'px', top: layout.tray.y * u + 'px',
      width: layout.tray.w * u + 'px', height: layout.tray.h * u + 'px',
    });

    for (const c of BOARD) {
      cellEls.get(c).classList.toggle('goal', isGoal(c));
    }

    for (const p of pieces) {
      const scale = pieceScale(p);
      const svgKey = `${p.orient.rot}${p.orient.flip}${u}${scale}${hasBadge(p)}${look.skin}`;
      if (p.svgKey !== svgKey) {
        p.el.innerHTML = pieceSvg(p, scale);
        p.svgKey = svgKey;
      }
      const pos = displayPos(p);
      p.el.style.left = pos.x * u + 'px';
      p.el.style.top = pos.y * u + 'px';
      p.el.style.zIndex = drag && drag.p === p ? 500 : kbd && kbd.p === p ? 400 : p.z + 10;
      p.el.classList.toggle('selected', selected === p);
      p.el.classList.toggle('dragging', !!(drag && drag.p === p && drag.moved));
      p.el.classList.toggle('kbd', !!(kbd && kbd.p === p));
      p.el.classList.toggle('invalid', !!(kbd && kbd.p === p && !canPlace(p, p.orient, kbd.x, kbd.y)));
    }
    hintBtn.textContent = `💡 Hint (${MAX_HINTS - hintsUsed} igjen)`;
    hintBtn.disabled = hintsUsed >= MAX_HINTS || !!solvedAt;
    renderGhost();
  }

  // Viser hvor brikka havner hvis du slipper den nå (grønn = passer, rød = passer ikke).
  function renderGhost() {
    if (!drag || !drag.moved) { ghostEl.style.display = 'none'; return; }
    const { bx, by } = snapped();
    const cells = cellsOf(drag.p);
    const touchesBoard = cells.some(([x, y]) =>
      bx + x >= 0 && bx + x < BOARD_SIZE && by + y >= 0 && by + y < BOARD_SIZE);
    if (!touchesBoard) { ghostEl.style.display = 'none'; return; }
    const u = layout.u;
    const { w, h } = sizeOf(cells);
    ghostEl.style.display = 'block';
    ghostEl.style.left = (layout.board.x + bx) * u + 'px';
    ghostEl.style.top = (layout.board.y + by) * u + 'px';
    ghostEl.setAttribute('width', w * u);
    ghostEl.setAttribute('height', h * u);
    ghostEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    ghostEl.innerHTML = cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('');
    ghostEl.classList.toggle('invalid', !canPlace(drag.p, drag.p.orient, bx, by));
  }

  // ---------- Handlinger ----------
  function select(p) {
    if (selected === p) return;
    selected = p;
    render();
  }

  function bringToFront(p) { p.z = ++zCounter; }

  function startTimer() {
    if (!startedAt) startedAt = Date.now();
  }

  function shake(p) {
    p.el.classList.remove('shake');
    void p.el.offsetWidth; // start animasjonen på nytt
    p.el.classList.add('shake');
  }

  function commit() {
    save();
    render();
    evaluate();
  }

  // Ruta som er nærmest midten av brikka – brukes som dreiepunkt.
  function centerCell(p) {
    const cells = cellsOf(p);
    const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
    let best = 0, bestD = Infinity;
    cells.forEach(([x, y], i) => {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  // Roter eller speilvend en brikke. `pivot` er ruta som skal bli liggende i ro.
  function turn(p, kind, pivot = centerCell(p)) {
    const next = kind === 'rotate' ? rotated(p.orient) : flipped(p.orient);
    if (drag && drag.p === p) {
      p.orient = next;
      updateDragPos();
      render();
      return;
    }
    if (kbd && kbd.p === p) {
      const oc = cellsOf(p), nc = transform(p.cells, next);
      p.orient = next;
      kbd.x += oc[pivot][0] - nc[pivot][0];
      kbd.y += oc[pivot][1] - nc[pivot][1];
      clampKbd();
      render();
      return;
    }
    if (p.board) {
      const oc = cellsOf(p), nc = transform(p.cells, next);
      const nx = p.board.x + oc[pivot][0] - nc[pivot][0];
      const ny = p.board.y + oc[pivot][1] - nc[pivot][1];
      if (!canPlace(p, next, nx, ny)) { shake(p); say('Brikka får ikke plass hvis den snus her.'); return; }
      p.board = { x: nx, y: ny };
    }
    p.orient = next;
    startTimer();
    commit();
  }

  function sendHome(p) {
    p.board = null;
    commit();
  }

  function reset() {
    if (pieces.some(p => p.board) && !confirm('Vil du fjerne alle brikkene fra brettet og starte på nytt?')) return;
    pieces.forEach(p => { p.board = null; p.orient = { rot: 0, flip: false }; p.hintKey = null; });
    startedAt = null;
    solvedAt = null;
    solvedHints = 0;
    drag = kbd = null;
    commit();
  }

  // ---------- Mus / berøring ----------
  let lastPointerType = 'mouse';

  function pointerUnits(e) {
    const r = playfield.getBoundingClientRect();
    return { x: (e.clientX - r.left) / layout.u, y: (e.clientY - r.top) / layout.u };
  }

  function updateDragPos() {
    const [cx, cy] = cellsOf(drag.p)[drag.cell];
    drag.pos = { x: drag.pointer.x - cx - drag.frac.x, y: drag.pointer.y - cy - drag.frac.y };
  }

  function snapped() {
    return {
      bx: Math.round(drag.pos.x - layout.board.x),
      by: Math.round(drag.pos.y - layout.board.y),
    };
  }

  function onPointerDown(e, p) {
    lastPointerType = e.pointerType;
    const hit = e.target.closest('.hit');
    if (!hit || e.button !== 0 || drag) return;
    e.preventDefault();
    if (kbd) cancelKbd();
    p.el.focus({ preventScroll: true });
    select(p);

    const cell = Number(hit.dataset.i);
    const pointer = pointerUnits(e);
    const start = displayPos(p);
    const scale = pieceScale(p);
    const [cx, cy] = cellsOf(p)[cell];
    drag = {
      p, cell, pointer,
      // Hvor i ruta du tok tak (0–1), så samme punkt blir under fingeren når brikka vokser til full størrelse.
      frac: { x: (pointer.x - start.x) / scale - cx, y: (pointer.y - start.y) / scale - cy },
      startClient: { x: e.clientX, y: e.clientY },
      moved: false,
      shift: e.shiftKey,
      origin: { orient: { ...p.orient }, board: p.board },
    };
    updateDragPos();
  }

  window.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved) {
      const dx = e.clientX - drag.startClient.x, dy = e.clientY - drag.startClient.y;
      if (dx * dx + dy * dy < 25) return;
      drag.moved = true;
      bringToFront(drag.p);
      startTimer();
    }
    drag.pointer = pointerUnits(e);
    updateDragPos();
    render();
  });

  window.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag;
    if (!d.moved) {
      // Et klikk uten draing: roter (eller speilvend med Shift), rundt ruta du klikket på.
      drag = null;
      turn(d.p, d.shift || e.shiftKey ? 'flip' : 'rotate', d.cell);
      return;
    }
    const { bx, by } = snapped();
    d.p.board = canPlace(d.p, d.p.orient, bx, by) ? { x: bx, y: by } : null;
    drag = null;
    commit();
  });

  window.addEventListener('pointercancel', () => {
    if (drag) cancelDrag();
  });

  function cancelDrag() {
    drag.p.orient = drag.origin.orient;
    drag.p.board = drag.origin.board;
    drag = null;
    render();
  }

  // Scrollehjulet roterer brikka mens du drar.
  window.addEventListener('wheel', e => {
    if (!drag || !drag.moved) return;
    e.preventDefault();
    turn(drag.p, 'rotate');
  }, { passive: false });

  function onContextMenu(e, p) {
    e.preventDefault();
    if (lastPointerType === 'touch') return; // langt trykk på mobil skal ikke speilvende
    if (drag && drag.p !== p) return;
    const hit = e.target.closest('.hit');
    turn(p, 'flip', drag ? undefined : hit ? Number(hit.dataset.i) : undefined);
  }

  // ---------- Tastatur ----------
  function firstFreeSpot(p) {
    for (let y = 0; y < BOARD_SIZE; y++)
      for (let x = 0; x < BOARD_SIZE; x++)
        if (canPlace(p, p.orient, x, y)) return { x, y };
    return { x: 0, y: 0 };
  }

  function clampKbd() {
    const { w, h } = sizeOf(cellsOf(kbd.p));
    kbd.x = Math.min(Math.max(kbd.x, 0), BOARD_SIZE - w);
    kbd.y = Math.min(Math.max(kbd.y, 0), BOARD_SIZE - h);
  }

  function startKbd(p) {
    const spot = p.board || firstFreeSpot(p);
    kbd = { p, x: spot.x, y: spot.y, origin: { orient: { ...p.orient }, board: p.board } };
    bringToFront(p);
    startTimer();
    render();
    say(`${p.name} er plukket opp. Flytt med piltastene, Enter for å legge den ned, Esc for å avbryte.`);
  }

  function dropKbd() {
    const { p, x, y } = kbd;
    if (!canPlace(p, p.orient, x, y)) { shake(p); say('Brikka får ikke plass her.'); return; }
    p.board = { x, y };
    kbd = null;
    commit();
  }

  function cancelKbd() {
    kbd.p.orient = kbd.origin.orient;
    kbd.p.board = kbd.origin.board;
    kbd = null;
    render();
  }

  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  function onPieceKey(e, p) {
    if (drag) return;
    const k = e.key;
    if (ARROWS[k]) {
      e.preventDefault();
      if (!kbd || kbd.p !== p) { startKbd(p); return; }
      kbd.x += ARROWS[k][0];
      kbd.y += ARROWS[k][1];
      clampKbd();
      render();
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (kbd && kbd.p === p) dropKbd(); else startKbd(p);
    } else if (k === 'Escape' && kbd && kbd.p === p) {
      e.preventDefault();
      cancelKbd();
    } else if ((k === 'Delete' || k === 'Backspace') && !kbd) {
      e.preventDefault();
      sendHome(p);
    }
  }

  // R/F virker på brikka du drar, flytter med tastaturet, eller sist valgte brikke.
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea') || e.metaKey || e.ctrlKey || e.altKey || openModalEl()) return;
    const k = e.key.toLowerCase();
    if (drag && drag.moved) {
      if (k === 'r') turn(drag.p, 'rotate');
      else if (k === 'f') turn(drag.p, 'flip');
      else if (k === 'escape') cancelDrag();
      return;
    }
    const target = kbd ? kbd.p : selected;
    if (!target) return;
    if (k === 'r') { e.preventDefault(); turn(target, 'rotate'); }
    else if (k === 'f') { e.preventDefault(); turn(target, 'flip'); }
  });

  // ---------- Hint ----------
  const hintBtn = $('btn-hint');
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const list = names => names.length > 1 ? names.slice(0, -1).join(', ') + ' og ' + names[names.length - 1] : names[0];

  function flash(p, cls) {
    p.el.classList.remove('flash-in', 'flash-out');
    void p.el.offsetWidth;
    p.el.classList.add(cls);
  }

  // Velger løsningen som beholder flest mulig av brikkene du har lagt selv.
  // Brikker som ikke passer inn i den løsningen, sendes tilbake, og én brikke legges riktig.
  function hint() {
    if (hintsUsed >= MAX_HINTS || solvedAt || drag) return;
    if (kbd) cancelKbd();

    const placed = pieces.filter(p => p.board);
    let best = [], bestScore = -1;
    for (const sol of allSolutions()) {
      const score = placed.filter(p => sol[p.index].cellsKey === pieceKey(p)).length;
      if (score > bestScore) { bestScore = score; best = [sol]; }
      else if (score === bestScore) best.push(sol);
    }
    const sol = best[Math.floor(Math.random() * best.length)];
    const wrong = placed.filter(p => sol[p.index].cellsKey !== pieceKey(p));
    const missing = pieces.filter(p => !p.board);
    // Lå noe feil, viser vi hvor en av de feilplasserte brikkene egentlig skal ligge.
    const target = wrong[0] || missing[Math.floor(Math.random() * missing.length)];

    for (const p of wrong) {
      p.board = null;
      p.hintKey = null;
      if (p !== target) flash(p, 'flash-out');
    }
    target.orient = { ...sol[target.index].orient };
    target.board = { ...sol[target.index].board };
    target.hintKey = pieceKey(target);
    bringToFront(target);
    hintsUsed++;
    startTimer();
    selected = target;
    commit();
    flash(target, 'flash-in');

    if (solvedAt) return; // hintet la siste brikke – gratulasjonen tar over
    let msg = `Hint ${hintsUsed} av ${MAX_HINTS}: `;
    if (wrong.length) {
      msg += `${cap(target.the)} lå slik at puslespillet ikke kunne løses. Nå ligger den riktig.`;
      const others = wrong.filter(p => p !== target);
      if (others.length) {
        msg += ` ${cap(list(others.map(p => p.the)))} måtte også flyttes og er lagt tilbake.`;
      }
    } else {
      msg += `Her skal ${target.the} ligge.`;
    }
    say(msg);
  }

  hintBtn.addEventListener('click', hint);

  // ---------- Sjekk av løsning ----------
  function say(text, solved = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('solved', solved);
  }

  const formatTime = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    const mmss = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return h ? `${h}:${mmss}` : mmss;
  };

  function evaluate() {
    const placed = pieces.filter(p => p.board).length;
    const solvedText = solvedAt ? ` Dagens oppgave er allerede løst (${formatTime(solvedAt - startedAt)}).` : '';
    if (placed < pieces.length) {
      say(`${placed} av ${pieces.length} brikker ligger på brettet.` + solvedText, false);
      return;
    }
    const covered = new Set();
    for (const p of pieces) for (const [x, y] of cellsOf(p)) covered.add(key(p.board.x + x, p.board.y + y));
    const open = BOARD.filter(c => !covered.has(key(c.x, c.y)));
    const ok = open.length === 2 &&
      open.some(c => c.kind === 'month' && c.value === date.month) &&
      open.some(c => c.kind === 'day' && c.value === date.day);

    if (!ok) {
      say(`Alle brikkene ligger, men brettet viser ${open.map(c => c.label).join(' og ')} – ikke dagens dato. Prøv igjen!`);
      return;
    }
    if (!solvedAt) {
      const before = reached(computeStats()); // for å se hvilke milepæler denne løsningen ga
      solvedAt = Date.now();
      solvedHints = hintsUsed;
      if (!startedAt) startedAt = solvedAt;
      save();
      showWin(before);
      syncNow();
    }
    say(`Løst! Brettet viser ${date.short}. Tid: ${formatTime(solvedAt - startedAt)}. ${helpText()}`, true);
  }

  // ---------- Gratulasjon ----------
  const winEl = $('win');

  function showWin(before) {
    $('win-text').textContent =
      `Du løste dagens puslespill for ${date.short} på ${formatTime(solvedAt - startedAt)}.`;
    $('win-help').textContent = helpText();
    $('win-help').classList.toggle('unaided', solvedHints === 0);
    const st = computeStats();
    const { streak } = st;
    $('win-streak').textContent = streak.current > 1 ? `🔥 ${streak.current} dager på rad!` : '';
    $('win-streak').hidden = streak.current < 2;
    renderWinMilestones(st, before);
    openModal(winEl, $('btn-close-win'));
    confetti();
    persistStorage();
  }

  function helpText() {
    if (solvedHints === 0) return 'Helt uten hjelp! 🏆';
    return `Du måtte få hjelp ${solvedHints} ${solvedHints === 1 ? 'gang' : 'ganger'}.`;
  }

  // ---------- Dialoger ----------
  let returnFocus = null;
  const openModalEl = () => document.querySelector('.modal:not([hidden])');

  function openModal(el, focusEl) {
    const open = openModalEl();
    if (open) open.hidden = true; // f.eks. fra gratulasjon til statistikk
    else returnFocus = document.activeElement;
    el.hidden = false;
    // Lange dialoger skal åpne øverst, selv om fokus havner på Lukk-knappen nederst.
    el.querySelector('.modal-card').scrollTop = 0;
    focusEl.focus({ preventScroll: true });
  }

  function closeModal() {
    const open = openModalEl();
    if (!open) return;
    open.hidden = true;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  for (const el of document.querySelectorAll('.modal')) {
    el.addEventListener('click', e => { if (e.target === el) closeModal(); });
  }
  for (const btn of document.querySelectorAll('.btn-close-modal')) btn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ---------- Statistikk ----------
  // Alt regnes ut fra det som allerede ligger lagret i nettleseren, én post per dag.
  function history(todayKey) {
    const days = new Map();
    let keys = [];
    try { keys = Object.keys(localStorage); } catch { return days; }
    for (const k of keys) {
      const m = /^apad:v1:(\d{4}-\d{2}-\d{2})$/.exec(k);
      if (!m || m[1] > todayKey) continue;
      try {
        const data = JSON.parse(localStorage.getItem(k));
        if (!data || data.test) continue;
        const solved = !!data.solvedAt;
        days.set(m[1], {
          solved,
          time: solved && data.startedAt ? data.solvedAt - data.startedAt : null,
          hints: data.hintsUsed | 0,
          unaided: solved && !(data.solvedHints | 0),
        });
      } catch { /* hopp over ødelagte dager */ }
    }
    return days;
  }

  // Lengste og nåværende rekke med dager der `ok` gjelder. Er ikke dagens løst ennå,
  // lever rekka fra i går fortsatt.
  function streakOf(days, todayKey, ok) {
    const hit = k => days.has(k) && ok(days.get(k));
    let longest = 0, run = 0, prev = null;
    for (const k of [...days.keys()].sort()) {
      if (!hit(k)) { run = 0; prev = null; continue; }
      run = prev && addDays(prev, 1) === k ? run + 1 : 1;
      prev = k;
      longest = Math.max(longest, run);
    }
    let current = 0;
    let k = hit(todayKey) ? todayKey : addDays(todayKey, -1);
    while (hit(k)) { current++; k = addDays(k, -1); }
    return { current, longest };
  }

  function computeStats() {
    const todayKey = isoDate(new Date());
    const days = history(todayKey);
    const all = [...days.values()];
    const times = all.filter(d => d.time != null).map(d => d.time).sort((a, b) => a - b);
    return {
      todayKey,
      days,
      played: days.size,
      solved: all.filter(d => d.solved).length,
      unaided: all.filter(d => d.unaided).length,
      hints: all.reduce((sum, d) => sum + d.hints, 0),
      hintDays: all.filter(d => d.hints > 0).length,
      times,
      bestUnaided: Math.min(...all.filter(d => d.unaided && d.time != null).map(d => d.time)),
      avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
      median: times.length ? times[Math.floor((times.length - 1) / 2)] : null,
      best: times.length ? times[0] : null,
      streak: streakOf(days, todayKey, d => d.solved),
      cleanStreak: streakOf(days, todayKey, d => d.unaided),
    };
  }

  const BUCKETS = [
    { max: 1, label: '< 1 min' }, { max: 2, label: '1–2 min' }, { max: 5, label: '2–5 min' },
    { max: 10, label: '5–10 min' }, { max: 20, label: '10–20 min' }, { max: Infinity, label: '20+ min' },
  ];
  const bucketOf = ms => BUCKETS.findIndex(b => ms < b.max * 60000);
  const WEEKS = 15;
  const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

  function tile(value, label) {
    return `<div class="tile"><div class="tile-value">${esc(value)}</div><div class="tile-label">${esc(label)}</div></div>`;
  }

  function renderStats() {
    const st = computeStats();
    const body = $('stats-body');
    if (!st.played) {
      body.innerHTML = '<p class="stats-empty">Ingen statistikk ennå. Løs dagens puslespill, så begynner tellingen!</p>';
      $('btn-share-stats').hidden = true;
      return;
    }
    const t = ms => ms == null ? '–' : formatTime(ms);

    // Fordeling av løsetider, med dagens tid uthevet.
    const counts = BUCKETS.map(() => 0);
    st.times.forEach(ms => counts[bucketOf(ms)]++);
    const todayTime = st.days.get(st.todayKey)?.time;
    const todayBucket = todayTime != null ? bucketOf(todayTime) : -1;
    const maxCount = Math.max(...counts, 1);
    const bars = BUCKETS.map((b, i) => `
      <div class="bar-row${i === todayBucket ? ' today' : ''}">
        <span class="bar-label">${b.label}</span>
        <span class="bar-track"><span class="bar" style="width:${Math.max(counts[i] ? 8 : 0, counts[i] / maxCount * 100)}%"></span></span>
        <span class="bar-count">${counts[i]}</span>
      </div>`).join('');

    // Kalender for de siste ukene, én kolonne per uke (mandag øverst).
    const todayDate = parseIso(st.todayKey);
    const start = addDays(st.todayKey, -((todayDate.getDay() + 6) % 7) - (WEEKS - 1) * 7);
    let cells = '';
    for (let k = start; k <= st.todayKey; k = addDays(k, 1)) {
      const d = st.days.get(k);
      const cls = !d ? '' : d.unaided ? 'unaided' : d.solved ? 'aided' : 'started';
      const what = !d ? 'ikke spilt' : d.unaided ? `løst uten hint (${t(d.time)})`
        : d.solved ? `løst med ${d.hints} hint (${t(d.time)})` : 'påbegynt';
      const label = parseIso(k).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' });
      cells += `<span class="cal-day ${cls}${k === st.todayKey ? ' is-today' : ''}" title="${esc(label)}: ${what}"></span>`;
    }

    body.innerHTML = `
      <div class="tiles">
        ${tile(st.streak.current, 'dager på rad')}
        ${tile(st.streak.longest, 'lengste rekke')}
        ${tile(st.solved, 'dager løst')}
      </div>
      <div class="tiles">
        ${tile(t(st.avg), 'snittid')}
        ${tile(t(st.median), 'mediantid')}
        ${tile(t(st.best), 'beste tid')}
      </div>
      <div class="tiles">
        ${tile(st.unaided, 'løst uten hint')}
        ${tile(st.cleanStreak.current, 'på rad uten hint')}
        ${tile(st.hints, 'hint brukt totalt')}
      </div>
      <h3>Løsetider</h3>
      <div class="bars">${bars}</div>
      <h3>Siste ${WEEKS} uker</h3>
      <div class="calendar" role="img" aria-label="Kalender: ${st.solved} av ${st.played} påbegynte dager er løst">${cells}</div>
      <div class="legend" aria-hidden="true">
        <span><i class="cal-day unaided"></i>Uten hint</span>
        <span><i class="cal-day aided"></i>Med hint</span>
        <span><i class="cal-day started"></i>Påbegynt</span>
      </div>
`;
    $('btn-share-stats').hidden = !st.days.get(st.todayKey)?.solved;
  }

  function showStats() {
    renderStats();
    $('backup-status').hidden = true;
    renderBackupNote();
    // Lastes inn nå, så innloggingsvinduet kan åpnes med en gang knappen trykkes
    // (ellers kan nettleseren blokkere det).
    loadSync().catch(() => { /* vises i renderSync */ });
    renderSync();
    openModal($('stats'), $('btn-close-stats'));
  }

  // ---------- Sikkerhetskopi ----------
  // Alt spillet lagrer, ligger under nøkler som begynner med «apad:». En sikkerhetskopi er
  // disse nøklene i en JSON-fil, og når den hentes inn, slås den sammen med det som ligger her.
  const BACKUP_APP = 'a-puzzle-a-day';
  const DAY_KEY = /^apad:v1:\d{4}-\d{2}-\d{2}$/;
  const OTHER_KEYS = ['apad:look', 'apad:seenMilestones', 'apad:showGoal'];

  // Ber nettleseren om å ikke rydde bort dataene av seg selv (f.eks. Safaris sju-dagersregel).
  // Nettleseren avgjør selv; vi spør først når spilleren faktisk har noe å miste.
  async function persistStorage() {
    try {
      if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
    } catch { /* ikke støttet */ }
  }

  async function renderBackupNote() {
    let persisted = false;
    try { persisted = !!(await navigator.storage?.persisted?.()); } catch { /* ikke støttet */ }
    $('backup-note').textContent = (syncUser
      ? 'Du er logget inn, så fremgangen ligger også i skyen. '
      : 'Statistikken og milepælene ligger bare i denne nettleseren' +
        (persisted ? ', og nettleseren har lovet å ikke slette dem av seg selv. ' : '. ')) +
      'Ta en sikkerhetskopi, eller hent inn en fra en annen enhet eller nettleser.';
  }

  function backupStatus(text, error = false) {
    const el = $('backup-status');
    el.textContent = text;
    el.classList.toggle('error', error);
    el.hidden = false;
  }

  function exportBackup() {
    const data = {};
    try {
      for (const k of Object.keys(localStorage)) {
        if (DAY_KEY.test(k) || OTHER_KEYS.includes(k)) data[k] = localStorage.getItem(k);
      }
    } catch { backupStatus('Fikk ikke lest lagringen i nettleseren.', true); return; }
    const todayKey = isoDate(new Date());
    const file = JSON.stringify({ app: BACKUP_APP, version: 1, exported: todayKey, data }, null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
    a.download = `a-puzzle-a-day-${todayKey}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    const days = Object.keys(data).filter(k => DAY_KEY.test(k)).length;
    backupStatus(`✓ Sikkerhetskopi med ${days} ${days === 1 ? 'dag' : 'dager'} er lastet ned.`);
  }

  // To lagrede utgaver av samme dag: en løst dag slår en uløst, og er begge løst, gjelder den
  // første løsningen. Er ingen løst, beholdes den lokale, men hint-telleren kan ikke gå ned.
  function mergeDay(local, other) {
    if (!local) return other;
    if (!other) return local;
    if (!!local.solvedAt !== !!other.solvedAt) return local.solvedAt ? local : other;
    if (local.solvedAt) return other.solvedAt < local.solvedAt ? other : local;
    return { ...local, hintsUsed: Math.max(local.hintsUsed | 0, other.hintsUsed | 0) };
  }

  function parseJson(s) {
    try { return JSON.parse(s); } catch { return undefined; }
  }

  // Slår sammen lagrede nøkler (samme format som i localStorage) med det som ligger her.
  // Brukes både av sikkerhetskopien og synkroniseringen. Kaster feil hvis lagringen ikke virker.
  function mergeIntoStorage(entries) {
    let added = 0, updated = 0;
    for (const [k, v] of Object.entries(entries)) {
      if (typeof v !== 'string') continue;
      const local = localStorage.getItem(k);
      if (DAY_KEY.test(k)) {
        const other = parseJson(v);
        if (!other || typeof other !== 'object') continue;
        const value = JSON.stringify(mergeDay(parseJson(local) || null, other));
        if (local == null) added++;
        else if (value !== local) updated++;
        if (value !== local) localStorage.setItem(k, value);
      } else if (k === 'apad:seenMilestones') {
        const seen = new Set([...(parseJson(local) || []), ...(parseJson(v) || [])]);
        localStorage.setItem(k, JSON.stringify([...seen]));
      } else if (OTHER_KEYS.includes(k) && local == null) {
        localStorage.setItem(k, v); // valgt utseende o.l. overstyrer ikke det som er valgt her
      }
    }
    return { added, updated };
  }

  // Last inn dagens brett, utseende og statistikk på nytt etter at lagringen er endret utenfra.
  function refreshAfterMerge() {
    if (drag || kbd) return; // brettet lastes inn neste gang i stedet for midt i et trekk
    load();
    loadLook();
    updateLooksBadge();
    render();
    evaluate();
    if (!$('stats').hidden) renderStats();
  }

  function importBackup(text) {
    const backup = parseJson(text);
    if (!backup || backup.app !== BACKUP_APP || typeof backup.data !== 'object' || !backup.data) {
      backupStatus('Dette ser ikke ut som en sikkerhetskopi fra A-Puzzle-A-Day.', true);
      return;
    }
    let added, updated;
    try {
      ({ added, updated } = mergeIntoStorage(backup.data));
    } catch {
      backupStatus('Fikk ikke lagret sikkerhetskopien i nettleseren.', true);
      return;
    }
    refreshAfterMerge();
    persistStorage();
    syncNow();
    backupStatus(added || updated
      ? `✓ Hentet inn: ${added} ${added === 1 ? 'ny' : 'nye'} og ${updated} ${updated === 1 ? 'oppdatert' : 'oppdaterte'} ${added + updated === 1 ? 'dag' : 'dager'}.`
      : '✓ Sikkerhetskopien er hentet inn. Alt i den fantes allerede her.');
  }

  $('btn-export').addEventListener('click', exportBackup);
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = ''; // så samme fil kan velges igjen
    if (file) importBackup(await file.text());
  });

  // ---------- Innlogging og synkronisering ----------
  // Valgfritt: localStorage er fortsatt hovedlagringen. Med innlogging hentes det som ligger
  // i skyen, slås sammen med det som ligger her (som en sikkerhetskopi), og resultatet lagres
  // tilbake. Dette skjer ved innlogging, når en oppgave er løst, og når siden lukkes eller åpnes igjen.
  const SYNC_KEY = 'apad:sync'; // satt når spilleren er logget inn i denne nettleseren
  const SYNC_AGAIN_MS = 5 * 60000; // synk igjen når siden vises, hvis det er så lenge siden
  let sync = null;           // sync.js, når den er lastet
  let syncLoading = null;
  let syncUser = undefined;  // undefined = vet ikke ennå, null = ikke logget inn
  let syncBusy = false;
  let syncLast = null;
  let syncError = null;

  function loadSync() {
    if (!syncLoading) {
      syncLoading = import('./sync.js').then(m => {
        sync = m;
        m.onUser(user => {
          syncUser = user;
          try {
            if (user) localStorage.setItem(SYNC_KEY, '1'); else localStorage.removeItem(SYNC_KEY);
          } catch { /* ignorer */ }
          if (user) syncNow();
          renderSync();
        });
        return m;
      });
      syncLoading.catch(() => {
        syncLoading = null;
        syncError = 'Fikk ikke kontakt med innloggingen. Sjekk nettforbindelsen og prøv igjen.';
        renderSync();
      });
    }
    return syncLoading;
  }

  // Det som synkroniseres: bare tallene statistikken og milepælene trenger, ikke brikkenes plass.
  function cloudData() {
    const days = {};
    let seen = [], look = null;
    for (const k of Object.keys(localStorage)) {
      if (!DAY_KEY.test(k)) continue;
      const d = parseJson(localStorage.getItem(k));
      if (!d || d.test) continue;
      days[k.slice(8)] = {
        startedAt: d.startedAt || null, solvedAt: d.solvedAt || null,
        hintsUsed: d.hintsUsed | 0, solvedHints: d.solvedHints | 0,
      };
    }
    seen = (parseJson(localStorage.getItem('apad:seenMilestones')) || []).slice().sort();
    look = parseJson(localStorage.getItem(LOOK_KEY)) || null;
    return { days, seen, look };
  }

  function cloudToEntries(remote) {
    const entries = {};
    for (const [day, d] of Object.entries(remote.days || {})) entries['apad:v1:' + day] = JSON.stringify(d);
    if (Array.isArray(remote.seen)) entries['apad:seenMilestones'] = JSON.stringify(remote.seen);
    if (remote.look) entries[LOOK_KEY] = JSON.stringify(remote.look);
    return entries;
  }

  // Sammenligner uavhengig av rekkefølgen på nøklene.
  const canon = v => Array.isArray(v) ? '[' + v.map(canon).join() + ']'
    : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join() + '}'
    : JSON.stringify(v ?? null);

  async function syncNow() {
    if (!sync || !syncUser || syncBusy) return;
    syncBusy = true;
    syncDirty = false;
    renderSync();
    try {
      const remote = (await sync.pull()) || {};
      const { added, updated } = mergeIntoStorage(cloudToEntries(remote));
      const merged = cloudData();
      const { days, seen, look } = remote;
      if (canon({ days, seen, look }) !== canon(merged)) await sync.push({ ...merged, updatedAt: Date.now() });
      if (added || updated) refreshAfterMerge();
      syncLast = Date.now();
      syncError = null;
    } catch {
      syncDirty = true;
      syncError = 'Synkroniseringen mislyktes. Spillet prøver igjen senere, og ingenting er tapt.';
    }
    syncBusy = false;
    renderSync();
  }

  async function signIn() {
    syncError = null;
    try {
      await (sync || await loadSync()).signIn(); // onUser tar seg av resten
      persistStorage();
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      syncError = e?.code === 'auth/popup-blocked'
        ? 'Nettleseren blokkerte innloggingsvinduet. Trykk på knappen en gang til.'
        : 'Innloggingen mislyktes. Sjekk nettforbindelsen og prøv igjen.';
      renderSync();
    }
  }

  async function signOut() {
    await syncNow(); // få med det siste før vi logger ut
    try { await sync.signOut(); } catch { /* onUser oppdaterer uansett */ }
  }

  async function deleteCloud() {
    if (!confirm('Vil du slette fremgangen din fra skyen og kontoen din i spillet? ' +
      'Det som ligger i denne nettleseren, blir liggende.')) return;
    try {
      await sync.deleteAccount();
      syncError = null;
      syncLast = null;
      say('Dataene dine i skyen og kontoen din er slettet.');
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user') return;
      syncError = 'Fikk ikke slettet dataene. Prøv igjen.';
    }
    renderSync();
  }

  function renderSync() {
    const body = $('sync-body');
    renderBackupNote();
    const status = syncError ? `<p class="stats-note backup-status error" role="status">${esc(syncError)}</p>` : '';
    if (syncUser) {
      const when = syncBusy ? 'Synkroniserer …'
        : syncLast ? `Sist synkronisert kl. ${new Date(syncLast).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}.`
        : '';
      body.innerHTML = `
        <p class="stats-note sync-user">Logget inn som <b>${esc(syncUser.email || syncUser.displayName || 'deg')}</b>. ${when}</p>
        <div class="modal-actions">
          <button type="button" data-sync="now"${syncBusy ? ' disabled' : ''}>🔄 Synkroniser nå</button>
          <button type="button" data-sync="out">Logg ut</button>
          <button type="button" data-sync="delete">Slett data i skyen</button>
        </div>${status}`;
      return;
    }
    const waiting = syncUser === undefined && syncLoading;
    body.innerHTML = `
      <p class="stats-note">Logg inn med Google for å ta vare på fremgangen og bruke den på flere enheter.
        Spillet virker like bra uten.</p>
      <div class="modal-actions">
        <button type="button" data-sync="in"${waiting ? ' disabled' : ''}>Logg inn med Google</button>
      </div>${status}
      <p class="stats-note sync-privacy">Ved innlogging lagres spillhistorikken din (datoer, tider,
        antall hint og valgt utseende) hos Google Firebase på servere i EU (Finland). Innloggingen og
        e-postadressen din håndteres av Google. Du kan slette alt når du vil.</p>`;
  }

  $('sync-body').addEventListener('click', e => {
    const action = e.target.closest('button[data-sync]')?.dataset.sync;
    if (action === 'in') signIn();
    else if (action === 'now') syncNow();
    else if (action === 'out') signOut();
    else if (action === 'delete') deleteCloud();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (syncDirty) syncNow(); }
    else if (!syncLast || Date.now() - syncLast > SYNC_AGAIN_MS) syncNow();
  });

  // ---------- Deling ----------
  async function share(btn) {
    const { streak } = computeStats();
    const lines = [
      `🧩 A-Puzzle-A-Day · ${date.short}`,
      `⏱️ ${formatTime(solvedAt - startedAt)} · ${solvedHints ? `💡 ${solvedHints} hint` : '🏆 uten hint'}`,
    ];
    if (streak.current > 1) lines.push(`🔥 ${streak.current} dager på rad`);
    const url = location.origin + location.pathname;
    const text = lines.join('\n');
    // Delemenyen passer på mobil; på PC er det enklere å kopiere.
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ text: text + '\n' + url }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const old = btn.textContent;
    try {
      await navigator.clipboard.writeText(text + '\n' + url);
      btn.textContent = '✓ Kopiert!';
    } catch {
      btn.textContent = 'Kunne ikke kopiere';
    }
    setTimeout(() => { btn.textContent = old; }, 2000);
  }

  $('btn-stats').addEventListener('click', showStats);
  $('btn-win-stats').addEventListener('click', showStats);
  $('btn-share-win').addEventListener('click', e => share(e.currentTarget));
  $('btn-share-stats').addEventListener('click', e => share(e.currentTarget));

  // ---------- Milepæler og utseende ----------
  // Hver milepæl låser opp en bakgrunn eller et utseende på brikkene. Alt regnes ut fra
  // statistikken, så dager som ble spilt før milepælene fantes, teller også.
  const THEMES = [
    { id: 'standard', name: 'Standard' },
    { id: 'skog', name: 'Skog' },
    { id: 'hav', name: 'Hav' },
    { id: 'solnedgang', name: 'Solnedgang' },
    { id: 'natt', name: 'Stjernenatt' },
  ];

  // Én farge per brikke, i samme rekkefølge som PIECE_DEFS.
  const SKINS = [
    { id: 'tre', name: 'Klassisk tre', texture: 'grain', colors: PIECE_DEFS.map(d => d.color) },
    { id: 'bjork', name: 'Bjørk', texture: 'grain',
      colors: ['#d9b98a', '#b98f5a', '#cfae7c', '#ead6b0', '#c4a070', '#a87d4c', '#e3c79a', '#bf9864'] },
    { id: 'regnbue', name: 'Regnbue', texture: 'shine',
      colors: ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#6a4c93', '#f28482', '#90be6d'] },
    { id: 'skifer', name: 'Skifer', texture: 'speckle',
      colors: ['#5b6770', '#3e474f', '#6f7b84', '#8a959c', '#4a555e', '#2f373e', '#7c878e', '#56616a'] },
    { id: 'pastell', name: 'Pastell', texture: 'shine',
      colors: ['#f6bd60', '#f7a8b8', '#a0c4ff', '#bdb2ff', '#b9e7ae', '#ffd6a5', '#9be3ec', '#f3b8f0'] },
    { id: 'neon', name: 'Neon', texture: 'shine',
      colors: ['#ff2e88', '#00d9ff', '#a6f53a', '#ffd60a', '#9d4edd', '#ff6d00', '#00f5a0', '#4361ee'] },
    { id: 'gull', name: 'Gull', texture: 'shine',
      colors: ['#d4a017', '#b8860b', '#e6be4a', '#c99a2e', '#f0c75e', '#a67c00', '#dcb33f', '#c4911c'] },
  ];

  // `goal` er et antall som `value` skal nå; `minutes` er en tid (uten hint) som skal slås.
  const MILESTONES = [
    { id: 'first', text: 'Løs ditt første puslespill', skin: 'bjork', goal: 1, value: st => st.solved },
    { id: 'unaided3', text: 'Løs 3 puslespill uten hint', theme: 'skog', goal: 3, value: st => st.unaided },
    { id: 'solved5', text: 'Løs 5 puslespill (hint er lov)', skin: 'regnbue', goal: 5, value: st => st.solved },
    { id: 'streak3', text: 'Løs 3 dager på rad', theme: 'hav', goal: 3, value: st => st.streak.longest },
    { id: 'fast5', text: 'Løs uten hint på under 5 minutter', skin: 'skifer', minutes: 5 },
    { id: 'solved10', text: 'Løs 10 puslespill', theme: 'solnedgang', goal: 10, value: st => st.solved },
    { id: 'streak7', text: 'Løs 7 dager på rad', skin: 'pastell', goal: 7, value: st => st.streak.longest },
    { id: 'unaided10', text: 'Løs 10 puslespill uten hint', theme: 'natt', goal: 10, value: st => st.unaided },
    { id: 'fast2', text: 'Løs uten hint på under 2 minutter', skin: 'neon', minutes: 2 },
    { id: 'solved30', text: 'Løs 30 puslespill', skin: 'gull', goal: 30, value: st => st.solved },
  ];

  function progress(m, st) {
    if (m.minutes) {
      const best = Number.isFinite(st.bestUnaided) ? st.bestUnaided : null;
      return {
        done: best != null && best < m.minutes * 60000,
        ratio: best == null ? 0 : Math.min(1, m.minutes * 60000 / best),
        text: best == null ? 'ingen løsning uten hint ennå' : `beste tid uten hint: ${formatTime(best)}`,
      };
    }
    const v = Math.min(m.goal, m.value(st));
    return { done: v >= m.goal, ratio: v / m.goal, text: `${v} av ${m.goal}` };
  }

  const reached = st => new Set(MILESTONES.filter(m => progress(m, st).done).map(m => m.id));
  const milestoneFor = (kind, id) => MILESTONES.find(m => m[kind] === id);
  const itemsOf = kind => (kind === 'theme' ? THEMES : SKINS);
  const rewardName = m => m.theme
    ? `bakgrunnen «${THEMES.find(t => t.id === m.theme).name}»`
    : `brikkene «${SKINS.find(s => s.id === m.skin).name}»`;

  function isOpen(kind, id, done) {
    if (!itemsOf(kind).some(item => item.id === id)) return false;
    const m = milestoneFor(kind, id);
    return !m || done.has(m.id);
  }

  // Det valgte utseendet huskes i nettleseren.
  const LOOK_KEY = 'apad:look';
  let look = { theme: 'standard', skin: 'tre' };
  const currentSkin = () => SKINS.find(s => s.id === look.skin) || SKINS[0];
  const textureOf = (skin, i) =>
    skin.texture === 'grain' ? `grain-${PIECE_DEFS[i].grain}` : skin.texture ? `tex-${skin.texture}` : null;

  function loadLook() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOOK_KEY));
      if (saved) look = { theme: saved.theme, skin: saved.skin };
    } catch { /* standard utseende */ }
    // Er statistikken slettet, er heller ikke det som var låst opp, tilgjengelig lenger.
    const done = reached(computeStats());
    if (!isOpen('theme', look.theme, done)) look.theme = 'standard';
    if (!isOpen('skin', look.skin, done)) look.skin = 'tre';
    applyLook();
  }

  function applyLook() {
    document.documentElement.dataset.theme = look.theme;
    // Statuslinjen på mobil og vinduskanten i installert app følger bakgrunnen.
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]').content = bg;
    if (layout) render();
  }

  function setLook(kind, id) {
    look[kind] = id;
    try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch { /* ignorer */ }
    applyLook();
  }

  // Milepæler som er nådd, men ikke sett i milepæl-vinduet ennå, gir en prikk på knappen.
  const SEEN_KEY = 'apad:seenMilestones';
  const looksBtn = $('btn-looks');

  function seenMilestones() {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []); } catch { return new Set(); }
  }

  function updateLooksBadge(done = reached(computeStats())) {
    const seen = seenMilestones();
    const fresh = [...done].filter(id => !seen.has(id)).length;
    looksBtn.classList.toggle('has-new', fresh > 0);
    looksBtn.title = fresh ? `Du har låst opp noe nytt!` : 'Milepæler og utseende';
  }

  // Det som ligger nærmest å bli nådd.
  function nextMilestone(st, done) {
    let best = null, bestRatio = -1;
    for (const m of MILESTONES) {
      if (done.has(m.id)) continue;
      const { ratio } = progress(m, st);
      if (ratio > bestRatio) { best = m; bestRatio = ratio; }
    }
    return best;
  }

  function renderWinMilestones(st, before) {
    const done = reached(st);
    const fresh = MILESTONES.filter(m => done.has(m.id) && !before.has(m.id));
    const unlockEl = $('win-unlock');
    unlockEl.hidden = !fresh.length;
    unlockEl.innerHTML = fresh.length
      ? `🔓 Ny milepæl! Du har låst opp ${list(fresh.map(m => `<b>${esc(rewardName(m))}</b>`))}.<br>` +
        '<button type="button" id="btn-win-looks">🎨 Prøv det nå</button>'
      : '';
    const next = nextMilestone(st, done);
    $('win-next').hidden = !next;
    if (next) {
      $('win-next').textContent =
        `Neste mål: ${next.text} (${progress(next, st).text}). Det låser opp ${rewardName(next)}.`;
    }
    updateLooksBadge(done);
  }

  function themePreview(t) {
    return `<span class="theme-swatch" data-theme="${t.id}"><span class="mini-board"></span></span>`;
  }

  function skinPreview(s) {
    let rects = '';
    s.colors.forEach((c, i) => {
      const r = `x="${i % 4}" y="${Math.floor(i / 4)}" width="1" height="1"`;
      const tex = textureOf(s, i);
      rects += `<rect ${r} fill="${c}"/>` + (tex ? `<rect ${r} fill="url(#${tex})"/>` : '');
    });
    return `<svg viewBox="0 0 4 2" aria-hidden="true">${rects}` +
      '<path d="M1 0V2M2 0V2M3 0V2M0 1H4" stroke="rgba(0,0,0,0.45)" stroke-width="0.04"/></svg>';
  }

  function lookCard(kind, item, st, done, fresh) {
    const m = milestoneFor(kind, item.id);
    const open = !m || done.has(m.id);
    const preview = (kind === 'theme' ? themePreview(item) : skinPreview(item)) +
      (open ? '' : '<span class="look-lock" aria-hidden="true">🔒</span>');
    const name = `<span class="look-name">${esc(item.name)}` +
      (m && fresh.has(m.id) ? ' <span class="look-new">Ny!</span>' : '') + '</span>';
    if (open) {
      return `<button type="button" class="look" data-kind="${kind}" data-id="${item.id}" aria-pressed="${look[kind] === item.id}">
        <span class="look-preview">${preview}</span>${name}
        <span class="look-req">${m ? '✓ ' + esc(m.text) : 'Alltid tilgjengelig'}</span>
      </button>`;
    }
    const pr = progress(m, st);
    return `<div class="look locked">
        <span class="look-preview">${preview}</span>${name}
        <span class="look-req">🔒 ${esc(m.text)}</span>
        <span class="progress" aria-hidden="true"><span style="width:${pr.ratio * 100}%"></span></span>
        <span class="look-count">${esc(cap(pr.text))}</span>
      </div>`;
  }

  function renderLooks(fresh) {
    const st = computeStats();
    const done = reached(st);
    const cards = kind => itemsOf(kind).map(item => lookCard(kind, item, st, done, fresh)).join('');
    $('looks-body').innerHTML = `
      <p class="looks-summary">Du har nådd <b>${done.size} av ${MILESTONES.length}</b> milepæler.
        Hver milepæl låser opp en ny bakgrunn eller nye brikker.</p>
      <span class="progress total" aria-hidden="true"><span style="width:${done.size / MILESTONES.length * 100}%"></span></span>
      <h3>Bakgrunn</h3>
      <div class="looks">${cards('theme')}</div>
      <h3>Brikker</h3>
      <div class="looks">${cards('skin')}</div>
      <p class="stats-note">Milepælene regnes ut fra statistikken i denne nettleseren.</p>`;
  }

  function showLooks() {
    const done = reached(computeStats());
    const seen = seenMilestones();
    renderLooks(new Set([...done].filter(id => !seen.has(id))));
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...done])); } catch { /* ignorer */ }
    updateLooksBadge(done);
    openModal($('looks'), $('btn-close-looks'));
  }

  $('looks-body').addEventListener('click', e => {
    const btn = e.target.closest('button.look');
    if (!btn) return;
    const { kind, id } = btn.dataset;
    setLook(kind, id);
    for (const b of $('looks-body').querySelectorAll(`button.look[data-kind="${kind}"]`)) {
      b.setAttribute('aria-pressed', b === btn);
    }
  });
  looksBtn.addEventListener('click', showLooks);
  $('win-unlock').addEventListener('click', e => { if (e.target.closest('button')) showLooks(); });

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = $('confetti');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#f2c14e', '#e76f51', '#2a9d8f', '#8ab17d', '#e9c46a', '#c0392b', '#6c5ce7'];
    const parts = Array.from({ length: 180 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: innerHeight / 3,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 14 - 4,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const alpha = Math.max(0, 1 - (t - start) / 4000);
      for (const q of parts) {
        q.vy += 0.35; q.vx *= 0.99; q.x += q.vx; q.y += q.vy; q.rot += q.vr;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        ctx.restore();
      }
      if (alpha > 0) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(start);
  }

  // ---------- Knapper og oppstart ----------
  $('btn-rotate').addEventListener('click', () => {
    if (selected) turn(selected, 'rotate'); else say('Velg en brikke først.');
  });
  $('btn-flip').addEventListener('click', () => {
    if (selected) turn(selected, 'flip'); else say('Velg en brikke først.');
  });
  $('btn-reset').addEventListener('click', reset);

  try { showGoal.checked = localStorage.getItem('apad:showGoal') !== '0'; } catch { /* standard: på */ }
  showGoal.addEventListener('change', () => {
    try { localStorage.setItem('apad:showGoal', showGoal.checked ? '1' : '0'); } catch { /* ignorer */ }
    render();
  });

  function setDate() {
    $('goal-text').textContent = date.text;
    document.title = `A-Puzzle-A-Day – ${date.short}`;
  }

  // Ny dag (f.eks. hvis siden står åpen over midnatt): last inn den nye dagens brett.
  setInterval(() => {
    const now = today();
    if (now.key !== date.key && !drag && !kbd) {
      date = now;
      setDate();
      load();
      render();
      evaluate();
    }
    timerEl.textContent = startedAt ? formatTime((solvedAt || Date.now()) - startedAt) : '00:00';
  }, 1000);

  window.addEventListener('resize', () => {
    layout = computeLayout();
    render();
  });

  layout = computeLayout();
  setDate();
  load();
  loadLook();
  updateLooksBadge();
  if (computeStats().solved) persistStorage();
  try { if (localStorage.getItem(SYNC_KEY)) loadSync().catch(() => { /* prøver igjen når statistikken åpnes */ }); } catch { /* ignorer */ }
  render();
  evaluate();
  timerEl.textContent = startedAt ? formatTime((solvedAt || Date.now()) - startedAt) : '00:00';
})();
