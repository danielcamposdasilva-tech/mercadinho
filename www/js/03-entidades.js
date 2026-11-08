"use strict";
// =====================================================================
// Entities
// =====================================================================
const customers = [], floats = [], workers = [], collectors = [];
const TRUCK_FORA = W + 60;                     // onde o caminhão some, à direita
const truck = { x: TRUCK_FORA, y: P.truckStop.y, state: "away", timer: 2 };
const lanes = [0, 1, 2, 3].map(() => ({ servingId: null, timer: 0, total: 1 }));
const station = { b: 0, c: 0 }, station2 = { b: 0, c: 0 };     // station2: cestas da segunda entrada (capítulo 4)
const estDe = c => c && c.ent && ENT2 ? station2 : station, posEstDe = c => c && c.ent && ENT2 ? STATION2 : STATION;
const piles = [0, 1, 2, 3].map(() => ({ b: 0, c: 0 }));
let spawnTimer = 1, nextId = 1, qSeq = 0, rushAnnounced = false;
const pending = {}; SECTORS.forEach(d => pending[d.id] = 0);
const SHIRTS = ["#c9513a", "#3f74b8", "#8a5cc2", "#d18a2a", "#2f8a7a", "#b5487a", "#5a7d2c", "#4b5563"];
const HAIR = ["#3b2a1a", "#6b4423", "#1f1a17", "#a8712d", "#d9b27a", "#7a3b2a", "#9ca3af"];
const SKIN = ["#f2cfa6", "#e0b088", "#c48a5f", "#9a6643", "#f6dcc0"];
const pick = a => a[(Math.random() * a.length) | 0];
const isRush = () => S.dayT / DAY_LEN >= RUSH[0] && S.dayT / DAY_LEN < RUSH[1];

function resetGear() {
  station.b = S.gear.baskets; station.c = S.gear.carts; piles.forEach(p => { p.b = 0; p.c = 0; }); collectors.length = 0;
  // duas entradas: carrinhos ficam mais do lado do estacionamento, cestas mais do lado da avenida
  if (ENT2) { station2.c = Math.floor(S.gear.carts * 0.25); station2.b = Math.ceil(S.gear.baskets * 0.6); station.c -= station2.c; station.b -= station2.b; }
}
function syncCollectors() { while (collectors.length < S.gear.collectors) collectors.push({ id: 200 + collectors.length, k: collectors.length, x: STATION.x + 36, y: FZ + 56, state: "idle", path: [], b: 0, c: 0, skin: pick(SKIN), hair: pick(HAIR) }); }
function syncWorkers() {
  SECTORS.forEach((d, i) => {
    const st = S.sec[d.id], have = workers.filter(w => w.sec === i).length, want = st.open && i < slots() ? st.staff : 0;
    for (let k = have; k < want; k++)
      workers.push({ id: 100 + workers.length, sec: i, k, x: P.whDoor.x + k * 6, y: P.whDoor.y, state: "idle", carry: 0, path: [], skin: pick(SKIN), hair: pick(HAIR) });
  });
}
function moveTo(e, tx, ty, speed, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (d <= speed * dt) { e.x = tx; e.y = ty; return true; }
  e.x += dx / d * speed * dt; e.y += dy / d * speed * dt; return false;
}
function follow(e, speed, dt) {
  while (e.path.length) { const p = e.path[0]; if (moveTo(e, p.x, p.y, speed, dt)) e.path.shift(); else return false; }
  return true;
}
// rota pelos corredores: usa o corredor vertical que dá o caminho mais curto
const corredorPara = (x0, x1) => LOJA.corredores.reduce((b, a) => Math.abs(x0 - a) + Math.abs(x1 - a) < Math.abs(x0 - b) + Math.abs(x1 - b) ? a : b);
const routeTo = (e, x, y) => { const a = corredorPara(e.x, x); return [{ x: a, y: e.y }, { x: a, y }, { x, y }]; };

function spawnCustomer(car, idx) {
  if (GANCHOS.chegada) return GANCHOS.chegada(car, idx);              // shopping: visitante em vez de cliente de mercado
  const open = openSectors();
  if (!car && customers.filter(o => o.state !== "outside").length >= 8 + 2 * open.length) return;
  // duas entradas: quem vem de carro entra pelo estacionamento; a pé, a maioria vem da avenida (compra rápida)
  const ent = ENT2 ? (car ? 0 : (Math.random() < 0.8 ? 1 : 0)) : 0;
  let n = Math.min(open.length, 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0));
  if (ent === 1) n = Math.min(n, 2);
  const pool = open.slice().sort(() => Math.random() - 0.5).slice(0, n).sort((a, b) => SECTORS.indexOf(a) - SECTORS.indexOf(b));
  const plan = pool.map(d => ({ sec: SECTORS.indexOf(d), want: 1 + (Math.random() < 0.35 ? 1 : 0), got: 0 }));
  const c = { id: nextId++, x: P.entrance.x, y: P.entrance.y, path: [], plan, step: 0, wait: 0, grab: 0, qWait: 0, gear: null,
    state: "toStation", lane: null, shirt: pick(SHIRTS), hair: pick(HAIR), skin: pick(SKIN), long: Math.random() < .4, slot: 0 };
  if (ent) c.ent = ent;
  const k = customers.filter(o => (o.state === "toStation" || o.state === "atStation") && (o.ent || 0) === ent).length;
  if (car) { const s = stallByKey(car.stall); c.car = car.id; c.side = idx ? 5 : -4; Object.assign(c, caminhoChegada({ x: s ? s.x : 60, side: c.side }, k, ent)); }
  else Object.assign(c, caminhoChegada(null, k, ent));
  perfilar(c);                 // perfil, prioridade e pedido de ajuda (03b); no modo de teste sem diversidade, não sorteia nada
  promoPlano(c.plan);
  if (GANCHOS.novoCliente) GANCHOS.novoCliente(c, car);
  customers.push(c);
}
// Caminho de chegada: da vaga (carro) ou da calçada (a pé) até a fila das cestas. É a mesma rota que
// a verificação de circulação percorre (03b), com o espaço de cada perfil.
function caminhoChegada(vaga, k, ent) {
  const E = ent && ENT2 ? ENT2 : ENT, ST = ent && ENT2 ? STATION2 : STATION;
  const wx = ST.x - 14 + (k % 4) * 13, wy = FZ + 58 + Math.floor(k / 4) * 5;
  const tail = [{ x: E.porta, y: P.entrance.y }, { x: E.dentro, y: P.entrance.y }, { x: E.dentro, y: wy }, { x: wx, y: wy }], y = pkY();
  if (vaga) {       // came by car: from the stall along the walkway to the entrance
    const x = vaga.x + vaga.side;
    return { x, y: y.door, path: [{ x, y: y.walk }, { x: E.fora, y: y.walk }, { x: E.fora, y: P.entrance.y }, ...tail] };
  }
  // on foot: from the sidewalk above or below (pela avenida, sempre de cima)
  return { x: E.fora, y: ent || Math.random() < .5 ? 44 : y.gate + 4, path: [{ x: E.fora, y: P.entrance.y }, ...tail] };
}
function caminhoCaixa(c, l) { const a = corredorPara(c.x, LANES[l].serve.x); return [{ x: a, y: c.y }, { x: a, y: FZ + 10 }, { x: LANES[l].serve.x, y: FZ + 10 }]; }
function caminhoIrritado(c) {
  const E = entDe(c), a = corredorPara(c.x, E.dentro);
  if (!DIV) return [{ x: a, y: c.y }, { x: a, y: P.entrance.y }, { x: E.porta, y: P.entrance.y }];
  // sai pela faixa livre entre a última fileira de gôndolas e as cestas (não atravessa o balcão das cestas)
  if (c.state === "atStation") return [{ x: E.dentro, y: c.y }, { x: E.dentro, y: P.entrance.y }, { x: E.porta, y: P.entrance.y }];   // volta por onde entrou
  const yb = FZ - 7, saindoDoCaixa = c.y > FZ + 20;
  return saindoDoCaixa ? [{ x: c.x, y: FZ + 10 }, { x: a, y: FZ + 10 }, { x: a, y: yb }, { x: E.dentro, y: yb }, { x: E.dentro, y: P.entrance.y }, { x: E.porta, y: P.entrance.y }]
    : [{ x: a, y: c.y }, { x: a, y: yb }, { x: E.dentro, y: yb }, { x: E.dentro, y: P.entrance.y }, { x: E.porta, y: P.entrance.y }];
}
const caminhoSaida = c => [{ x: c.x, y: pkY().walk }];      // do caixa, pelo corredor do caixa e pela porta de saída
function takeGear(c) {
  const total = c.plan.reduce((a, p) => a + p.want, 0);
  const station = estDe(c);
  if (station.c > 0 && (total >= BASKET_CAP || station.b === 0)) { station.c--; c.gear = "c"; c.plan.forEach(p => p.want++); }
  else if (station.b > 0) {
    station.b--; c.gear = "b";
    let t = total; for (let i = c.plan.length - 1; i >= 0 && t > BASKET_CAP; i--) while (c.plan[i].want > 1 && t > BASKET_CAP) { c.plan[i].want--; t--; }
    while (c.plan.length > BASKET_CAP) c.plan.pop();
  } else return false;
  if (DIV) pedirAjuda(c);
  c.step = 0; goToShelf(c); return true;
}
function returnGear(c, where) { if (!c.gear) return; (where || estDe(c))[c.gear]++; c.gear = null; }
function goToShelf(c) {
  const sec = c.plan[c.step].sec, sh = SHELVES[sec];
  const used = new Set(customers.filter(o => o !== c && (o.state === "walk" || o.state === "shop") && o.plan[o.step] && o.plan[o.step].sec === sec).map(o => o.slot));
  let k = 0; while (used.has(k) && k < 4) k++;
  c.slot = k; c.wait = 0; c.state = "walk";
  c.path = routeTo(c, sh.x + 16 + k * 27, sh.stand);
}
function laneQueue(l) { if (DIV) return filaOrdenada(l); return customers.filter(c => c.lane === l && (c.state === "toLane" || c.state === "queue")).sort((a, b) => a.qAt - b.qAt); }
function pickLane() { let best = 0, n = Infinity; for (let l = 0; l < nCaixas(); l++) { const k = laneQueue(l).length; if (k < n) { n = k; best = l; } } return best; }
function float(x, y, text, color) { floats.push({ x, y, text, t: 0, color }); }
// causa (1.6): soma por motivo, no dia, para explicar a reputação ao tocar nas estrelas (12i-reputacao)
function changeRep(d, causa) { S.rep = Math.max(0, Math.min(5, S.rep + d)); if (causa && S.today) { const r = S.today.repCausas || (S.today.repCausas = {}), q = r[causa] || (r[causa] = { v: 0, n: 0 }); q.v += d; q.n++; } }
const causaIrritado = why => /cesta/.test(why) ? "cesta" : /fila/.test(why) ? "fila" : /achei/.test(why) ? "nada" : "irritado";
function leaveAngry(c, why) {
  S.today.lost++; changeRep(-0.12, causaIrritado(why)); float(c.x, c.y - 18, why, "#c9513a");
  const pm = window.__perdas || (window.__perdas = {}), k = why + (c.perfil && c.perfil !== "padrao" ? " [" + c.perfil + "]" : "") + (DIV && usaPrio(c) ? " prio" : ""); pm[k] = (pm[k] || 0) + 1;   // diagnóstico (não é salvo)
  c.path = caminhoIrritado(c); c.state = "angry"; c.wasAngry = true; c.lane = null;
}
function nextStep(c) {
  c.step++;
  if (c.step < c.plan.length) { goToShelf(c); return; }
  if (c.plan.some(p => p.got > 0)) {
    c.lane = DIV ? escolherCaixa(c) : pickLane(); c.qAt = qSeq++; c.state = "toLane";
    c.path = caminhoCaixa(c, c.lane);
  } else { changeRep(0.04, "nada"); leaveAngry(c, "😠 não achei nada"); }
}
