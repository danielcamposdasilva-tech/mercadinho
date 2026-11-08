"use strict";
// =====================================================================
// Actions (shared by the panel and by automated balance tests)
// =====================================================================
const UPGRADE_KINDS = new Set(["shelf", "price", "hire", "train", "cashhire", "cashtrain", "storage", "ads", "gear", "mgr", "parkhire", "parktrain", "parksign"]);
function actions() {
  const list = [], gr = S.gear;
  SECTORS.forEach((d, i) => {
    if (i >= slots()) return;
    const st = S.sec[d.id];
    if (!st.open) {
      list.push({ key: `open:${d.id}`, sec: i, kind: "open", title: `Abrir ${d.name}`, info: `Vende M ${fmt(d.price)} por item e atrai mais clientes`, cost: custoAbrir(d),
        run: () => { st.open = true; st.shelf = 2; st.wh = 4; banner(`${d.ic} ${d.name} aberto!`, d.color); confetti(); } });
      return;
    }
    list.push({ key: `shelf:${d.id}`, sec: i, kind: "shelf", title: "Prateleira", info: st.shelfLvl >= MAX_PRATELEIRA ? `${shelfCap(st.shelfLvl)} itens: tamanho máximo da gôndola` : `${shelfCap(st.shelfLvl)} → ${shelfCap(st.shelfLvl + 1)} itens`,
      cost: Math.ceil(d.base * Math.pow(G, st.shelfLvl)), maxed: st.shelfLvl >= MAX_PRATELEIRA, run: () => st.shelfLvl++ });
    list.push({ key: `price:${d.id}`, sec: i, kind: "price", title: "Qualidade", info: `M ${fmt(secPrice(d, st.priceLvl))} → M ${fmt(secPrice(d, st.priceLvl + 1))}`,
      cost: Math.ceil(d.base * 2 * Math.pow(1.45, st.priceLvl)), run: () => st.priceLvl++ });
    list.push({ key: `hire:${d.id}`, sec: i, kind: "hire", title: "Contratar", info: st.staff >= MAX_STAFF ? `Equipe completa (${st.staff})` : `Repositores ${st.staff} → ${st.staff + 1}`,
      cost: Math.ceil(d.base * 5 * Math.pow(2.5, st.staff - 1)), maxed: st.staff >= MAX_STAFF, run: () => st.staff++ });
    list.push({ key: `train:${d.id}`, sec: i, kind: "train", title: `Treinar (nv ${st.staffLvl})`, info: `Mais rápidos, levam ${staffCarry(st.staffLvl + 1)}`,
      cost: Math.ceil(d.base * 1.5 * Math.pow(G, st.staffLvl)), run: () => st.staffLvl++ });
  });
  const maxC = nLanes();
  list.push({ key: "buybasket", kind: "gear", title: `Comprar cestas (${gr.baskets})`, info: `+3 cestas, cada uma leva até ${BASKET_CAP} itens`,
    cost: Math.ceil(12 * Math.pow(1.3, gr.buyB)), run: () => { gr.baskets += 3; gr.buyB++; station.b += 3; } });
  list.push({ key: "buycart", kind: "gear", title: `Comprar carrinhos (${gr.carts})`, info: `+2 carrinhos: o cliente compra mais de cada item`,
    cost: Math.ceil(45 * Math.pow(1.35, gr.buyC)), locked: S.tier < 1 && openSectors().length < 3, lockText: "Abra 3 setores", run: () => { gr.carts += 2; gr.buyC++; station.c += 2; } });
  list.push({ key: "hirecol", kind: "gear", title: "Contratar carrinheiro", info: gr.collectors >= MAX_COLLECTORS ? `Equipe completa (${gr.collectors})` : `Recolhe cestas dos caixas (${gr.collectors} → ${gr.collectors + 1})`,
    cost: Math.ceil(40 * Math.pow(3, gr.collectors - 1)), maxed: gr.collectors >= MAX_COLLECTORS, run: () => { gr.collectors++; } });
  list.push({ key: "traincol", kind: "gear", title: `Treinar carrinheiros (nv ${gr.colLvl})`, info: `Mais rápidos, levam ${colCarry(gr.colLvl + 1)} por vez`,
    cost: Math.ceil(15 * Math.pow(G, gr.colLvl)), run: () => { gr.colLvl++; } });
  list.push({ key: "cashhire", kind: "cashhire", title: "Abrir mais um caixa", info: S.cashiers >= maxC ? (maxC < 4 ? `Loja maior libera mais caixas` : `Todos os caixas abertos`) : `Caixas ${S.cashiers} → ${S.cashiers + 1}`,
    cost: Math.ceil(80 * Math.pow(3, S.cashiers - 1)), maxed: S.cashiers >= maxC, run: () => S.cashiers++ });
  list.push({ key: "cashtrain", kind: "cashtrain", title: `Treinar operadores (nv ${S.cashLvl})`, info: `${cashTime(S.cashLvl).toFixed(2)}s → ${cashTime(S.cashLvl + 1).toFixed(2)}s por item`,
    cost: Math.ceil(10 * Math.pow(G, S.cashLvl)), run: () => S.cashLvl++ });
  list.push({ key: "storage", kind: "storage", title: `Depósito (nv ${S.whLvl})`, info: `Cabe ${whCap(S.whLvl)} → ${whCap(S.whLvl + 1)}, caminhão traz ${truckLoad(S.whLvl)} → ${truckLoad(S.whLvl + 1)}`,
    cost: Math.ceil(15 * Math.pow(G, S.whLvl)), run: () => S.whLvl++ });
  list.push({ key: "ads", kind: "ads", title: `Panfletos (nv ${S.adsLvl})`, info: `Mais gente do bairro vem comprar`,
    cost: Math.ceil(15 * Math.pow(G, S.adsLvl)), run: () => S.adsLvl++ });
  list.push({ key: "mgr", kind: "mgr", title: S.mgrLvl ? `Gerente (nv ${S.mgrLvl})` : "Contratar gerente",
    info: `Fora do jogo: ${Math.round(mgrEff(S.mgrLvl) * 100)}% → ${Math.round(mgrEff(S.mgrLvl + 1) * 100)}% do lucro, até ${mgrHours(S.mgrLvl + 1)}h`,
    cost: Math.ceil(120 * Math.pow(4, S.mgrLvl)), maxed: mgrEff(S.mgrLvl) >= 0.7 && mgrHours(S.mgrLvl) >= 14, run: () => S.mgrLvl++ });
  // goals
  const next = TIERS[S.tier + 1];
  if (MODO === "carreira") { /* na carreira o porte é definido pela fase */ }
  else if (next) list.push({ key: "tier", kind: "tier", title: `Expandir para ${next.name}`, info: `${next.slots} setores, ${next.lanes} caixas, ${Math.round(next.mult * 100)}% de clientes`,
    cost: next.cost, locked: !tierReqOk(), lockText: "Complete as metas", run: () => tierUp() });
  else list.push({ key: "branch", kind: "branch", title: `Abrir filial nº ${S.branches + 1}`, info: `+35% em todas as vendas, contas um pouco maiores`,
    cost: Math.ceil(2e8 * Math.pow(3, S.branches)), run: () => { S.branches++; banner(`🏬 Filial ${S.branches} inaugurada!`, "#0f5132"); confetti(); } });
  if (S.tasks) {
    S.tasks.list.forEach((t, i) => list.push({ key: `task:${i}`, kind: "claim", title: "Pegar", info: "", cost: 0, maxed: t.claimed, locked: t.progress < t.target, lockText: `${fmt(t.progress)}/${fmt(t.target)}`,
      run: () => { t.claimed = true; S.money += taskReward(); float(W / 2, H / 2, `+M ${fmt(taskReward())}`, "#2e7a57"); coinBurst(W / 2, H / 2, 6); } }));
    const all = S.tasks.list.every(t => t.claimed);
    list.push({ key: "chest", kind: "claim", title: "Abrir baú do dia", info: "Bônus por completar as 3 tarefas", cost: 0, maxed: S.tasks.chest, locked: !all, lockText: "Faça as 3 tarefas",
      run: () => { S.tasks.chest = true; S.streak = S.streakDate === yesterdayKey() ? S.streak + 1 : (S.streakDate === dateKey() ? S.streak : 1); S.streakDate = dateKey();
        const v = taskReward() * 3; S.money += v; banner(`🎁 Baú: +M ${fmt(v)}`, "#b7773b"); confetti(); } });
  }
  // neighbouring lots
  LOTS.forEach(L => { if (!L.cost) return; const bad = lotReqs(L).find(r => !r.ok);
    list.push({ key: `lot:${L.id}`, kind: "lot", lot: L.id, title: `Comprar ${L.kind === "park" ? "lote" : "terreno"}`, info: lotBenefit(L), cost: L.cost,
      maxed: owns(L.id), locked: !!bad, lockText: bad ? bad.short : "", run: () => buyLot(L) }); });
  // parking staff and upgrades
  const pk = S.park;
  if (CANCELA) list.push({ key: "parkhire", kind: "parkhire", title: "Contratar atendente", info: pk.staff >= PK.maxStaff ? `Equipe completa (${pk.staff})` : `${postName(pk.staff)} · salário M ${fmt(parkWage())}/dia`,
    cost: Math.ceil(60 * Math.pow(2.2, pk.staff)), maxed: pk.staff >= PK.maxStaff, run: () => { pk.staff++; pk.everHired = true; } });
  const tNow = gateTime("out"), tNext = gateTime("out", pk.staff, pk.train + 1);
  if (CANCELA) list.push({ key: "parktrain", kind: "parktrain", title: `Treinar atendentes (nv ${pk.train})`, info: pk.staff ? `Saída ${tNow.toFixed(2).replace(".", ",")} s → ${tNext.toFixed(2).replace(".", ",")} s por carro` : "Contrate um atendente primeiro",
    cost: Math.ceil(25 * Math.pow(1.45, pk.train)), locked: !pk.staff, lockText: "Sem atendente", maxed: parkTrain() <= 0.35 + 1e-9, run: () => pk.train++ });
  list.push({ key: "parksign", kind: "parksign", title: `Placas na rua (nv ${pk.sign})`, info: `Mais motoristas param: +${12 * (pk.sign + 1)}% de procura (hoje +${12 * pk.sign}%)`,
    cost: Math.ceil(40 * Math.pow(1.6, pk.sign)), maxed: pk.sign >= 5, run: () => pk.sign++ });
  PINTRO.forEach(t => { if (pk.intro[t.id]) return; list.push({ key: `pintro:${t.id}`, kind: "claim", title: t.label, info: `Prêmio M ${fmt(t.reward)}`, cost: 0, locked: !t.ok(), lockText: "A fazer",
    run: () => { pk.intro[t.id] = true; S.money += t.reward; banner(`🅿️ +M ${fmt(t.reward)}`, "#2a4f7a"); } }); });
  ACH.forEach(a => { if (S.ach[a.id]) return; list.push({ key: `ach:${a.id}`, kind: "claim", title: a.label, info: `Prêmio M ${fmt(achReward(a))}`, cost: 0, locked: !a.ok(), lockText: "Em andamento",
    run: () => { S.ach[a.id] = true; S.money += achReward(a); banner(`🏆 ${a.label}`, "#6b3fa0"); coinBurst(W / 2, H / 2, 8); } }); });
  list.forEach(a => a.ok = !a.locked && !a.maxed && S.money >= a.cost && (a.cost === 0 || S.money >= 0));
  return GANCHOS.filtrarAcoes ? GANCHOS.filtrarAcoes(list) : list;     // shopping: só o que faz sentido lá
}
function tierReqs() {
  const n = TIERS[S.tier + 1]; if (!n) return [];
  return [
    { label: "Faturamento total", have: S.earned, need: n.req.earned, money: true },
    { label: "Setores abertos", have: openSectors().length, need: n.req.sectors },
    { label: "Reputação (estrelas)", have: S.rep, need: n.req.rep, dec: true },
    { label: "Terreno de ampliação comprado", have: owns("market") ? 1 : 0, need: 1, lot: true },
  ];
}
function tierReqOk() { return tierReqs().every(r => r.have >= r.need); }
function tierUp() {
  S.tier++; relayout(); syncWorkers();
  confetti(); banner(`🎉 ${tierNow().name}!`, tierNow().signColor);
  showModal(`<h2>${tierNow().name}!</h2><p>A loja cresceu: agora cabem <b>${tierNow().slots} setores</b> e <b>${tierNow().lanes} caixas</b>, e o movimento de clientes aumentou.</p>
    <p>As contas do dia também sobem (aluguel M ${fmt(tierNow().rent)}). Novas tarefas diárias ficam mais valiosas.</p><button class="btn" id="ok">Bora!</button>`);
  document.getElementById("ok").onclick = hideModal;
}
function doAction(key) {
  const a = actions().find(a => a.key === key);
  if (!a || !a.ok) return false;
  const before = S.money;
  S.money -= a.cost; a.run(); syncWorkers(); if (UPGRADE_KINDS.has(a.kind)) taskProgress("upgrades", 1);
  save(); lastSig = ""; renderSheet(); hud();
  if (a.sec != null) { const sh = SHELVES[a.sec]; sparkle(sh.cx, sh.y + 10, SECTORS[a.sec].color, a.kind === "open" ? 40 : 16); float(sh.cx, sh.y - 4, a.kind === "open" ? "Aberto!" : "Melhorou!", "#2e7a57"); }
  else if (a.kind === "gear") sparkle(STATION.x + 4, STATION.y, "#d9533f", 18);
  else if (a.kind === "lot") { const r = lotRect(lotById(a.lot)); sparkle(r.x + r.w / 2, r.y + r.h / 2, "#f2b233", 24); requestAnimationFrame(() => reveal(r)); }
  else if (a.kind.startsWith("park")) sparkle(exitX() - 30, pkY().gate, "#f2b233", 18);
  else if (a.kind !== "claim") sparkle(a.kind === "storage" ? DEP.x + DEP.w / 2 : a.kind === "ads" || a.kind === "mgr" ? LOJA.letreiro.x + LOJA.letreiro.w / 2 : W / 2, a.kind === "storage" ? 80 : a.kind === "ads" || a.kind === "mgr" ? 66 : FZ + 90, "#f2b233", 18);
  const btn = panelEls[key]; if (btn) { btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
  window.__lastPurchase = { key, cost: a.cost, before, after: S.money };
  if (a.kind !== "claim") anunciar(`${a.title}: feito${a.cost ? `, custou M ${fmt(a.cost)}` : ""}.`); else anunciar(`Recompensa recolhida: ${a.title}.`);
  return true;
}
// janelas: o foco entra na janela ao abrir e volta para onde estava ao fechar
let modalOrigem = null;
function showModal(html) {
  const d = document.getElementById("dialog"), m = document.getElementById("modal");
  if (m.hidden) { const a = document.activeElement; modalOrigem = a && a !== document.body ? a : null; }
  d.innerHTML = html; m.hidden = false;
  const h = d.querySelector("h2"); if (h) { h.id = "dlgTitulo"; d.setAttribute("aria-labelledby", "dlgTitulo"); } else d.removeAttribute("aria-labelledby");
  setTimeout(() => { if (m.hidden) return; const b = d.querySelector("button"); if (b && !d.contains(document.activeElement)) b.focus({ preventScroll: true }); }, 30);
}
// janelas na fila: mostradas uma depois da outra (ex.: "bem-vindo de volta" e depois o convite)
const filaModal = [];
function hideModal() {
  const m = document.getElementById("modal"); if (m.hidden) return;
  m.hidden = true; const o = modalOrigem; modalOrigem = null;
  document.getElementById("dialog").classList.remove("dialog-mapa");
  if (o && document.contains(o) && o.offsetParent !== null) { try { o.focus({ preventScroll: true }); } catch (e) {} }
  if (filaModal.length) { const f = filaModal.shift(); setTimeout(() => { if (m.hidden) f(); else filaModal.unshift(f); }, 150); }
}
