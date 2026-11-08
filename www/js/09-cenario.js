"use strict";
// ---------- parking, lots and construction ----------
function paintParkingGround(g, rrg, wb, ww) {
  const y = pkY(), ex = exitX(), EX = PK.EX;
  // curb sidewalk, one-way street and the far sidewalk below the parking
  g.fillStyle = COR().calcadaPerto; g.fillRect(wb.x0, H + 62, ww, 14);
  g.fillStyle = COR().rua; g.fillRect(wb.x0, H + 76, ww, 34);
  g.strokeStyle = COR().faixa; g.lineWidth = 2; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(wb.x0, H + 94); g.lineTo(wb.x1, H + 94); g.stroke(); g.setLineDash([]);
  g.fillStyle = "rgba(255,255,255,.55)";
  for (let x = wb.x0 + 40; x < wb.x1; x += 120) { [H + 86, H + 102].forEach(ly => { g.fillRect(x, ly - 1, 14, 2); g.beginPath(); g.moveTo(x + 14, ly - 4); g.lineTo(x + 20, ly); g.lineTo(x + 14, ly + 4); g.fill(); }); }
  g.fillStyle = COR().calcadaBaixo; g.fillRect(wb.x0, H + 110, ww, 14);
  // walkway: left side from the street above down to the parking, and along the top of the stalls
  // (passeio do lado da entrada: à esquerda no Modo Livre, à direita quando a loja é espelhada)
  const px0 = LOJA.espelho ? W + 8 : -42;
  g.fillStyle = COR().passeio; g.fillRect(px0, 40, 34, H + 36); g.fillRect(LOJA.espelho ? W : -42, P.entrance.y - 14, 42, 36);
  if (LOJA.espelho) { const b0 = Math.min(-12, EX - 30), b1 = Math.max(W + 42, ex + 24); g.fillRect(b0, H, b1 - b0, 16); } else g.fillRect(-42, H, ex + 66, 16);
  g.fillStyle = COR().passeioJunta; for (let yy = 48; yy < H + 74; yy += 14) g.fillRect(px0, yy, 34, 1);
  // asphalt of the parking that is built, with entry and exit lanes crossing the curb
  g.fillStyle = COR().asfalto; rrg(EX - 12, H + 16, ex + 12 - (EX - 12), 46, 6); g.fill();
  g.fillRect(EX - 11, H + 40, 22, 38); g.fillRect(ex - 11, H + 40, 22, 38);
  g.fillStyle = COR().asfaltoClaro; g.fillRect(EX - 12 + 2, H + 18, ex - EX + 20, 26);
  // stall lines, numbers and aisle arrows
  g.fillStyle = "rgba(255,255,255,.85)";
  STALLS.forEach((s, i) => { g.fillRect(s.x - 11, H + 18, 1.6, 26); g.fillRect(s.x + 10, H + 18, 1.6, 26); });
  g.font = '800 7px "Nunito", system-ui, sans-serif'; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,.6)";
  STALLS.forEach((s, i) => g.fillText(String(i + 1), s.x, H + 41));
  g.fillStyle = "rgba(255,255,255,.6)";
  for (let x = EX + 30; x < ex - 20; x += 64) { g.fillRect(x, y.aisle - 1, 12, 2); g.beginPath(); g.moveTo(x + 12, y.aisle - 4); g.lineTo(x + 18, y.aisle); g.lineTo(x + 12, y.aisle + 4); g.fill(); }
  // entry and exit labels painted on the lanes
  g.font = '800 6.5px "Nunito", system-ui, sans-serif'; g.fillStyle = "rgba(255,255,255,.8)";
  g.fillText("ENTRADA", EX, H + 50); g.fillText("SAÍDA", ex, H + 50);
  // lots for sale: grass with a dashed border (sign is drawn live)
  LOTS.forEach(L => {
    if (lotReady(L.id) && L.kind !== "logi") return;
    const r = lotRect(L);
    if (L.kind === "logi" && lotReady("logi")) {
      g.fillStyle = "#c9c4b6"; rrg(r.x, r.y, r.w, r.h, 8); g.fill();
      g.fillStyle = "rgba(242,178,51,.8)"; for (let x = r.x + 6; x < r.x + r.w - 8; x += 14) g.fillRect(x, r.y + r.h - 6, 8, 3);
      return;
    }
    if (L.kind === "market") return;      // the existing expansion plot already has its own ground
    g.fillStyle = "rgba(255,255,255,.12)"; rrg(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8); g.fill();
    g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 2; g.setLineDash([7, 6]); rrg(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8); g.stroke(); g.setLineDash([]);
  });
}
function forSaleSign(x, y, L) {
  const can = lotReqs(L).every(r => r.ok), t = now();
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(x - 1, y + 2, 3, 14);
  ctx.fillStyle = "#8a6634"; ctx.fillRect(x - 1.5, y, 3, 14);
  rr(x - 27, y - 22, 54, 24, 5, "rgba(0,0,0,.16)");
  rr(x - 27, y - 24, 54, 24, 5, can ? "#fffaf0" : "#ece4cf");
  rr(x - 27, y - 24, 54, 8, 4, can ? "#c9513a" : "#9a8d6f");
  text("À VENDA", x, y - 17.5, 6.5, "#fff", "center", 800);
  text(can ? `M ${fmt(L.cost)}` : "🔒 " + (lotReqs(L).find(r => !r.ok) || {}).short.replace("Requer ", ""), x, y - 6, can ? 8 : 5.6, can ? "#2a2620" : "#7d7464", "center", 800);
  if (can && S.money >= L.cost) { ctx.globalAlpha = pulso(t, 4, .45, .3); ctx.strokeStyle = "#2e7a57"; ctx.lineWidth = 1.6; rrPath(x - 29, y - 26, 58, 28, 6); ctx.stroke(); ctx.globalAlpha = 1; }
}
function drawConstruction(r, k) {
  const t = now();
  ctx.fillStyle = "rgba(160,120,70,.55)"; rrPath(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8); ctx.fill();
  for (let i = 0; i < 4; i++) { const cx = r.x + 12 + i * (r.w - 24) / 3, cy = r.y + r.h - 8;
    ctx.fillStyle = "#e8742c"; ctx.beginPath(); ctx.moveTo(cx - 4, cy + 3); ctx.lineTo(cx + 4, cy + 3); ctx.lineTo(cx, cy - 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(cx - 2, cy - 3, 4, 1.5); }
  // a little crane arm swinging
  const ax = r.x + r.w / 2, ay = r.y + r.h / 2, a = pulso(t, 2, 0, .6);
  ctx.strokeStyle = "#f2b233"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay + 10); ctx.lineTo(ax, ay - 12); ctx.lineTo(ax + Math.cos(a) * 26, ay - 12 + Math.sin(a) * 6); ctx.stroke();
  if (!REDUZ() && Math.random() < .3) fx.push({ kind: "spark", x: r.x + Math.random() * r.w, y: r.y + r.h - 6, vx: (Math.random() - .5) * 20, vy: -20 - Math.random() * 20, t: 0, life: .6, color: "rgba(150,120,80,.8)" });
  rr(r.x + r.w / 2 - 34, r.y - 12, 68, 9, 4.5, "rgba(0,0,0,.35)"); rr(r.x + r.w / 2 - 33, r.y - 11, 66 * k, 7, 3.5, "#f2b233");
  text("OBRA", r.x + r.w / 2, r.y - 5.3, 6, "#2a2620", "center", 800);
}
function carTop(x, y, ang, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  rr(-11, -5, 24, 13, 4, "rgba(0,0,0,.18)");
  rr(-12, -6.5, 24, 13, 4, color);
  rr(-4, -5.5, 10, 11, 3, shade(color, .78));
  rr(5, -5, 4, 10, 1.5, "rgba(214,232,251,.9)"); rr(-9.5, -5, 3, 10, 1.2, "rgba(214,232,251,.7)");
  ctx.fillStyle = "#fff6c8"; ctx.fillRect(11, -5, 1.5, 2.5); ctx.fillRect(11, 2.5, 1.5, 2.5);
  ctx.fillStyle = "#c9513a"; ctx.fillRect(-12.5, -5, 1.2, 2.5); ctx.fillRect(-12.5, 2.5, 1.2, 2.5);
  ctx.restore();
}
function booth(x, y, manned) {
  rr(x - 9, y - 7, 18, 15, 3, "rgba(0,0,0,.18)");
  rr(x - 9, y - 9, 18, 15, 3, manned ? "#2e7a57" : "#6b7c85");
  rr(x - 10, y - 11, 20, 4, 2, "#f2b233");
  rr(x - 6, y - 6, 12, 6, 1.5, "rgba(214,232,251,.9)");
}
function barrier(px, y, dir, open) {
  // pivot at the booth side; the arm crosses the lane and lifts when open
  const len = 22 * (1 - open * .82);
  rr(px - 2, y - 2, 4, 4, 1, "#2a2620");
  ctx.save(); ctx.translate(px, y);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#c9513a"; ctx.fillRect(dir * (i * len / 4), -1.4, dir * len / 4, 2.8); }
  ctx.restore();
}
function drawParking() {
  const y = pkY(), ex = exitX(), EX = PK.EX, st = S.park.staff;
  // gates, booths and the price board
  if (CANCELA) {
    booth(EX + 20, y.gate, st >= 2); barrier(EX + 11, y.gate, -1, gates.in.open);
    booth(ex - 20, y.gate, st >= 1); barrier(ex - 11, y.gate, 1, gates.out.open);
  }
  [[gates.in, EX], [gates.out, ex]].forEach(([g, gx]) => { if (g.car != null) { const p = 1 - Math.max(0, g.t) / g.total; rr(gx - 11, y.gate + 7, 22, 3, 1.5, "rgba(0,0,0,.25)"); rr(gx - 11, y.gate + 7, 22 * p, 3, 1.5, "#7cc49a"); } });
  const full = !STALLS.some(s => !s.car && !s.res);
  rr(-9, y.gate - 2, 3, 12, 1, "#5b6b73");
  rr(-21, y.gate - 18, 26, 18, 4, full ? "#c9513a" : "#2a4f7a");
  text("P", -14, y.gate - 6, 10, "#fff", "center", 800, "Baloo 2");
  text(full ? "LOTADO" : !CANCELA ? "LIVRE" : S.park.price ? `M ${fmt(S.park.price)}` : "GRÁTIS", -1.5, y.gate - 7.5, 5.2, "#ffd36b", "center", 800);
  text(`${occupied()}/${STALLS.length}`, -1.5, y.gate - 1.5, 5.2, "#fff", "center", 800);
  // attendants standing at their posts
  const posts = [[ex - 34, y.gate + 2], [EX + 34, y.gate + 2], [ex - 46, y.gate + 4], [EX + 46, y.gate + 4]];
  for (let i = 0; i < Math.min(st, 4); i++) person({ x: posts[i][0], y: posts[i][1], id: 300 + i, skin: SKIN[(i + 1) % SKIN.length], hair: HAIR[(i + 3) % HAIR.length] }, { body: "#f2b233", cap: "#1f4d3a", mood: (i % 2 ? gates.in : gates.out).car != null ? "happy" : null });
  // lots for sale and construction
  LOTS.forEach(L => {
    const r = lotRect(L);
    if (building[L.id] > 0) { drawConstruction(r, 1 - building[L.id] / PK.buildT); return; }
    if (owns(L.id)) { if (L.kind === "logi") drawDock(r); return; }
    if (L.kind === "market") return;      // drawn by drawPlot
    forSaleSign(r.x + r.w / 2, r.y + r.h / 2 + 8, L);
  });
  // cars, back to front
  STALLS.forEach(s => { if (s.res && !s.car) { ctx.fillStyle = "rgba(242,178,51,0.35)"; ctx.fillRect(s.x - 9, H + 20, 18, 22); } });   // 1.4: vaga reservada para o carro que está entrando
  pcars.slice().sort((a, b) => a.y - b.y).forEach(c => carTop(c.x, c.y, c.ang, c.color));
}
function drawDock(r) {
  rr(r.x + 8, r.y + 10, 40, 24, 3, "#8e7350"); rr(r.x + 10, r.y + 12, 36, 20, 2, "#b89a6c");
  for (let i = 0; i < 3; i++) rrs(r.x + 58 + i * 16, r.y + 14, 12, 10, 2, "#c99a5b", "#8a6634", .8);
  // parked delivery truck
  const x = r.x + r.w - 32, yy = r.y + r.h - 22;
  rrs(x - 26, yy - 9, 38, 18, 3, "#fff", "rgba(0,0,0,.25)"); rr(x - 26, yy - 9, 38, 4, 2, "#e0b43a");
  rrs(x + 12, yy - 7, 14, 15, 3, "#3f74b8", "rgba(0,0,0,.25)");
  text(SCENE.doca ? "DOCA" : "LOGÍSTICA", r.x + 28, r.y + 44, 6.5, "#4a3b22", "center", 800);
  if (SCENE.doca) desenharDoca(r);
}

// ---------- scenery ----------
let floorCache = null, doorOpen = 0;
// Static ground (grass, sidewalks, parking, the expansion lot and the store floor) is painted once into a bitmap
// at the current zoom resolution and redrawn only when the zoom step or the store size changes.
function tree(g, x, y, r) {
  g.fillStyle = "rgba(40,50,20,.22)"; g.beginPath(); g.ellipse(x + 2, y + r * .8, r * 1.05, r * .45, 0, 0, 7); g.fill();
  g.fillStyle = COR().arvoreTronco; g.fillRect(x - 1.5, y, 3, r * .8);
  g.fillStyle = COR().arvoreEscura; g.beginPath(); g.arc(x, y - r * .2, r, 0, 7); g.fill();
  g.fillStyle = COR().arvoreClara; g.beginPath(); g.arc(x - r * .3, y - r * .5, r * .55, 0, 7); g.fill();
}
function buildFloor() {
  const wb = WORLD, ww = wb.x1 - wb.x0, wh = wb.y1 - wb.y0, f = Math.max(1, Math.min(RES, 4096 / ww, 4096 / wh));
  const c = document.createElement("canvas"); c.width = Math.round(ww * f); c.height = Math.round(wh * f);
  const g = c.getContext("2d"); g.scale(f, f); g.translate(-wb.x0, -wb.y0);
  const rrg = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  // grass with a little texture
  g.fillStyle = COR().grama; g.fillRect(wb.x0, wb.y0, ww, wh);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < ww * wh / 240; i++) { g.fillStyle = rnd() < .5 ? COR().gramaEscura : COR().gramaClara; g.fillRect(wb.x0 + rnd() * ww, wb.y0 + rnd() * wh, 2, 2); }
  // far sidewalk, near sidewalk, walkway to the entrance
  g.fillStyle = COR().calcadaLonge; g.fillRect(wb.x0, -9, ww, 9);
  g.fillStyle = COR().meioFio; g.fillRect(wb.x0, 34, ww, 6);
  // walkways, parking, gates and the street below the store
  paintParkingGround(g, rrg, wb, ww);
  // expansion lot
  if (SCENE.plot) {
    g.fillStyle = COR().lote; rrg(PLOT.x, PLOT.y, PLOT.w, PLOT.h, 12); g.fill();
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 3; g.setLineDash([10, 8]); rrg(PLOT.x + 5, PLOT.y + 5, PLOT.w - 10, PLOT.h - 10, 9); g.stroke(); g.setLineDash([]);
  }
  // trees and hedges around
  if (!SCENE.vizinhanca) for (let x = wb.x0 + 18; x < wb.x1; x += 46) tree(g, x + (rnd() - .5) * 10, -26, 9 + rnd() * 3);
  for (let y = 70; y < H - 10; y += 58) { const ty = y + rnd() * 10; if (!(SCENE.doca && ty < 140)) tree(g, -57, ty, 8); }
  if (SCENE.plot) {
    for (let y = PLOT.y + PLOT.h + 34; y < H + 6; y += 56) { tree(g, W + 50, y, 10); tree(g, W + 118, y + 20, 9); }
    for (let y = 60; y < PLOT.y - 6; y += 40) tree(g, W + 160, y, 7);
    for (let y = PLOT.y; y < H; y += 52) tree(g, W + 162, y + 10, 7);
  } else if (!SCENE.faixaDir) for (let y = LOJA.espelho ? 70 : 150; y < H - 10; y += 58) tree(g, W + 57, y + rnd() * 10, 8);
  if (SCENE.vizinhanca) pintarVizinhanca(g, rrg, wb, ww);
  // store slab and walls
  g.fillStyle = "rgba(40,30,15,.20)"; g.fillRect(-4, 116, W + 10, H - 116 + 8);
  const [f0, f1] = tierNow().floor;
  for (let y = 118, r = 0; y < H; y += 24, r++) for (let x = 0, k = 0; x < W; x += 24, k++) {
    g.fillStyle = (r + k) % 2 ? f1 : f0; g.fillRect(x, y, 24, 24);
    g.fillStyle = "rgba(160,130,80,.10)"; g.fillRect(x, y, 24, 1); g.fillRect(x, y, 1, 24);
  }
  const lg = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * .7);
  lg.addColorStop(0, "rgba(255,250,235,.30)"); lg.addColorStop(1, "rgba(120,90,40,.16)");
  g.fillStyle = lg; g.fillRect(0, 118, W, H - 118);
  for (let y = 170; y < FZ; y += 150) [[Math.round(W * 4 / 15), y], [W * 3 / 4, y]].forEach(([x, yy]) => {
    const l2 = g.createRadialGradient(x, yy, 2, x, yy, 70); l2.addColorStop(0, "rgba(255,248,220,.35)"); l2.addColorStop(1, "rgba(255,248,220,0)");
    g.fillStyle = l2; g.fillRect(x - 70, yy - 70, 140, 140);
  });
  g.fillStyle = "rgba(31,77,58,.08)"; g.fillRect(0, FZ + 56, W, H - FZ - 56);
  (ENT2 ? [6, W - 36] : [LOJA.espelho ? W - 36 : 6]).forEach(tapX => {    // tapete da entrada (duas, no capítulo 4)
  g.fillStyle = "#5a9a3c"; g.beginPath(); g.roundRect ? g.roundRect(tapX, FZ, 30, 34, 4) : g.rect(tapX, FZ, 30, 34); g.fill();
  g.strokeStyle = "rgba(255,255,255,.35)"; g.setLineDash([3, 3]); g.strokeRect(tapX + 3, FZ + 3, 24, 28); g.setLineDash([]); });
  g.fillStyle = COR().parede;
  const paredePorta = x => { g.fillRect(x, 118, 5, FZ - 6 - 118); g.fillRect(x, FZ + 38, 5, H - FZ - 38); };
  if (ENT2) { paredePorta(-5); paredePorta(W); }
  else if (LOJA.espelho) { g.fillRect(-5, 118, 5, H - 118); paredePorta(W); } else { paredePorta(-5); g.fillRect(W, 118, 5, H - 118); }
  g.fillRect(-5, H, 25, 5); g.fillRect(W - 20, H, 25, 5);
  if (DIV) { vidroComSaidas(g); pintarAcessibilidade(g, rrg); }
  else { g.fillStyle = "rgba(170,210,232,.85)"; g.fillRect(20, H, W - 40, 3); }
  c.f = f; return c;
}
function plant(x, y, s = 1) {
  ctx.fillStyle = "rgba(40,30,15,.15)"; ctx.beginPath(); ctx.ellipse(x, y + 8 * s, 9 * s, 3 * s, 0, 0, 7); ctx.fill();
  rr(x - 6 * s, y, 12 * s, 9 * s, 2 * s, "#b5643a");
  ctx.fillStyle = "#4f8a3a"; [[-5, -6], [5, -7], [0, -11], [-2, -3], [3, -2]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, 4.5 * s, 3 * s, dx * .1, 0, 7); ctx.fill(); });
  ctx.fillStyle = "#6fae52"; ctx.beginPath(); ctx.ellipse(x - 1 * s, y - 8 * s, 3 * s, 2 * s, 0, 0, 7); ctx.fill();
}
// Time of day: the store opens at 8h and closes at 20h
function clockTime() { const h = 8 + 12 * Math.min(1, S.dayT / DAY_LEN); return { h: Math.floor(h), m: Math.floor((h % 1) * 60) }; }
function drawClock(x, y) {
  const { h, m } = clockTime();
  ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.arc(x, y + 1.5, 13, 0, 7); ctx.fill();
  ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill(); ctx.strokeStyle = "#1f4d3a"; ctx.lineWidth = 2.5; ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = "#7d7464"; ctx.fillRect(x + Math.cos(a) * 10 - .6, y + Math.sin(a) * 10 - .6, 1.2, 1.2); }
  const ha = ((h % 12) + m / 60) / 12 * Math.PI * 2 - Math.PI / 2, ma = m / 60 * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = "#2a2620"; ctx.lineCap = "round";
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ha) * 6, y + Math.sin(ha) * 6); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ma) * 9, y + Math.sin(ma) * 9); ctx.stroke();
  ctx.lineCap = "butt";
}
// Sky and street lighting follow the clock
function skyColor() {
  const k = Math.min(1, S.dayT / DAY_LEN);
  const stops = [[0, [255, 226, 180]], [0.25, [190, 225, 245]], [0.7, [200, 225, 240]], [0.88, [246, 170, 110]], [1, [120, 110, 160]]];
  for (let i = 1; i < stops.length; i++) if (k <= stops[i][0]) {
    const [k0, c0] = stops[i - 1], [k1, c1] = stops[i], f = (k - k0) / (k1 - k0);
    return c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
  }
  return stops[stops.length - 1][1];
}


let chaoMeio = null;
function chaoReduzido() {
  if (!chaoMeio || chaoMeio.src !== floorCache) {
    const c = document.createElement("canvas"); c.width = Math.ceil(floorCache.width / 2); c.height = Math.ceil(floorCache.height / 2);
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(floorCache, 0, 0, c.width, c.height); c.src = floorCache; chaoMeio = c;
  }
  return chaoMeio;
}
function drawBackground() {
  if (!floorCache) floorCache = buildFloor();
  const wb = WORLD, ww = wb.x1 - wb.x0;
  // de longe, usa uma cópia do chão em meia resolução: reduzir a imagem grande a cada quadro é caro
  const chao = (SCENE.vizinhanca && !window.__semOtimizar && cam.s * DPR <= floorCache.f / 2) ? chaoReduzido() : floorCache;   // (só nos cenários grandes da carreira)
  ctx.drawImage(chao, wb.x0, wb.y0, ww, wb.y1 - wb.y0);
  if (isRush() && !paused) { ctx.fillStyle = `rgba(242,178,51,${pulso(now(), 4, .07, .03)})`; ctx.fillRect(0, 118, W, H - 118); }
  const [r, g, b] = skyColor();
  ctx.fillStyle = COR().rua; ctx.fillRect(wb.x0, 0, ww, 34);
  ctx.fillStyle = `rgba(${r},${g},${b},.35)`; ctx.fillRect(wb.x0, 0, ww, 34);
  ctx.strokeStyle = COR().faixaTopo; ctx.setLineDash([12, 10]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wb.x0, 17); ctx.lineTo(wb.x1, 17); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#b3ab99"; ctx.fillRect(wb.x0, 39, ww, 1);
  ctx.fillStyle = grad(40, 118, "#e2d3b0", "#d2bf98"); ctx.fillRect(0, 40, W, 78);
  ctx.fillStyle = "#bfa97f"; ctx.fillRect(0, 112, W, 6);
  // side walls show the store's footprint
  ctx.fillStyle = "rgba(120,95,60,.18)"; ctx.fillRect(0, 118, 3, H - 118); ctx.fillRect(W - 3, 118, 3, H - 118);
  // warehouse
  const dx = DEP.x, dw = DEP.w, cols = Math.floor((dw - 20) / 12);
  rr(dx, 44, dw, 70, 10, "#8e7350");
  rr(dx + 4, 48, dw - 8, 62, 8, grad(48, 110, "#b89a6c", "#cdb183"));
  ctx.fillStyle = "#7a5f3c"; ctx.fillRect(dx + 8, 76, dw - 16, 2); ctx.fillRect(dx + 8, 99, dw - 16, 2);
  let bx = 0; const open = openSectors(), share = Math.max(1, whCap(S.whLvl) / open.length), slotsN = cols * 2;
  open.forEach(d => {
    const per = Math.max(1, Math.floor(slotsN / open.length));
    const n = Math.min(per, Math.ceil(S.sec[d.id].wh / share * per));
    for (let k = 0; k < n && bx < slotsN; k++) {
      const col = bx % cols, row = Math.floor(bx / cols), x = dx + 10 + col * 12, y = 88 - row * 23;
      rrs(x, y, 11, 11, 2, d.color, shade(d.color, .6), .8); rr(x, y + 4, 11, 2, 0, shade(d.color, .7)); rr(x + 3.5, y, 4, 4, 1, "rgba(255,255,255,.4)");
      bx++;
    }
  });
  rr(dx + 8, 50, dw - 16, 12, 4, "rgba(40,30,15,.25)");
  text(`${dw < 120 ? "DEP." : "DEPÓSITO"} ${whUsed()}/${whCap(S.whLvl)}`, dx + dw / 2, 59.5, 8.5, whUsed() === 0 ? "#ffb4a3" : "#fff");
  rr(P.whDoor.x - 15, 108, 30, 8, 2, "#5c4a2e");
  for (let i = 0; i < 3; i++) rr(P.whDoor.x - 13, 109 + i * 2.3, 26, 1, 0, "#8e7350");
  // clock + storefront sign that changes with the tier
  const LT = LOJA.letreiro, lcx = LT.x + LT.w / 2;
  drawClock(LT.x - 18, 68);
  const lt = SCENE.letreiro || tierNow(), sc = lt.signColor, [s1, s2] = lt.sign;
  rr(LT.x, 46, LT.w, 42, 10, shade(sc, .75));
  rr(LT.x + 2, 48, LT.w - 4, 38, 9, grad(48, 86, shade(sc, 1.25), sc));
  text(s1, lcx, 64, s1.length > 10 ? 11.5 : 13, "#fff", "center", 800, "Baloo 2");
  text(s2 + (S.branches ? ` · ${S.branches + 1} LOJAS` : ""), lcx, 77, 9, "#f2b233", "center", 800, "Baloo 2");
  const aw = LT.w + 32, ax = LT.x - 32;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = COR().toldo[i % 2]; ctx.beginPath();
    const x0 = ax + i * aw / 12, x1 = x0 + aw / 12;
    ctx.moveTo(x0, 92); ctx.lineTo(x1, 92); ctx.lineTo(x1, 102); ctx.quadraticCurveTo((x0 + x1) / 2, 108, x0, 102); ctx.fill();
  }
  ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.fillRect(ax, 92, aw, 2);
  plant(W - 13, 126, .9); plant(12, FZ + 56, .9); plant(W - 12, FZ + 56, .9);
  if (S.tier >= 2) { plant(W - 13, FZ - 20, .8); }
  // automatic entrance door
  const near = customers.some(c => (LOJA.espelho ? c.x > W - 40 : c.x < 40) && Math.abs(c.y - P.entrance.y) < 30);
  doorOpen += ((near ? 1 : 0) - doorOpen) * 0.14;
  const dy = FZ - 6;
  const pxp = LOJA.espelho ? W - 6 : 0;
  rr(pxp, dy, 6, 44, 2, COR().porta);
  rr(pxp, dy + 1, 6, 20 - doorOpen * 16, 2, COR().vidro); rr(pxp, dy + 23 + doorOpen * 16, 6, 20 - doorOpen * 16, 2, COR().vidro);
  text(ENT2 ? "ENTRADA · ESTACIONAMENTO" : "ENTRADA", LOJA.espelho ? W - 8 : 8, dy - 4, 8, COR().entradaTexto, LOJA.espelho ? "right" : "left", 800);
  if (ENT2) {        // segunda porta, do lado da avenida
    const near2 = customers.some(c => c.ent && (LOJA.espelho ? c.x < 40 : c.x > W - 40) && Math.abs(c.y - P.entrance.y) < 30);
    doorOpen2 += ((near2 ? 1 : 0) - doorOpen2) * 0.14;
    const px2 = LOJA.espelho ? 0 : W - 6;
    rr(px2, dy, 6, 44, 2, COR().porta);
    rr(px2, dy + 1, 6, 20 - doorOpen2 * 16, 2, COR().vidro); rr(px2, dy + 23 + doorOpen2 * 16, 6, 20 - doorOpen2 * 16, 2, COR().vidro);
    text("ENTRADA · AVENIDA", LOJA.espelho ? 8 : W - 8, dy - 4, 8, COR().entradaTexto, LOJA.espelho ? "left" : "right", 800);
  }
  if (GANCHOS.desenharFundo) GANCHOS.desenharFundo();
}
let doorOpen2 = 0;
function drawTruck() {
  if (truck.state === "away") return;
  const x = truck.x, y = truck.y - 2, t = now(), moving = truck.state !== "unloading";
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x - 4, y + 15, 40, 4, 0, 0, 7); ctx.fill();
  rrs(x - 36, y - 13, 52, 25, 4, grad(y - 13, y + 12, "#ffffff", "#e6dfcd"), "rgba(0,0,0,.25)");
  rr(x - 36, y - 13, 52, 6, 3, "#e0b43a");
  text("ENTREGAS", x - 10, y + 6, 7.5, "#7d7464");
  rrs(x + 16, y - 9, 20, 21, 5, grad(y - 9, y + 12, "#5b8fd6", "#3f74b8"), "rgba(0,0,0,.25)");
  rr(x + 25, y - 6, 9, 8, 2, "#d6e8fb"); rr(x + 34, y + 4, 3, 4, 1, "#f2b233");
  [-26, 2, 26].forEach(dx => {
    ctx.fillStyle = "#2a2620"; ctx.beginPath(); ctx.arc(x + dx, y + 12, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#9aa0a3"; ctx.beginPath(); ctx.arc(x + dx, y + 12, 1.8, 0, 7); ctx.fill();
    if (moving) { const a = t * 15; ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + dx, y + 12); ctx.lineTo(x + dx + Math.cos(a) * 4, y + 12 + Math.sin(a) * 4); ctx.stroke(); }
  });
  if (moving && !REDUZ()) for (let i = 0; i < 3; i++) { const k = ((t * 2 + i / 3) % 1); ctx.fillStyle = `rgba(200,200,200,${.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + 46 + k * 16, y + 8 - k * 6, 2 + k * 4, 0, 7); ctx.fill(); }
  if (truck.state === "unloading") { const k = (t * 3) % 1; rrs(x - 44, y - 2 - k * 10, 9, 9, 2, "#c99a5b", "#8a6634", .8); }
}

function drawShelves() {
  const t = now();
  SECTORS.forEach((d, i) => {
    if (i >= SHELVES.length) return;
    const sh = SHELVES[i], st = S.sec[d.id];
    if (!st.open) {
      ctx.save(); rrPath(sh.x, sh.y - 6, sh.w, sh.h + 12, 8); ctx.clip();
      ctx.fillStyle = "rgba(191,176,140,.18)"; ctx.fillRect(sh.x, sh.y - 6, sh.w, sh.h + 12);
      ctx.strokeStyle = "rgba(191,176,140,.35)"; ctx.lineWidth = 6;
      for (let k = -40; k < sh.w + 40; k += 18) { ctx.beginPath(); ctx.moveTo(sh.x + k, sh.y + sh.h + 6); ctx.lineTo(sh.x + k + 30, sh.y - 6); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = "#bfb08c"; ctx.lineWidth = 1.5; rrPath(sh.x, sh.y - 6, sh.w, sh.h + 12, 8); ctx.stroke(); ctx.restore();
      ctx.globalAlpha = .55; emoji(d.ic, sh.x + 18, sh.y + 11, 13); ctx.globalAlpha = 1;
      text(d.name, sh.x + 34, sh.y + 9, 10, "#8f8263", "left");
      const can = S.money >= custoAbrir(d);
      text(`abrir por M ${fmt(custoAbrir(d))}`, sh.x + 34, sh.y + 21, 9, can ? "#2e7a57" : "#9a8d6f", "left", 800);
      if (can) { ctx.globalAlpha = pulso(t, 4, .5, .3); ctx.strokeStyle = "#2e7a57"; ctx.lineWidth = 2; rrPath(sh.x - 1, sh.y - 7, sh.w + 2, sh.h + 14, 9); ctx.stroke(); ctx.globalAlpha = 1; }
      return;
    }
    // shelf unit with depth
    ctx.fillStyle = "rgba(40,30,15,.18)"; ctx.beginPath(); ctx.ellipse(sh.x + sh.w / 2, sh.y + sh.h + 9, sh.w / 2 + 4, 5, 0, 0, 7); ctx.fill();
    rr(sh.x - 4, sh.y - 5, sh.w + 8, sh.h + 11, 7, "#5e4229");
    rr(sh.x - 4, sh.y - 5, sh.w + 8, 4, 3, shade(d.color, .9));
    rr(sh.x, sh.y, sh.w, sh.h, 4, grad(sh.y, sh.y + sh.h, "#fbf4e4", "#eadcbf"));
    rr(sh.x, sh.y + sh.h - 3, sh.w, 3, 1, "#cdb994");
    const cap = shelfCap(st.shelfLvl), per = (sh.w - 26) / cap, two = per < 10;
    const size = two ? Math.min(12, per * 1.9) : Math.min(13, Math.max(7, per * 1.05));
    for (let k = 0; k < cap; k++) {
      const cx = sh.x + 4 + per * (k + 0.5), cy = sh.y + sh.h / 2 + (two ? (k % 2 ? 3 : -3) : 0.5);
      if (k < st.shelf) { const pp = pops[i], dtp = now() - pp.t; const bump = k >= pp.from && k < pp.to && dtp < .45 ? 1 + .6 * Math.sin(dtp / .45 * Math.PI) : 1;
        emoji(d.ic, cx, cy - (bump - 1) * 6, size * bump); }
      else if (!two) { ctx.fillStyle = "rgba(110,79,51,.10)"; ctx.fillRect(cx - per / 2 + 1, sh.y + 5, per - 2, sh.h - 10); }
    }
    // price tag on the right end
    const px = sh.x + sh.w - 20;
    rrs(px, sh.y + 3, 18, sh.h - 6, 3, "#f8d24a", "#c98f17", .8);
    text(fmt(secPrice(d, st.priceLvl)), px + 9, sh.y + sh.h / 2 + 3, fmt(secPrice(d, st.priceLvl)).length > 3 ? 6.5 : 8, "#4a3203", "center", 800);
    // empty shelf warning blink
    if (st.shelf === 0) { ctx.globalAlpha = pulso(t, 6, .25, .2); rr(sh.x, sh.y, sh.w, sh.h, 4, "#e2553c"); ctx.globalAlpha = 1; }
  });
}
function drawShelfLabels() {
  SECTORS.forEach((d, i) => {
    if (i >= SHELVES.length) return; const sh = SHELVES[i], st = S.sec[d.id]; if (!st.open) return;
    const label = `${d.name} ${st.shelf}/${shelfCap(st.shelfLvl)}`;
    ctx.font = '800 9px "Nunito", system-ui'; const tw = ctx.measureText(label).width + 12;
    ctx.globalAlpha = .94; rr(sh.x + 6, sh.y + sh.h + 5, tw, 13, 6.5, st.shelf === 0 ? "#c9513a" : shade(d.color, .82)); ctx.globalAlpha = 1;
    text(label, sh.x + 12, sh.y + sh.h + 14.5, 9, "#fff", "left");
  });
}


function drawLanes() {
  const t = now(), y0 = FZ + 82;
  LANES.forEach((ln, l) => {
    const open = l < nCaixas(), x = ln.x, st = lanes[l], busy = open && st.servingId;
    ctx.globalAlpha = open ? 1 : .35;
    ctx.fillStyle = "rgba(40,30,15,.18)"; ctx.beginPath(); ctx.ellipse(x - 6, y0 + 24, 32, 4, 0, 0, 7); ctx.fill();
    rrs(x - 36, y0, 56, 22, 6, grad(y0, y0 + 22, "#6b7c85", "#4b5a62"), "rgba(0,0,0,.25)");
    rr(x - 33, y0 + 3, 30, 15, 3, "#262f33");
    ctx.save(); rrPath(x - 33, y0 + 3, 30, 15, 3); ctx.clip(); ctx.fillStyle = "rgba(255,255,255,.08)";
    const off = busy ? (t * 20) % 6 : 0; for (let k = -6; k < 32; k += 6) ctx.fillRect(x - 33 + k + off, y0 + 3, 2, 15); ctx.restore();
    rrs(x + 1, y0 + 2, 15, 12, 3, "#dfe5e8", "rgba(0,0,0,.25)", .8);
    rr(x + 3, y0 + 4, 11, 5, 1.5, busy ? "#7cc49a" : "#a8b5ba");
    ctx.globalAlpha = 1;
    if (open) person({ x: x + 27, y: y0 + 14, shirt: "#2e7a57", skin: SKIN[l % SKIN.length], hair: HAIR[(l + 2) % HAIR.length], id: l + 50 }, { cap: "#1f4d3a", mood: busy ? "happy" : null });
    text(open ? `CAIXA ${l + 1}` : "FECHADO", x - 8, y0 + 37, 8.5, open ? "#4a3b22" : "#9a8d6f");
    if (busy) { const p = 1 - Math.max(0, st.timer) / st.total; rr(x - 36, y0 - 6, 56, 4, 2, "rgba(0,0,0,.15)"); rr(x - 36, y0 - 6, 56 * p, 4, 2, "#2e7a57"); }
  });
}
function drawGear() {
  rackCestas(STATION, station);
  if (ENT2) rackCestas(STATION2, station2);
  drawPilhas();
}
function rackCestas(STATION, station) {
  const sx = STATION.x - 22, sy = STATION.y - 16;
  ctx.fillStyle = "rgba(40,30,15,.16)"; ctx.beginPath(); ctx.ellipse(sx + 26, sy + 32, 28, 4, 0, 0, 7); ctx.fill();
  rrs(sx, sy, 52, 30, 5, "#f7efdd", "#a98a5b", 1.2);
  const nb = Math.min(6, station.b), nc = Math.min(3, station.c);
  for (let k = 0; k < nb; k++) rrs(sx + 4, sy + 22 - k * 3, 16, 6, 1.5, "#d9533f", "#9e2f22", .8);
  for (let k = 0; k < nc; k++) { const cx = sx + 26 + k * 3; rrs(cx, sy + 8, 18, 12, 2, "rgba(220,228,232,.95)", "#5b6b73", 1); ctx.fillStyle = "#2a2620"; ctx.beginPath(); ctx.arc(cx + 3, sy + 22, 1.6, 0, 7); ctx.arc(cx + 15, sy + 22, 1.6, 0, 7); ctx.fill(); }
  const empty = station.b + station.c === 0;
  rr(sx, sy - 14, 64, 12, 6, empty ? "#c9513a" : "#1f4d3a");
  text(`🧺${station.b}  🛒${station.c}`, sx + 32, sy - 5, 8.5, "#fff");
  if (empty) { ctx.globalAlpha = pulso(now(), 6, .3, .2); rr(sx, sy, 52, 30, 5, "#e2553c"); ctx.globalAlpha = 1; }
}
function drawPilhas() {
  const py = FZ + 130;
  piles.forEach((p, l) => {
    const n = p.b + p.c; if (!n || l >= LANES.length) return;
    const px = pileX(l);
    for (let k = 0; k < Math.min(5, p.b); k++) rrs(px - 8, py - k * 3, 16, 6, 1.5, "#d9533f", "#9e2f22", .8);
    if (p.c) rrs(px - 10, py - 14 - Math.min(5, p.b) * 3, 20, 10, 2, "rgba(220,228,232,.95)", "#5b6b73", 1);
    rr(px + 6, py - 20, 14, 11, 5.5, n >= 4 ? "#c9513a" : "#2a2620"); text(String(n), px + 13, py - 11.5, 8, "#fff");
    if (n >= 3) { ctx.globalAlpha = pulso(now(), 5, .35, .25); ctx.strokeStyle = "#c9513a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py - 4, 14, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  });
}
function dayLight() {
  // screen space: tints the whole view at the end of the day
  const k = Math.min(1, S.dayT / DAY_LEN);
  if (k < .75) return;
  const f = (k - .75) / .25;
  ctx.fillStyle = `rgba(255,140,60,${.10 * f})`; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = `rgba(60,50,110,${.12 * Math.max(0, f - .5) * 2})`; ctx.fillRect(0, 0, VW, VH);
}

// ---------- buildings that can be selected ----------
function bRect(sel) {
  if (!sel) return null;
  switch (sel.kind) {
    case "shelf": { const sh = SHELVES[sel.i]; return sh ? { x: sh.x - 6, y: sh.y - 10, w: sh.w + 12, h: sh.h + 30 } : null; }
    case "lane": { const ln = LANES[sel.l]; return ln ? { x: ln.x - 40, y: FZ + 74, w: 78, h: 50 } : null; }
    case "station": { const ps = sel.n && STATION2 ? STATION2 : STATION; return { x: ps.x - 26, y: ps.y - 34, w: 72, h: 52 }; }
    case "wh": return { x: DEP.x - 2, y: 42, w: DEP.w + 4, h: 76 };
    case "sign": return { x: LOJA.letreiro.x - 34, y: 44, w: LOJA.letreiro.w + 36, h: 66 };
    case "expand": return SCENE.plot ? { x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h } : null;
    case "lot": { const L = lotById(sel.id); return L ? lotRect(L) : null; }
    case "parking": return { x: PK.EX - 22, y: H + 14, w: exitX() + 34 - PK.EX, h: 66 };
  }
  return GANCHOS.bRect ? GANCHOS.bRect(sel) : null;
}
function hitBuilding(x, y) {
  const inR = r => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (let i = 0; i < SHELVES.length; i++) if (inR(bRect({ kind: "shelf", i }))) return { kind: "shelf", i };
  for (let l = 0; l < LANES.length; l++) if (inR(bRect({ kind: "lane", l }))) return { kind: "lane", l };
  for (const kind of ["station", "wh", "sign"]) if (inR(bRect({ kind }))) return { kind };
  if (ENT2 && inR(bRect({ kind: "station", n: 1 }))) return { kind: "station", n: 1 };
  if (GANCHOS.tocar) { const t = GANCHOS.tocar(x, y); if (t) return t; }
  for (const L of LOTS) { if (L.kind === "market" && lotReady("market")) continue; if (L.kind === "park" && lotReady(L.id)) continue; if (inR(lotRect(L))) return { kind: "lot", id: L.id }; }
  if (inR(bRect({ kind: "expand" }))) return { kind: "expand" };
  if (inR(bRect({ kind: "parking" }))) return { kind: "parking" };
  if (truck.state !== "away" && Math.abs(x - truck.x) < 40 && Math.abs(y - truck.y) < 18) return { kind: "wh" };
  return null;
}
function hitPile(x, y) {
  for (let l = 0; l < LANES.length; l++) { const px = pileX(l), p = piles[l]; if (x > px - 16 && x < px + 20 && y > FZ + 104 && y < FZ + 140 && p.b + p.c > 0) return l; }
  return -1;
}
function tierProgress() {
  const next = TIERS[S.tier + 1];
  if (!next) { const a = actions().find(a => a.kind === "branch"); return a ? Math.max(0, Math.min(1, S.money / a.cost)) : 1; }
  const r = tierReqs(); return r.reduce((a, q) => a + Math.min(1, Math.max(0, q.have) / q.need), 0) / r.length;
}
function drawPlot() {
  if (!SCENE.plot || building.market > 0) return;
  if (!owns("market")) { forSaleSign(PLOT.x + PLOT.w / 2, PLOT.y + PLOT.h / 2 + 10, lotById("market")); text("Ampliação do mercado", PLOT.x + PLOT.w / 2, PLOT.y + PLOT.h / 2 + 34, 7.5, "#4a3b22", "center", 800); return; }
  const next = TIERS[S.tier + 1], t = now(), cx = PLOT.x + PLOT.w / 2, cy = PLOT.y + PLOT.h / 2;
  const ready = next ? tierReqOk() : false, p = tierProgress();
  if (ready) { ctx.globalAlpha = pulso(t, 4, .45, .3); ctx.strokeStyle = "#2e7a57"; ctx.lineWidth = 4; rrPath(PLOT.x - 2, PLOT.y - 2, PLOT.w + 4, PLOT.h + 4, 14); ctx.stroke(); ctx.globalAlpha = 1; }
  rr(PLOT.x + 12, cy - 48, PLOT.w - 24, 96, 14, "rgba(0,0,0,.12)");
  rr(PLOT.x + 12, cy - 51, PLOT.w - 24, 96, 14, ready ? "#2e7a57" : "rgba(36,52,44,.82)");
  text(next ? "EXPANSÃO" : "NOVA FILIAL", cx, cy - 31, 11, "#fff", "center", 800, "Baloo 2");
  text(next ? next.name : `Filial nº ${S.branches + 1}`, cx, cy - 17, 9.5, "#ffd36b", "center", 800);
  if (ready) {
    ctx.fillStyle = "#ffd36b"; const by = cy + 2 - (REDUZ() ? 0 : Math.abs(Math.sin(t * 4)) * 3);
    ctx.beginPath(); ctx.moveTo(cx, by - 10); ctx.lineTo(cx + 10, by + 2); ctx.lineTo(cx + 4, by + 2); ctx.lineTo(cx + 4, by + 12); ctx.lineTo(cx - 4, by + 12); ctx.lineTo(cx - 4, by + 2); ctx.lineTo(cx - 10, by + 2); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(cx, cy, 6, Math.PI, 0); ctx.lineTo(cx + 6, cy + 3); ctx.moveTo(cx - 6, cy + 3); ctx.lineTo(cx - 6, cy); ctx.stroke();
    rr(cx - 9, cy + 3, 18, 13, 3, "#fff"); rr(cx - 1.2, cy + 7, 2.4, 5, 1, "#2a2620");
  }
  rr(cx - 42, cy + 23, 84, 9, 4.5, "rgba(255,255,255,.2)"); rr(cx - 42, cy + 23, 84 * p, 9, 4.5, ready ? "#ffd36b" : "#f2b233");
  text(ready ? "Toque para expandir" : `${Math.floor(p * 100)}% das metas`, cx, cy + 41, 8, "#fff", "center", 800);
}
function drawSelection() {
  const r = bRect(ui.sel); if (!r) return;
  const t = now();
  ctx.save();
  ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(242,178,51,${REDUZ() ? .8 : .6 + Math.sin(t * 5) * .3})`; rrPath(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 10); ctx.stroke();
  ctx.setLineDash([6, 5]); ctx.lineDashOffset = REDUZ() ? 0 : -t * 18; ctx.lineWidth = 1.5; ctx.strokeStyle = "#fff"; rrPath(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 10); ctx.stroke();
  ctx.restore();
  const bx = r.x + r.w / 2, by = r.y - 8 - (REDUZ() ? 2 : Math.abs(Math.sin(t * 4)) * 5);
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.moveTo(bx - 8, by - 9); ctx.lineTo(bx + 8, by - 9); ctx.lineTo(bx, by + 1.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2b233"; ctx.strokeStyle = "#a56f0e"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(bx - 8, by - 11); ctx.lineTo(bx + 8, by - 11); ctx.lineTo(bx, by); ctx.closePath(); ctx.fill(); ctx.stroke();
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  const k = cam.s * DPR;
  ctx.setTransform(k, 0, 0, k, DPR * (VW / 2 - cam.x * cam.s), DPR * (VH / 2 - cam.y * cam.s));
  if (GANCHOS.desenharCena) { GANCHOS.desenharCena(); floats.forEach(f => { ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4); text(f.text, f.x, f.y - f.t * 22, 12, f.color, "center", 800, "Nunito", "rgba(255,250,240,.9)"); ctx.globalAlpha = 1; });
    drawFx(); drawSelection(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); dayLight(); drawFxScreen(); return; }     // shopping (capítulos 7 e 8)
  drawBackground(); drawPlot(); drawCidade(0); drawCars(); drawCidade(1); drawTruck(); drawShelves(); desenharPromo(); if (DIV) drawLanesAcess(); else drawLanes(); drawGear(); if (GANCHOS.desenharLoja) GANCHOS.desenharLoja(); drawParking();
  const ents = [...customers.map(c => ({ c, y: c.y })), ...workers.map(w => ({ w, y: w.y })), ...collectors.map(k => ({ k, y: k.y })), ...(GANCHOS.pessoas ? GANCHOS.pessoas().map(v => ({ v, y: v.y })) : [])].sort((a, b) => a.y - b.y);
  for (const e of ents) {
    if (e.v) GANCHOS.desenharPessoa(e.v);
    else if (e.c) {
      const c = e.c, basket = [];
      c.plan.forEach(p => { for (let k = 0; k < p.got; k++) basket.push(SECTORS[p.sec].ic); });
      const mood = c.state === "angry" ? "angry" : c.state === "exit" ? "happy" : null;
      if (DIV) {
        const andou = Math.hypot(c.x - (c.px == null ? c.x : c.px), c.y - (c.py == null ? c.y : c.py)) > 0.05;
        const op = { moving: c.path.length > 0 || andou, mood, basket: c.gear === "b" ? basket : null, cart: c.gear === "c" ? basket : null };
        atualizarRumo(c);
        if (c.perfil && c.perfil !== "padrao" && c.perfil !== "idoso") pessoaDiversa(c, op); else person(c, op);
      } else person(c, { moving: c.path.length > 0, mood, basket: c.gear === "b" ? basket : null, cart: c.gear === "c" ? basket : null });
      if (c.state === "atStation" && c.wait > 1) { bubble(c.x + 10, c.y - 32, "🧺", "#fde2dc", .85); patienceBar(c.x, c.y - 28, Math.min(1, c.wait / GEAR_PATIENCE)); }
      const it = c.plan[c.step];
      if ((c.state === "walk" || c.state === "shop") && it) {
        const empty = c.state === "shop" && it.got < it.want && S.sec[SECTORS[it.sec].id].shelf === 0;
        bubble(c.x - 10, c.y - 32, SECTORS[it.sec].ic, empty ? "#fde2dc" : "#fffaf0", .85);
        if (empty) patienceBar(c.x, c.y - 28, Math.min(1, c.wait / SHELF_PATIENCE));
      }
      if (c.state === "angry" && c.x > 20) bubble(c.x + 8, c.y - 32, "😠", "#fde2dc", .85);
      if ((c.state === "queue" || c.state === "toLane") && c.qWait > 5) patienceBar(c.x, c.y - 30, Math.min(1, c.qWait / QUEUE_PATIENCE));
      if (DIV) marcasCliente(c);
    } else if (e.k) {
      person(e.k, { body: "#ef7d2b", cap: "#b85614", moving: e.k.path.length > 0, stack: e.k.b + e.k.c });
    } else {
      const w = e.w, d = SECTORS[w.sec];
      person(w, { body: "#f4efe2", apron: d.color, cap: d.color, moving: w.path.length > 0, box: w.carry ? d.ic : null });
    }
  }
  drawShelfLabels();
  floats.forEach(f => { ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4); text(f.text, f.x, f.y - f.t * 22, 12, f.color, "center", 800, "Nunito", "rgba(255,250,240,.9)"); ctx.globalAlpha = 1; });
  drawFx(); drawSelection();
  // screen space from here on
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  dayLight(); drawFxScreen();
}
