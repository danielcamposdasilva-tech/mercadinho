"use strict";
// =====================================================================
// Input: drag to pan, pinch or wheel to zoom, tap to select.
// A gesture that moved more than a few pixels never counts as a tap, so panning cannot buy or select anything.
// =====================================================================
const ptrs = new Map(); let drag = null, pinch = null;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
cv.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("gesturestart", e => e.preventDefault());
window.addEventListener("wheel", e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
cv.addEventListener("pointerdown", ev => {
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
  ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  cam.anim = null; cam.vx = cam.vy = 0;
  if (ptrs.size === 1) drag = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, t: performance.now(), lt: performance.now(), moved: false, slop: ev.pointerType === "mouse" ? 5 : 10 };
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.max(10, dist(a, b)), s: cam.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; if (drag) drag.moved = true; }
});
cv.addEventListener("pointermove", ev => {
  const p = ptrs.get(ev.pointerId);
  if (!p) { if (ev.pointerType === "mouse") { const w = toWorld(ev.clientX, ev.clientY); cv.classList.toggle("hot", !!hitBuilding(w.x, w.y) || hitPile(w.x, w.y) >= 0); } return; }
  p.x = ev.clientX; p.y = ev.clientY;
  if (ptrs.size >= 2 && pinch) {
    const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    cam.x -= (mx - pinch.mx) / cam.s; cam.y -= (my - pinch.my) / cam.s; pinch.mx = mx; pinch.my = my;
    zoomAt(mx, my, pinch.s * dist(a, b) / pinch.d); camHome = null;
    if (overview) { overview = false; syncMapBtn(); }
    return;
  }
  if (drag && ev.pointerId === drag.id) {
    const dx = ev.clientX - drag.lx, dy = ev.clientY - drag.ly, tn = performance.now();
    if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > drag.slop) { drag.moved = true; camHome = null; cv.classList.add("dragging"); }
    if (drag.moved) {
      cam.x -= dx / cam.s; cam.y -= dy / cam.s; clampCam();
      const dt = Math.max(8, tn - drag.lt);
      cam.vx = cam.vx * .5 + dx / dt * 1000 * .5; cam.vy = cam.vy * .5 + dy / dt * 1000 * .5;
      drag.lt = tn;
      if (overview) { overview = false; syncMapBtn(); }
    }
    drag.lx = ev.clientX; drag.ly = ev.clientY;
  }
});
function endPointer(ev) {
  if (!ptrs.has(ev.pointerId)) return;
  ptrs.delete(ev.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (drag && ev.pointerId === drag.id) {
    const tap = !drag.moved && ev.type === "pointerup" && performance.now() - drag.t < 700;
    if (performance.now() - drag.lt > 90 || !drag.moved) cam.vx = cam.vy = 0;   // finger rested before lifting: no glide
    drag = null; cv.classList.remove("dragging");
    if (tap) tapAt(ev.clientX, ev.clientY);
  }
  if (ptrs.size === 1 && !drag) {   // pinch ended: the remaining finger keeps panning, never taps
    const [id, p] = [...ptrs.entries()][0];
    drag = { id, sx: p.x, sy: p.y, lx: p.x, ly: p.y, t: 0, lt: performance.now(), moved: true, slop: 10 };
    cam.vx = cam.vy = 0;
  }
}
["pointerup", "pointercancel", "lostpointercapture"].forEach(t => cv.addEventListener(t, endPointer));
cv.addEventListener("wheel", ev => {
  ev.preventDefault(); cam.anim = null; cam.vx = cam.vy = 0; camHome = null;
  const dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1);
  zoomAt(ev.clientX, ev.clientY, cam.s * Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0016)));
  if (overview) { overview = false; syncMapBtn(); }
}, { passive: false });
function tapAt(sx, sy) {
  if (paused) return;
  const { x, y } = toWorld(sx, sy);
  // quick action: baskets left at a checkout go back to the entrance
  const l = hitPile(x, y);
  if (l >= 0) {
    const p = piles[l];
    if (p.c > 0) { p.c--; station.c++; } else { p.b--; station.b++; }
    S.stats.tapGear++; taskProgress("tapgear", 1);
    float(pileX(l), FZ + 110, "+1 🧺", "#b23a2a"); return;
  }
  const hit = hitBuilding(x, y);
  if (hit) { select(hit); return; }
  if (ui.sheet) closeSheet();   // tapping empty ground closes the open panel
}
