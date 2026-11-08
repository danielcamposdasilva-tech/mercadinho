"use strict";
// =====================================================================
// Parking and neighbouring lots. Every number here is original to this prototype (see MEMORIA.md).
// Flow: car arrives on the street below -> decides on the price -> queues at the entry gate ->
// a free stall is reserved at the gate -> parks -> passengers shop in the store -> they return ->
// the car leaves through the exit gate and pays once.
// =====================================================================
const PK = {
  EX: 18,                    // entry lane centre x
  carWait: 12,               // seconds a car waits for a free stall before giving up
  maxQueue: 3,               // cars at the entry: one at the gate + two on the street
  maxStaff: 4,
  priceMax: 10, priceStep: 0.5, priceDefault: 1,
  machineIn: 3.0, machineOut: 3.5,   // gates without an attendant use slow machines (never stuck)
  staffIn: 1.4, staffOut: 1.8,       // attendant times at training level 0
  helper: 0.7,                       // 3rd and 4th attendants cut the time at their gate by 30%
  buildT: 2.6,                       // seconds of the construction animation after buying a lot
};
// vertical layout below the store (world units; 1 unit is about 0.2 m)
const pkY = () => ({ walk: H + 8, door: H + 22, stall: H + 31, aisle: H + 54, gate: H + 70, gateStop: H + 84, lanePass: H + 86, laneIn: H + 102 });
const LOTS = SCENE.lotes;
const CANCELA = SCENE.estacionamento.cancela !== false;   // false: vagas livres, sem cabine nem cobrança
const parkPrice = () => CANCELA ? S.park.price : 0;
const lotById = id => LOTS.find(l => l.id === id);
const owns = id => !!(S.park && S.park.lots[id]);
const building = {};                                   // lot id -> seconds left of the construction
const lotReady = id => owns(id) && !(building[id] > 0);
function lotRect(L) {
  if (L.kind === "park") return { x: L.x, y: H + 16, w: L.w, h: 46 };
  if (L.kind === "market") return { x: PLOT.x, y: PLOT.y, w: PLOT.w, h: PLOT.h };
  return { x: LOJA.espelho ? -152 : W + 22, y: 46, w: 130, h: 76 };
}
const lotPurpose = L => L.kind === "park" ? "Estacionamento" : L.kind === "market" ? "Ampliação do mercado" : "Logística";
const lotSize = L => { const r = lotRect(L); return `${Math.round(r.w * 0.2)} × ${Math.round(r.h * 0.2)} m`; };
const lotBenefit = L => L.kind === "park" ? `Adiciona ${L.stalls} vagas` : L.kind === "market"
  ? "Libera as obras de ampliação da loja (Mercado Médio em diante)" : "Caminhão passa a cada 6 s (era 8 s) e traz +4 caixas por entrega";
function lotReqs(L) {
  const r = [];
  if (L.tier) r.push({ label: `Ser ${TIERS[L.tier].name}`, short: `Requer ${TIERS[L.tier].name}`, ok: S.tier >= L.tier });
  if (L.after && lotById(L.after).cost) r.push({ label: `Ter comprado: ${lotById(L.after).name}`, short: "Compre o lote anterior", ok: owns(L.after) });
  return r;
}
function buyLot(L) {
  S.park.lots[L.id] = true; building[L.id] = PK.buildT;
  banner(`🏗️ Obra: ${L.name}`, "#b7773b");
}
function finishLot(id) {
  const L = lotById(id); delete building[id];
  buildStalls(); floorCache = null;
  const r = lotRect(L); sparkle(r.x + r.w / 2, r.y + r.h / 2, "#f2b233", 30); confetti();
  banner(L.kind === "park" ? `🅿️ +${L.stalls} vagas prontas!` : `✅ ${L.name} pronto!`, "#2e7a57");
}

// stalls of every lot that is bought and built
let STALLS = [];
function buildStalls() {
  const keep = new Map(STALLS.map(s => [s.key, s]));
  STALLS = [];
  LOTS.forEach(L => { if (L.kind !== "park" || !lotReady(L.id)) return;
    for (let i = 0; i < L.stalls; i++) { const key = L.id + ":" + i, o = keep.get(key); STALLS.push({ key, lot: L.id, x: L.x + 11 + 22 * i, car: o ? o.car : null, res: o ? o.res : null }); } });
}
const stallByKey = k => STALLS.find(s => s.key === k);
const parkEnd = () => Math.max(...LOTS.filter(L => L.kind === "park" && lotReady(L.id)).map(L => L.x + L.w));
const exitX = () => parkEnd() + 14;
const occupied = () => STALLS.filter(s => s.car || s.res).length;

// staff, prices and demand
const parkWage = () => 2 + S.tier;                     // per attendant per day, like a cashier
const parkWages = () => S.park.staff * parkWage();
const parkTrain = (t = S.park.train) => Math.max(0.35, Math.pow(0.85, t));
function gateTime(which, staff = S.park.staff, train = null) {
  if (train == null) train = typeof nvPark === "function" ? nvPark(which === "out" ? 0 : 1) : S.park.train;   // 1.5: nível de quem está na cabine
  if (!CANCELA) return 0.4;                          // sem cancela: o carro só reduz e passa
  const manned = which === "out" ? staff >= 1 : staff >= 2, helper = which === "out" ? staff >= 3 : staff >= 4;
  if (!manned) return which === "out" ? PK.machineOut : PK.machineIn;
  return (which === "out" ? PK.staffOut : PK.staffIn) * parkTrain(train) * (helper ? PK.helper : 1);
}
const parkRef = () => 1.5 * (1 + 0.6 * S.tier);       // typical price a driver accepts at this store size
const acceptShare = p => Math.max(0, Math.min(1, (1.8 - p / parkRef()) / 1.6));
function carRate() {
  const n = STALLS.length; if (!n) return 0;
  return 0.05 * Math.pow(n, 0.7) * demand() * (0.6 + 0.1 * S.rep) * (isRush() ? 1.6 : 1) * (1 + 0.12 * S.park.sign);
}
const postName = n => ["1º atendente: cabine de saída (cobrança)", "2º atendente: cabine de entrada", "3º atendente: ajuda na saída (−30% de tempo)", "4º atendente: ajuda na entrada (−30% de tempo)"][n] || "";
const PINTRO_TODAS = [
  { id: "car1", label: "Atender o primeiro carro do estacionamento", ok: () => S.park.served >= 1, reward: 30 },
  { id: "hire1", label: "Contratar um atendente de cancela", ok: () => S.park.everHired, reward: 50 },
  { id: "lot1", label: "Comprar o primeiro lote de ampliação do estacionamento", ok: () => LOTS.some(L => L.kind === "park" && L.cost > 0 && owns(L.id)), reward: 120 },
];
const PINTRO = PINTRO_TODAS.filter(t => CANCELA || t.id !== "hire1");   // sem cancela não há atendente

// runtime (not saved: cars are rebuilt from zero after a reload, so nothing is charged twice and no stall stays blocked)
const pcars = [], inQ = [];
let carSpawnT = 4, pcarId = 1;
const gates = { in: { car: null, t: 0, total: 1, open: 0, hold: 0 }, out: { car: null, t: 0, total: 1, open: 0, hold: 0 } };
const CARP = ["#c9513a", "#3f74b8", "#f2b233", "#5a9a3c", "#8a5cc2", "#e6e2d8", "#4b5563", "#2f8a7a"];
function resetParking() {
  pcars.length = 0; inQ.length = 0; STALLS.forEach(s => { s.car = null; s.res = null; });
  for (const g of Object.values(gates)) Object.assign(g, { car: null, t: 0, open: 0, hold: 0 });
}
function spawnCar() {
  if (pcars.length > 40) return;
  const y = pkY();
  pcars.push({ id: pcarId++, x: WORLD.x0 - 30, y: y.laneIn, ang: 0, color: pick(CARP), state: "approach", path: [{ x: PK.EX - 92, y: y.laneIn }],
    wtp: parkRef() * (0.2 + 1.6 * Math.random()), fee: 0, stall: null, wait: 0, pax: 0, back: 0, paid: false, blockT: 0 });
}
function carBlocked(c) {
  const p = c.path[0]; if (!p) return false;
  const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy); if (d < .01) return false;
  const ux = dx / d, uy = dy / d;
  for (const o of pcars) {
    if (o === c || o.state === "parked" || o.state === "queue") continue;
    const vx = o.x - c.x, vy = o.y - c.y, ahead = vx * ux + vy * uy, lat = Math.abs(vx * uy - vy * ux);
    if (ahead > 0 && ahead < 27 && lat < 11) return true;
  }
  return false;
}
function steer(c, tx, ty, dt) { const a = Math.atan2(ty - c.y, tx - c.x); let d = a - c.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; c.ang += d * Math.min(1, dt * 12); }
// drives along the path, keeping distance from the car ahead; returns true at the end of the path
function drive(c, dt, speed, noBlock) {
  if (!c.path.length) return true;
  if (!noBlock && carBlocked(c) && c.blockT < 8) { c.blockT += dt; return false; }
  c.blockT = 0;
  const p = c.path[0];
  if (Math.hypot(p.x - c.x, p.y - c.y) > .5) steer(c, p.x, p.y, dt);
  if (moveTo(c, p.x, p.y, speed, dt)) c.path.shift();
  return !c.path.length;
}
function passBy(c, lostWhy) {
  const y = pkY();
  c.state = "pass"; c.path = [{ x: c.x + 16, y: y.lanePass }, { x: WORLD.x1 + 60, y: y.lanePass }];
  if (lostWhy === "price") { S.today.park.lostPrice++; float(c.x + 10, c.y - 14, "Caro! 💸", "#c9513a"); }
  if (lostWhy === "full") { S.today.park.lostFull++; changeRep(-0.02, "estacionamento"); avisoDesistiu(c); }
}
// 1.4: só diz "lotado" quando não há vaga livre; com vagas sobrando, o gargalo é a fila da cancela
const vagaLivre = () => STALLS.some(s => !s.car && !s.res);
function avisoDesistiu(c) {
  const filaCancela = vagaLivre() && S.park.staff < PK.maxStaff;
  if (filaCancela) { float(c.x + 10, c.y - 14, "Fila 😕", "#c9513a"); toastOnce("parkfila", `Fila na cancela do estacionamento: ainda há vagas livres, mas ${S.park.staff ? "a cancela não dá conta" : "não há atendente"}. Contrate ou treine atendentes.`); }
  else { float(c.x + 10, c.y - 14, "Lotado 😕", "#c9513a"); toastOnce("parkfull", S.park.staff >= PK.maxStaff || !CANCELA ? "Estacionamento lotado: todas as vagas ocupadas ou reservadas (em amarelo) para carros entrando. Amplie o estacionamento." : "Estacionamento lotado! Compre mais vagas ou contrate atendentes."); }
}
function qPos(i) { const y = pkY(); return i === 0 ? { x: PK.EX, y: y.gateStop } : { x: PK.EX - 30 * i, y: y.laneIn }; }
function updateParking(dt) {
  const y = pkY(), ex = exitX();
  // construction
  for (const id of Object.keys(building)) { building[id] -= dt; if (building[id] <= 0) finishLot(id); }
  // arrivals
  carSpawnT -= dt;
  if (carSpawnT <= 0) { const r = carRate(); carSpawnT = r ? (0.6 + 0.8 * Math.random()) / r : 5; if (r && !(GANCHOS.semCarros && GANCHOS.semCarros())) spawnCar(); }   // capítulo 8: canteiro de obras sem clientes
  for (const g of Object.values(gates)) { if (g.hold > 0) g.hold -= dt; g.open += ((g.hold > 0 ? 1 : 0) - g.open) * Math.min(1, dt * 8); }
  // entry queue: positions, waiting and giving up
  inQ.forEach((id, i) => {
    const c = pcars.find(k => k.id === id); if (!c) return;
    const t = qPos(i);
    if (i === 0 && Math.abs(c.x - PK.EX) > .5 && c.y > y.gateStop) moveTo(c, PK.EX, c.y, 45, dt), steer(c, PK.EX, c.y, dt);
    else if (moveTo(c, t.x, t.y, 45, dt)) { if (i === 0) steer(c, PK.EX, y.gate, dt); }
    else steer(c, t.x, t.y, dt);
    if (gates.in.car !== c.id) c.wait += dt;
  });
  for (let i = inQ.length - 1; i >= 0; i--) {
    const c = pcars.find(k => k.id === inQ[i]);
    if (!c) { inQ.splice(i, 1); continue; }
    if (c.wait > PK.carWait && !c.stall && gates.in.car !== c.id) {
      inQ.splice(i, 1);
      if (i === 0 && c.y < y.laneIn - 2) { c.state = "pass"; c.path = [{ x: PK.EX, y: y.laneIn }, { x: WORLD.x1 + 60, y: y.laneIn }]; S.today.park.lostFull++; changeRep(-0.02, "estacionamento"); avisoDesistiu(c); }
      else passBy(c, "full");
    }
  }
  // head of the queue at the gate: reserve a stall, then the gate serves it
  const head = inQ.length && pcars.find(k => k.id === inQ[0]);
  if (head && Math.abs(head.x - PK.EX) < .6 && Math.abs(head.y - y.gateStop) < .6) {
    if (!head.stall) { const s = STALLS.find(s => !s.car && !s.res); if (s) { s.res = head.id; head.stall = s.key; } }
    if (head.stall && gates.in.car == null) { gates.in.car = head.id; gates.in.t = gates.in.total = gateTime("in"); }
  }
  if (gates.in.car != null) {
    const c = pcars.find(k => k.id === gates.in.car);
    gates.in.t -= dt;
    if (!c) gates.in.car = null;
    else if (gates.in.t <= 0) {
      const s = stallByKey(c.stall);
      gates.in.car = null; gates.in.hold = 1.1; inQ.shift();
      c.state = "entering"; c.path = [{ x: PK.EX, y: y.aisle }, { x: s.x, y: y.aisle }, { x: s.x, y: y.stall }];
    }
  }
  // exit gate
  if (gates.out.car != null) {
    const c = pcars.find(k => k.id === gates.out.car);
    gates.out.t -= dt;
    if (!c) gates.out.car = null;
    else if (gates.out.t <= 0) {
      if (!c.paid) {                                    // the one and only charge for this visit
        c.paid = true; S.park.served++; S.today.park.cars++;
        if (c.fee > 0) { S.money += c.fee; S.today.park.fees += c.fee; float(c.x + 22, c.y - 6, `+M ${fmt(c.fee)}`, "#2e7a57"); coinBurst(c.x, c.y, 2); }
      }
      gates.out.car = null; gates.out.hold = 1.1;
      c.state = "away"; c.path = [{ x: c.gx, y: y.laneIn }, { x: WORLD.x1 + 60, y: y.laneIn }];
    }
  }
  // every car
  for (let i = pcars.length - 1; i >= 0; i--) {
    const c = pcars[i];
    if (c.state === "approach") {
      if (drive(c, dt, 70)) {
        if (parkPrice() > c.wtp + 1e-9) passBy(c, "price");
        else if (inQ.length >= PK.maxQueue) passBy(c, "full");
        else { c.fee = parkPrice(); c.state = "queue"; c.wait = 0; inQ.push(c.id); }   // price accepted now is kept for this car
      }
    } else if (c.state === "entering") {
      if (drive(c, dt, 52)) {
        const s = stallByKey(c.stall);
        if (s) { s.car = c.id; s.res = null; }
        c.state = "parked"; c.pax = Math.random() < 0.35 ? 2 : 1; c.back = 0;
        for (let k = 0; k < c.pax; k++) spawnCustomer(c, k);
      }
    } else if (c.state === "parked") {
      if (c.back >= c.pax) {
        const s = stallByKey(c.stall);
        const busy = pcars.some(o => o !== c && o.state !== "parked" && o.state !== "queue" && Math.abs(o.y - y.aisle) < 12 && o.x > s.x - 46 && o.x < s.x + 16);
        if (!busy) { c.state = "toExit"; c.gx = ex; c.path = [{ x: s.x, y: y.aisle }, { x: ex, y: y.aisle }, { x: ex, y: y.gateStop }]; }
      }
    } else if (c.state === "toExit") {
      const before = c.path.length;
      if (drive(c, dt, 50)) { c.state = "exitGate"; }
      if (before === 3 && c.path.length === 2) { const s = stallByKey(c.stall); if (s && s.car === c.id) s.car = null; c.stall = null; }   // stall is free once the car is in the aisle
    } else if (c.state === "exitGate") {
      steer(c, c.x, c.y + 10, dt);
      if (gates.out.car == null) { gates.out.car = c.id; gates.out.t = gates.out.total = gateTime("out"); }
    } else if (c.state === "away" || c.state === "pass") {
      if (drive(c, dt, 72)) pcars.splice(i, 1);
    }
  }
}
// tier change moves the parking down: shift everything that is outside the store
function shiftOutside(oldH, dH) {
  const mv = p => { if (p.y >= oldH - 1) p.y += dH; };
  pcars.forEach(c => { mv(c); c.path.forEach(mv); });
  customers.forEach(c => { if (c.state === "outside" || c.y >= oldH - 1) { mv(c); c.path.forEach(mv); } });
}
// customers who came by car walk back to it; others go back to the street
function goOutside(c) {
  const y = pkY(), fromEntrance = c.y < H - 2, E = entDe(c);
  const car = c.car && pcars.find(k => k.id === c.car), s = car && stallByKey(car.stall);
  if (c.ent && ENT2 && fromEntrance && !s) { c.state = "outside"; c.path = [{ x: E.fora, y: c.y }, { x: E.fora, y: 44 }]; return; }   // volta para a avenida
  const p = fromEntrance ? [{ x: E.fora, y: c.y }, { x: E.fora, y: y.walk }] : [];
  if (s) p.push({ x: s.x + (c.side || 0), y: y.walk }, { x: s.x + (c.side || 0), y: y.door });
  else { if (!fromEntrance) p.push({ x: E.fora, y: y.walk }); p.push({ x: E.fora, y: y.gate + 4 }); }
  c.state = "outside"; c.path = p;
}
function setParkPrice(v) {
  S.park.price = Math.max(0, Math.min(PK.priceMax, Math.round(v / PK.priceStep) * PK.priceStep));
  save(); lastSig = ""; renderSheet();
}
