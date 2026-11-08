"use strict";
// =====================================================================
// Simulation step
// =====================================================================
function update(dt) {
  if (paused) return;
  S.dayT += dt;
  if (S.dayT >= DAY_LEN) endDay();
  if (isRush() && !rushAnnounced) { rushAnnounced = true; banner("HORÁRIO DE PICO!", "#c9513a"); }
  if (GANCHOS.simulacao) {            // capítulos 7 e 8: shopping (outra escala de gestão; ver 06h e 06i)
    updateParking(dt); GANCHOS.simulacao(dt);
    for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > 1.4) floats.splice(i, 1); }
    faseTick(dt); return;
  }
  syncWorkers(); syncCollectors();

  // Supplier truck
  if (truck.state === "away") {
    truck.timer -= dt;
    if (truck.timer <= 0) {
      if (planOrder().total > 0) truck.state = "arriving";
      else { truck.timer = 2; if (whUsed() === 0 && S.money < 1) toastOnce("nocash", "Sem dinheiro para pagar o fornecedor!"); }
    }
  } else if (truck.state === "arriving") {
    if (moveTo(truck, P.truckStop.x, P.truckStop.y, 150, dt)) { truck.state = "unloading"; truck.timer = 0.7; }
  } else if (truck.state === "unloading") {
    truck.timer -= dt;
    if (truck.timer <= 0) {
      const order = planOrder(); let paid = 0, n = 0;
      const fa = fornAtivo(), fat = fa ? fatorCaminhao() : 1;   // capítulo 3: reposição de emergência, mais cara; com fornecedores, custo médio por setor
      SECTORS.forEach(d => { const k = order[d.id] || 0; if (k) { if (fa) entrouEstoque(d, k, boxCost(d, S.sec[d.id].priceLvl) * fat); S.sec[d.id].wh += k; paid += fa ? k * boxCost(d, S.sec[d.id].priceLvl) * fat : k * boxCost(d, S.sec[d.id].priceLvl); n += k; } });
      if (n) { S.money -= paid; S.today.goods += paid; float(P.truckStop.x, 52, `+${n} caixas  -M ${fmt(paid)}`, "#6b4f2f"); }
      truck.state = "leaving";
    }
  } else if (truck.state === "leaving") {
    if (moveTo(truck, TRUCK_FORA, P.truckStop.y, 170, dt)) { truck.state = "away"; truck.timer = truckEvery(); }
  }

  updateParking(dt);

  // Restockers
  workers.forEach((w, wi) => {
    if (w.state === "idle" && w.tsec != null) w.tsec = null;
    if (w.state === "idle" && GANCHOS.ajudaRepositor) { const o = S.sec[SECTORS[w.sec].id]; if (!(shelfCap(o.shelfLvl) - o.shelf - pending[SECTORS[w.sec].id] > 0 && o.wh > 0)) { const t = GANCHOS.ajudaRepositor(w); if (t != null) w.tsec = t; } }
    const ws = w.tsec != null ? w.tsec : w.sec;          // capítulo 4: com encarregado de reposição, quem está sem serviço ajuda outro setor
    const d = SECTORS[ws], st = S.sec[d.id], sh = SHELVES[ws], sp = staffSpd(nvRep(w.sec, w.k || 0));
    if (w.state === "idle") {
      const space = shelfCap(st.shelfLvl) - st.shelf - pending[d.id];
      if (space > 0 && st.wh > 0) {
        const n = Math.min(staffCarry(nvRep(w.sec, w.k || 0)), st.wh, space);
        st.wh -= n; w.carry = n; pending[d.id] += n; w.state = "go";
        const a = corredorPara(P.whDoor.x, sh.cx); w.aisle = a;
        w.path = [{ x: a, y: P.whDoor.y }, { x: a, y: sh.top }, { x: sh.cx + (wi % 3 - 1) * 18, y: sh.top }];
      }
    } else if (w.state === "go") {
      if (follow(w, sp, dt)) {
        const put = Math.min(w.carry, shelfCap(st.shelfLvl) - st.shelf);
        if (put) markPop(ws, st.shelf, st.shelf + put);
        st.shelf += put; pending[d.id] -= w.carry; w.carry -= put; w.state = "back";
        const a = w.aisle != null ? w.aisle : AISLE_X;
        w.path = [{ x: a, y: sh.top }, { x: a, y: P.whDoor.y }, { x: P.whDoor.x, y: P.whDoor.y }];
      }
    } else if (w.state === "back") {
      if (follow(w, sp, dt)) { st.wh += w.carry; w.carry = 0; w.state = "idle"; }
    }
  });

  // Customers arrive
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const rate = (0.5 + S.rep * 0.2) * demand() * (isRush() ? RUSH_MULT : 1) * (1 + 0.15 * (openSectors().length - 1)) * promoFluxo() * (GANCHOS.fluxo ? GANCHOS.fluxo() : 1);
    spawnTimer = spawnGap(S.adsLvl) / rate * (0.7 + Math.random() * 0.6);
    spawnCustomer();
  }

  const queues = LANES.map((_, l) => laneQueue(l));
  for (const c of customers) {
    const v = c.vel || 1;                       // ritmo do perfil (bengala e andador andam mais devagar); 1 no padrão
    if (c.ajuda) tickAjudaCliente(c, dt);
    if (c.state === "toStation") {
      if (follow(c, 84 * v, dt)) { c.state = "atStation"; c.wait = 0; }
    } else if (c.state === "atStation") {
      if (!takeGear(c)) {
        c.wait += dt;
        if (c.wait > GEAR_PATIENCE) { leaveAngry(c, "😠 sem cesta"); toastOnce("nogear", "Faltam cestas! Toque nas cestas do caixa, compre mais ou contrate carrinheiros."); }
      }
    } else if (c.state === "walk") {
      if (follow(c, 72 * v, dt)) c.state = "shop";
    } else if (c.state === "shop") {
      const it = c.plan[c.step], st = S.sec[SECTORS[it.sec].id];
      c.grab -= dt;
      if (st.shelf > 0 && it.got < it.want) {
        if (c.grab <= 0) { st.shelf--; it.got++; c.grab = c.ajuda && c.ajuda.estado === "acompanhado" ? 0.25 : 0.35; c.wait = Math.max(0, c.wait - 1); }
      } else if (it.got < it.want) c.wait += dt;
      if (it.got >= it.want) nextStep(c);
      else if (c.wait > SHELF_PATIENCE + (GANCHOS.paciencia ? GANCHOS.paciencia(it.sec) : 0)) { if (it.got === 0) { changeRep(-0.04, "gondola"); float(c.x, c.y - 18, "😕", "#c9513a"); } nextStep(c); }
    } else if (c.state === "toLane" || c.state === "queue") {
      if (c.lane >= LANES.length) c.lane = DIV ? escolherCaixa(c) : pickLane();
      if (lanes[c.lane].servingId !== c.id) c.qWait += dt;
      if (c.qWait > QUEUE_PATIENCE + (GANCHOS.pacienciaFila ? GANCHOS.pacienciaFila(c) : 0)) {
        c.plan.forEach(p => { S.sec[SECTORS[p.sec].id].wh += p.got; p.got = 0; });
        leaveAngry(c, "😤 fila enorme"); continue;
      }
      if (c.state === "toLane") { if (follow(c, 80 * v, dt)) { c.state = "queue"; if (DIV) c.qChegou = ++qChegSeq; } }
      else { const q = queues[c.lane] || [], i = q.indexOf(c), t = i <= 0 ? LANES[c.lane].serve : posFila(c.lane, i, q); moveTo(c, t.x, t.y, 80 * v, dt); }
    } else if (c.state === "exit" || c.state === "angry") {
      if (follow(c, (c.state === "angry" ? 100 : 78) * v, dt)) { returnGear(c); goOutside(c); }
    } else if (c.state === "outside") {
      if (follow(c, 84 * v, dt)) { c.state = "gone"; if (c.car) { const car = pcars.find(k => k.id === c.car); if (car) car.back++; } }
    }
  }

  // Cashiers
  const nCx = nCaixas();
  for (let l = 0; l < LANES.length; l++) {
    // caixa que um volante deixou (capítulo 4): termina a fila que já estava nele, sem receber gente nova
    if (l >= nCx && !(GANCHOS.caixasExtra && laneQueue(l).length)) continue;
    const head = laneQueue(l)[0], ln = lanes[l];
    if (head && head.state === "queue" && head.x === LANES[l].serve.x && head.y === LANES[l].serve.y) {
      const items = head.plan.reduce((a, p) => a + p.got, 0);
      if (ln.servingId !== head.id) { if (DIV) inicioAtendimento(l, head); ln.servingId = head.id; ln.total = ln.timer = cashTime(nvCaixa(l)) * items + 0.25; }
      ln.timer -= dt;
      if (ln.timer <= 0) {
        const mult = branchMult() * streakMult();
        const v = head.plan.reduce((a, p) => a + p.got * secPrice(SECTORS[p.sec], S.sec[SECTORS[p.sec].id].priceLvl) * promoFator(p.sec), 0) * mult;
        S.money += v; S.today.sales += v; S.today.served++; S.earned += v; S.served++;
        taskProgress("serve", 1); taskProgress("sales", v);
        head.plan.forEach(p => { if (p.got) { taskProgress("sell", p.got, p.sec); vendaSetor(p.sec, p.got); } });
        changeRep(head.qWait < 5 ? 0.05 : 0.02, head.qWait < 5 ? "rapido" : "atendido"); if (head.qWait < 5) heart(head.x, head.y - 24);
        if (GANCHOS.atendido) GANCHOS.atendido(head, v);
        float(LANES[l].serve.x, LANES[l].serve.y - 22, `+M ${fmt(v)}`, "#2e7a57"); coinBurst(LANES[l].serve.x, LANES[l].serve.y - 10, Math.min(5, 1 + Math.round(Math.log2(1 + v))));
        returnGear(head, piles[l]); if (piles[l].b + piles[l].c >= 3) toastOnce("pile", "Cestas acumulando no caixa! Toque nelas para devolver ou contrate carrinheiros.");
        head.state = "exit"; head.lane = null; ln.servingId = null;
        head.path = caminhoSaida(head);
      }
    } else if (!head) ln.servingId = null;
  }

  // Collectors bring baskets and carts back from the checkouts
  for (const w of collectors) {
    const sp = colSpeed(nvCol(w.k || 0));
    if (DIV && (w.state === "ajuda" || w.state === "acompanha")) { passoAjuda(w, sp, dt); continue; }
    if (DIV && w.state === "idle") { const c = clientePedindo(w); if (c) { iniciarAjuda(w, c); continue; } }   // atender quem pediu ajuda vem antes das cestas
    if (w.state === "idle") {
      let best = -1, n = 0;
      piles.forEach((p, l) => { if (l >= LANES.length) return; const k = p.b + p.c - collectors.filter(o => o !== w && o.target === l).reduce((x, o) => x + colCarry(nvCol(o.k || 0)), 0); if (k > n) { n = k; best = l; } });
      if (best >= 0) { w.target = best; w.state = "go"; w.path = [{ x: w.x, y: FZ + 134 }, { x: pileX(best), y: FZ + 134 }]; }
    } else if (w.state === "go") {
      if (follow(w, sp, dt)) {
        const p = piles[w.target], cap = colCarry(nvCol(w.k || 0));
        w.c = Math.min(p.c, cap); p.c -= w.c; w.b = Math.min(p.b, cap - w.c); p.b -= w.b;
        w.dest = ENT2 && station2.b + station2.c < station.b + station.c ? 1 : 0;   // duas entradas: leva para as cestas mais vazias
        const PS = w.dest ? STATION2 : STATION;
        w.state = "back"; w.target = null; w.path = [{ x: w.x, y: FZ + 134 }, { x: PS.x + 36, y: FZ + 134 }, { x: PS.x + 36, y: FZ + 56 }];
      }
    } else if (w.state === "back") {
      if (follow(w, sp, dt)) { const st2 = w.dest ? station2 : station; st2.b += w.b; st2.c += w.c; w.b = w.c = 0; w.state = "idle"; }
    }
  }
  for (let i = customers.length - 1; i >= 0; i--) if (customers[i].state === "gone") customers.splice(i, 1);
  for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > 1.4) floats.splice(i, 1); }
  if (GANCHOS.tick) GANCHOS.tick(dt);
  faseTick(dt);
}

function planOrder() {
  const open = openSectors(), order = { total: 0 }, fa = fornAtivo();
  if (fa && !fornEstado().auto) return order;           // capítulo 3: reposição automática desligada pelo jogador
  let room = whCap(S.whLvl) - whUsed() - (fa ? reservado() : 0), load = truckLoad(S.whLvl), cash = S.money;
  const fc = fa && fornCompleto(), fat = fc ? FORN_CFG.fatorAuto : 1;
  const target = fc ? FORN_CFG.emergencia : Math.floor(whCap(S.whLvl) / Math.max(1, open.length));
  let progress = true;
  while (load > 0 && room > 0 && progress) {
    progress = false;
    for (const d of open) {
      const st = S.sec[d.id], have = st.wh + (order[d.id] || 0) - (GANCHOS.faltaEstoque ? GANCHOS.faltaEstoque(d.id) : 0), c = boxCost(d, st.priceLvl) * fat;
      if (have < target && load > 0 && room > 0 && cash >= c) { order[d.id] = (order[d.id] || 0) + 1; order.total++; load--; room--; cash -= c; progress = true; }
    }
  }
  return order;
}
