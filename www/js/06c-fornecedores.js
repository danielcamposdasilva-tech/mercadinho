"use strict";
// =====================================================================
// Capítulo 3 (Supermercado Ipê): negociação com fornecedores.
// - Duas ofertas por setor, fáceis de comparar: Distribuidora Ligeira (lote pequeno, preço cheio,
//   entrega no mesmo dia) e Atacado Serra (lote grande, 25% de desconto, entrega em 2 dias, ocupa
//   mais depósito). Custo total, quantidade, prazo e espaço aparecem antes de confirmar.
// - O pedido é pago na hora e reserva espaço no depósito até chegar. Pedidos pendentes ficam no
//   estado da loja (S.forn): sobrevivem a troca de loja, fechar o app e progresso offline.
// - A reposição automática do distribuidor continua como emergência: só até 6 caixas por setor
//   e 30% mais cara. Pode ser desligada.
// - Margem: cada setor guarda o custo médio da mercadoria (st.cu); a venda soma o custo do que saiu.
// - Compra ruim tem conserto: perecíveis parados perdem 10% por dia, e dá para repassar excedente
//   (metade do custo), cancelar pedido a caminho (multa de 20%) ou fazer promoção.
// Fora do capítulo 3 nada daqui roda: fornAtivo() é falso e os ganchos não mexem em nada.
// 1.6: nos capítulos 4 e 5 (fornecedores: "leve") a Ligeira e a Serra continuam atendendo, mas o caminhão
// automático segue como antes (preço normal, enche o depósito) e perecíveis não estragam: negociar é uma
// ferramenta para economizar e se preparar para o pico, não uma obrigação nova. fornCompleto() só no Ipê.
// =====================================================================
const FORN = {
  ligeira: { id: "ligeira", nome: "Distribuidora Ligeira", pedir: "Pedir à Ligeira", ic: "🚐", cor: "#3f74b8", lote: 30, fator: 1, prazo: 30,
    prazoTxt: "no mesmo dia (cerca de 4 h de jogo)", resumo: "Lote pequeno, entrega rápida, preço cheio" },
  serra: { id: "serra", nome: "Atacado Serra", pedir: "Pedir ao Serra", ic: "🚛", cor: "#b7773b", lote: 90, fator: 0.75, prazo: 180,
    prazoTxt: "em 2 dias de jogo", resumo: "Desconto de 25% por volume, entrega demorada, ocupa mais depósito" },
};
const FORN_CFG = { fatorAuto: 1.3, emergencia: 6, multa: 0.2, repasse: 0.5, repasseLote: 10, validade: 0.15, maxPendentes: 8 };
const PERECIVEIS = new Set(["hortifruti", "laticinios", "padaria", "acougue", "frios"]);
const fornAtivo = () => NA_CARREIRA && !!CFG && !!CFG.fornecedores;
const fornCompleto = () => fornAtivo() && CFG.fornecedores === true;     // Ipê: caminhão só de emergência, mais caro, e validade
const fatorCaminhao = () => fornCompleto() ? FORN_CFG.fatorAuto : 1;
const tAbs = () => (S.day - 1) * DAY_LEN + S.dayT;          // tempo de jogo da loja, em segundos
const secDef = id => SECTORS.find(d => d.id === id);
const pct = v => `${Math.round(v * 100)}%`;
function fornEstado() {
  if (!S.forn) S.forn = fornNovo();
  const f = S.forn; f.pedidos = f.pedidos || []; f.recebidos = Object.assign({ ligeira: 0, serra: 0 }, f.recebidos || {});
  if (f.auto === undefined) f.auto = true; f.hist = f.hist || []; f.seq = f.seq || 1; return f;
}
const reservado = () => fornAtivo() ? fornEstado().pedidos.reduce((a, p) => a + p.qtd, 0) : 0;
const livreDeposito = () => whCap(S.whLvl) - whUsed() - reservado();
function custoUnit(d, st) { if (!(st.cu > 0)) st.cu = boxCost(d, st.priceLvl); return st.cu; }
// mercadoria que entra no setor: atualiza o custo médio do que está na loja (depósito, gôndola e mãos dos repositores)
function entrouEstoque(d, k, unit) {
  const st = S.sec[d.id], tem = Math.max(0, st.wh + st.shelf + (pending[d.id] || 0)), cu = custoUnit(d, st);
  st.cu = Math.round((cu * tem + unit * k) / Math.max(1, tem + k) * 10000) / 10000;
}
function fornVenda(sec, n) { const d = SECTORS[sec], st = S.sec[d.id]; S.today.cmv = (S.today.cmv || 0) + n * custoUnit(d, st); }

// ---------- ofertas, recusas e pedidos ----------
function oferta(fid, secId) {
  const fo = FORN[fid], d = secDef(secId), st = S.sec[secId];
  const unit = Math.round(boxCost(d, st.priceLvl) * fo.fator * 100) / 100, total = Math.round(unit * fo.lote * 100) / 100, venda = secPrice(d, st.priceLvl);
  return { fo, d, st, unit, total, qtd: fo.lote, venda, margem: 1 - unit / venda, prazo: fo.prazo, espaco: fo.lote, perecivel: PERECIVEIS.has(secId) };
}
function motivoRecusa(o) {
  const livre = livreDeposito();
  if (!o.st.open) return { tipo: "setor", curto: "Setor fechado", txt: `${o.d.name} ainda está fechado. Abra o setor antes de comprar mercadoria para ele.` };
  if (S.money < 0) return { tipo: "dinheiro", curto: "Caixa no vermelho", txt: `Pedido recusado: o caixa está no vermelho (−M ${fmt(-S.money)}). Os fornecedores só vendem à vista; saia da dívida antes de comprar.` };
  if (S.money < o.total) return { tipo: "dinheiro", curto: `Faltam M ${fmt(o.total - S.money)}`, txt: `Pedido recusado por falta de dinheiro: o lote custa M ${fmt(o.total)} e o caixa tem M ${fmt(S.money)}. Faltam M ${fmt(o.total - S.money)}. Venda mais, repasse excedente ou escolha o lote menor.` };
  if (o.espaco > livre) return { tipo: "espaco", curto: `Só ${Math.max(0, livre)} caixas livres`, txt: `Pedido recusado por falta de espaço: o lote ocupa ${o.espaco} caixas e o depósito tem ${Math.max(0, livre)} livres (capacidade ${whCap(S.whLvl)}, ${whUsed()} ocupadas, ${reservado()} reservadas para pedidos a caminho). Amplie o depósito, repasse excedente, espere vender ou escolha o lote menor.` };
  if (fornEstado().pedidos.length >= FORN_CFG.maxPendentes) return { tipo: "limite", curto: "Muitos pedidos a caminho", txt: `Já há ${FORN_CFG.maxPendentes} pedidos a caminho. Espere algum chegar antes de pedir de novo.` };
  return null;
}
function fazerPedido(fid, secId) {
  if (!fornAtivo() || !FORN[fid] || !S.sec[secId]) return { ok: false };
  const o = oferta(fid, secId), r = motivoRecusa(o), f = fornEstado();
  if (r) { f.recusas++; anunciar(r.txt); return Object.assign({ ok: false }, r); }
  S.money -= o.total; S.today.goods += o.total;
  const p = { id: f.seq++, forn: fid, sec: secId, qtd: o.qtd, unit: o.unit, custo: o.total, feito: tAbs(), chega: tAbs() + o.prazo, feitoEm: Date.now() };
  f.pedidos.push(p);
  banner(`${o.fo.ic} Pedido: ${o.qtd} caixas de ${o.d.name}`, o.fo.cor);
  anunciar(`Pedido confirmado: ${o.qtd} caixas de ${o.d.name} da ${o.fo.nome}, M ${fmt(o.total)}, chega ${quandoChega(p)}.`);
  save(); lastSig = ""; renderSheet(); return { ok: true, pedido: p };
}
function receberPedido(p, quieto) {
  const f = fornEstado(), d = secDef(p.sec), st = S.sec[p.sec];
  f.pedidos = f.pedidos.filter(x => x.id !== p.id);
  entrouEstoque(d, p.qtd, p.unit); st.wh += p.qtd;
  f.recebidos[p.forn] = (f.recebidos[p.forn] || 0) + 1;
  f.hist.unshift({ id: p.id, forn: p.forn, sec: p.sec, qtd: p.qtd, custo: p.custo, dia: S.day, fora: !!quieto }); f.hist.length = Math.min(f.hist.length, 6);
  if (!quieto) {
    docaChegada(p); banner(`📦 Chegou: ${p.qtd} caixas de ${d.name}`, "#1f7a3a");
    anunciar(`Chegou o pedido da ${FORN[p.forn].nome}: ${p.qtd} caixas de ${d.name} no depósito.`);
    lastSig = "";
  }
}
function fornTick() { if (!fornAtivo()) return; const t = tAbs(); fornEstado().pedidos.slice().forEach(p => { if (p.chega <= t) receberPedido(p); }); }
// ao voltar para a loja: pedidos cujo prazo passou durante a ausência (o tempo de jogo já avançou no offline)
function fornAoVoltar() { if (!fornAtivo()) return []; const t = tAbs(), out = []; fornEstado().pedidos.slice().forEach(p => { if (p.chega <= t) { receberPedido(p, true); out.push(p); } }); return out; }
function cancelarPedido(id) {
  const f = fornEstado(), p = f.pedidos.find(x => x.id === id); if (!p) return false;
  const volta = Math.round(p.custo * (1 - FORN_CFG.multa) * 100) / 100;
  f.pedidos = f.pedidos.filter(x => x.id !== id);
  S.money += volta; S.today.goods -= volta; S.today.perdas = (S.today.perdas || 0) + (p.custo - volta);
  toast(`Pedido cancelado: voltaram M ${fmt(volta)} (multa de ${pct(FORN_CFG.multa)}).`); anunciar(`Pedido cancelado. Voltaram M ${fmt(volta)}.`);
  save(); lastSig = ""; renderSheet(); return true;
}
function repassar(secId) {
  const d = secDef(secId), st = S.sec[secId], n = Math.min(FORN_CFG.repasseLote, st.wh); if (!fornAtivo() || n <= 0) return false;
  const cu = custoUnit(d, st), v = Math.round(n * cu * FORN_CFG.repasse * 100) / 100;
  st.wh -= n; S.money += v; S.today.goods -= v; S.today.perdas = (S.today.perdas || 0) + (n * cu - v);
  toast(`Repassadas ${n} caixas de ${d.name} por M ${fmt(v)}.`); anunciar(`Repassadas ${n} caixas de ${d.name} por M ${fmt(v)}.`);
  save(); lastSig = ""; renderSheet(); return true;
}
function alternarAuto() { const f = fornEstado(); f.auto = !f.auto; toast(f.auto ? (fornCompleto() ? "Reposição automática ligada (emergência, 30% mais cara)." : "Caminhão automático ligado (preço normal).") : "Reposição automática desligada: só chegam os seus pedidos."); save(); lastSig = ""; renderSheet(); }
const textoAuto = f => fornCompleto() ? `Reposição automática do distribuidor: <b>${f.auto ? "ligada" : "desligada"}</b>. Só mantém até ${FORN_CFG.emergencia} caixas por setor e cobra ${pct(FORN_CFG.fatorAuto - 1)} a mais.`
  : `Caminhão automático: <b>${f.auto ? "ligado" : "desligado"}</b>. Preço normal; ele completa o depósito com o espaço que sobrar dos seus pedidos.`;

// ---------- fechamento do dia: validade e margem ----------
function fornFimDoDia(L) {
  const t = S.today, venc = {}; let perdasVal = 0;
  if (fornCompleto()) PERECIVEIS.forEach(id => {
    const st = S.sec[id]; if (!st.open || st.wh < 5) return;
    const n = Math.floor(st.wh * FORN_CFG.validade); if (n <= 0) return;
    st.wh -= n; venc[id] = n; perdasVal += n * custoUnit(secDef(id), st);
  });
  L.cmv = Math.round((t.cmv || 0) * 100) / 100; L.perdas = Math.round(((t.perdas || 0) + perdasVal) * 100) / 100; L.vencidos = venc;
  L.margem = L.sales > 0 ? (L.sales - L.cmv - L.perdas) / L.sales : 0;
  const nv = Object.values(venc).reduce((a, b) => a + b, 0);
  if (nv) setTimeout(() => toast(`Validade: ${nv} caixas de perecíveis estragaram no depósito (M ${fmt(perdasVal)}).`), 4200);
}

// ---------- tempo, textos e estimativas ----------
function quandoChega(p) {
  const falta = p.chega - tAbs(); if (falta <= 0) return "agora";
  const dia = Math.floor(p.chega / DAY_LEN) + 1, h = 8 + 12 * ((p.chega % DAY_LEN) / DAY_LEN);
  const hora = `${Math.floor(h)}h${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
  return dia === S.day ? `hoje às ${hora}` : dia === S.day + 1 ? `amanhã às ${hora}` : `no dia ${dia} às ${hora}`;
}
const vendasOntem = id => (S.fase && S.fase.vendOntem && S.fase.vendOntem[id]) || 0;
function margemAtual(d) { const st = S.sec[d.id]; return 1 - custoUnit(d, st) / secPrice(d, st.priceLvl); }
function setorSugerido() {          // o setor aberto com menos estoque por venda
  const abertos = openSectors(); if (!abertos.length) return "mercearia";
  return abertos.slice().sort((a, b) => (S.sec[a.id].wh + S.sec[a.id].shelf) / (1 + vendasOntem(a.id)) - (S.sec[b.id].wh + S.sec[b.id].shelf) / (1 + vendasOntem(b.id)))[0].id;
}
function sigForn() { if (!fornAtivo()) return ""; const f = fornEstado(); return `${f.pedidos.map(p => p.id).join(",")}:${f.recebidos.ligeira}${f.recebidos.serra}:${f.auto}:${ui.fornSec || ""}:${S.fase.concluida}`; }
function missaoFornecedor() {
  if (!fornCompleto()) return null;
  const f = fornEstado(); if (f.pedidos.length) return null;
  const r = f.recebidos;
  if (r.ligeira + r.serra === 0) return { title: "Fazer o primeiro pedido", sub: "Compare a Distribuidora Ligeira e o Atacado Serra", p: 0, ring: "🚚", go: () => openSheet("forn") };
  return null;
}

// ---------- painel: cartão na aba Carreira ----------
function cartaoFornecedores() {
  const f = fornEstado(), card = el("div", "card");
  card.innerHTML = `<h3>🚚 Fornecedores e depósito</h3>
    <p class="note" id="fnResumo"></p>`;
  live(() => { const e = card.querySelector("#fnResumo"); if (!e) return; const L = S.lastDay;
    e.textContent = `Depósito ${whUsed()} de ${whCap(S.whLvl)} caixas, ${reservado()} reservadas para ${f.pedidos.length} pedido${f.pedidos.length === 1 ? "" : "s"} a caminho. ${fornCompleto() ? "Reposição automática" : "Caminhão automático"} ${f.auto ? "ligado" : "desligado"}.${L && L.margem != null ? ` Ontem: margem ${pct(L.margem)}, perdas M ${fmt(L.perdas)}.` : ""}`; });
  const b = el("button", "btn", "Negociar com fornecedores"); b.onclick = () => openSheet("forn"); card.appendChild(b);
  return card;
}

// ---------- painel completo: comparar, pedir, acompanhar e corrigir ----------
function buildFornecedores(body) {
  const f = fornEstado();
  if (!ui.fornSec || !S.sec[ui.fornSec] || !S.sec[ui.fornSec].open) ui.fornSec = setorSugerido();
  const secId = ui.fornSec, d = secDef(secId), st = S.sec[secId];
  head("🚚", "#e3efe2", "Fornecedores", () => `Depósito ${whUsed()}/${whCap(S.whLvl)} · ${reservado()} reservadas · ${Math.max(0, livreDeposito())} livres`);
  body.appendChild(el("p", "note", "Escolha o setor e compare as duas ofertas. O pedido é pago na hora e reserva espaço no depósito até chegar."));
  if (!fornCompleto()) body.appendChild(el("p", "note", "Aqui o caminhão automático continua trazendo mercadoria pelo preço normal. Pedir à Serra sai 25% mais barato; a Ligeira traz um lote extra no mesmo dia, bom antes do pico."));
  // setor
  body.appendChild(el("div", "sec-title", "Setor"));
  const seg = el("div", "acts setores-forn"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Setor do pedido");
  openSectors().forEach(x => { const s2 = S.sec[x.id];
    const bt = el("button", "plain mini" + (x.id === secId ? " toggle" : ""), `<span>${x.ic} ${x.name}</span>`);
    bt.setAttribute("aria-pressed", String(x.id === secId));
    bt.setAttribute("aria-label", `${x.name}: gôndola ${s2.shelf}, depósito ${s2.wh}, vendeu ${vendasOntem(x.id)} ontem`);
    bt.onclick = () => { ui.fornSec = x.id; lastSig = ""; renderSheet(); }; seg.appendChild(bt); });
  body.appendChild(seg);
  body.appendChild(statsBox([
    ["Gôndola", () => `${st.shelf}/${shelfCap(st.shelfLvl)}`],
    ["No depósito", () => `${st.wh} cx`],
    ["Vendeu ontem", () => `${vendasOntem(secId)} un.`],
    ["Margem do estoque", () => pct(margemAtual(d))],
  ]));
  if (PERECIVEIS.has(secId) && fornCompleto()) body.appendChild(el("p", "note", `⚠️ Perecível: no fechamento de cada dia, ${pct(FORN_CFG.validade)} do que estiver parado no depósito estraga (a partir de 5 caixas).`));
  // ofertas lado a lado
  body.appendChild(el("div", "sec-title", "Ofertas"));
  const g = el("div", "ofertas");
  ["ligeira", "serra"].forEach(fid => {
    const o = oferta(fid, secId), c = el("div", "card oferta");
    c.innerHTML = `<h3>${o.fo.ic} ${o.fo.nome}</h3><p class="note">${o.fo.resumo}</p>
      <dl class="ficha">
        <dt>Quantidade</dt><dd>${o.qtd} caixas</dd>
        <dt>Preço por caixa</dt><dd>M ${fmt(o.unit)}</dd>
        <dt>Custo total</dt><dd><b>M ${fmt(o.total)}</b></dd>
        <dt>Prazo</dt><dd>${o.fo.prazoTxt}</dd>
        <dt>Espaço no depósito</dt><dd>${o.espaco} caixas</dd>
        <dt>Margem na venda</dt><dd>${pct(o.margem)}</dd>
      </dl><p class="note estado" aria-live="off"></p>`;
    const b = el("button", "btn", o.fo.pedir);
    b.onclick = () => confirmarPedido(fid, secId);
    c.appendChild(b);
    live(() => { const r = motivoRecusa(oferta(fid, secId)), e = c.querySelector(".estado"); e.textContent = r ? `Indisponível agora: ${r.curto}.` : "Disponível."; e.classList.toggle("ruim", !!r); });
    g.appendChild(c);
  });
  body.appendChild(g);
  const comp = el("p", "note"); const ol = oferta("ligeira", secId), os = oferta("serra", secId);
  comp.textContent = `Comparando: o Atacado Serra traz ${os.qtd / ol.qtd} vezes mais caixas por caixa ${pct(1 - os.unit / ol.unit)} mais barata, mas demora ${os.prazo / ol.prazo} vezes mais e ocupa ${os.espaco} caixas do depósito até ser vendido.`;
  body.appendChild(comp);
  // pedidos a caminho
  body.appendChild(el("div", "sec-title", `A caminho (${f.pedidos.length})`));
  if (!f.pedidos.length) body.appendChild(el("p", "note", "Nenhum pedido a caminho."));
  f.pedidos.forEach(p => {
    const dd = secDef(p.sec), row = el("div", "card pedido");
    row.innerHTML = `<div class="req"><span>${FORN[p.forn].ic} ${p.qtd} cx de ${dd.name} · ${FORN[p.forn].nome}</span><b class="quando"></b></div>`;
    live(() => { const q = row.querySelector(".quando"); if (q) q.textContent = `chega ${quandoChega(p)}`; });
    const volta = Math.round(p.custo * (1 - FORN_CFG.multa) * 100) / 100;
    const bc = el("button", "plain mini", `<span>Cancelar (volta M ${fmt(volta)})</span>`);
    bc.onclick = () => { if (bc.dataset.armed) cancelarPedido(p.id); else { bc.dataset.armed = 1; bc.querySelector("span").textContent = `Toque de novo: multa de M ${fmt(p.custo - volta)}`; setTimeout(() => { if (bc.isConnected) { delete bc.dataset.armed; bc.querySelector("span").textContent = `Cancelar (volta M ${fmt(volta)})`; } }, 3000); } };
    row.appendChild(bc); body.appendChild(row);
  });
  // corrigir uma compra ruim
  body.appendChild(el("div", "sec-title", "Corrigir o estoque"));
  const n = Math.min(FORN_CFG.repasseLote, st.wh), v = Math.round(n * custoUnit(d, st) * FORN_CFG.repasse * 100) / 100;
  const br = el("button", "plain", `<span>${n > 0 ? `Repassar ${n} caixas de ${d.name} a outro comerciante por M ${fmt(v)} (metade do custo)` : `Sem caixas de ${d.name} no depósito para repassar`}</span>`);
  br.disabled = n <= 0; br.onclick = () => repassar(secId); body.appendChild(br);
  const ba = el("button", "plain toggle", `<span>${textoAuto(f)}</span>`);
  ba.setAttribute("aria-pressed", String(f.auto)); ba.onclick = alternarAuto; body.appendChild(ba);
  if (f.hist.length) {
    body.appendChild(el("div", "sec-title", "Recebidos"));
    body.appendChild(el("p", "note", f.hist.map(h => `Dia ${h.dia}: ${h.qtd} cx de ${secDef(h.sec).name} (${FORN[h.forn].nome})${h.fora ? ", chegou enquanto você estava fora" : ""}`).join(" · ")));
  }
  const L = S.lastDay;
  if (L && L.margem != null) body.appendChild(el("p", "note", `Ontem (dia ${L.day}): vendas M ${fmt(L.sales)}, custo do que foi vendido M ${fmt(L.cmv)}, perdas M ${fmt(L.perdas)}, margem ${pct(L.margem)}.`));
}
function confirmarPedido(fid, secId) {
  const o = oferta(fid, secId), r = motivoRecusa(o);
  if (r) {
    fornEstado().recusas++;
    showModal(`<h2>Pedido recusado</h2><p>${r.txt}</p>
      <table><tr><td>Lote</td><td>${o.qtd} caixas de ${o.d.name}</td></tr><tr><td>Custo total</td><td>M ${fmt(o.total)}</td></tr>
      <tr><td>Seu caixa</td><td>M ${fmt(S.money)}</td></tr><tr><td>Espaço livre no depósito</td><td>${Math.max(0, livreDeposito())} caixas</td></tr></table>
      <button class="btn" id="ok">Entendi</button>`);
    document.getElementById("ok").onclick = hideModal; return;
  }
  const depois = livreDeposito() - o.espaco;
  showModal(`<h2>Confirmar pedido</h2><p class="note" style="margin-top:-4px">${o.fo.ic} ${o.fo.nome} · ${o.d.ic} ${o.d.name}</p>
    <table>
      <tr><td>Quantidade</td><td>${o.qtd} caixas</td></tr>
      <tr><td>Preço por caixa</td><td>M ${fmt(o.unit)}</td></tr>
      <tr><td>Custo total (pago agora)</td><td>M ${fmt(o.total)}</td></tr>
      <tr><td>Prazo de entrega</td><td>${o.fo.prazoTxt}</td></tr>
      <tr><td>Espaço necessário</td><td>${o.espaco} caixas</td></tr>
      <tr><td>Depósito livre depois</td><td>${depois} caixas</td></tr>
      <tr><td>Caixa depois</td><td>M ${fmt(S.money - o.total)}</td></tr>
    </table>
    ${o.perecivel && fornCompleto() ? `<div class="warn">Perecível: ${pct(FORN_CFG.validade)} do que sobrar no depósito estraga a cada fechamento. Peça o que você consegue vender.</div>` : ""}
    <button class="btn" id="sim">Confirmar pedido</button>
    <button class="plain" id="nao" style="margin-top:8px;width:100%;justify-content:center"><span>Voltar</span></button>`);
  document.getElementById("sim").onclick = () => { hideModal(); const res = fazerPedido(fid, secId); if (!res.ok && res.txt) confirmarPedido(fid, secId); };
  document.getElementById("nao").onclick = hideModal;
}

// ---------- doca de recebimento (desenho) ----------
const docaAnims = [];
function docaChegada(p) { docaAnims.push({ t0: performance.now(), t: 0, forn: p.forn, cor: secDef(p.sec).color, qtd: p.qtd }); if (docaAnims.length > 3) docaAnims.shift(); }
function desenharDoca(r) {
  if (!fornAtivo()) return;
  const n = fornEstado().pedidos.length;
  rr(r.x + 6, r.y - 12, 118, 12, 5, "rgba(31,122,58,.92)");
  text(n ? `RECEBIMENTO · ${n} A CAMINHO` : "RECEBIMENTO", r.x + 65, r.y - 4, 6.8, "#fff", "center", 800);
  for (let i = docaAnims.length - 1; i >= 0; i--) {
    const a = docaAnims[i]; a.t = (performance.now() - a.t0) / 1000; if (a.t > 7) { docaAnims.splice(i, 1); continue; }
    const fo = FORN[a.forn], k = Math.min(1, a.t / 1.2);
    // carreta encostando na doca e paletes saindo
    const x = r.x + r.w - 40 + (1 - k) * 60, y = r.y + r.h - 24;
    rrs(x - 30, y - 10, 46, 20, 3, "#fff", "rgba(0,0,0,.25)"); rr(x - 30, y - 10, 46, 4, 2, fo.cor);
    rrs(x + 16, y - 8, 14, 17, 3, fo.cor, "rgba(0,0,0,.25)");
    const pal = Math.min(4, Math.floor(a.t * 1.2));
    for (let j = 0; j < pal; j++) rrs(r.x + 10 + j * 15, r.y + 38, 12, 12, 2, a.cor, shade(a.cor, .6), .8);
  }
}
