"use strict";
// =====================================================================
// Interface: one sheet at a time, opened from the bottom bar, the HUD or by tapping a building
// =====================================================================
const $ = id => document.getElementById(id);
const ui = { sheet: null, sel: null, from: null, seg: "sectors", opener: null };
let panelEls = {}, liveFns = [], lastSig = "";
const TAB_SHEETS = ["upgrade", "expand", "tasks", "ach", "lista"];

// Android back gesture / browser back closes the sheet (only when the page is not embedded)
const canHist = (() => { try { return window.top === window && !!history.pushState; } catch (e) { return false; } })();
let histPushed = false;
// fechar e abrir outro painel no mesmo instante: o "voltar" ainda não aconteceu, então reaproveita a entrada em vez de empilhar outra
// (sem isso o voltar assíncrono chegava depois do pushState e o histórico ia descendo até sair da página)
let voltaPendente = 0;
function pushHist() {
  if (!canHist) return;
  if (voltaPendente) { clearTimeout(voltaPendente); voltaPendente = 0; histPushed = true; return; }
  if (!histPushed) { try { history.pushState({ sheet: 1 }, ""); histPushed = true; } catch (e) {} }
}
// o "voltar" que nós mesmos pedimos ao fechar não pode fechar um painel aberto logo em seguida
let popProprio = 0;
function popHist() {
  if (!canHist || !histPushed) return;
  histPushed = false; clearTimeout(voltaPendente);
  voltaPendente = setTimeout(() => { voltaPendente = 0; popProprio++; try { history.back(); } catch (e) { popProprio--; } }, 0);
}
window.addEventListener("popstate", () => {
  if (popProprio > 0) { popProprio--; return; }
  if (!histPushed) return;
  histPushed = false;
  if (ui.sheet === "building" && ui.from) openSheet(ui.from); else closeSheet(true);
});

function openSheet(kind, opts = {}) {
  const el = $("sheet"), changed = el.hidden || ui.sheet !== kind || kind === "building";
  // quem abriu o painel recebe o foco de volta ao fechar (Esc, X ou toque no chão)
  const ativo = document.activeElement;
  if (el.hidden) ui.opener = ativo && ativo !== document.body && ativo !== cv && !el.contains(ativo) ? ativo : null;
  ui.sheet = kind; ui.from = opts.from || null;
  if (kind !== "building") ui.sel = null;
  el.hidden = false; document.body.classList.add("sheet-open");
  if (changed) { el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); }
  lastSig = ""; renderSheet();
  if (changed) $("shBody").scrollTop = 0;
  syncNav(); pushHist(); requestAnimationFrame(updateOccl);
  if (changed && (ui.opener || el.contains(ativo))) setTimeout(() => { try { if (!el.hidden) $("shTitle").focus({ preventScroll: true }); } catch (e) {} }, 0);
}
function closeSheet(fromHistory) {
  if (!ui.sheet) return;
  ui.sheet = null; ui.sel = null; ui.from = null; panelEls = {}; liveFns = [];
  const volta = ui.opener; ui.opener = null;
  const focoNoPainel = $("sheet").contains(document.activeElement);
  $("sheet").hidden = true; document.body.classList.remove("sheet-open");
  syncNav(); updateOccl();
  if (volta && document.contains(volta) && volta.offsetParent !== null) { try { volta.focus({ preventScroll: true }); } catch (e) {} }
  else if (focoNoPainel) { const b = document.querySelector('.nav-btn[data-tab="market"]'); if (b) b.focus({ preventScroll: true }); }
  if (camHome) { cam.anim = camHome; camHome = null; } else settleCam();
  if (!fromHistory) popHist();
}
function select(sel, from) {
  ui.sel = sel; openSheet("building", { from: from || (ui.sheet && ui.sheet !== "building" ? ui.sheet : ui.from) });
  if (!camHome) camHome = { x: cam.x, y: cam.y, s: cam.s };   // where to return when the panel closes
  const r = bRect(sel);
  if (r) { requestAnimationFrame(() => { updateOccl(); reveal(r); }); setTimeout(() => { if (ui.sel === sel && !cam.anim) { updateOccl(); reveal(r); } }, 350); }
}
function syncNav() {
  const cur = ui.sheet === "building" ? (ui.from && TAB_SHEETS.includes(ui.from) ? ui.from : "market") : TAB_SHEETS.includes(ui.sheet) ? ui.sheet : "market";
  document.querySelectorAll(".nav-btn").forEach(b => { const on = b.dataset.tab === cur; if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); b.setAttribute("aria-expanded", String(on && !!ui.sheet && cur !== "market")); });
  const bl = $("btnLista"); if (bl) bl.setAttribute("aria-pressed", String(ui.sheet === "lista" || (ui.sheet === "building" && ui.from === "lista")));
}
document.querySelectorAll(".nav-btn").forEach(b => b.onclick = () => {
  const t = b.dataset.tab;
  if (t === "market") { if (ui.sheet) closeSheet(); else recenter(); return; }
  if (ui.sheet === t) closeSheet(); else openSheet(t);
});
$("shClose").onclick = () => closeSheet();
$("shBack").onclick = () => { if (ui.from) openSheet(ui.from); else closeSheet(); };
$("btnSettings").onclick = () => ui.sheet === "settings" ? closeSheet() : openSheet("settings");
$("progress").onclick = () => openSheet("expand");
$("lvlChip").onclick = () => openSheet("expand");
$("btnRewards").onclick = () => { const c = claimCounts(); openSheet(c.tasks || !c.ach ? "tasks" : "ach"); };
$("btnMap").onclick = () => toggleOverview();
$("btnCenter").onclick = () => recenter();
$("mission").onclick = () => { const m = currentMission(); if (m && m.go) m.go(); };
document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.sheet && $("modal").hidden) closeSheet(); });

// ---------- building blocks ----------
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function live(fn) { liveFns.push(fn); }
function blockReason(a) {
  if (a.maxed) return a.kind === "claim" ? "Recompensa já recolhida." : "Já está no nível máximo.";
  if (a.locked) return a.kind === "tier" ? "Complete as metas de faturamento, setores e reputação para expandir." : a.kind === "claim" ? `Ainda não concluído (${a.lockText}).` : `Bloqueado: ${a.lockText}.`;
  if (S.money < 0 && a.cost > 0) return "Você está no vermelho: saia das dívidas para voltar a comprar.";
  if (S.money < a.cost) return `Falta dinheiro: precisa de mais M ${fmt(a.cost - S.money)}.`;
  return "";
}
function actBtn(a) {
  const b = el("button", "act", "<b></b><span></span><em></em><i class=\"sr-only\"></i>");
  b.onclick = () => {
    const cur = actions().find(x => x.key === a.key);
    if (cur && cur.ok) doAction(a.key);
    else if (cur) { toast(blockReason(cur)); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); }
  };
  panelEls[a.key] = b; return b;
}
function paintAct(b, a) {
  b.querySelector("b").textContent = a.title; b.querySelector("span").textContent = a.info;
  const lack = !a.maxed && !a.locked && a.cost > 0 && (S.money < a.cost || S.money < 0);
  b.querySelector("em").textContent = a.maxed ? (a.kind === "claim" ? "Recolhido" : a.kind === "lot" ? "Comprado" : "Máximo") : a.locked ? a.lockText : a.cost ? `M ${fmt(a.cost)}` : "Pegar!";
  b.classList.toggle("can", a.ok); b.classList.toggle("lack", lack); b.classList.toggle("max", !!a.maxed);
  b.setAttribute("aria-disabled", String(!a.ok));
  // estado também em texto (não só pela cor): lido por leitores de tela e mostrado na etiqueta
  b.querySelector("i").textContent = a.ok ? " — disponível" : a.maxed ? " — concluído" : a.locked ? " — bloqueado" : lack ? " — falta dinheiro" : "";
}
function actsBox(acts, keys) { const g = el("div", "acts"); keys.forEach(k => { const a = acts.find(x => x.key === k); if (a) g.appendChild(actBtn(a)); }); return g; }
function stat(label, fn) { const s = el("div", "stat", `<small>${label}</small><b></b>`), b = s.querySelector("b"); live(() => { b.textContent = fn(); }); return s; }
function statsBox(list) { const g = el("div", "stats"); list.forEach(([l, f]) => g.appendChild(stat(l, f))); return g; }
function meter(fn, color) { const m = el("div", "meter", "<i></i>"), i = m.firstChild; if (color) i.style.background = color; live(() => { i.style.width = `${Math.max(0, Math.min(1, fn())) * 100}%`; }); return m; }
function head(ic, bg, title, sub) {
  $("shIc").innerHTML = ic; $("shIc").style.background = bg; $("shTitle").textContent = title;
  const s = $("shSub"); if (typeof sub === "function") live(() => { s.textContent = sub(); }); else s.textContent = sub || "";
}
function iconSvg(id) { return `<svg class="i" style="width:26px;height:26px"><use href="#${id}"/></svg>`; }
const affordable = (acts, pred) => acts.filter(a => pred(a) && a.ok && a.kind !== "claim").length;

// ---------- contextual panels for buildings ----------
function buildBuilding(body, acts) {
  const sel = ui.sel;
  if (sel.kind === "shelf") {
    const d = SECTORS[sel.i], st = S.sec[d.id];
    if (!st.open) {
      head(d.ic, shade(d.color, 1.8), d.name, "Setor fechado");
      body.appendChild(el("p", "note", `Abra este setor para vender ${d.ic} a <b>M ${fmt(d.price)}</b> por item. Mais setores atraem mais clientes.`));
      body.appendChild(actsBox(acts, [`open:${d.id}`]));
      return;
    }
    head(d.ic, shade(d.color, 1.8), d.name, () => `Prateleira nv ${st.shelfLvl + 1} · Qualidade nv ${st.priceLvl + 1} · Equipe ${faixaNv(eqRep(d.id))}`);
    body.appendChild(statsBox([
      ["Na prateleira", () => `${st.shelf}/${shelfCap(st.shelfLvl)}`],
      ["No depósito", () => `${st.wh} un.`],
      ["Preço", () => `M ${fmt(secPrice(d, st.priceLvl))}`],
      ["Repositores", () => `${st.staff} de ${MAX_STAFF}`],
    ]));
    body.appendChild(meter(() => st.shelf / shelfCap(st.shelfLvl), d.color));
    // restock by hand: free, one item per tap
    const hb = el("button", "act", "<b>Repor à mão</b><span></span><em>+1</em>");
    hb.onclick = () => {
      if (st.wh > 0 && st.shelf < shelfCap(st.shelfLvl)) {
        markPop(sel.i, st.shelf, st.shelf + 1); st.wh--; st.shelf++; S.stats.hand++; taskProgress("hand", 1);
        float(SHELVES[sel.i].cx, SHELVES[sel.i].y - 2, "+1", "#6b4f2f"); hb.classList.remove("pop"); void hb.offsetWidth; hb.classList.add("pop");
      } else {          // 1.6: o aviso sai uma vez por dia e por setor; toques seguidos só balançam o botão
        if (st.wh === 0) toastOnce(`semEstoque:${d.id}`, `Sem ${d.name} no depósito. Melhore o depósito ou espere o caminhão.`);
        else toastOnce(`cheia:${d.id}`, st.shelfLvl < MAX_PRATELEIRA ? `A prateleira de ${d.name} já está cheia: só cabe mais quando os clientes levarem. Para caber mais, use "Prateleira" em Melhorias.` : `A prateleira de ${d.name} já está cheia e no tamanho máximo.`);
        hb.classList.remove("shake"); void hb.offsetWidth; hb.classList.add("shake"); }
    };
    live(() => { const ok = st.wh > 0 && st.shelf < shelfCap(st.shelfLvl); hb.classList.toggle("can", ok);
      hb.querySelector("span").textContent = ok ? "Leva 1 item do depósito para a prateleira" : st.wh === 0 ? "Depósito sem estoque deste setor" : "Prateleira cheia"; });
    body.appendChild(el("div", "sec-title", "Melhorias"));
    body.appendChild(actsBox(acts, [`shelf:${d.id}`, `price:${d.id}`, `hire:${d.id}`, `train:${d.id}`]));
    const g = body.lastChild; g.insertBefore(hb, g.firstChild);
    cartaoEquipe(body, "rep", d.id, "Repositores");
  } else if (sel.kind === "lane") {
    const l = sel.l, open = () => l < nCaixas();
    head("🧾", "#d6ead9", `Caixa ${l + 1}`, () => open() ? (l < S.cashiers ? `Aberto · ${eqCaixa()[l].n}, nível ${nvCaixa(l) + 1}` : "Aberto com volante") : "Fechado");
    body.appendChild(statsBox([
      ["Caixas abertos", () => `${nCaixas()} de ${nLanes()}${nCaixas() > S.cashiers ? ` (${nCaixas() - S.cashiers} com volantes)` : ""}`],
      ["Tempo por item", () => `${cashTime(nvCaixa(l)).toFixed(2).replace(".", ",")} s`],
      ["Fila agora", () => open() ? `${laneQueue(l).length} cliente${laneQueue(l).length === 1 ? "" : "s"}` : "—"],
    ]));
    body.appendChild(el("p", "note", "Fila longa faz o cliente largar as compras e baixa a reputação."));
    body.appendChild(actsBox(acts, ["cashhire", "cashtrain"]));
    cartaoEquipe(body, "caixa", null, "Operadores de caixa (um por caixa)");
    if (DIV) cartaoPrioridade(body, l);
  } else if (sel.kind === "station") {
    const gr = S.gear;
    head("🧺", "#fde2dc", "Cestas e carrinhos", () => `Carrinheiros ${faixaNv(eqCol())}`);
    body.appendChild(statsBox([
      [ENT2 ? "Entradas (estac. · avenida)" : "Na entrada", () => ENT2 ? `🧺${station.b} 🛒${station.c} · 🧺${station2.b} 🛒${station2.c}` : `🧺 ${station.b} · 🛒 ${station.c}`],
      ["Total da loja", () => `🧺 ${gr.baskets} · 🛒 ${gr.carts}`],
      ["Nos caixas", () => `${piles.reduce((a, p) => a + p.b + p.c, 0)}`],
      ["Carrinheiros", () => `${gr.collectors} de ${MAX_COLLECTORS}`],
    ]));
    body.appendChild(el("p", "note", "Sem cesta o cliente vai embora. Toque nas pilhas ao lado dos caixas para devolver na hora."));
    body.appendChild(actsBox(acts, ["buybasket", "buycart", "hirecol", "traincol"]));
    cartaoEquipe(body, "col", null, "Carrinheiros");
  } else if (sel.kind === "wh") {
    head("📦", "#e8dcc4", "Depósito", () => `Nível ${S.whLvl + 1}`);
    body.appendChild(statsBox([
      ["Ocupação", () => `${whUsed()}/${whCap(S.whLvl)}`],
      ["Caminhão traz", () => `${truckLoad(S.whLvl)} caixas`],
      ["Passa a cada", () => `${truckEvery()} s`],
    ]));
    body.appendChild(meter(() => whUsed() / whCap(S.whLvl), "#b07a3c"));
    const per = el("div", "stats");
    openSectors().forEach(d => per.appendChild(stat(`${d.ic} ${d.name}`, () => `${S.sec[d.id].wh} un.`)));
    body.appendChild(el("div", "sec-title", "Estoque por setor")); body.appendChild(per);
    if (fornAtivo()) {
      body.appendChild(el("p", "note", `Reservadas para pedidos a caminho: ${reservado()} caixas. ${fornCompleto() ? `A reposição automática só mantém até ${FORN_CFG.emergencia} caixas por setor e custa ${Math.round((FORN_CFG.fatorAuto - 1) * 100)}% a mais.` : "O caminhão automático completa o resto pelo preço normal; na Serra sai 25% mais barato."}`));
      const bf = el("button", "btn", "Negociar com fornecedores"); bf.onclick = () => openSheet("forn"); body.appendChild(bf);
    } else body.appendChild(el("p", "note", "O fornecedor cobra cada caixa entregue. Sem dinheiro, o caminhão não descarrega."));
    body.appendChild(actsBox(acts, ["storage"]));
  } else if (sel.kind === "sign") {
    head("📣", "#f6e3c4", "Fachada e gerência", () => tierNow().name);
    body.appendChild(statsBox([
      typeof SH_ATIVO !== "undefined" && SH_ATIVO ? ["Pessoas no shopping", () => `${dentro()}`] : ["Clientes na loja", () => `${customers.length}`],
      ["Reputação", () => `★ ${S.rep.toFixed(1).replace(".", ",")}`],
      ["Gerente", () => S.mgrLvl ? `nv ${S.mgrLvl}` : "nenhum"],
    ]));
    body.appendChild(el("div", "sec-title", "Propaganda"));
    body.appendChild(actsBox(acts, ["ads"]));
    body.appendChild(el("div", "sec-title", "Gerente"));
    body.appendChild(el("p", "note", "Cuida da loja enquanto você está fora do jogo."));
    body.appendChild(actsBox(acts, ["mgr"]));
  } else if (sel.kind === "parking") {
    const pk = S.park, fmtS = v => `${v.toFixed(1).replace(".", ",")} s`;
    head("🅿️", "#dfe8f4", "Estacionamento", () => !CANCELA ? "Vagas livres em frente à loja, sem cancela nem cobrança" : `Cobrança por visita · ${pk.price ? `M ${fmt(pk.price)} por carro` : "grátis"}`);
    body.appendChild(statsBox([
      ["Vagas ocupadas", () => `${occupied()}/${STALLS.length}`],
      ["Aguardando", () => `${inQ.length} carro${inQ.length === 1 ? "" : "s"}`],
      ["Saindo", () => `${pcars.filter(c => c.state === "toExit" || c.state === "exitGate").length} na fila`],
      ["Atendentes", () => `${pk.staff} de ${PK.maxStaff}`],
    ]));
    body.appendChild(meter(() => occupied() / Math.max(1, STALLS.length), "#3f74b8"));
    if (CANCELA) {
    // price per visit
    const pc = el("div", "card", `<h3>Preço por visita</h3>
      <div class="price"><button class="icon-btn" id="pkMinus" aria-label="Diminuir preço">−</button><b id="pkPrice"></b><button class="icon-btn" id="pkPlus" aria-label="Aumentar preço">+</button><button class="chipbtn" id="pkFree">Grátis</button></div>
      <p class="note" id="pkAccept"></p>
      <p class="note">Cobrado uma única vez, na saída. A mudança vale para os próximos carros; quem já entrou paga o preço que aceitou.</p>`);
    pc.querySelector("#pkMinus").onclick = () => setParkPrice(pk.price - PK.priceStep);
    pc.querySelector("#pkPlus").onclick = () => setParkPrice(pk.price + PK.priceStep);
    pc.querySelector("#pkFree").onclick = () => setParkPrice(0);
    live(() => { pc.querySelector("#pkPrice").textContent = pk.price ? `M ${fmt(pk.price)}` : "Grátis";
      pc.querySelector("#pkAccept").textContent = `Cerca de ${Math.round(acceptShare(pk.price) * 100)}% dos motoristas aceitam este preço. Quem desiste também não compra no mercado.`; });
    body.appendChild(pc);
    } else body.appendChild(el("p", "note", "Mercado de bairro: as vagas da frente são livres. Mais vagas trazem mais clientes de carro, mas não há receita de estacionamento."));
    // today
    const td = el("div", "card", `<h3>Hoje no estacionamento</h3><table class="rep">
      <tr><td>Receita das vagas</td><td class="pos" id="pkFees"></td></tr><tr><td>Salários (pagos no fim do dia)</td><td class="neg" id="pkWages"></td></tr>
      <tr><td><b>Lucro do estacionamento</b></td><td id="pkNet"></td></tr><tr><td>Carros atendidos</td><td id="pkCars"></td></tr>
      <tr><td>Perdidos por lotação</td><td id="pkFull"></td></tr><tr><td>Perdidos pelo preço</td><td id="pkLostP"></td></tr></table>`);
    live(() => { const d = S.today.park, w = parkWages(), n = d.fees - w, q = id => td.querySelector(id);
      q("#pkFees").textContent = `+M ${fmt(d.fees)}`; q("#pkWages").textContent = `-M ${fmt(w)}`;
      q("#pkNet").textContent = `${n < 0 ? "-" : "+"}M ${fmt(Math.abs(n))}`; q("#pkNet").className = n < 0 ? "neg" : "pos";
      q("#pkCars").textContent = d.cars; q("#pkFull").textContent = d.lostFull; q("#pkLostP").textContent = d.lostPrice; });
    body.appendChild(td);
    if (CANCELA) {
    // staff
    body.appendChild(el("div", "sec-title", "Atendentes de cancela"));
    body.appendChild(statsBox([["Entrada", () => fmtS(gateTime("in"))], ["Saída", () => fmtS(gateTime("out"))], ["Salários", () => `M ${fmt(parkWages())}/dia`]]));
    const how = el("p", "note"); live(() => { how.textContent = pk.staff
      ? "Cada atendente recebe M " + fmt(parkWage()) + " por dia. O 1º cobra na saída, o 2º cuida da entrada e o 3º e o 4º ajudam (−30% de tempo). Poucos atendentes formam fila."
      : `Sem atendente, as cancelas usam máquinas automáticas: mais lentas (${fmtS(PK.machineIn)} na entrada, ${fmtS(PK.machineOut)} na saída), mas nenhum carro fica preso.`; });
    body.appendChild(how);
    body.appendChild(actsBox(acts, ["parkhire", "parktrain"]));
    cartaoEquipe(body, "park", null, "Atendentes (1º saída, 2º entrada, 3º e 4º ajudam)");
    const fire = el("button", "plain", `<span>Dispensar um atendente</span>`);
    fire.onclick = () => { if (!pk.staff) return; if (fire.dataset.armed) { pk.staff--; save(); lastSig = ""; renderSheet(); toast("Atendente dispensado. O salário deixa de ser cobrado."); }
      else { fire.dataset.armed = 1; fire.firstChild.textContent = "Toque de novo para dispensar"; setTimeout(() => { delete fire.dataset.armed; fire.firstChild.textContent = "Dispensar um atendente"; }, 2500); } };
    live(() => { fire.hidden = !pk.staff; });
    body.appendChild(fire);
    }
    body.appendChild(el("div", "sec-title", "Melhorias"));
    body.appendChild(actsBox(acts, ["parksign"]));
    body.appendChild(el("div", "sec-title", "Terrenos do estacionamento"));
    LOTS.filter(L => L.kind === "park").forEach(L => body.appendChild(lotRow(L, null)));
  } else if (sel.kind === "lot") {
    const L = lotById(sel.id), ic = L.kind === "park" ? "🅿️" : L.kind === "logi" ? "🚚" : "🏗️";
    head(ic, "#e4ece6", L.name, () => owns(L.id) ? (building[L.id] > 0 ? `Em obra · ${Math.round(100 * (1 - building[L.id] / PK.buildT))}%` : "Comprado") : "À venda");
    body.appendChild(statsBox([["Finalidade", () => lotPurpose(L)], ["Tamanho", () => lotSize(L)], ["Preço", () => owns(L.id) ? "Pago" : L.cost ? `M ${fmt(L.cost)}` : "Já é seu"]]));
    body.appendChild(el("div", "sec-title", "Benefício"));
    body.appendChild(el("p", "note", `<b style="color:var(--ink)">${lotBenefit(L)}</b>`));
    const reqs = lotReqs(L);
    if (!owns(L.id) && reqs.length) {
      body.appendChild(el("div", "sec-title", "Requisitos"));
      const box = el("div", "card"); reqs.forEach(r => box.appendChild(el("div", "req", `<span>${r.ok ? "✅" : "🔒"} ${r.label}</span><span>${r.ok ? "ok" : "falta"}</span>`)));
      body.appendChild(box);
    }
    if (L.cost) body.appendChild(actsBox(acts, [`lot:${L.id}`]));
    if (owns(L.id) && L.kind === "park") { const b = el("button", "plain", `<span>Gerenciar o estacionamento</span>`); b.onclick = () => select({ kind: "parking" }); body.appendChild(b); }
    if (owns(L.id) && L.kind === "market") { const b = el("button", "plain", `<span>Ver as metas de expansão da loja</span>`); b.onclick = () => openSheet("expand"); body.appendChild(b); }
  } else if (sel.kind === "expand") {
    buildTierCard(body, acts, true);
  } else if (GANCHOS.painel) GANCHOS.painel(sel, body, acts);
}

// ---------- tab sheets ----------
function lotRow(L, from) {
  const ic = L.kind === "park" ? "🅿️" : L.kind === "logi" ? "🚚" : "🏗️";
  const r = el("button", "row", `<div class="ic" style="background:#e4ece6">${ic}</div><div><div class="t">${L.name}</div><div class="s"></div></div><div class="go"></div>`);
  const sub = r.querySelector(".s"), go = r.querySelector(".go");
  live(() => {
    const own = owns(L.id), blocked = lotReqs(L).find(q => !q.ok);
    r.classList.toggle("locked", !own && !!blocked);
    sub.textContent = `${lotBenefit(L)}${own ? "" : ` · M ${fmt(L.cost)}`}`;
    go.innerHTML = own ? (building[L.id] > 0 ? "Em obra" : "✅ Seu") : blocked ? `<svg class="i" style="width:18px;height:18px"><use href="#i-lock"/></svg>` : S.money >= L.cost ? `<span class="n">Comprar</span>` : "À venda";
  });
  r.onclick = () => select({ kind: "lot", id: L.id }, from || undefined);
  return r;
}
function sectorRow(i, acts) {
  const d = SECTORS[i], st = S.sec[d.id], r = el("button", "row" + (st.open ? "" : " locked"));
  r.innerHTML = `<div class="ic" style="background:${shade(d.color, 1.8)}">${d.ic}</div><div><div class="t">${d.name}</div><div class="s"></div></div><div class="go"></div>`;
  const s = r.querySelector(".s"), go = r.querySelector(".go");
  live(() => {
    const A = actions();
    if (st.open) {
      s.textContent = `Prateleira ${st.shelf}/${shelfCap(st.shelfLvl)} · Depósito ${st.wh} · M ${fmt(secPrice(d, st.priceLvl))}`;
      const n = affordable(A, a => a.sec === i);
      go.innerHTML = n ? `<span class="n">${n}</span> melhorar` : `Ver <svg class="i" style="width:16px;height:16px"><use href="#i-next"/></svg>`;
    } else { s.textContent = `Abrir por M ${fmt(custoAbrir(d))}`; go.innerHTML = S.money >= custoAbrir(d) ? `<span class="n">Abrir</span>` : `<svg class="i" style="width:18px;height:18px"><use href="#i-lock"/></svg>`; }
  });
  r.onclick = () => select({ kind: "shelf", i }, "upgrade");
  return r;
}
function storeRow(ic, bg, title, subFn, sel, pred) {
  const r = el("button", "row", `<div class="ic" style="background:${bg}">${ic}</div><div><div class="t">${title}</div><div class="s"></div></div><div class="go"></div>`);
  const s = r.querySelector(".s"), go = r.querySelector(".go");
  live(() => { s.textContent = subFn(); const n = affordable(actions(), pred); go.innerHTML = n ? `<span class="n">${n}</span> melhorar` : `Ver <svg class="i" style="width:16px;height:16px"><use href="#i-next"/></svg>`; });
  r.onclick = () => select(sel, "upgrade"); return r;
}
function buildUpgrade(body, acts) {
  head(iconSvg("i-up"), "#fff1c9", "Melhorar", "Toque em um item para ver detalhes e melhorias");
  if (GANCHOS.melhorar) { GANCHOS.melhorar(body, acts); return; }          // shopping (capítulos 7 e 8)
  const seg = el("div", "seg", `<button data-s="sectors">Setores</button><button data-s="store">Loja</button>`);
  seg.querySelectorAll("button").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.s === ui.seg)); b.onclick = () => { ui.seg = b.dataset.s; lastSig = ""; renderSheet(); }; });
  body.appendChild(seg);
  if (ui.seg === "sectors") {
    for (let i = 0; i < slots(); i++) body.appendChild(sectorRow(i, acts));
    const nx = TIERS[S.tier + 1];
    if (nx && nx.slots > slots()) {
      const r = el("button", "row locked", `<div class="ic" style="background:#ece4cf">${iconSvg("i-lock")}</div><div><div class="t">Mais ${nx.slots - slots()} setores</div><div class="s">${SECTORS.slice(slots(), nx.slots).map(d => d.ic).join(" ")} · em ${nx.name}</div></div><div class="go">Expandir</div>`);
      r.onclick = () => openSheet("expand"); body.appendChild(r);
    }
  } else {
    body.appendChild(storeRow("🧾", "#d6ead9", "Caixas", () => `${nCaixas()} de ${nLanes()} abertos · operadores ${faixaNv(eqCaixa())}`, { kind: "lane", l: 0 }, a => a.kind === "cashhire" || a.kind === "cashtrain"));
    body.appendChild(storeRow("🧺", "#fde2dc", "Cestas e carrinhos", () => `🧺 ${S.gear.baskets} · 🛒 ${S.gear.carts} · ${S.gear.collectors} carrinheiro${S.gear.collectors > 1 ? "s" : ""}`, { kind: "station" }, a => a.kind === "gear"));
    body.appendChild(storeRow("📦", "#e8dcc4", "Depósito", () => `${whUsed()}/${whCap(S.whLvl)} caixas · nível ${S.whLvl + 1}`, { kind: "wh" }, a => a.kind === "storage"));
    body.appendChild(storeRow("🅿️", "#dfe8f4", "Estacionamento", () => `${occupied()}/${STALLS.length} vagas · ${S.park.staff} atendente${S.park.staff === 1 ? "" : "s"} · ${S.park.price ? "M " + fmt(S.park.price) : "grátis"}`, { kind: "parking" }, a => a.kind.startsWith("park")));
    body.appendChild(storeRow("📣", "#f6e3c4", "Fachada e gerência", () => `Propaganda nv ${S.adsLvl} · gerente ${S.mgrLvl ? "nv " + S.mgrLvl : "—"}`, { kind: "sign" }, a => a.kind === "ads" || a.kind === "mgr"));
  }
}
function buildTierCard(body, acts, fromPlot) {
  const nx = TIERS[S.tier + 1];
  head(iconSvg("i-grow"), "#fff1c9", nx ? "Expandir a loja" : "Abrir filial", () => nx ? `${tierNow().name} → ${nx.name}` : `${S.branches + 1} loja${S.branches ? "s" : ""} na rede`);
  const c = el("div", "card");
  if (nx) {
    c.appendChild(el("p", "note", `Mais espaço: <b>${nx.slots} setores</b>, <b>${nx.lanes} caixas</b> e ${Math.round(nx.mult * 100)}% de movimento. Aluguel passa a M ${fmt(nx.rent)} por dia.`));
    tierReqs().forEach(r => {
      const row = el("div", "", `<div class="req"><span>${r.label}</span><span></span></div>`), v = row.querySelector("span:last-child");
      live(() => { v.textContent = r.lot ? (owns("market") ? "Comprado" : "Falta comprar") : r.money ? `M ${fmt(tierReqs().find(q => q.label === r.label).have)} / M ${fmt(r.need)}` : r.dec ? `${S.rep.toFixed(1).replace(".", ",")} / ${String(r.need).replace(".", ",")}` : `${openSectors().length} / ${r.need}`; });
      row.appendChild(meter(() => { const q = tierReqs().find(q => q.label === r.label); return q ? q.have / q.need : 1; }, "var(--gold)"));
      c.appendChild(row);
    });
    c.appendChild(actsBox(acts, ["tier"]));
  } else {
    c.appendChild(el("p", "note", "Sua rede cobre o país. Cada filial soma +35% em todas as vendas."));
    c.appendChild(actsBox(acts, ["branch"]));
  }
  body.appendChild(c);
  if (!fromPlot) {
    const b = el("button", "plain", `${iconSvg("i-map")}<span>Ver o terreno de expansão no mapa</span>`);
    b.onclick = () => select({ kind: "expand" }, "expand"); body.appendChild(b);
  }
}
function buildExpand(body, acts) {
  buildTierCard(body, acts, false);
  body.appendChild(el("div", "sec-title", "Terrenos vizinhos"));
  LOTS.filter(L => L.cost > 0).forEach(L => body.appendChild(lotRow(L, "expand")));
  body.appendChild(el("div", "sec-title", "Sua jornada"));
  TIERS.forEach((t, i) => {
    const done = i < S.tier, cur = i === S.tier;
    const r = el("div", "row" + (cur ? " cur" : i > S.tier ? " locked" : ""), `<div class="ic" style="background:${done || cur ? shade(t.signColor, 1.9) : "#ece4cf"}">${done ? "✅" : cur ? "📍" : iconSvg("i-lock")}</div>
      <div><div class="t">${t.name}</div><div class="s">${t.slots} setores · ${t.lanes} caixas${t.cost ? ` · custa M ${fmt(t.cost)}` : ""}</div></div><div class="go">${cur ? "Agora" : done ? "Feito" : ""}</div>`);
    body.appendChild(r);
  });
}
function buildTasks(body, acts) {
  ensureTasks();
  head(iconSvg("i-tasks"), "#d6ead9", "Tarefas do dia", () => `Sequência: ${S.streak} dia${S.streak === 1 ? "" : "s"}${S.streak ? ` · +${Math.round((streakMult() - 1) * 100)}% nas vendas` : ""}`);
  const c = el("div", "card");
  c.appendChild(el("p", "note", `Renovam todo dia. Cada tarefa paga M ${fmt(taskReward())}; as três juntas liberam o baú.`));
  S.tasks.list.forEach((t, i) => {
    const ty = TASK_TYPES.find(x => x.id === t.type), row = el("div", "task", `<div class="tt"><div>${ty.label(t.target, t.sec)}</div><div class="s" style="font:700 11px var(--body);color:var(--muted)"></div></div>`);
    const s = row.querySelector(".s"); live(() => { s.textContent = `${fmt(t.progress)} de ${fmt(t.target)}`; });
    row.firstChild.appendChild(meter(() => t.progress / t.target));
    row.appendChild(actBtn(acts.find(a => a.key === `task:${i}`))); c.appendChild(row);
  });
  c.appendChild(actsBox(acts, ["chest"]));
  body.appendChild(c);
  if (PINTRO.some(t => !S.park.intro[t.id])) {
    const pc = el("div", "card", `<h3>Primeiros passos no estacionamento</h3>`);
    pc.appendChild(actsBox(acts, PINTRO.filter(t => !S.park.intro[t.id]).map(t => `pintro:${t.id}`)));
    const go = el("button", "plain", `<span>Abrir o estacionamento</span>`); go.onclick = () => select({ kind: "parking" }, "tasks"); pc.appendChild(go);
    body.appendChild(pc);
  }
  const b = el("div", "card", `<h3>Contas do dia</h3>`);
  const p = el("p", "note"); live(() => { const bl = bills(); p.innerHTML = S.money < 0 ? `Você está no vermelho. O banco cobra <b>5% de juros por dia</b> e as compras ficam bloqueadas até o saldo voltar a ser positivo.` : `No fim do dia você paga <b>M ${fmt(bl)}</b> de aluguel e salários. ${S.money >= bl ? "Já está garantido." : `Faltam M ${fmt(bl - S.money)}.`}`; });
  b.appendChild(p); b.appendChild(meter(() => S.money / Math.max(1, bills()), "var(--gold)")); body.appendChild(b);
  if (S.lastDay) {
    const L = S.lastDay, sg = v => `${v < 0 ? "-" : "+"}M ${fmt(Math.abs(v))}`;
    body.appendChild(el("div", "card", `<h3>Relatório do dia ${L.day}</h3><div class="note">${L.served} clientes atendidos, ${L.lost} perdidos</div>
      <table class="rep"><tr><td>Vendas do mercado</td><td class="pos">${sg(L.sales)}</td></tr>${L.park ? `<tr><td>Estacionamento (${L.park.cars} carros)</td><td class="pos">${sg(L.park.fees)}</td></tr>` : ""}<tr><td>Mercadoria</td><td class="neg">${sg(-L.goods)}</td></tr>
      <tr><td>Aluguel e salários do mercado</td><td class="neg">${sg(-(L.bills - (L.park ? L.park.wages : 0)))}</td></tr>${L.park && L.park.wages ? `<tr><td>Salários do estacionamento</td><td class="neg">${sg(-L.park.wages)}</td></tr>` : ""}${L.interest ? `<tr><td>Juros do banco</td><td class="neg">${sg(-L.interest)}</td></tr>` : ""}
      <tr><td><b>Lucro</b></td><td class="${L.net < 0 ? "neg" : "pos"}"><b>${sg(L.net)}</b></td></tr></table>`));
  }
}
function buildAch(body, acts) {
  head(iconSvg("i-medal"), "#e6dcf3", "Conquistas", () => `${Object.keys(S.ach).length} de ${ACH.length} concluídas`);
  const pend = ACH.filter(a => !S.ach[a.id]).sort((a, b) => (+b.ok()) - (+a.ok()));
  if (pend.length) { body.appendChild(el("div", "sec-title", "Em andamento")); body.appendChild(actsBox(acts, pend.map(a => `ach:${a.id}`))); }
  const done = ACH.filter(a => S.ach[a.id]);
  if (done.length) {
    body.appendChild(el("div", "sec-title", "Concluídas"));
    const g = el("div", "acts");
    done.forEach(a => g.appendChild(el("div", "act max", `<b>${a.label}</b><span>Prêmio M ${fmt(achReward(a))}</span><em>Recolhido</em>`)));
    body.appendChild(g);
  }
}
function buildSettings(body) {
  head(iconSvg("i-gear"), "#e4ece6", "Configurações", "Seu progresso é salvo automaticamente neste aparelho");
  const mk = (ic, txt, fn) => { const b = el("button", "plain", `${iconSvg(ic)}<span>${txt}</span>`); b.onclick = fn; body.appendChild(b); };
  mk("i-help", "Como jogar", () => { closeSheet(); showIntro(); });
  mk("i-target", "Recentralizar a câmera", () => { closeSheet(); recenter(); });
  mk("i-map", "Ver a loja inteira", () => { closeSheet(); if (!overview) toggleOverview(); });
  opcoesAcess(body);
  body.appendChild(el("p", "note", "Arraste o cenário para explorar. Use pinça ou a roda do mouse para zoom. Toque em prateleiras, caixas, depósito, cestas, fachada ou no terreno de expansão para ver detalhes."));
  if (MODO === "livre" || MODO === "carreira") mk("i-map", "Voltar à escolha de modo", () => { closeSheet(); voltarAoMenu(); });
  const nomeRb = NA_CARREIRA ? "Recomeçar a carreira do zero" : MODO === "livre" ? "Recomeçar o Meu Mercado do zero" : "Recomeçar do zero";
  const rb = el("button", "danger", nomeRb);
  body.appendChild(el("p", "note", NA_CARREIRA ? "Apaga só a carreira. O Meu Mercado continua intacto." : MODO === "livre" ? "Apaga só o Meu Mercado. A carreira continua intacta." : ""));
  rb.onclick = () => { if (rb.dataset.armed) restart(); else { rb.dataset.armed = 1; rb.textContent = "Toque de novo para apagar esta partida"; setTimeout(() => { delete rb.dataset.armed; rb.textContent = nomeRb; }, 3000); } };
  body.appendChild(rb);
}
function sheetSig() {
  const sel = ui.sel ? JSON.stringify(ui.sel) : "";
  const ach = ACH.filter(a => !S.ach[a.id] && a.ok()).length;
  return [ui.sheet, sel, ui.seg, S.tier, S.branches, S.cashiers, SECTORS.map(d => +S.sec[d.id].open).join(""),
    S.tasks ? S.tasks.date + S.tasks.list.map(t => +t.claimed).join("") + S.tasks.chest : "", Object.keys(S.ach).length, ach,
    S.lastDay ? S.lastDay.day : 0, DIV && S.acess ? S.acess.caixaPrio : "", ui.sheet === "lista" ? SHELVES.length + ":" + LOTS.filter(L => owns(L.id)).length : "", Object.keys(S.park.lots).join(",") + Object.keys(building).join(",") + S.park.staff + Object.keys(S.park.intro).length, ui.sheet === "building" && ui.sel.kind === "wh" ? openSectors().length : "", NA_CARREIRA ? sigForn() + (S.fase ? S.fase.concluida : "") : "", GANCHOS.assinatura ? GANCHOS.assinatura() : ""].join("|");
}
function renderSheet() {
  if (!ui.sheet) return;
  const acts = actions(), sig = sheetSig();
  if (sig !== lastSig) {
    lastSig = sig; panelEls = {}; liveFns = [];
    const body = $("shBody"), keep = body.scrollTop; body.innerHTML = "";
    $("shBack").hidden = !(ui.sheet === "building" && ui.from && TAB_SHEETS.includes(ui.from));
    if (ui.sheet === "building") buildBuilding(body, acts);
    else if (ui.sheet === "upgrade") buildUpgrade(body, acts);
    else if (ui.sheet === "expand") (NA_CARREIRA ? buildCarreira : buildExpand)(body, acts);
    else if (ui.sheet === "tasks") buildTasks(body, acts);
    else if (ui.sheet === "ach") buildAch(body, acts);
    else if (ui.sheet === "settings") buildSettings(body);
    else if (ui.sheet === "lista") buildLista(body);
    else if (ui.sheet === "forn") buildFornecedores(body);
    else if (PAINEIS[ui.sheet]) PAINEIS[ui.sheet](body, acts);
    body.scrollTop = keep;
  }
  acts.forEach(a => { const b = panelEls[a.key]; if (b) paintAct(b, a); });
  liveFns.forEach(f => f());
}

// ---------- mission card: one clear next step ----------
function claimCounts() {
  const acts = actions(), c = { tasks: 0, ach: 0, tier: 0 };
  acts.forEach(a => { if (!a.ok) return; if (a.key.startsWith("task:") || a.key === "chest" || a.key.startsWith("pintro:")) c.tasks++; else if (a.key.startsWith("ach:")) c.ach++; else if (a.kind === "tier") c.tier++; });
  return c;
}
function currentMission() {
  const acts = actions(), c = claimCounts();
  if (c.tasks || c.ach) {
    const n = c.tasks + c.ach;
    return { title: `${n} recompensa${n > 1 ? "s" : ""} para pegar`, sub: c.tasks ? "Tarefas do dia concluídas" : "Conquista desbloqueada", p: 1, ring: "Pegar", done: true, go: () => openSheet(c.tasks ? "tasks" : "ach") };
  }
  const mc = missaoCarreira(); if (mc) return mc;
  if (c.tier) return { title: `Expandir para ${TIERS[S.tier + 1].name}`, sub: "Todas as metas cumpridas!", p: 1, ring: "Ir", done: true, go: () => select({ kind: "expand" }) };
  const open = acts.find(a => a.kind === "open");
  ensureTasks();
  const t = S.tasks.list.find(t => t.progress < t.target);
  const openMission = open && (open.ok
    ? { title: open.title, sub: `Dinheiro suficiente: toque para abrir (M ${fmt(open.cost)})`, p: 1, ring: SECTORS[open.sec].ic, done: true, go: () => select({ kind: "shelf", i: open.sec }) }
    : { title: open.title, sub: `M ${fmt(Math.max(0, S.money))} de M ${fmt(open.cost)}`, p: Math.max(0, S.money) / open.cost, ring: SECTORS[open.sec].ic, go: () => select({ kind: "shelf", i: open.sec }) });
  if (openMission && openMission.p >= 0.5) return openMission;
  const ni = PINTRO.find(x => !S.park.intro[x.id] && !x.ok());
  if (ni) {
    if (ni.id === "car1") return { title: "Atender o primeiro carro", sub: "Carros chegam pela rua de baixo e estacionam", p: 0, ring: "🅿️", go: () => select({ kind: "parking" }) };
    const a = acts.find(x => x.key === (ni.id === "hire1" ? "parkhire" : "lot:park1"));
    if (a && !a.locked) return { title: ni.id === "hire1" ? "Contratar um atendente de cancela" : "Comprar o lote do estacionamento", sub: a.ok ? `Dinheiro suficiente: M ${fmt(a.cost)}` : `M ${fmt(Math.max(0, S.money))} de M ${fmt(a.cost)}`,
      p: Math.max(0, S.money) / a.cost, ring: "🅿️", done: a.ok, go: () => select(ni.id === "hire1" ? { kind: "parking" } : { kind: "lot", id: "park1" }) };
  }
  if (t) { const ty = TASK_TYPES.find(x => x.id === t.type); return { title: ty.label(t.target, t.sec), sub: `${fmt(t.progress)} de ${fmt(t.target)} · tarefa do dia`, p: t.progress / t.target, ring: `M ${fmt(taskReward())}`, go: () => openSheet("tasks") }; }
  if (openMission) return openMission;
  const nx = TIERS[S.tier + 1];
  return { title: nx ? `Chegar a ${nx.name}` : `Abrir filial nº ${S.branches + 1}`, sub: nx ? "Metas de faturamento, setores e reputação" : "Cada filial soma +35% nas vendas", p: tierProgress(), ring: "", go: () => openSheet("expand") };
}
let missionKey = "";
function renderMission() {
  const m = currentMission(); if (!m) return;
  const p = Math.max(0, Math.min(1, m.p));
  $("mTitle").textContent = m.title; $("mSub").textContent = m.sub;
  $("mReward").textContent = m.ring || `${Math.floor(p * 100)}%`;
  $("mRing").setAttribute("stroke-dashoffset", (125.66 * (1 - p)).toFixed(1));
  $("mission").classList.toggle("done", !!m.done);
  if (m.title !== missionKey) { missionKey = m.title; const e = $("mission"); e.animate && e.animate([{ transform: "scale(.96)" }, { transform: "scale(1)" }], { duration: 220, easing: "ease-out" }); }
}

// ---------- 1.6: proteção contra toque duplo em compras ----------
// Depois de um toque que gastou dinheiro, o painel se redesenha e o próximo nível aparece no mesmo lugar.
// Um toque duplo rápido comprava os dois (ex.: balcão de M 600 e logo o de M 1.400). Agora, por 0,6 s
// depois de uma compra, outro toque em botão do painel ou de um aviso é ignorado.
const TOQUE_DUPLO_MS = 600;
let ultimaCompraToque = -1e9, dinheiroAntesToque = null;
["sheet", "modal"].forEach(id => {
  const raiz = document.getElementById(id); if (!raiz) return;
  raiz.addEventListener("click", ev => {
    const b = ev.target.closest && ev.target.closest("button"); if (!b) return;
    const fechar = b.id === "shClose" || /^(Fechar|Entendi|Voltar|Cancelar|OK)$/i.test((b.textContent || "").trim());
    if (performance.now() - ultimaCompraToque < TOQUE_DUPLO_MS && !fechar) { ev.stopImmediatePropagation(); ev.preventDefault(); return; }
    dinheiroAntesToque = S.money;
  }, true);
  const conferir = () => { if (dinheiroAntesToque != null && S.money < dinheiroAntesToque - 1e-9) ultimaCompraToque = performance.now(); dinheiroAntesToque = null; };
  raiz.addEventListener("click", conferir);                 // mesmo toque, depois do botão agir
  raiz.addEventListener("click", () => setTimeout(conferir, 0), true);   // caso o botão pare a propagação
});
