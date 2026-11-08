"use strict";
// =====================================================================
// HUD
// =====================================================================
function fmt(v) {
  v = Math.max(0, v);
  if (v < 1000) { const r = Math.round(v * 100) / 100; return (Number.isInteger(r) ? String(r) : r.toFixed(2)).replace(".", ","); }
  const u = ["", "mil", "mi", "bi", "tri", "quatri"]; let i = 0;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return v.toFixed(v < 10 ? 2 : 1).replace(".", ",") + " " + u[i];
}
let shownMoney = null;
function tickMoney(dt) {
  if (shownMoney === null || Math.abs(S.money - shownMoney) > Math.max(1e4, Math.abs(S.money) * 2)) shownMoney = S.money;
  shownMoney += (S.money - shownMoney) * Math.min(1, dt * 8);
  if (Math.abs(S.money - shownMoney) < 0.01) shownMoney = S.money;
  $("money").textContent = `${shownMoney < 0 ? "-" : ""}${fmt(Math.abs(Math.round(shownMoney * 100) / 100))}`;
}
function pulseMoney() { const m = $("money"); m.classList.remove("pulse"); void m.offsetWidth; m.classList.add("pulse"); }
let toastT; const toasted = {};
function toast(msg) { if (!msg) return; const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
function toastOnce(key, msg) { if (toasted[key] === S.day) return; toasted[key] = S.day; toast(msg); }
let freeTop = 120;
function measureHudBox() { measureHud(); freeTop = $("hud").getBoundingClientRect().bottom; }
function hud() {
  const { h, m } = clockTime(), b = bills(), nx = TIERS[S.tier + 1], acts = actions();
  $("money").classList.toggle("neg", S.money < 0);
  $("lvlNum").textContent = `Nv ${S.tier + 1}`;
  $("repNum").textContent = S.rep.toFixed(1).replace(".", ",");
  if (NA_CARREIRA) {
    const reqs = faseReqs(), ok = reqs.filter(r => r.have >= r.need - 1e-9).length, p = faseProgresso();
    $("tierName").textContent = `${CFG.titulo} · ${CFG.lugar}`;
    $("pNext").textContent = `Capítulo ${CFG.capitulo}`;
    $("pFill").style.width = `${(S.fase.concluida ? 1 : p) * 100}%`;
    $("pTxt").textContent = S.fase.concluida ? "Fase concluída!" : `${ok} de ${reqs.length} requisitos`;
  } else {
  $("tierName").textContent = tierNow().name + (S.branches ? ` · ${S.branches + 1} lojas` : "");
  $("pNext").textContent = nx ? `→ ${nx.name}` : "Filiais";
  const p = tierProgress(), ready = acts.some(a => (a.kind === "tier" || a.kind === "branch") && a.ok);
  $("pFill").style.width = `${p * 100}%`;
  $("pTxt").textContent = ready ? "Pronto para expandir!" : nx ? `${Math.floor(p * 100)}% das metas` : `${Math.floor(p * 100)}% da próxima filial`;
  }
  $("dayline").innerHTML = `${GANCHOS.rotuloDia ? GANCHOS.rotuloDia() : `Dia ${S.day}`} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${isRush() ? '<span class="rush">PICO</span>' : ""}`;
  const bp = $("billsPill");
  if (S.money < 0) { bp.className = "pill warn"; bp.textContent = "No vermelho · juros de 5% ao dia"; }
  else if (S.money >= b) { bp.className = "pill ok"; bp.textContent = `Contas do dia garantidas (M ${fmt(b)})`; }
  else { bp.className = "pill"; bp.textContent = `Contas no fim do dia: M ${fmt(b)}`; }
  const c = claimCounts(), n = c.tasks + c.ach + c.tier;
  $("rewardBadge").textContent = n; $("rewardBadge").hidden = !n;
  $("badgeTasks").textContent = c.tasks; $("badgeTasks").hidden = !c.tasks;
  $("badgeAch").textContent = c.ach; $("badgeAch").hidden = !c.ach;
  $("dotUpgrade").hidden = !acts.some(a => a.ok && (UPGRADE_KINDS.has(a.kind) || a.kind === "open"));
  renderMission(); renderSheet();
}
window.addEventListener("resize", () => requestAnimationFrame(measureHudBox));

// =====================================================================
// Loop and start
// =====================================================================
function restart() {
  if (NA_CARREIRA) {                                   // apaga só a carreira e volta ao capítulo 1
    paused = true; try { localStorage.removeItem(CHAVE_CARREIRA); } catch (e) {}
    CARREIRA = null; location.reload(); return;
  }
  S = freshState(); S.seenIntro = true;
  customers.length = 0; floats.length = 0; workers.length = 0; SECTORS.forEach(d => pending[d.id] = 0);
  relayout(); resetGear(); ensureTasks();
  Object.assign(truck, { x: TRUCK_FORA, state: "away", timer: 2 }); lanes.forEach(l => l.servingId = null);
  for (const k in building) delete building[k]; buildStalls(); resetParking(); floorCache = null;
  hideModal(); paused = false; syncWorkers(); save(); closeSheet(); lastSig = ""; bannerQ = []; recenter(); hud();
}
let last = performance.now(), hudT = 0, saveT = 0, dayCheckT = 0;
function frame(nowMs) {
  const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
  update(dt); updateFx(dt); updateCars(dt); updateCidade(dt); stepCam(dt); draw(); drawBanner(dt); tickMoney(dt);
  hudT += dt; saveT += dt; dayCheckT += dt;
  if (hudT > 0.25) { hudT = 0; hud(); }
  if (saveT > 5) { saveT = 0; save(); }
  if (dayCheckT > 30) { dayCheckT = 0; const before = S.tasks && S.tasks.date; ensureTasks(); if (S.tasks.date !== before) { lastSig = ""; toast("Novas tarefas do dia chegaram!"); } }
  requestAnimationFrame(frame);
}
function welcomeBack(o) {
  const hrs = Math.floor(o.away / 3600), mins = Math.floor((o.away % 3600) / 60);
  const awayTxt = hrs ? `${hrs}h${String(mins).padStart(2, "0")}` : `${mins} min`;
  showModal(`<h2>Bem-vindo de volta!</h2><p>Você ficou fora <b>${awayTxt}</b>. ${NA_CARREIRA ? `O ${CFG.titulo}` : "A loja"} continuou funcionando: passaram <b>${o.days} dias</b> no jogo.</p>
    <table><tr><td>Lucro enquanto você esteve fora</td><td class="pos">+M ${fmt(o.gain)}</td></tr>
    ${o.pedidos && o.pedidos.length ? `<tr><td>Pedidos que chegaram</td><td>${o.pedidos.map(p => `${p.qtd} cx de ${SECTORS.find(d => d.id === p.sec).name}`).join(", ")}</td></tr>` : ""}
    ${(o.linhas || []).map(l => `<tr><td>${l[0]}</td><td>${l[1]}</td></tr>`).join("")}
    <tr><td>Rendimento do gerente</td><td>${Math.round(mgrEff(S.mgrLvl) * 100)}% por até ${mgrHours(S.mgrLvl)}h</td></tr></table>
    ${o.away > o.counted ? `<div class="warn">Depois de ${mgrHours(S.mgrLvl)}h a loja parou de render. Melhore o gerente na fachada da loja para render por mais tempo.</div>` : ""}
    <p>Confira as <b>tarefas de hoje</b> em Tarefas.</p><button class="btn" id="ok">Abrir a loja</button>`);
  document.getElementById("ok").onclick = () => { hideModal(); if (o.gain > 0 && LANES[0]) coinBurst(LANES[0].serve.x, LANES[0].serve.y, 10); };
}
function showIntro(first) {
  showModal(`<h2>${first ? "Seu mercadinho abriu!" : "Como jogar"}</h2>
    <p>A moeda é a <b>Mumbuca (M)</b>. Seu sonho: transformar este <b>mercadinho de bairro</b> em uma <b>rede de supermercados</b>.</p>
    <p><b>Arraste</b> o cenário para explorar e use <b>pinça</b> ou a <b>roda do mouse</b> para zoom. <b>Toque</b> em prateleiras, caixas, depósito, cestas e fachada para ver detalhes e melhorar.</p>
    <p>Mantenha as prateleiras cheias. No fim de cada dia você paga aluguel e salários. Volte todo dia: há <b>tarefas diárias</b> e a loja continua rendendo enquanto você está fora.</p>
    <button class="btn" id="go">${first ? "Abrir as portas" : "Entendi"}</button>`);
  document.getElementById("go").onclick = () => { hideModal(); save(); };
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
  else { last = performance.now(); const o = offlineProgress(); if (o && o.days > 0) welcomeBack(o); save(); }
});
iniciarCarreira();
relayout(); fitCanvas(); measureHudBox(); syncWorkers(); resetGear(); ensureTasks(); hud();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureHudBox(); });
if (MODO === "menu") { paused = true; mostrarMenu(); }
else {
  const away = S.seenIntro && !introFasePendente && !lojaReaberta ? offlineProgress() : null;
  const troca = NA_CARREIRA ? lerTroca() : null;
  // convite pendente (ex.: partida que concluiu o capítulo antes desta versão): mostrado ao abrir, uma vez
  const conv = NA_CARREIRA ? proximaDisponivel() : null, convNovo = conv && !CARREIRA.convites[conv];
  if (introFasePendente) mostrarIntroFase();
  else if (lojaReaberta) mostrarLojaReaberta();
  else if (!S.seenIntro) { S.seenIntro = true; showIntro(true); }
  else if (troca) resumoOperacao(troca, away && away.days > 0 ? away : null);
  else if (away && away.days > 0) welcomeBack(away);
  if (NA_CARREIRA && S.avisoForn16) {          // 1.6: fornecedores chegaram aos capítulos 4 e 5 (partida em andamento)
    delete S.avisoForn16;
    const avisar = () => { showModal(`<h2>🚚 Novidade: fornecedores</h2><p>A Distribuidora Ligeira e o Atacado Serra, que você conheceu no Ipê, agora também atendem o ${CFG.titulo}.</p>
      <p>O caminhão automático continua igual, pelo preço normal. Se quiser economizar, peça à Serra (25% mais barato, chega em 2 dias); a Ligeira traz um lote extra no mesmo dia.</p>
      <p class="note">Fica no depósito e na aba Carreira, em "Negociar com fornecedores". Nada mudou nas metas do capítulo.</p>
      <button class="btn" id="ok">Entendi</button>`); document.getElementById("ok").onclick = hideModal; };
    if (document.getElementById("modal").hidden) avisar(); else filaModal.push(avisar);
  }
  if (NA_CARREIRA && S.avisoPal16) {           // 1.6: segunda distribuidora de paletes no atacarejo (partida em andamento)
    delete S.avisoPal16;
    const avisar = () => { showModal(`<h2>🚛 Novidade: duas distribuidoras</h2><p>Os paletes agora podem vir de duas distribuidoras. A <b>Distribuidora Ligeira</b> é a de sempre: 1 palete, preço cheio, chega em 14 s.</p>
      <p>O <b>Atacado Serra</b> vende lote de 3 paletes do mesmo setor 15% mais barato, mas a carreta demora 60 s e o lote ocupa o porta-paletes desde o pedido.</p>
      <p class="note">Escolha no painel do atacado, em "Comprar paletes". A compra automática continua na Ligeira até você trocar.</p>
      <button class="btn" id="ok">Entendi</button>`); document.getElementById("ok").onclick = hideModal; };
    if (document.getElementById("modal").hidden) avisar(); else filaModal.push(avisar);
  }
  if (convNovo) { if (document.getElementById("modal").hidden) abrirMapa(conv); else filaModal.push(() => abrirMapa(conv)); }
  save();
}
if (NA_CARREIRA) { const b = document.querySelector('[data-tab="expand"]'); if (b && b.lastChild) b.lastChild.textContent = "Carreira"; }
requestAnimationFrame(frame);
window.__boot.ok = true; try { sessionStorage.removeItem("mercadinho-recarga"); } catch (e) {}
// Hooks for automated balance and interface tests
window.__game = { get S() { return S; }, update, customers, workers, pending, station, piles, actions, doAction, restart, bills, tierReqs, ensureTasks, offlineProgress,
  get paused() { return paused; }, cam, ui, select, openSheet, closeSheet, toWorld, toScreen, bRect, recenter, camLimits, get SHELVES() { return SHELVES; }, get LANES() { return LANES; },
  pcars, inQ, gates, LOTS, building, get STALLS() { return STALLS; }, setParkPrice, gateTime, parkWages, carRate, exitX, pkY, acceptShare, migrate, endDay, flyTo, camLimits,
  get MODO() { return MODO; }, filaOrdenada: l => laneQueue(l), verificarCirculacao, escolherCaixa, get FASES() { return FASES; }, proximaDisponivel, trocarLoja, abrirMapa, fazerPedido, cancelarPedido, repassar, oferta, motivoRecusa, reservado, livreDeposito, fornEstado, tAbs, registroLoja, alternarAuto, acess: () => acess(), PERFIS, caixaPrio: () => caixaPrio(), collectors, lanes, posFila, PREFS, get FASE() { return FASE; }, get CARREIRA() { return CARREIRA; }, faseReqs, faseCompleta, assumirProxima, iniciarPromo, promoAtiva, get SCENE() { return SCENE; }, get W() { return W; }, P, STATION_: () => STATION, corredorPara, routeTo, voltarAoMenu, entrarModo };
