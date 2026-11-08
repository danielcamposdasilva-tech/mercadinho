"use strict";
// =====================================================================
// Capítulo 4 (Supermercado Restinga): delegar a gestão.
// - Responsáveis com custo e efeito visível:
//   · Encarregado de reposição: repositor sem serviço no próprio setor vai ajudar a gôndola mais vazia.
//   · Líder de setor: repõe à mão a gôndola dele quando ela baixa da metade e acalma quem espera
//     (+3 s de paciência naquele setor).
//   · Fiscal de frente de loja: pode decidir sozinho quantos volantes vão para os caixas, recolhe cestas
//     paradas nos caixas e segura a fila (+3 s de paciência na fila).
// - Volantes: equipe flexível. Cada volante abre um caixa extra OU repõe qualquer setor. O plano diz
//   quantos vão ao caixa fora do pico e no pico: é a escolha entre fila curta e gôndola cheia.
// - Métricas do dia: tempo médio de fila, custo da equipe sobre as vendas e resultado do horário de pico.
// O mesmo quadro de volantes é usado no capítulo 5 (lá também separam pedidos de entrega).
// Fora dos capítulos 4 e 5 nada daqui roda.
// =====================================================================
const EQ = {
  encarregado: { contratar: 400, salario: 45 },
  lider: { contratar: 150, salario: 18 },
  fiscal: { contratar: 350, salario: 40 },
  volante: { contratar: 120, salario: 20, max: 4 },
  liderRepoe: 1.6, liderAte: 0.6, paciencia: 3, fiscalCestas: 5, fiscalDecide: 3,
};
const EQ_ATIVO = NA_CARREIRA && (FASE === "restinga" || FASE === "pitanga");
const novaEquipe = () => ({ encarregado: false, lideres: {}, fiscal: false, volantes: 0, plano: { normal: 0, pico: 1 }, planoDefinido: false, auto: false,
  hoje: novoHojeEq(), picos: [], picosOk: 0, custos: [], filas: [] });
const novoHojeEq = () => ({ filaSoma: 0, filaN: 0, pT: 0, pVazio: 0, pFilaSoma: 0, pFilaN: 0, pLost: 0, pServed: 0, naCaixaT: 0 });
function eq() {
  if (!S.equipe) S.equipe = novaEquipe();
  const e = S.equipe; e.lideres = e.lideres || {}; e.plano = Object.assign({ normal: 0, pico: 1 }, e.plano || {});
  e.hoje = Object.assign(novoHojeEq(), e.hoje || {}); e.picos = e.picos || []; e.custos = e.custos || []; e.filas = e.filas || [];
  return e;
}
const nLideres = () => Object.keys(eq().lideres).filter(id => eq().lideres[id] && S.sec[id] && S.sec[id].open).length;
const salariosEquipe = () => { const e = eq(); return (e.encarregado ? EQ.encarregado.salario : 0) + nLideres() * EQ.lider.salario + (e.fiscal ? EQ.fiscal.salario : 0) + e.volantes * EQ.volante.salario; };
const vagasCaixaVolante = () => Math.max(0, LANES.length - S.cashiers);
// quantos volantes o plano manda para os caixas agora (o fiscal pode ajustar sozinho, em modo automático)
let autoCaixa = null;
function alvoCaixa() {
  const e = eq(), lim = Math.min(e.volantes, vagasCaixaVolante());
  if (e.fiscal && e.auto && autoCaixa != null) return Math.min(lim, autoCaixa);
  return Math.min(lim, isRush() ? e.plano.pico : e.plano.normal);
}

// ---------- volantes (pessoas no cenário) ----------
const volantes = [];
function syncVolantes() {
  const e = eq();
  while (volantes.length < e.volantes) volantes.push({ id: 700 + volantes.length, x: P.whDoor.x, y: P.whDoor.y + 6, papel: "repor", state: "idle", path: [], carry: 0, sec: null, skin: pick(SKIN), hair: pick(HAIR) });
  while (volantes.length > e.volantes) { const v = volantes.pop(); if (v.carry && v.sec != null) { const id = SECTORS[v.sec].id; pending[id] -= v.carry; S.sec[id].wh += v.carry; } }
}
const papelEntrega = () => typeof entregaPapeis === "function" ? entregaPapeis() : 0;   // capítulo 5: separadores de pedidos
function distribuirPapeis() {
  const nc = alvoCaixa(), ns = Math.min(volantes.length - nc, papelEntrega());
  volantes.forEach((v, i) => {
    const quer = i < nc ? "caixa" : i < nc + ns ? "separar" : "repor";
    if (v.papel !== quer) trocarPapel(v, quer);
  });
}
function trocarPapel(v, papel) {
  if (v.carry && v.sec != null) { const id = SECTORS[v.sec].id; pending[id] -= v.carry; S.sec[id].wh += v.carry; v.carry = 0; }   // devolve o que levava
  if (v.pedido != null && typeof soltarPedido === "function") soltarPedido(v);                                // capítulo 5: o pedido volta para a fila
  v.papel = papel; v.state = "indo"; v.sec = null;
  if (papel === "caixa") { const k = volantes.filter(o => o.papel === "caixa").indexOf(v), l = Math.min(LANES.length - 1, S.cashiers + k); v.lane = l;
    const a = corredorPara(v.x, LANES[l].x + 27); v.path = [{ x: a, y: v.y }, { x: a, y: FZ + 10 }, { x: LANES[l].x + 27, y: FZ + 10 }, { x: LANES[l].x + 27, y: FZ + 96 }]; }
  else if (papel === "separar") v.path = typeof caminhoExpedicao === "function" ? caminhoExpedicao(v) : routeTo(v, P.whDoor.x, P.whDoor.y + 6);
  else { const a = corredorPara(v.x, P.whDoor.x); v.path = [{ x: a, y: v.y }, { x: a, y: P.whDoor.y + 6 }, { x: P.whDoor.x, y: P.whDoor.y + 6 }]; }
}
const caixasDeVolante = () => volantes.filter(v => v.papel === "caixa" && v.state === "caixa").length;
// setor que mais precisa: menor ocupação da gôndola, com estoque no depósito e espaço livre
function setorMaisVazio(ignorar) {
  let best = null, bp = 2;
  SHELVES.forEach((sh, i) => { const d = SECTORS[i], st = S.sec[d.id]; if (!st.open || i === ignorar) return;
    const cap = shelfCap(st.shelfLvl), livre = cap - st.shelf - pending[d.id]; if (livre <= 0 || st.wh <= 0) return;
    const p = (st.shelf + pending[d.id]) / cap; if (p < bp) { bp = p; best = i; } });
  return { i: best, p: bp };
}
function passoVolante(v, dt) {
  const sp = staffSpd(1);
  if (v.state === "indo") { if (follow(v, sp, dt)) v.state = v.papel === "caixa" ? "caixa" : v.papel === "separar" ? "separando" : "idle"; return; }
  if (v.papel === "caixa") return;                                   // atende no caixa (o desenho do operador é o do caixa)
  if (v.papel === "separar") { if (typeof passoSeparador === "function") passoSeparador(v, dt, sp); return; }
  if (v.state === "idle") {
    const alvo = setorMaisVazio(); if (alvo.i == null || alvo.p > 0.85) return;
    const d = SECTORS[alvo.i], st = S.sec[d.id], sh = SHELVES[alvo.i];
    const n = Math.min(staffCarry(1), st.wh, shelfCap(st.shelfLvl) - st.shelf - pending[d.id]);
    st.wh -= n; v.carry = n; v.sec = alvo.i; pending[d.id] += n; v.state = "go";
    const a = corredorPara(P.whDoor.x, sh.cx); v.aisle = a;
    v.path = [{ x: a, y: P.whDoor.y + 6 }, { x: a, y: sh.top }, { x: sh.cx + 22, y: sh.top }];
  } else if (v.state === "go") {
    if (follow(v, sp, dt)) {
      const d = SECTORS[v.sec], st = S.sec[d.id], put = Math.min(v.carry, shelfCap(st.shelfLvl) - st.shelf);
      if (put) markPop(v.sec, st.shelf, st.shelf + put);
      st.shelf += put; pending[d.id] -= v.carry; v.carry -= put; v.state = "back";
      v.path = [{ x: v.aisle, y: SHELVES[v.sec].top }, { x: v.aisle, y: P.whDoor.y + 6 }, { x: P.whDoor.x, y: P.whDoor.y + 6 }];
    }
  } else if (v.state === "back") {
    if (follow(v, sp, dt)) { if (v.carry) S.sec[SECTORS[v.sec].id].wh += v.carry; v.carry = 0; v.sec = null; v.state = "idle"; }
  }
}

// ---------- efeitos dos responsáveis ----------
let tLider = 0, tFiscal = 0, tDecide = 0;
function tickEquipe(dt) {
  const e = eq();
  syncVolantes();
  // fiscal em modo automático: olha filas e gôndolas a cada 3 s e move um volante por vez
  if (e.fiscal && e.auto) {
    tDecide += dt;
    if (tDecide >= EQ.fiscalDecide || autoCaixa == null) {
      tDecide = 0; const n = nCaixas(), filas = LANES.slice(0, n).reduce((a, _, l) => a + laneQueue(l).length, 0) / Math.max(1, n);
      const ess = CFG.essenciais.filter(id => S.sec[id].open), vaz = ess.filter(id => S.sec[id].shelf === 0).length / Math.max(1, ess.length);
      const lim = Math.min(e.volantes - papelEntrega(), vagasCaixaVolante());
      if (autoCaixa == null) autoCaixa = Math.min(lim, isRush() ? e.plano.pico : e.plano.normal);
      if (filas >= 2.2 && vaz < 0.34 && autoCaixa < lim) autoCaixa++;
      else if ((vaz >= 0.2 || filas <= 0.6) && autoCaixa > 0) autoCaixa--;
    }
  } else autoCaixa = null;
  distribuirPapeis();
  volantes.forEach(v => passoVolante(v, dt));
  // líderes de setor repõem à mão
  tLider += dt;
  if (tLider >= EQ.liderRepoe) {
    tLider = 0;
    SHELVES.forEach((sh, i) => { const d = SECTORS[i], st = S.sec[d.id];
      if (e.lideres[d.id] && st.open && st.wh > 0 && st.shelf < shelfCap(st.shelfLvl) * EQ.liderAte) { markPop(i, st.shelf, st.shelf + 1); st.wh--; st.shelf++; } });
  }
  // fiscal recolhe uma cesta parada nos caixas a cada 5 s
  if (e.fiscal) { tFiscal += dt; if (tFiscal >= EQ.fiscalCestas) { tFiscal = 0; const l = piles.findIndex((p, k) => k < LANES.length && p.b + p.c > 0);
    if (l >= 0) { const p = piles[l], dest = ENT2 && station2.b + station2.c < station.b + station.c ? station2 : station; if (p.c > 0) { p.c--; dest.c++; } else { p.b--; dest.b++; } } } }
  // métricas do dia e do pico
  const h = e.hoje;
  if (isRush()) {
    h.pT += dt; const ess = CFG.essenciais.filter(id => S.sec[id].open);
    if (ess.length) h.pVazio += dt * ess.filter(id => S.sec[id].shelf === 0).length / ess.length;
    h.naCaixaT += dt * caixasDeVolante();
  }
}
function atendidoEquipe(c) {
  const h = eq().hoje; h.filaSoma += c.qWait || 0; h.filaN++;
  if (isRush()) { h.pFilaSoma += c.qWait || 0; h.pFilaN++; h.pServed++; }
}
const perdasNoPico = { n: 0 };
// ---------- fim do dia: tempo de fila, custo da equipe e resultado do pico ----------
const metaPico = { vazio: 0.15, fila: 7, perdidos: 0.12 };
function fimDoDiaEquipe(L) {
  const e = eq(), h = e.hoje;
  L.filaMedia = h.filaN ? h.filaSoma / h.filaN : 0;
  L.custoEquipe = wages(); L.custoPct = L.sales > 0 ? L.custoEquipe / L.sales : 1;
  e.custos.push(Math.round(L.custoPct * 1000) / 1000); while (e.custos.length > 3) e.custos.shift();
  e.filas.push(Math.round(L.filaMedia * 10) / 10); while (e.filas.length > 3) e.filas.shift();
  if (h.pT > 1) {
    const pv = h.pVazio / h.pT, pf = h.pFilaN ? h.pFilaSoma / h.pFilaN : 0, pl = h.pServed + h.pLost ? h.pLost / (h.pServed + h.pLost) : 0;
    const ok = pv <= metaPico.vazio && pf <= metaPico.fila && pl <= metaPico.perdidos;
    const pico = { dia: L.day, vazio: pv, fila: pf, perdidos: pl, ok, volCaixa: h.naCaixaT / h.pT, motivo: ok ? "Pico bem atendido" : pv > metaPico.vazio ? "gôndolas vazias demais no pico" : pf > metaPico.fila ? "fila longa no pico" : "muitos clientes perdidos no pico" };
    e.picos.unshift(pico); e.picos.length = Math.min(e.picos.length, 5); if (ok) e.picosOk++;
    L.pico = pico;
    setTimeout(() => banner(ok ? "⏱️ Pico bem atendido!" : `⏱️ Pico: ${pico.motivo}`, ok ? "#2e7a57" : "#b7773b"), 3400);
  }
  e.hoje = novoHojeEq(); autoCaixa = null;
}

// ---------- ações: nomear, dispensar, contratar volantes, plano do pico ----------
function pagarContratacao(v, oque) {
  if (S.money < v || S.money < 0) { toast(`Falta dinheiro: ${oque} custa M ${fmt(v)} (contratação e treinamento).`); return false; }
  S.money -= v; S.today.outrasDesp = (S.today.outrasDesp || 0) + v; return true;
}
function nomear(papel, sec) {
  const e = eq();
  if (papel === "encarregado") { if (e.encarregado) { e.encarregado = false; toast("Encarregado dispensado: os repositores voltam a cuidar só do próprio setor."); }
    else if (pagarContratacao(EQ.encarregado.contratar, "o encarregado")) { e.encarregado = true; banner("📋 Encarregado de reposição nomeado", "#1f5fa8"); } }
  else if (papel === "fiscal") { if (e.fiscal) { e.fiscal = false; e.auto = false; toast("Fiscal dispensado: o plano dos volantes volta a ser fixo."); }
    else if (pagarContratacao(EQ.fiscal.contratar, "o fiscal")) { e.fiscal = true; banner("🧾 Fiscal de frente de loja nomeado", "#1f5fa8"); } }
  else if (papel === "lider" && sec) { if (e.lideres[sec]) { delete e.lideres[sec]; toast(`Líder de ${nomeSetor(sec)} dispensado.`); }
    else if (pagarContratacao(EQ.lider.contratar, "o líder")) { e.lideres[sec] = true; banner(`⭐ Líder de ${nomeSetor(sec)} nomeado`, "#1f5fa8"); } }
  anunciar(`Equipe atualizada. Salários dos responsáveis: M ${fmt(salariosEquipe())} por dia.`);
  save(); lastSig = ""; renderSheet();
}
function mudarVolantes(d) {
  const e = eq();
  if (d > 0) { if (e.volantes >= EQ.volante.max) { toast(`No máximo ${EQ.volante.max} volantes.`); return; } if (!pagarContratacao(EQ.volante.contratar, "um volante")) return; e.volantes++; }
  else if (e.volantes > 0) e.volantes--;
  e.plano.normal = Math.min(e.plano.normal, e.volantes); e.plano.pico = Math.min(e.plano.pico, e.volantes);
  syncVolantes(); save(); lastSig = ""; renderSheet();
}
function mudarPlano(qual, d) {
  const e = eq(); e.plano[qual] = Math.max(0, Math.min(e.volantes, e.plano[qual] + d)); e.planoDefinido = true;
  anunciar(`${qual === "pico" ? "No pico" : "Fora do pico"}: ${e.plano[qual]} volante${e.plano[qual] === 1 ? "" : "s"} no caixa.`);
  save(); lastSig = ""; renderSheet();
}
function alternarAutoFiscal() { const e = eq(); if (!e.fiscal) return; e.auto = !e.auto; e.planoDefinido = true; autoCaixa = null; toast(e.auto ? "O fiscal decide sozinho: volantes vão para o caixa quando a fila cresce e voltam quando as gôndolas esvaziam." : "Plano fixo: volantes seguem o que você definiu."); save(); lastSig = ""; renderSheet(); }

// ---------- desenho: volantes, líderes, encarregado e fiscal ----------
function pessoasEquipe() {
  const e = eq(), out = volantes.filter(v => !(v.papel === "caixa" && v.state === "caixa"));
  SHELVES.forEach((sh, i) => { const d = SECTORS[i]; if (e.lideres[d.id] && S.sec[d.id].open) out.push({ lider: true, id: 760 + i, x: sh.x + sh.w + 2, y: sh.y + 36, cor: d.color, skin: SKIN[i % SKIN.length], hair: HAIR[(i + 1) % HAIR.length] }); });
  if (e.encarregado) out.push({ enc: true, id: 790, x: P.whDoor.x + 26, y: P.whDoor.y + 18, skin: SKIN[2], hair: HAIR[4] });
  if (e.fiscal) out.push({ fiscal: true, id: 791, x: LANES[0].x - 54, y: FZ + 98, skin: SKIN[3], hair: HAIR[1] });
  return out;
}
function desenharPessoaEquipe(v) {
  if (v.lider) { person(v, { body: "#f4efe2", apron: v.cor, cap: "#1f5fa8" }); rr(v.x - 7, v.y - 34, 14, 9, 4, "#1f5fa8"); text("L", v.x, v.y - 27.5, 7, "#fff"); return; }
  if (v.enc) { person(v, { body: "#1f5fa8", cap: "#f2b233" }); rr(v.x + 6, v.y - 6, 7, 9, 1.5, "#fff"); rr(v.x - 13, v.y - 36, 26, 9, 4, "#1f5fa8"); text("ENCARR.", v.x, v.y - 29.5, 5.6, "#fff"); return; }
  if (v.fiscal) { person(v, { body: "#2a4f7a", cap: "#2a4f7a" }); rr(v.x - 11, v.y - 36, 22, 9, 4, "#2a4f7a"); text("FISCAL", v.x, v.y - 29.5, 5.6, "#fff"); return; }
  person(v, { body: "#6b3fa0", cap: "#f2b233", moving: v.path.length > 0, box: v.carry && v.sec != null ? SECTORS[v.sec].ic : v.pedido ? "🛍️" : null });
  rr(v.x - 9, v.y - 36, 18, 8, 4, "#6b3fa0"); text("VOL", v.x, v.y - 30, 5.6, "#fff");
}

// ---------- painel ----------
const pctTxt = v => `${Math.round(v * 100)}%`;
function cartaoEquipe() {
  const c = el("div", "card");
  c.innerHTML = `<h3>👥 Equipe e responsáveis</h3><p class="note" id="eqRes"></p>`;
  live(() => { const e = eq(), q = c.querySelector("#eqRes"); if (!q) return;
    q.textContent = `${e.encarregado ? "Encarregado ✔" : "Sem encarregado"} · ${nLideres()} líder${nLideres() === 1 ? "" : "es"} · ${e.fiscal ? "fiscal ✔" : "sem fiscal"} · ${e.volantes} volante${e.volantes === 1 ? "" : "s"} (${caixasDeVolante()} no caixa agora). Equipe hoje: M ${fmt(wages())}${S.today.sales > 0 ? `, ${pctTxt(wages() / S.today.sales)} das vendas até agora` : ""}.`; });
  const b = el("button", "btn", "Organizar a equipe"); b.onclick = () => openSheet("equipe"); c.appendChild(b);
  return c;
}
function passo(rotulo, valorFn, menos, mais, nome) {
  const r = el("div", "passo", `<span></span><button class="icon-btn" aria-label="Diminuir: ${nome}">−</button><b aria-live="off"></b><button class="icon-btn" aria-label="Aumentar: ${nome}">+</button>`);
  r.querySelector("span").textContent = rotulo;
  const [bm, bp] = r.querySelectorAll("button"); bm.onclick = menos; bp.onclick = mais;
  live(() => { r.querySelector("b").textContent = valorFn(); });
  return r;
}
function buildEquipe(body) {
  const e = eq();
  head("👥", "#dfe8f4", "Equipe e responsáveis", () => `Salários de hoje: M ${fmt(wages())} · ${isRush() ? "PICO agora" : "fora do pico"}`);
  body.appendChild(el("p", "note", "Delegar custa salário, mas libera você: cada responsável faz uma parte da gestão sozinho. No pico, decida se os volantes vão abrir caixas ou repor gôndolas."));
  body.appendChild(statsBox([
    ["Fila média hoje", () => { const h = eq().hoje; return h.filaN ? `${(h.filaSoma / h.filaN).toFixed(1).replace(".", ",")} s` : "—"; }],
    ["Caixas abertos", () => `${nCaixas()} de ${LANES.length}`],
    ["Gôndolas vazias", () => { const ess = CFG.essenciais.filter(id => S.sec[id].open); return `${ess.filter(id => S.sec[id].shelf === 0).length} de ${ess.length}`; }],
    ["Equipe / vendas hoje", () => S.today.sales > 0 ? pctTxt(wages() / S.today.sales) : "—"],
  ]));
  // responsáveis
  body.appendChild(el("div", "sec-title", "Responsáveis"));
  const papel = (ic, nome, efeito, ativo, cfg, fn) => {
    const c = el("div", "card", `<h3>${ic} ${nome} ${ativo ? '<span class="tag bom">nomeado</span>' : '<span class="tag">vago</span>'}</h3><p class="note">${efeito}</p><p class="note">Contratação M ${fmt(cfg.contratar)} · salário M ${fmt(cfg.salario)} por dia</p>`);
    const b = el("button", ativo ? "plain" : "btn", ativo ? `<span>Dispensar (o salário deixa de ser cobrado)</span>` : `Nomear por M ${fmt(cfg.contratar)}`);
    b.onclick = fn; c.appendChild(b); return c;
  };
  body.appendChild(papel("📋", "Encarregado de reposição", "Quem está sem serviço no próprio setor vai repor a gôndola mais vazia da loja. Aparece perto do depósito com a prancheta.", e.encarregado, EQ.encarregado, () => nomear("encarregado")));
  body.appendChild(papel("🧾", "Fiscal de frente de loja", "Pode decidir sozinho quantos volantes vão para os caixas, recolhe cestas paradas e segura a fila (+3 s de paciência).", e.fiscal, EQ.fiscal, () => nomear("fiscal")));
  const lc = el("div", "card", `<h3>⭐ Líderes de setor (${nLideres()})</h3><p class="note">O líder repõe à mão quando a gôndola dele baixa da metade e acalma quem espera (+3 s de paciência). Contratação M ${fmt(EQ.lider.contratar)} · M ${fmt(EQ.lider.salario)} por dia cada.</p>`);
  const g = el("div", "linha2");
  openSectors().forEach(d => { const on = !!e.lideres[d.id], b = el("button", "plain mini toggle", `<span>${d.ic} ${d.name}${on ? " · líder" : ""}</span>`); b.setAttribute("aria-pressed", String(on)); b.onclick = () => nomear("lider", d.id); g.appendChild(b); });
  lc.appendChild(g); body.appendChild(lc);
  // volantes e plano do pico
  body.appendChild(el("div", "sec-title", "Volantes e plano do pico"));
  const vc = el("div", "card", `<p class="note">Cada volante abre um caixa extra (há ${vagasCaixaVolante()} caixa${vagasCaixaVolante() === 1 ? "" : "s"} sem operador fixo) ou repõe qualquer setor. Contratação M ${fmt(EQ.volante.contratar)} · M ${fmt(EQ.volante.salario)} por dia cada.</p>`);
  vc.appendChild(passo("Volantes contratados", () => `${eq().volantes}`, () => mudarVolantes(-1), () => mudarVolantes(1), "volantes"));
  vc.appendChild(passo("Fora do pico: no caixa", () => `${eq().plano.normal}`, () => mudarPlano("normal", -1), () => mudarPlano("normal", 1), "volantes no caixa fora do pico"));
  vc.appendChild(passo("No pico: no caixa", () => `${eq().plano.pico}`, () => mudarPlano("pico", -1), () => mudarPlano("pico", 1), "volantes no caixa no pico"));
  const st = el("p", "note"); live(() => { const n = volantes.length, c = volantes.filter(v => v.papel === "caixa").length, s = volantes.filter(v => v.papel === "separar").length;
    st.textContent = n ? `Agora: ${c} no caixa, ${n - c - s} repondo${s ? `, ${s} separando pedidos` : ""}.` : "Nenhum volante contratado."; });
  vc.appendChild(st);
  if (e.fiscal) { const ba = el("button", "plain toggle", `<span>Fiscal decide sozinho (automático): <b>${e.auto ? "ligado" : "desligado"}</b></span>`); ba.setAttribute("aria-pressed", String(e.auto)); ba.onclick = alternarAutoFiscal; vc.appendChild(ba); }
  else vc.appendChild(el("p", "note", "Com um fiscal nomeado, o plano pode ser automático."));
  vc.appendChild(el("p", "note", "Mais gente no caixa encurta a fila, mas as gôndolas esvaziam mais rápido. Mais gente repondo mantém tudo cheio, mas a fila cresce no pico."));
  body.appendChild(vc);
  // resultados
  body.appendChild(el("div", "sec-title", "Horários de pico"));
  if (!e.picos.length) body.appendChild(el("p", "note", `O pico começa às ${8 + Math.round(12 * RUSH[0])}h. Conta como bem atendido com gôndolas essenciais vazias até ${pctTxt(metaPico.vazio)} do tempo, fila média até ${metaPico.fila} s e até ${pctTxt(metaPico.perdidos)} de clientes perdidos.`));
  e.picos.forEach(p => body.appendChild(el("div", "card", `<div class="req"><span>${p.ok ? "✅" : "❌"} Dia ${p.dia}: ${p.motivo}</span></div><p class="note">Vazias ${pctTxt(p.vazio)} · fila ${p.fila.toFixed(1).replace(".", ",")} s · perdidos ${pctTxt(p.perdidos)} · em média ${p.volCaixa.toFixed(1).replace(".", ",")} volante(s) no caixa</p>`)));
  const L = S.lastDay;
  if (L && L.custoEquipe != null) body.appendChild(el("p", "note", `Ontem (dia ${L.day}): fila média ${L.filaMedia.toFixed(1).replace(".", ",")} s, equipe M ${fmt(L.custoEquipe)} = ${pctTxt(L.custoPct)} das vendas.`));
}

// ---------- capítulo 4: configuração ----------
const DEL_CFG = { filaMax: 6, custoMax: 0.22, picos: 3 };
FASE_CFG.restinga = {
  capitulo: 4, titulo: "Supermercado Restinga", lugar: "Centro",
  resumo: "Supermercado do Centro com duas entradas: a do estacionamento (carros, carrinhos e compras maiores) e a da avenida (gente a pé e do ônibus, compras rápidas).",
  intro: "Agora você <b>delega</b>: nomeie um encarregado de reposição, líderes de setor e um fiscal de frente de loja, e contrate volantes. Cada um custa salário e faz parte da gestão sozinho. No <b>horário de pico</b>, escolha quantos volantes abrem caixas extras e quantos repõem gôndolas. As metas medem a qualidade do serviço e o custo da equipe. Os fornecedores do Ipê continuam atendendo: o caminhão automático volta ao preço normal, e a Serra segue 25% mais barata.",
  essenciais: ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria", "acougue"],
  dia: { vazioMax: 0.15, perdidosMax: 0.08, repMin: 3.9 },
  diasSeguidos: 3, lucroMedio: 260, fornecedores: "leve",
  aluguel: 120, fluxo: 1.25,
  aberturas: { frios: 3000, limpeza: 5000 },
  convite: {
    responsabilidades: "duas entradas com públicos diferentes, nomear responsáveis (reposição, setores e frente de loja), plano dos volantes no horário de pico e metas de qualidade do serviço e custo da equipe.",
    comeca: "orçamento de M 3.500, seis setores abertos, depósito para 136 caixas, 2 caixas fixos de 4, 32 cestas e carrinhos divididos entre as duas entradas, 2 carrinheiros treinados e 8 vagas livres.",
  },
  estrutura: [
    { id: "encarregado", label: "Nomear o encarregado de reposição", como: "Aba Carreira > Organizar a equipe. Ele faz quem está parado ajudar a gôndola mais vazia.", have: () => eq().encarregado ? 1 : 0, need: 1, painel: "equipe" },
    { id: "lideres", label: "Nomear líderes em 2 setores", como: "Escolha os setores que mais esvaziam (veja o relatório do dia).", have: () => nLideres(), need: 2, painel: "equipe" },
    { id: "fiscal", label: "Nomear o fiscal de frente de loja", como: "Ele pode decidir sozinho onde ficam os volantes e recolhe cestas paradas.", have: () => eq().fiscal ? 1 : 0, need: 1, painel: "equipe" },
    { id: "volantes", label: "Contratar 2 volantes e definir o plano do pico", como: "Escolha quantos vão ao caixa fora do pico e no pico, ou deixe o fiscal decidir.", have: () => Math.min(2, eq().volantes) * (eq().planoDefinido ? 1 : 0.5), need: 2, painel: "equipe" },
  ],
  extras() {
    const e = eq(), med = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    return [
      { id: "picos", label: `${DEL_CFG.picos} horários de pico bem atendidos`, tipo: "gestao", have: e.picosOk, need: DEL_CFG.picos,
        como: `No pico (das ${8 + Math.round(12 * RUSH[0])}h às ${8 + Math.round(12 * RUSH[1])}h): gôndolas essenciais vazias até ${pctTxt(metaPico.vazio)} do tempo, fila média até ${metaPico.fila} s e até ${pctTxt(metaPico.perdidos)} de perdidos. Não precisam ser seguidos.` },
      { id: "custo", label: `Custo da equipe até ${pctTxt(DEL_CFG.custoMax)} das vendas (média de 3 dias)`, tipo: "gestao", pct: true, inverso: true,
        have: e.custos.length >= 3 && med(e.custos) <= DEL_CFG.custoMax ? 1 : 0, need: 1,
        
        mostra: () => e.custos.length ? `${pctTxt(med(e.custos))} (${e.custos.length} de 3 dias)` : "sem dias fechados",
        como: "Salários de todos (repositores, caixas, carrinheiros, responsáveis e volantes) divididos pelas vendas do dia. Delegar demais encarece; de menos, o serviço cai." },
    ];
  },
  diaComo: () => `Um dia conta quando: gôndolas essenciais vazias até 15% do tempo, até 8% de clientes perdidos, fila média até ${DEL_CFG.filaMax} s, custo da equipe até ${pctTxt(DEL_CFG.custoMax)} das vendas, reputação de pelo menos 3,9 e nenhuma dívida.`,
  avaliar(itens, L) {
    const e = eq(), h = e.hoje, fila = h.filaN ? h.filaSoma / h.filaN : 0, custo = L.sales > 0 ? wages() / L.sales : 1;
    itens.push({ ok: fila <= DEL_CFG.filaMax, txt: `Fila média ${fila.toFixed(1).replace(".", ",")} s (máx. ${DEL_CFG.filaMax} s)` });
    itens.push({ ok: custo <= DEL_CFG.custoMax, txt: `Custo da equipe ${pctTxt(custo)} das vendas (máx. ${pctTxt(DEL_CFG.custoMax)})` });
  },
  fimDoDia(L) { fimDoDiaEquipe(L); },
  tick(dt) { tickEquipe(dt); },
  cartoes() { return [cartaoEquipe()]; },
  missao() {
    const e = eq();
    if (!e.encarregado && !e.fiscal && !nLideres() && !e.volantes) return { title: "Organizar a equipe", sub: "Nomeie responsáveis e contrate volantes (aba Carreira)", p: 0, ring: "👥", go: () => openSheet("equipe") };
    return null;
  },
  orcamento: 3500,
  inicio() {
    S.tier = 1; S.money = this.orcamento; S.whLvl = 4; S.cashiers = 2;
    this.essenciais.forEach(id => { const st = S.sec[id]; st.open = true; st.staff = 1; st.shelfLvl = 2; st.shelf = shelfCap(st.shelfLvl); st.wh = 8; });
    S.gear.baskets = 22; S.gear.carts = 10; S.gear.collectors = 2; S.gear.colLvl = 2; S.park.price = 0;
    S.equipe = novaEquipe();
    const r = CARREIRA && CARREIRA.repCarreira ? CARREIRA.repCarreira : 3;
    S.rep = Math.max(3, Math.min(3.5, 3 + (r - 3.5) * 0.5));
    ACH.forEach(a => { if (a.ok()) S.ach[a.id] = true; });
  },
  carregar() { eq(); },
  reabrir(r) { const e = eq(); e.encarregado = true; e.fiscal = true; e.lideres = { mercearia: true, bebidas: true }; e.volantes = 2; e.planoDefinido = true; e.picosOk = 3; reabrirComum(r); },
  reaberturaTxt: "responsáveis nomeados, 2 volantes e o orçamento inicial do Restinga (M 3.500)",
  previa: () => `<svg viewBox="0 0 220 120" class="previa" role="img" aria-label="Esquema do Supermercado Restinga: duas entradas, uma pelo estacionamento à esquerda e outra pela avenida à direita, quatro fileiras de gôndolas e quatro caixas no meio">
    <rect width="220" height="120" rx="10" fill="#c3c7c6"/><rect y="22" width="220" height="10" fill="#7f878c"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${6 + i * 43}" y="4" width="40" height="16" rx="2" fill="${["#3f74b8", "#d9822b", "#2e7a57", "#b5487a", "#8a5cc2"][i]}"/>`).join("")}
    <rect x="30" y="36" width="160" height="66" rx="4" fill="#f3f3ef" stroke="#1f5fa8" stroke-width="1.5"/>
    <rect x="36" y="38" width="60" height="10" rx="2" fill="#1f5fa8"/><rect x="112" y="38" width="72" height="12" rx="2" fill="#8e7350"/>
    ${[0, 1, 2, 3].map(c => [0, 1].map(r => `<rect x="${36 + c * 38}" y="${55 + r * 13}" width="32" height="6" rx="1.5" fill="#b89a6c"/>`).join("")).join("")}
    ${[0, 1, 2, 3].map(i => `<rect x="${66 + i * 22}" y="88" width="12" height="6" rx="1.5" fill="#4b5a62"/>`).join("")}
    <rect x="24" y="78" width="6" height="14" fill="#1f5fa8"/><rect x="190" y="78" width="6" height="14" fill="#1f5fa8"/>
    <text x="10" y="100" font-size="7" font-weight="800" fill="#1f5fa8">estac.</text><text x="194" y="74" font-size="7" font-weight="800" fill="#1f5fa8">avenida</text>
    <rect x="30" y="104" width="150" height="13" rx="3" fill="#9aa3a6"/></svg>`,
};

if (EQ_ATIVO) {
  GANCHOS.caixasExtra = () => caixasDeVolante();
  GANCHOS.salarios = () => salariosEquipe() + (GANCHOS.salariosEntrega ? GANCHOS.salariosEntrega() : 0);
  GANCHOS.aluguel = () => CFG && CFG.aluguel != null ? CFG.aluguel : tierNow().rent;
  GANCHOS.fluxo = () => CFG && CFG.fluxo ? CFG.fluxo : 1;
  GANCHOS.ajudaRepositor = w => { if (!eq().encarregado) return null; const a = setorMaisVazio(w.sec); return a.i != null && a.p < 0.5 ? a.i : null; };
  GANCHOS.paciencia = sec => eq().lideres[SECTORS[sec].id] ? EQ.paciencia : 0;
  GANCHOS.pacienciaFila = () => eq().fiscal ? EQ.paciencia : 0;
  GANCHOS.atendido = c => atendidoEquipe(c);
  GANCHOS.pessoas = () => pessoasEquipe().concat(GANCHOS.pessoasExtra ? GANCHOS.pessoasExtra() : []);
  GANCHOS.desenharPessoa = v => v.desenhar ? v.desenhar(v) : desenharPessoaEquipe(v);
  const asOld = GANCHOS.assinatura;
  GANCHOS.assinatura = () => { const e = eq(); return `${e.encarregado}${e.fiscal}${e.auto}${Object.keys(e.lideres).join(",")}${e.volantes}${e.plano.normal}${e.plano.pico}${e.picos.length}` + (asOld ? asOld() : ""); };
  PAINEIS.equipe = buildEquipe;
}
// perdas no pico (cliente que vai embora irritado durante o pico)
if (EQ_ATIVO) { const _la = leaveAngry; leaveAngry = function (c, why) { if (isRush()) eq().hoje.pLost++; return _la(c, why); }; }
