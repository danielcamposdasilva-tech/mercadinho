"use strict";
// =====================================================================
// Layout: the store grows with each tier
// =====================================================================
const nLanes = () => LOJA.caixasN || tierNow().lanes;
const W = LOJA.W, AISLE_X = LOJA.corredores[0], COLS = LOJA.colunas.length;
let H = 480, FZ = 336, SHELVES = [], LANES = [], STATION = { x: LOJA.estacao, y: 366 }, STATION2 = null;
const DEP = LOJA.deposito, PORTA_DEP = DEP.x + DEP.w / 2 - 2;
const P = { whDoor: { x: PORTA_DEP, y: 112 }, entrance: { x: ENT.porta, y: 352 }, truckStop: { x: PORTA_DEP + 16, y: 20 } };
function relayout() {
  const oldH = H;
  const rows = Math.ceil(slots() / COLS), n = nLanes();
  FZ = 132 + rows * 74 - 18 + (LOJA.faixaPaletes || 0); H = FZ + 144;   // atacarejo: faixa de paletes entre as gôndolas e os caixas
  if (LOJA.H) { H = LOJA.H; FZ = H - 144; }          // shopping: altura fixa do prédio
  const gw = LOJA.gondola;
  SHELVES = SECTORS.slice(0, slots()).map((d, i) => { const col = i % COLS, row = Math.floor(i / COLS), x = LOJA.colunas[col], y = 132 + row * 74;
    return { x, y, w: gw, h: 22, stand: y + 50, top: y - 10, cx: x + gw / 2 }; });
  LANES = Array.from({ length: n }, (_, i) => { const x = LOJA.caixas - (n - 1) * 42 + i * 84; return { x, serve: { x: x - 8, y: FZ + 68 } }; });
  STATION = { x: LOJA.estacao, y: FZ + 30 }; P.entrance = { x: ENT.porta, y: FZ + 16 };
  if (ENT2) { STATION2 = { x: LOJA.estacao2, y: FZ + 30 }; P.entrance2 = { x: ENT2.porta, y: FZ + 16 }; }
  if (LOJA.semLoja) { SHELVES = []; LANES = []; }          // shopping (capítulos 7 e 8): sem gôndolas nem caixas de mercado
  worldBounds();
  if (canvasOK) { buildStalls(); if (oldH !== H) shiftOutside(oldH, H - oldH); floorCache = null; clampCam(true); }
}
// The world is the store plus the street, sidewalks, parking and the next expansion plot around it
const WORLD = { x0: -70 - MARGEM.esq, y0: -46 - MARGEM.topo, x1: W + 190 + MARGEM.dir, y1: 0 };
function worldBounds() { WORLD.y1 = H + 124 + MARGEM.baixo; PLOT.h = Math.max(120, Math.min(260, FZ - 150)); return WORLD; }
const PLOT = { x: W + 22, y: 132, w: 130, h: 200 };
relayout();
const queueSlot = (l, i) => ({ x: LANES[l].serve.x + (i > 3 ? 12 : 0), y: LANES[l].serve.y - 22 * Math.min(i, 3) - (i > 3 ? 11 : 0) });
const pileX = l => LANES[l].x + 32;
