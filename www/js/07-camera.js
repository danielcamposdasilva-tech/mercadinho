"use strict";
// =====================================================================
// Drawing
// =====================================================================
const cv = document.getElementById("c"), ctx = cv.getContext("2d");
let DPR = 1, VW = 360, VH = 640, RES = 2, camReady = false; canvasOK = true;

// ---------- camera: pan, zoom and limits ----------
// cam.x/cam.y is the world point at the centre of the screen, cam.s is CSS pixels per world unit.
const cam = { x: W / 2, y: 300, s: 1, anim: null, vx: 0, vy: 0 };
const PAD_X = 24, PAD_T = 120, PAD_B = 130;          // screen px the world edge may travel under the HUD
const STEPS = [1, 1.5, 2, 3, 4, 6, 8];
function camLimits() {
  const wb = worldBounds(), ww = wb.x1 - wb.x0, wh = wb.y1 - wb.y0;
  const base = Math.min(VW / (W + 24), (VH - 190) / 520);
  const s0 = Math.max(0.5, base);
  const min = Math.min(s0 * 0.9, Math.max(VW / (ww + 40), (VH - 200) / (wh + 40)) * 0.98, VW / (ww + 40));
  return { s0, min: Math.max(0.25, Math.min(min, s0)), max: s0 * 2.8 };
}
// screen px covered by an open sheet (bottom on phones, right on wide screens); the camera may travel that much further
const occl = { b: 0, r: 0 };
function updateOccl() {
  const sh = document.getElementById("sheet"); occl.b = occl.r = 0;
  if (sh && !sh.hidden) { const r = sh.getBoundingClientRect(); if (r.left > VW * 0.45) occl.r = VW - r.left; else occl.b = Math.max(0, VH - r.top - PAD_B); }
}
function clampedPos(x, y, s) {
  const wb = WORLD, hw = VW / 2 / s, hh = VH / 2 / s;
  const ax = wb.x0 - PAD_X / s + hw, bx = wb.x1 + (PAD_X + occl.r) / s - hw;
  const ay = wb.y0 - PAD_T / s + hh, by = wb.y1 + (PAD_B + occl.b) / s - hh;
  return { x: ax > bx ? (ax + bx) / 2 : Math.max(ax, Math.min(bx, x)), y: ay > by ? (ay + by) / 2 : Math.max(ay, Math.min(by, y)) };
}
function clampCam(snap) {
  const L = camLimits();
  cam.s = Math.max(L.min, Math.min(L.max, cam.s));
  const c = clampedPos(cam.x, cam.y, cam.s);
  if (snap || cam.x !== c.x) { if (cam.x !== c.x) cam.vx = 0; cam.x = c.x; }
  if (snap || cam.y !== c.y) { if (cam.y !== c.y) cam.vy = 0; cam.y = c.y; }
}
// after a sheet closes, glide back inside the normal limits instead of jumping
function settleCam() { updateOccl(); const c = clampedPos(cam.x, cam.y, cam.s); if (Math.abs(c.x - cam.x) > .5 || Math.abs(c.y - cam.y) > .5) cam.anim = { x: c.x, y: c.y, s: cam.s }; }
function freeArea() {
  // the part of the screen not covered by HUD, bottom UI or an open sheet
  const hud = document.getElementById("hud").getBoundingClientRect(), nav = document.getElementById("nav").getBoundingClientRect();
  let top = hud.bottom + 6, bottom = nav.top - 6, right = VW;
  const sh = document.getElementById("sheet");
  if (!sh.hidden) { const r = sh.getBoundingClientRect(); if (r.left > VW * 0.45) right = r.left - 8; else bottom = Math.min(bottom, r.top - 8); }
  else { const m = document.getElementById("mission").getBoundingClientRect(); if (m.height) bottom = Math.min(bottom, m.top - 4); }
  if (bottom - top < 80) top = Math.max(0, bottom - 80);
  return { left: 0, right, top, bottom };
}
const toWorld = (sx, sy) => ({ x: cam.x + (sx - VW / 2) / cam.s, y: cam.y + (sy - VH / 2) / cam.s });
const toScreen = (wx, wy) => ({ x: (wx - cam.x) * cam.s + VW / 2, y: (wy - cam.y) * cam.s + VH / 2 });
function zoomAt(sx, sy, s) {
  const L = camLimits(), ns = Math.max(L.min, Math.min(L.max, s)), p = toWorld(sx, sy);
  cam.s = ns; cam.x = p.x - (sx - VW / 2) / ns; cam.y = p.y - (sy - VH / 2) / ns; clampCam();
}
// smooth move so that world point (wx, wy) lands at the centre of the free area
function flyTo(wx, wy, s, instant) {
  const L = camLimits(); s = Math.max(L.min, Math.min(L.max, s || cam.s));
  const f = freeArea(), fx = (f.left + f.right) / 2, fy = (f.top + f.bottom) / 2;
  const c = clampedPos(wx - (fx - VW / 2) / s, wy - (fy - VH / 2) / s, s), tx = c.x, ty = c.y;
  cam.vx = cam.vy = 0;
  if (instant) { cam.x = tx; cam.y = ty; cam.s = s; cam.anim = null; clampCam(true); }
  else cam.anim = { x: tx, y: ty, s };
}
function recenter(instant) { overview = false; camHome = null; syncMapBtn(); flyTo(W / 2, Math.min((60 + H + 80) / 2, 360), camLimits().s0, instant); }
let overview = false, beforeOverview = null, camHome = null;
function toggleOverview() {
  camHome = null;
  if (overview) { overview = false; const b = beforeOverview; if (b) cam.anim = { x: b.x, y: b.y, s: b.s }; else recenter(); }
  else { overview = true; beforeOverview = { x: cam.x, y: cam.y, s: cam.s }; flyTo((WORLD.x0 + WORLD.x1) / 2, (WORLD.y0 + WORLD.y1) / 2, camLimits().min); }
  syncMapBtn();
}
function syncMapBtn() { const b = document.getElementById("btnMap"); if (b) b.setAttribute("aria-pressed", overview); }
// keep a selected building inside the free area (only moves when it is hidden or under a panel)
function reveal(r) {
  const f = freeArea(), a = toScreen(r.x, r.y), b = toScreen(r.x + r.w, r.y + r.h), m = 16;
  if (a.x >= f.left + m && b.x <= f.right - m && a.y >= f.top + m && b.y <= f.bottom - m) return;
  flyTo(r.x + r.w / 2, r.y + r.h / 2, cam.s);
}
function stepCam(dt) {
  if (cam.anim) {
    const k = REDUZ() ? 1 : 1 - Math.exp(-dt * 9), A = cam.anim;      // movimento reduzido: a câmera vai direto
    cam.x += (A.x - cam.x) * k; cam.y += (A.y - cam.y) * k; cam.s += (A.s - cam.s) * k;
    if (Math.abs(A.x - cam.x) < .3 && Math.abs(A.y - cam.y) < .3 && Math.abs(A.s - cam.s) < .002) { cam.x = A.x; cam.y = A.y; cam.s = A.s; cam.anim = null; }
    clampCam();
  } else if (!drag && !REDUZ() && (Math.abs(cam.vx) > 2 || Math.abs(cam.vy) > 2)) {
    // a short glide after a fling
    cam.x -= cam.vx * dt / cam.s; cam.y -= cam.vy * dt / cam.s;
    const k = Math.exp(-dt * 5); cam.vx *= k; cam.vy *= k; clampCam();
  }
  let r = STEPS.find(v => v >= DPR * cam.s * 0.9) || 8;
  if (r !== RES) { RES = r; floorCache = null; if (Object.keys(emojiCache).length > 700) for (const k in emojiCache) delete emojiCache[k]; }
}
function fitCanvas() {
  DPR = Math.min(3, window.devicePixelRatio || 1);
  VW = cv.clientWidth || window.innerWidth; VH = cv.clientHeight || window.innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  updateOccl();
  if (!camReady) { camReady = true; recenter(true); } else clampCam(true);
}
window.addEventListener("resize", fitCanvas);
if (window.ResizeObserver) new ResizeObserver(() => { if (cv.clientWidth !== VW || cv.clientHeight !== VH) fitCanvas(); }).observe(cv);
function rrPath(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r); else ctx.rect(x, y, w, h); }
function rr(x, y, w, h, r, fill) { rrPath(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function rrs(x, y, w, h, r, fill, stroke, lw = 1) { rrPath(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
function grad(y0, y1, c0, c1) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
function text(t, x, y, size, color, align = "center", weight = 800, font = "Nunito", outline) {
  ctx.font = `${weight} ${size}px "${font}", system-ui, sans-serif`; ctx.textAlign = align;
  if (outline) { ctx.lineJoin = "round"; ctx.lineWidth = 3; ctx.strokeStyle = outline; ctx.strokeText(t, x, y); }
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}
// Emoji are rendered once into small bitmaps so the scene stays smooth
const emojiCache = {};
function emoji(ch, x, y, size) {
  const k = ch + size + "@" + RES;
  if (!emojiCache[k]) {
    const c = document.createElement("canvas"), s = Math.max(8, Math.ceil(size * 1.5 * RES)); c.width = c.height = s;
    const g = c.getContext("2d"); g.font = `${s * 0.77}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, s / 2, s / 2 + s * 0.05); emojiCache[k] = c;
  }
  ctx.drawImage(emojiCache[k], x - size * 0.75, y - size * 0.75, size * 1.5, size * 1.5);
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = v => Math.round(f > 1 ? v + (255 - v) * (f - 1) / f : v * f);
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
const now = () => performance.now() / 1000;
