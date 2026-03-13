'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const RANK_LABELS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUIT_SYMBOL  = '♠';
const CARD_W       = 90;
const CARD_H       = 126;
const OFFSET_DOWN  = 18;   // face-down card peek height
const OFFSET_UP    = 28;   // face-up card peek height
const NUM_COLS     = 10;
const TOTAL_SETS   = 8;

// ── State ──────────────────────────────────────────────────────────────────
let G = null;       // game state
let drag = null;    // drag state

// ── Deck helpers ───────────────────────────────────────────────────────────
function makeDeck() {
  const deck = [];
  for (let copy = 0; copy < TOTAL_SETS; copy++)
    for (let rank = 1; rank <= 13; rank++)
      deck.push({ rank, faceUp: false });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Init ───────────────────────────────────────────────────────────────────
function initGame() {
  const deck = shuffle(makeDeck());
  const tableau = [];
  let di = 0;

  // Deal: first 4 cols get 6 cards, last 6 get 5 cards (54 total)
  for (let c = 0; c < NUM_COLS; c++) {
    const count = c < 4 ? 6 : 5;
    const col = [];
    for (let i = 0; i < count; i++) col.push({ ...deck[di++] });
    col[col.length - 1].faceUp = true;
    tableau.push(col);
  }

  // Remaining 50 go to stock
  const stock = deck.slice(di).map(c => ({ ...c }));

  G = {
    tableau,
    stock,
    foundations: 0,
    score: 500,
    moves: 0,
    history: [],
  };
}

// ── Snapshot for undo ──────────────────────────────────────────────────────
function snapshot() {
  return {
    tableau:     G.tableau.map(col => col.map(c => ({ ...c }))),
    stock:       G.stock.map(c => ({ ...c })),
    foundations: G.foundations,
    score:       G.score,
    moves:       G.moves,
  };
}

function saveHistory() {
  G.history.push(snapshot());
  if (G.history.length > 20) G.history.shift();
}

// ── Move validation ────────────────────────────────────────────────────────
/**
 * A sequence starting at cardIdx in col is movable if:
 * - All cards from cardIdx onward are face-up
 * - They form a consecutive descending sequence
 */
function isMovable(colIdx, cardIdx) {
  const col = G.tableau[colIdx];
  if (!col[cardIdx] || !col[cardIdx].faceUp) return false;
  for (let i = cardIdx; i < col.length - 1; i++) {
    if (!col[i + 1].faceUp) return false;
    if (col[i].rank !== col[i + 1].rank + 1) return false;
  }
  return true;
}

function isValidDrop(cards, toColIdx) {
  const toCol = G.tableau[toColIdx];
  if (toCol.length === 0) return true;
  const top = toCol[toCol.length - 1];
  return top.faceUp && top.rank === cards[0].rank + 1;
}

// ── Core moves ─────────────────────────────────────────────────────────────
function doMove(fromColIdx, fromCardIdx, toColIdx) {
  saveHistory();
  const from = G.tableau[fromColIdx];
  const cards = from.splice(fromCardIdx);

  // Flip newly exposed top card
  if (from.length > 0 && !from[from.length - 1].faceUp)
    from[from.length - 1].faceUp = true;

  G.tableau[toColIdx].push(...cards);
  G.moves++;
  G.score = Math.max(0, G.score - 1);

  runSequenceCheck();
  render();
}

function dealStock() {
  if (G.stock.length === 0) { toast('No more cards in stock!'); return; }
  if (G.tableau.some(col => col.length === 0)) {
    toast('Fill all empty columns before dealing'); return;
  }
  saveHistory();
  for (let i = 0; i < NUM_COLS; i++) {
    const card = G.stock.pop();
    card.faceUp = true;
    G.tableau[i].push(card);
  }
  G.moves++;
  runSequenceCheck();
  render();
}

function undo() {
  if (G.history.length === 0) { toast('Nothing to undo'); return; }
  const s = G.history.pop();
  G.tableau     = s.tableau;
  G.stock       = s.stock;
  G.foundations = s.foundations;
  G.score       = s.score;
  G.moves       = s.moves;
  render();
}

// ── Sequence detection ─────────────────────────────────────────────────────
function checkColSequence(colIdx) {
  const col = G.tableau[colIdx];
  if (col.length < 13) return false;
  const tail = col.slice(-13);
  for (let i = 0; i < 13; i++) {
    if (!tail[i].faceUp)          return false;
    if (tail[i].rank !== 13 - i)  return false;
  }
  // Remove it
  col.splice(-13);
  G.foundations++;
  G.score += 100;
  if (col.length > 0 && !col[col.length - 1].faceUp)
    col[col.length - 1].faceUp = true;
  toast(`Sequence complete! +100 pts  (${G.foundations}/${TOTAL_SETS})`);
  return true;
}

function runSequenceCheck() {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < NUM_COLS; i++)
      if (checkColSequence(i)) { changed = true; break; }
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────
function render() {
  renderFoundations();
  renderTableau();
  renderStock();
  updateHUD();
  if (G.foundations === TOTAL_SETS) setTimeout(showVictory, 350);
}

function renderFoundations() {
  const area = document.getElementById('foundations-area');
  area.innerHTML = '';
  for (let i = 0; i < TOTAL_SETS; i++) {
    const slot = document.createElement('div');
    slot.className = 'foundation-slot' + (i < G.foundations ? ' filled' : '');
    if (i < G.foundations) {
      const card = document.createElement('div');
      card.className = 'card complete-card';
      card.innerHTML = `<span class="suit-large">${SUIT_SYMBOL}</span>`;
      slot.appendChild(card);
    }
    area.appendChild(slot);
  }
}

function renderTableau() {
  const area = document.getElementById('tableau-area');
  area.innerHTML = '';

  G.tableau.forEach((col, colIdx) => {
    const colEl = document.createElement('div');
    colEl.className = 'tableau-col';
    colEl.dataset.col = colIdx;

    if (col.length === 0) {
      const ph = document.createElement('div');
      ph.className = 'col-placeholder';
      colEl.appendChild(ph);
      colEl.style.height = CARD_H + 'px';
    } else {
      let top = 0;
      col.forEach((card, cardIdx) => {
        const el = makeCardEl(card, colIdx, cardIdx);
        el.style.top = top + 'px';
        colEl.appendChild(el);
        if (cardIdx < col.length - 1)
          top += card.faceUp ? OFFSET_UP : OFFSET_DOWN;
      });
      colEl.style.height = (top + CARD_H) + 'px';
    }

    area.appendChild(colEl);
  });
}

function makeCardEl(card, colIdx, cardIdx) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.col  = colIdx;
  el.dataset.idx  = cardIdx;

  if (!card.faceUp) {
    el.classList.add('face-down');
    return el;
  }

  el.classList.add('face-up');
  const r = RANK_LABELS[card.rank - 1];
  el.innerHTML = `
    <div class="card-corner tl"><div class="c-rank">${r}</div><div class="c-suit">${SUIT_SYMBOL}</div></div>
    <div class="card-center">${SUIT_SYMBOL}</div>
    <div class="card-corner br"><div class="c-rank">${r}</div><div class="c-suit">${SUIT_SYMBOL}</div></div>
  `;

  if (isMovable(colIdx, cardIdx)) {
    el.classList.add('draggable');
    el.addEventListener('mousedown', e => onCardDown(e, colIdx, cardIdx));
  }
  return el;
}

function renderStock() {
  const pile = document.getElementById('stock-pile');
  pile.innerHTML = '';

  const deals = Math.floor(G.stock.length / 10);
  if (deals === 0) {
    const empty = document.createElement('div');
    empty.className = 'stock-empty-slot';
    empty.textContent = 'Empty';
    pile.appendChild(empty);
  } else {
    const stack = Math.min(deals, 5);
    for (let i = 0; i < stack; i++) {
      const c = document.createElement('div');
      c.className = 'card face-down stock-card';
      c.style.top  = (-i * 2) + 'px';
      c.style.left = (i * 1)  + 'px';
      pile.appendChild(c);
    }
    const lbl = document.createElement('div');
    lbl.className   = 'stock-deals-left';
    lbl.textContent = deals + ' deal' + (deals > 1 ? 's' : '') + ' left';
    pile.appendChild(lbl);
  }
}

function updateHUD() {
  document.getElementById('score').textContent = G.score;
  document.getElementById('moves').textContent = G.moves;
  document.getElementById('sets').textContent  = G.foundations + ' / ' + TOTAL_SETS;
}

// ── Drag & Drop ────────────────────────────────────────────────────────────
function onCardDown(e, colIdx, cardIdx) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const col   = G.tableau[colIdx];
  const cards = col.slice(cardIdx);
  const rect  = e.currentTarget.getBoundingClientRect();

  drag = {
    fromCol: colIdx,
    fromIdx: cardIdx,
    cards,
    ox: e.clientX - rect.left,
    oy: e.clientY - rect.top,
  };

  // Build ghost
  const ghost = document.getElementById('drag-ghost');
  ghost.innerHTML = '';
  ghost.classList.remove('hidden');
  ghost.style.width = CARD_W + 'px';

  cards.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'card face-up';
    el.style.position = 'absolute';
    el.style.top = (i * OFFSET_UP) + 'px';
    const r = RANK_LABELS[card.rank - 1];
    el.innerHTML = `
      <div class="card-corner tl"><div class="c-rank">${r}</div><div class="c-suit">${SUIT_SYMBOL}</div></div>
      <div class="card-center">${SUIT_SYMBOL}</div>
    `;
    ghost.appendChild(el);
  });
  ghost.style.height = ((cards.length - 1) * OFFSET_UP + CARD_H) + 'px';
  placeGhost(e.clientX, e.clientY);

  // Dim the source cards
  dimDragging(colIdx, cardIdx, true);

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);
}

function placeGhost(x, y) {
  const g = document.getElementById('drag-ghost');
  g.style.left = (x - drag.ox) + 'px';
  g.style.top  = (y - drag.oy) + 'px';
}

function onMouseMove(e) {
  if (!drag) return;
  placeGhost(e.clientX, e.clientY);
  highlightTarget(e.clientX, e.clientY);
}

function onMouseUp(e) {
  if (!drag) return;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup',   onMouseUp);

  document.getElementById('drag-ghost').classList.add('hidden');
  clearHighlights();
  dimDragging(drag.fromCol, drag.fromIdx, false);

  const colEl = colAtPoint(e.clientX, e.clientY);
  if (colEl) {
    const toColIdx = parseInt(colEl.dataset.col);
    if (toColIdx !== drag.fromCol) {
      if (isValidDrop(drag.cards, toColIdx)) {
        const saved = drag;
        drag = null;
        doMove(saved.fromCol, saved.fromIdx, toColIdx);
        return;
      } else {
        toast('Invalid move');
      }
    }
  }

  drag = null;
  render();
}

function dimDragging(colIdx, fromCardIdx, on) {
  const colEl = document.querySelector(`#tableau-area .tableau-col[data-col="${colIdx}"]`);
  if (!colEl) return;
  const cards = colEl.querySelectorAll('.card');
  for (let i = fromCardIdx; i < cards.length; i++) {
    cards[i].classList.toggle('dragging', on);
  }
}

function highlightTarget(x, y) {
  clearHighlights();
  const colEl = colAtPoint(x, y);
  if (!colEl) return;
  const toIdx = parseInt(colEl.dataset.col);
  if (toIdx === drag.fromCol) return;
  colEl.classList.add(isValidDrop(drag.cards, toIdx) ? 'drop-valid' : 'drop-bad');
}

function clearHighlights() {
  document.querySelectorAll('.tableau-col.drop-valid, .tableau-col.drop-bad')
    .forEach(el => el.classList.remove('drop-valid', 'drop-bad'));
}

function colAtPoint(x, y) {
  const cols = document.querySelectorAll('#tableau-area .tableau-col');
  for (const col of cols) {
    const r = col.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 80)
      return col;
  }
  return null;
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden', 'fade-out');
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.classList.add('hidden'), 320);
  }, 2200);
}

function showVictory() {
  document.getElementById('final-score').textContent = G.score;
  document.getElementById('final-moves').textContent = G.moves;
  document.getElementById('victory-overlay').classList.remove('hidden');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Menu → New Game
  document.getElementById('btn-new-game').addEventListener('click', () => {
    initGame();
    showScreen('game-screen');
    render();
  });

  // In-game controls
  document.getElementById('btn-undo').addEventListener('click', undo);

  document.getElementById('btn-restart').addEventListener('click', () => {
    if (confirm('Restart this game? All progress will be lost.')) {
      initGame();
      render();
      window.DealerBackground?.regenerate();   // regenerate dealer on restart
    }
  });

  document.getElementById('btn-menu').addEventListener('click', () => {
    if (confirm('Return to main menu? Current game will be lost.')) {
      document.getElementById('victory-overlay').classList.add('hidden');
      showScreen('menu-screen');
    }
  });

  // Stock click
  document.getElementById('stock-pile').addEventListener('click', dealStock);

  // Victory screen
  document.getElementById('btn-play-again').addEventListener('click', () => {
    document.getElementById('victory-overlay').classList.add('hidden');
    initGame();
    render();
  });

  document.getElementById('btn-main-menu').addEventListener('click', () => {
    document.getElementById('victory-overlay').classList.add('hidden');
    showScreen('menu-screen');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (!G) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  });
});
