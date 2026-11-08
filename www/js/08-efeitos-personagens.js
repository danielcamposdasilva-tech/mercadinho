"use strict";
// ---------- particles: coins fly to the balance, sparkles on purchases ----------
// Os efeitos decorativos usam um sorteio próprio: ligar ou desligar "reduzir movimento" não altera
// o sorteio da simulação (clientes, compras, carros). Sem a diversidade (teste de regressão), usa o de antes.
let decorSeed = 987654321;
const rDec = () => DIV ? (decorSeed = (decorSeed * 16807) % 2147483647) / 2147483647 : Math.random();
const fx = [];
function coinBurst(x, y, n) {
  if (REDUZ()) { pulseMoney(); return; }      // movimento reduzido: sem moedas voando
  for (let i = 0; i < n; i++) fx.push({ kind: "coin", x, y, sx: x, sy: y, t: -i * 0.06, life: 0.8, ox: (rDec() - .5) * 40, oy: -20 - rDec() * 20 });
}
function sparkle(x, y, color, n = 14) {
  if (REDUZ()) return;
  for (let i = 0; i < n; i++) { const a = rDec() * Math.PI * 2, s = 30 + rDec() * 60;
    fx.push({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0, life: 0.7 + rDec() * .3, color }); }
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i]; p.t += dt;
    if (p.kind === "spark") { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
    if (p.kind === "conf") { p.x += (p.vx + Math.sin(p.t * 4 + p.r) * 20) * dt; p.y += p.vy * dt; }
    if (p.t > p.life) { fx.splice(i, 1); if (p.kind === "coin") pulseMoney(); }
  }
}
function drawFx() {
  for (const p of fx) {
    if (p.t < 0) continue;
    const k = p.t / p.life;
    if (p.kind === "coin" || p.kind === "conf") continue;   // drawn in screen space, see drawFxScreen
    if (p.kind === "heart") {
      ctx.globalAlpha = 1 - k; emoji("💚", p.x + p.vx * p.t, p.y - p.t * 30, 8 + k * 3); ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 6); ctx.fillRect(-2, -2, 4, 4); ctx.restore(); ctx.globalAlpha = 1;
    }
  }
}

// coins fly from the checkout to the balance in the HUD; confetti falls over the whole screen
let moneyAt = { x: 120, y: 30 };
function measureHud() { const r = document.getElementById("moneyChip").getBoundingClientRect(); moneyAt = { x: r.left + 18, y: r.top + r.height / 2 }; }
function drawFxScreen() {
  for (const p of fx) {
    if (p.t < 0) continue;
    const k = p.t / p.life;
    if (p.kind === "coin") {
      const a = toScreen(p.sx, p.sy), mx = a.x + p.ox * 1.4, my = a.y + p.oy * 1.6, e = k * k, u = 1 - k;
      const x = u * u * a.x + 2 * u * k * mx + e * moneyAt.x, y = u * u * a.y + 2 * u * k * my + e * moneyAt.y;
      const r = 8 * (1 - k * .35), sq = Math.abs(Math.cos(now() * 10 + p.ox));
      ctx.fillStyle = "#c98f17"; ctx.beginPath(); ctx.ellipse(x, y + 1.5, r * Math.max(.3, sq), r, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#f8c94a"; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(.3, sq), r, 0, 0, 7); ctx.fill();
      if (sq > .6) text("M", x, y + 4, 10, "#8a5d06", "center", 800);
    } else if (p.kind === "conf") {
      ctx.globalAlpha = Math.min(1, (p.life - p.t) * 2); ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r + p.t * 5); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore(); ctx.globalAlpha = 1;
    }
  }
}

// ---------- ambient life ----------
const cars = []; let carTimer = 2;
const CAR_COLORS = ["#c9513a", "#3f74b8", "#f2b233", "#5a9a3c", "#8a5cc2", "#e6e2d8", "#2a2620"];
function updateCars(dt) {
  carTimer -= dt;
  if (carTimer <= 0) { carTimer = (2.5 + Math.random() * 4) / (SCENE.transito || 1); const right = Math.random() < .5;
    cars.push({ x: right ? WORLD.x0 - 40 : WORLD.x1 + 40, y: right ? 27 : 8, v: (right ? 1 : -1) * (70 + Math.random() * 50), color: pick(CAR_COLORS) }); }
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; c.x += c.v * dt; if (c.x < WORLD.x0 - 60 || c.x > WORLD.x1 + 60) cars.splice(i, 1); }
}
function drawCars() {
  for (const c of cars) {
    const d = Math.sign(c.v), x = c.x, y = c.y;
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(x - 15, y + 5, 30, 3);
    rr(x - 15, y - 5, 30, 11, 4, c.color);
    rr(x - 7 + d * 2, y - 4, 13, 9, 3, shade(c.color, .75));
    rr(x - 5 + d * 2, y - 3, 9, 7, 2, "rgba(214,232,251,.85)");
    ctx.fillStyle = "#fff6c8"; ctx.fillRect(x + d * 14 - 1, y - 4, 2, 3); ctx.fillRect(x + d * 14 - 1, y + 2, 2, 3);
  }
}
let bannerQ = [];
function banner(txt, color = "#1f4d3a") { bannerQ.push({ txt, color, t: 0 }); }
function drawBanner(dt) {
  const b = bannerQ[0]; if (!b) return;
  if (!b.dito) { b.dito = true; anunciar(b.txt); }   // leitores de tela ouvem cada aviso uma vez
  b.t += dt; const T = 2.2;
  if (b.t > T) { bannerQ.shift(); return; }
  const k = b.t < .35 ? 1 - Math.pow(1 - b.t / .35, 3) : b.t > T - .35 ? Math.pow((T - b.t) / .35, 2) : 1;
  // screen space, just below the HUD
  const red = REDUZ(), x = red ? VW / 2 : VW / 2 + (1 - k) * (b.t < T / 2 ? -VW : VW), y = Math.min(VH * 0.42, freeTop + 70);
  ctx.save(); ctx.translate(x, y); if (red) ctx.globalAlpha = Math.min(1, k * 1.5); else ctx.rotate(-.04);
  rr(-140, -20, 280, 40, 12, "rgba(0,0,0,.18)");
  rr(-140, -23, 280, 40, 12, b.color);
  ctx.fillStyle = "rgba(255,255,255,.12)"; for (let i = -140; i < 140; i += 22) ctx.fillRect(i + (red ? 0 : (b.t * 40) % 22), -23, 8, 40);
  text(b.txt, 0, 5, 18, "#fff", "center", 800, "Baloo 2", "rgba(0,0,0,.25)");
  ctx.restore();
}

// shelves bounce the products that were just placed
const pops = SECTORS.map(() => ({ from: 0, to: 0, t: -9 }));
function markPop(i, from, to) { pops[i] = { from, to, t: now() }; }
function heart(x, y) { if (REDUZ()) return; fx.push({ kind: "heart", x, y, t: 0, life: 1.1, vx: (rDec() - .5) * 10 }); }
function confetti() {
  if (REDUZ()) return;
  const cols = ["#c9513a", "#f2b233", "#3f74b8", "#5a9a3c", "#8a5cc2", "#fffaf0"];
  for (let i = 0; i < 80; i++) fx.push({ kind: "conf", x: rDec() * VW, y: -10 - rDec() * 120, vx: (rDec() - .5) * 40, vy: 160 + rDec() * 140,
    t: 0, life: 2.4 + rDec(), color: cols[(rDec() * cols.length) | 0], r: rDec() * 6 });
}

// ---------- characters ----------
function person(p, opts = {}) {
  const { x, y } = p, t = now(), moving = opts.moving, ph = t * 13 + (p.id || 0) * 1.7;
  const bob = REDUZ() ? 0 : moving ? Math.abs(Math.sin(ph)) * -1.6 : Math.sin(t * 2 + (p.id || 0)) * .4;
  const ink = "rgba(42,32,20,.55)";
  ctx.fillStyle = "rgba(40,30,15,.18)"; ctx.beginPath(); ctx.ellipse(x, y + 10, 9.5, 3.6, 0, 0, 7); ctx.fill();
  // legs
  const s = moving ? Math.sin(ph) * 2.6 : 0;
  rr(x - 5 + s, y + 4, 4, 7, 2, "#3a3330"); rr(x + 1 - s, y + 4, 4, 7, 2, "#3a3330");
  // body
  const body = opts.body || p.shirt;
  rrPath(x - 8.5, y - 7 + bob, 17, 15, 6); ctx.fillStyle = grad(y - 7 + bob, y + 8 + bob, shade(body, 1.15), shade(body, .85)); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = .8; ctx.stroke();
  if (opts.apron) { rr(x - 5.5, y - 3 + bob, 11, 10, 3, opts.apron); rr(x - 2, y - 1 + bob, 4, 3, 1, "rgba(255,255,255,.45)"); }
  // arms
  const arm = moving && !REDUZ() ? Math.sin(ph) * 2 : 0;
  rr(x - 11, y - 4 + bob - arm, 4, 9, 2, shade(body, .9)); rr(x + 7, y - 4 + bob + arm, 4, 9, 2, shade(body, .9));
  // head
  ctx.fillStyle = p.skin || "#f2cfa6"; ctx.beginPath(); ctx.arc(x, y - 13 + bob, 7.8, 0, 7); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = .8; ctx.stroke();
  ctx.fillStyle = p.hair || "#3b2a1a"; ctx.beginPath(); ctx.arc(x, y - 15 + bob, 7.9, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  if (p.long) { rr(x - 8, y - 15 + bob, 3.5, 9, 2, p.hair); rr(x + 4.5, y - 15 + bob, 3.5, 9, 2, p.hair); }
  if (opts.cap) { rr(x - 8.5, y - 23.5 + bob, 17, 6, 3, opts.cap); rr(x - 1, y - 20 + bob, 11, 3, 1.5, shade(opts.cap, .8)); }
  // face
  const blink = (Math.sin(t * 1.3 + (p.id || 0) * 3) > .985) ? .2 : 1.2;
  ctx.fillStyle = "#2a2620";
  ctx.beginPath(); ctx.ellipse(x - 2.8, y - 12 + bob, 1.1, blink, 0, 0, 7); ctx.ellipse(x + 2.8, y - 12 + bob, 1.1, blink, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(230,120,110,.35)"; ctx.beginPath(); ctx.arc(x - 4.8, y - 9.5 + bob, 1.6, 0, 7); ctx.arc(x + 4.8, y - 9.5 + bob, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = "#2a2620"; ctx.lineWidth = 1; ctx.beginPath();
  if (opts.mood === "angry") ctx.arc(x, y - 6.5 + bob, 2.2, Math.PI * 1.15, Math.PI * 1.85);
  else if (opts.mood === "happy") ctx.arc(x, y - 9.5 + bob, 2.4, Math.PI * .15, Math.PI * .85);
  else { ctx.moveTo(x - 1.5, y - 8.3 + bob); ctx.lineTo(x + 1.5, y - 8.3 + bob); }
  ctx.stroke();
  // basket (shoppers) or box (staff)
  if (opts.basket) {
    ctx.strokeStyle = "#b23a2a"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x + 13, y - 2 + bob, 6, Math.PI, 0); ctx.stroke();
    opts.basket.slice(-2).forEach((ch, i) => emoji(ch, x + 9.5 + i * 7, y - 1 + bob, 8));
    rrs(x + 5, y + 1 + bob, 16, 8, 2, "#d9533f", "#9e2f22", 1);
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x + 7, y + 3.5 + bob, 12, 1);
  }
  if (opts.cart) {
    const cx = x + 9, cy = y - 2 + bob;
    ctx.strokeStyle = "#5b6b73"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + 5, y - 4 + bob); ctx.lineTo(cx, cy); ctx.stroke();
    rrs(cx, cy, 18, 11, 2, "rgba(220,228,232,.9)", "#5b6b73", 1.2);
    ctx.strokeStyle = "rgba(91,107,115,.5)"; ctx.lineWidth = .7; for (let k = 4; k < 18; k += 4) { ctx.beginPath(); ctx.moveTo(cx + k, cy); ctx.lineTo(cx + k, cy + 11); ctx.stroke(); }
    opts.cart.slice(-3).forEach((ch, i) => emoji(ch, cx + 4 + i * 5.5, cy + 2, 7.5));
    ctx.fillStyle = "#2a2620"; ctx.beginPath(); ctx.arc(cx + 3, cy + 13, 1.8, 0, 7); ctx.arc(cx + 15, cy + 13, 1.8, 0, 7); ctx.fill();
  }
  if (opts.stack) {
    for (let k = 0; k < Math.min(4, opts.stack); k++) rrs(x - 7, y - 2 + bob - k * 3, 14, 6, 1.5, "#d9533f", "#9e2f22", .8);
  }
  if (opts.box) {
    rrs(x - 8, y - 6 + bob, 16, 12, 2, "#c99a5b", "#8a6634", .8); rr(x - 8, y - 2 + bob, 16, 2, 0, "#a87b42");
    emoji(opts.box, x, y + 1 + bob, 6.5);
  }
}
function bubble(x, y, ch, color = "#fffaf0", pop = 1) {
  const s = pop;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.arc(0, 1.2, 10.5, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1, 8); ctx.lineTo(6, 13); ctx.lineTo(6, 6); ctx.fill();
  ctx.strokeStyle = "rgba(42,32,20,.25)"; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, 7); ctx.stroke();
  ctx.restore();
  emoji(ch, x, y, 10 * s);
}
function patienceBar(x, y, p) {
  rr(x - 11, y, 22, 5, 2.5, "rgba(42,32,20,.35)");
  rr(x - 10, y + 1, 20 * (1 - p), 3, 1.5, p > .6 ? "#e2553c" : p > .3 ? "#f2b233" : "#7cc49a");
}
