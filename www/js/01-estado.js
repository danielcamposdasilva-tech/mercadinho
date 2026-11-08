"use strict";
// =====================================================================
// State
// =====================================================================
// Cada modo tem a sua chave: o Modo Livre continua em "mercadinho-save-v4"; a carreira guarda
// a loja da fase atual dentro de "mercadinho-carreira-v1"; prévias e o menu nunca tocam nessas chaves.
const SAVE_KEY = MODO === "livre" ? CHAVE_LIVRE : MODO === "carreira" ? CHAVE_CARREIRA : MODO === "previa" ? "mercadinho-previa-" + CENA_ID : null;
function freshState() {
  const s = { money: 25, day: 1, dayT: 0, rep: 3, tier: 0, branches: 0, earned: 0, served: 0, seenIntro: false,
    cashiers: 1, cashLvl: 0, whLvl: 0, adsLvl: 0, mgrLvl: 0, sec: {},
    gear: { baskets: 8, carts: 0, buyB: 0, buyC: 0, collectors: 1, colLvl: 0 },
    today: { sales: 0, goods: 0, lost: 0, served: 0, park: freshParkDay() }, lastDay: null, avgNet: 0, lastSeen: Date.now(),
    tasks: null, streak: 0, streakDate: null, ach: {}, stats: { tapGear: 0, hand: 0 },
    park: { lots: { park0: true }, price: 1, staff: 0, train: 0, sign: 0, served: 0, everHired: false, intro: {} } };
  SECTORS.forEach((d, i) => s.sec[d.id] = { open: i === 0, shelfLvl: 0, priceLvl: 0, staff: 1, staffLvl: 0, shelf: i === 0 ? 4 : 0, wh: i === 0 ? 10 : 0 });
  return s;
}
function freshParkDay() { return { fees: 0, cars: 0, lostFull: 0, lostPrice: 0 }; }
// older saves have no parking: fill in the new fields without touching the rest of the progress
function migrate() {
  const f = freshState();
  S.park = Object.assign(f.park, S.park || {});
  S.park.lots = Object.assign({ park0: true }, S.park.lots || {}); S.park.intro = S.park.intro || {};
  if (S.tier >= 1) S.park.lots.market = true;        // stores already past the first expansion own the lot
  if (!S.today) S.today = f.today;
  if (!S.today.park) S.today.park = freshParkDay();
  if (!(S.park.price >= 0)) S.park.price = 1;
  if (SCENE.doca) S.park.lots.logi = true;            // a doca de recebimento faz parte da loja (capítulo 3)
}
let S = freshState();
try {
  if (MODO === "carreira") { const lj = CARREIRA && CARREIRA.lojas && CARREIRA.lojas[FASE]; if (lj) S = Object.assign(freshState(), lj); }
  else if (SAVE_KEY) { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const o = JSON.parse(raw); S = Object.assign(freshState(), o); } }
} catch (e) {}
migrate();
function save() {
  if (!SAVE_KEY) return;                               // menu: nada é salvo
  if (window.__semSalvar) return;                      // trapaça "recomeçar capítulo": a loja apagada não volta
  S.lastSeen = Date.now();
  try {
    // carreira: grava só a loja aberta, e só se ela ainda é a loja ativa (uma troca já gravada não é desfeita)
    if (MODO === "carreira") { if (CARREIRA && CARREIRA.ativa === FASE && CARREIRA.lojas) { CARREIRA.lojas[FASE] = S; localStorage.setItem(SAVE_KEY, JSON.stringify(CARREIRA)); } }
    else localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch (e) {}
}
let paused = false;
const openSectors = () => SECTORS.filter((d, i) => i < slots() && S.sec[d.id].open);
const whUsed = () => SECTORS.reduce((a, d) => a + S.sec[d.id].wh, 0) + (GANCHOS.whExtra ? GANCHOS.whExtra() : 0);   // + reservas de entregas (cap. 5)
