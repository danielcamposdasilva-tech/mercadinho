"use strict";
// =====================================================================
// Capítulo 5 (Mercado Pitanga): loja física e entregas ao mesmo tempo.
// - Pedidos chegam pelo telefone e pelo aplicativo do mercado. Aceitar reserva o estoque do depósito
//   (o que faltar fica pendente e é reservado assim que o caminhão trouxer). Recusar ou deixar expirar
//   não custa nada.
// - Separação: volantes no papel "separar" pegam o pedido no depósito e levam ao balcão de expedição.
//   Cada turno (manhã e tarde) tem quantos separam e quantos motoboys ficam de serviço.
// - Entrega: o motoboy sai com um pedido; o pagamento entra uma única vez, na entrega (flag pago).
//   Atrasado: 25% de desconto e reputação menor. Sem sair até o prazo + tolerância: cancelado, o estoque
//   reservado volta para o depósito e nada é cobrado.
// - Falta de estoque: o jogador cancela (devolve a reserva) ou envia sem o que falta (cobra só o enviado).
// - Impacto na loja: compara fila e gôndolas vazias com e sem separação em andamento e avisa quando as
//   entregas começam a prejudicar o atendimento no salão.
// Nada aqui roda fora do capítulo 5. O estoque nunca é duplicado: ele sai de st.wh para a reserva do
// pedido e da reserva para o cliente (entrega) ou de volta para st.wh (cancelamento).
// =====================================================================
const ENT_CFG = {
  motoboy: { contratar: 250, salarioTurno: 14, max: 4 },
  balcao: [600, 1400],                      // níveis do balcão de expedição (separação mais rápida)
  aceitarEm: 12,                            // segundos para aceitar um pedido novo
  tolerancia: 12,                           // segundos depois do prazo para cancelar quem nem saiu
  desconto: 0.75, repAtraso: -0.04, repCancela: -0.08, repParcial: -0.03,
  zonas: [
    { nome: "perto", bairros: ["Centro", "Mumbuca", "Flamengo"], prazo: 32, ida: 4.5, taxa: 3 },
    { nome: "médio", bairros: ["Araçatiba", "Itapeba", "Barra de Maricá"], prazo: 40, ida: 6.5, taxa: 5 },
    { nome: "longe", bairros: ["São José do Imbassaí", "Ponta Negra", "Inoã"], prazo: 50, ida: 8.5, taxa: 8 },
  ],
  taxaChegada: 1 / 11, raioMult: [0.55, 1, 1.4],
  porUnidade: 0.38, porPedido: 1.2,          // tempo de separação (s)
};
const ENT_ATIVO = NA_CARREIRA && FASE === "pitanga";
const novasEntregas = () => ({ pedidos: [], seq: 1, motoboys: 1, balcao: 0, cap: 2, raio: 1, auto: false, turnosDefinidos: false,
  turnos: { manha: { sep: 1, mot: 1 }, tarde: { sep: 1, mot: 1 } }, hoje: novoHojeEnt(), dias: [], totNoPrazo: 0, totEntregues: 0, totCancel: 0, receitaTot: 0 });
const novoHojeEnt = () => ({ chegaram: 0, aceitos: 0, expirados: 0, entregues: 0, noPrazo: 0, atrasados: 0, cancelados: 0, parciais: 0, receita: 0,
  com: { t: 0, vazio: 0, fila: 0 }, sem: { t: 0, vazio: 0, fila: 0 } });
function ent() {
  if (!S.entregas) S.entregas = novasEntregas();
  const e = S.entregas; e.pedidos = e.pedidos || []; e.turnos = e.turnos || novasEntregas().turnos; e.hoje = Object.assign(novoHojeEnt(), e.hoje || {}); e.dias = e.dias || [];
  return e;
}
const turnoAgora = () => S.dayT / DAY_LEN < 0.5 ? "manha" : "tarde";
const NOME_TURNO = { manha: "Manhã (8h às 14h)", tarde: "Tarde (14h às 20h)" };
const motosDeServico = () => Math.min(ent().motoboys, ent().turnos[turnoAgora()].mot);
function entregaPapeis() { return ENT_ATIVO ? ent().turnos[turnoAgora()].sep : 0; }
const ativos = () => ent().pedidos.filter(o => o.estado !== "novo");
// segundos reais → tempo do relógio do jogo (1 dia de 12 h de loja = DAY_LEN s), ex.: "3h20" ou "45 min"
function tempoJogo(seg) { const m = Math.ceil(seg / (DAY_LEN / 12) * 60); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`; }
const emAndamento = () => ent().pedidos.filter(o => ["aceito", "separando", "pronto", "rota"].includes(o.estado)).length;
const unidades = o => o.itens.reduce((a, i) => a + i.q, 0);
const reservadas = o => o.itens.reduce((a, i) => a + i.res, 0);
const faltando = o => o.itens.reduce((a, i) => a + (o.parcial ? 0 : i.q - i.res), 0);
const valorPedido = o => o.itens.reduce((a, i) => a + i.res * secPrice(SECTORS.find(d => d.id === i.sec), S.sec[i.sec].priceLvl), 0);
const zonaDe = o => ENT_CFG.zonas[o.zona];
// reserva no depósito: conta como ocupado até sair na moto (o caminhão não enche demais)
const estoqueReservado = () => ent().pedidos.reduce((a, o) => a + (["aceito", "separando", "pronto"].includes(o.estado) ? reservadas(o) : 0), 0);
const reservaDoSetor = id => ent().pedidos.reduce((a, o) => a + (["aceito", "separando", "pronto"].includes(o.estado) ? o.itens.filter(i => i.sec === id).reduce((x, i) => x + i.res, 0) : 0), 0);

// ---------- pedidos ----------
function novoPedido() {
  const e = ent(), abertos = openSectors(); if (!abertos.length) return null;
  const zona = Math.min(e.raio, Math.floor(Math.random() * (e.raio + 1))), z = ENT_CFG.zonas[zona];
  const n = Math.min(abertos.length, 2 + Math.floor(Math.random() * 3)), secs = abertos.slice().sort(() => Math.random() - 0.5).slice(0, n);
  const o = { id: e.seq++, zona, bairro: z.bairros[Math.floor(Math.random() * z.bairros.length)], itens: secs.map(d => ({ sec: d.id, q: 2 + Math.floor(Math.random() * 4), res: 0 })),
    estado: "novo", idade: 0, espera: 0, prazo: z.prazo, rota: 0, pago: false, parcial: false };
  e.pedidos.push(o); e.hoje.chegaram++;
  return o;
}
function reservar(o) {          // tira do depósito o que der; o resto fica faltando
  o.itens.forEach(i => { const st = S.sec[i.sec], k = Math.min(i.q - i.res, Math.max(0, st.wh)); if (k > 0) { st.wh -= k; i.res += k; } });
}
function devolver(o) { o.itens.forEach(i => { if (i.res > 0) { S.sec[i.sec].wh += i.res; i.res = 0; } }); }
function aceitarPedido(id, silencioso) {
  const e = ent(), o = e.pedidos.find(p => p.id === id);
  if (!o || o.estado !== "novo") return false;
  if (emAndamento() >= e.cap) { if (!silencioso) toast(`Capacidade cheia: ${e.cap} pedidos em andamento. Aumente a capacidade ou espere sair um.`); return false; }
  o.estado = "aceito"; o.idade = 0; e.hoje.aceitos++; reservar(o);
  if (!silencioso) anunciar(`Pedido ${o.id} aceito: ${o.bairro}, ${unidades(o)} itens${faltando(o) ? `, faltam ${faltando(o)} no depósito` : ""}.`);
  save(); lastSig = ""; return true;
}
function recusarPedido(id) { const e = ent(), k = e.pedidos.findIndex(p => p.id === id && p.estado === "novo"); if (k < 0) return false; e.pedidos.splice(k, 1); e.hoje.expirados++; lastSig = ""; return true; }
function cancelarEntrega(id, motivo) {
  const e = ent(), k = e.pedidos.findIndex(p => p.id === id); if (k < 0) return false;
  const o = e.pedidos[k]; if (!["aceito", "separando", "pronto"].includes(o.estado)) return false;     // na moto não volta
  volantes.forEach(v => { if (v.pedido === o.id) { v.pedido = null; v.state = "voltando"; v.path = routeTo(v, P.whDoor.x, P.whDoor.y + 6); } });
  devolver(o); e.pedidos.splice(k, 1); e.hoje.cancelados++; e.totCancel++; changeRep(ENT_CFG.repCancela, "entregaCancelada");
  float(EXPED().x, EXPED().y - 20, "❌ pedido cancelado", "#c9513a");
  if (motivo) toast(motivo);
  save(); lastSig = ""; return true;
}
function enviarSemFalta(id, auto) {
  const o = ent().pedidos.find(p => p.id === id); if (!o || o.estado !== "aceito" || !faltando(o)) return false;
  if (!reservadas(o)) return cancelarEntrega(id, "Nada do pedido estava no depósito: cancelado sem cobrança.");
  o.parcial = true; o.itens.forEach(i => i.q = i.res); ent().hoje.parciais++; changeRep(ENT_CFG.repParcial, "entregaParcial");
  if (!auto) toast(`Pedido ${o.id} vai sem o que faltava. O cliente paga só o que receber.`); else float(EXPED().x, EXPED().y - 20, `#${o.id} sai sem o que falta`, "#b7773b");
  save(); lastSig = ""; return true;
}
function soltarPedido(v) { const o = ent().pedidos.find(p => p.id === v.pedido); if (o && o.estado === "separando") o.estado = "aceito"; v.pedido = null; }
function entregar(o) {          // chamado uma vez, quando o motoboy chega ao cliente
  if (o.pago) return 0;
  const e = ent(), atrasado = o.idade > o.prazo, z = zonaDe(o);
  const v = Math.round((valorPedido(o) * (atrasado ? ENT_CFG.desconto : 1) + z.taxa) * 100) / 100;
  o.pago = true; o.valor = v; o.atrasado = atrasado;
  S.money += v; S.earned += v; S.today.outras = (S.today.outras || 0) + v; e.hoje.receita += v; e.receitaTot += v;
  e.hoje.entregues++; e.totEntregues++;
  if (atrasado) { e.hoje.atrasados++; changeRep(ENT_CFG.repAtraso, "entregaAtrasada"); } else { e.hoje.noPrazo++; e.totNoPrazo++; changeRep(0.01, "entregaPrazo"); }
  return v;
}

// ---------- simulação ----------
let tEnt = 0, pressao = { vazio: 0, fila: 0, aviso: false }, avisadoDia = 0;
function tickEntregas(dt) {
  const e = ent(), h = e.hoje;
  // chegada de pedidos (o raio e a reputação mudam o movimento; no pico chega mais)
  const taxa = ENT_CFG.taxaChegada * ENT_CFG.raioMult[e.raio] * (0.6 + S.rep * 0.1) * (isRush() ? 1.3 : 1);
  if (Math.random() < taxa * dt && e.pedidos.filter(o => o.estado === "novo").length < 4) { const o = novoPedido(); if (o && e.auto && emAndamento() < e.cap) aceitarPedido(o.id, true); }
  for (let k = e.pedidos.length - 1; k >= 0; k--) {
    const o = e.pedidos[k]; o.idade += dt;
    if (o.estado === "novo") { if (e.auto && emAndamento() < e.cap) aceitarPedido(o.id, true); else if (o.idade > ENT_CFG.aceitarEm) { e.pedidos.splice(k, 1); h.expirados++; lastSig = ""; } continue; }
    if (o.estado === "aceito" && faltando(o)) reservar(o);                       // chegou estoque: completa a reserva
    if (o.estado === "aceito" && faltando(o) && e.autoParcial && o.idade > o.prazo * 0.4) enviarSemFalta(o.id, true);   // regra escolhida pelo jogador
    if (["aceito", "separando", "pronto"].includes(o.estado) && o.idade > o.prazo + ENT_CFG.tolerancia) { cancelarEntrega(o.id); toast(`Pedido ${o.id} (${o.bairro}) cancelado: passou do prazo sem sair. O estoque voltou ao depósito.`); continue; }
    if (o.estado === "rota") {
      o.rota += dt; const ida = zonaDe(o).ida;
      if (!o.pago && o.rota >= ida) { const v = entregar(o); float(EXPED().x, EXPED().y - 30, `🛵 +M ${fmt(v)}${o.atrasado ? " (atraso)" : ""}`, o.atrasado ? "#b7773b" : "#2e7a57"); lastSig = ""; }
      if (o.rota >= ida * 2) { e.pedidos.splice(k, 1); lastSig = ""; }
    }
  }
  // motoboys de serviço levam os pedidos prontos, do prazo mais curto primeiro
  const livres = motosDeServico() - e.pedidos.filter(o => o.estado === "rota").length;
  if (livres > 0) e.pedidos.filter(o => o.estado === "pronto").sort((a, b) => (a.prazo - a.idade) - (b.prazo - b.idade)).slice(0, livres).forEach(o => { o.estado = "rota"; o.rota = 0; lastSig = ""; });
  // impacto na loja: com e sem separação em andamento
  const sep = volantes.filter(v => v.papel === "separar").length, ess = CFG.essenciais.filter(id => S.sec[id].open);
  const vaz = ess.length ? ess.filter(id => S.sec[id].shelf === 0).length / ess.length : 0, n = nCaixas();
  const fila = LANES.slice(0, n).reduce((a, _, l) => a + laneQueue(l).length, 0) / Math.max(1, n);
  const b = sep > 0 ? h.com : h.sem; b.t += dt; b.vazio += vaz * dt; b.fila += fila * dt;
  const a = Math.min(1, dt / 8); pressao.vazio += (vaz - pressao.vazio) * a; pressao.fila += (fila - pressao.fila) * a;
  pressao.aviso = sep > 0 && (pressao.vazio > 0.2 || pressao.fila > 2.6);
  if (pressao.aviso && avisadoDia !== S.day && h.com.t > 10) { avisadoDia = S.day; toast("As entregas estão pesando na loja: gôndolas esvaziando ou fila crescendo enquanto volantes separam pedidos."); }
}
const mediaBalde = b => b.t > 0 ? { vazio: b.vazio / b.t, fila: b.fila / b.t, t: b.t } : null;
function fimDoDiaEntregas(L) {
  const e = ent(), h = e.hoje, fech = h.entregues + h.cancelados;
  const d = { dia: L.day, chegaram: h.chegaram, aceitos: h.aceitos, expirados: h.expirados, entregues: h.entregues, noPrazo: h.noPrazo, atrasados: h.atrasados, cancelados: h.cancelados, parciais: h.parciais,
    receita: Math.round(h.receita), taxa: fech ? h.noPrazo / fech : null, com: mediaBalde(h.com), sem: mediaBalde(h.sem) };
  e.dias.unshift(d); e.dias.length = Math.min(e.dias.length, 5);
  L.entregas = d; e.hoje = novoHojeEnt();
}
// taxa de pontualidade dos últimos 3 dias (cancelado conta como fora do prazo)
function pontualidade() {
  const ds = ent().dias.slice(0, 3), np = ds.reduce((a, d) => a + d.noPrazo, 0), tot = ds.reduce((a, d) => a + d.entregues + d.cancelados, 0);
  return { taxa: tot ? np / tot : 0, tot, dias: ds.length };
}
const salariosEntrega = () => ENT_ATIVO ? (Math.min(ent().motoboys, ent().turnos.manha.mot) + Math.min(ent().motoboys, ent().turnos.tarde.mot)) * ENT_CFG.motoboy.salarioTurno : 0;

// ---------- volantes separando (chamado por passoVolante, em 06d) ----------
const EXPED = () => ({ x: LOJA.expedicao || Math.round((LOJA.letreiro.x + LOJA.letreiro.w + W) / 2), y: 118 });
function caminhoExpedicao(v) { return routeTo(v, P.whDoor.x, P.whDoor.y + 6); }
function passoSeparador(v, dt, sp) {
  const e = ent(), o = v.pedido != null ? e.pedidos.find(p => p.id === v.pedido) : null;
  if (v.pedido != null && !o) { v.pedido = null; v.state = "voltando"; v.path = [{ x: P.whDoor.x, y: P.whDoor.y + 6 }]; }
  if (v.state === "separando") {                         // parado na porta do depósito, esperando pedido completo
    const prox = e.pedidos.filter(p => p.estado === "aceito" && !faltando(p)).sort((a, b) => (a.prazo - a.idade) - (b.prazo - b.idade))[0];
    if (prox) { prox.estado = "separando"; v.pedido = prox.id; v.pick = 0; v.state = "pegando"; }
  } else if (v.state === "pegando") {
    v.pick += dt * (1 + 0.35 * e.balcao);
    if (o && v.pick >= ENT_CFG.porPedido + unidades(o) * ENT_CFG.porUnidade) { const x = EXPED(); v.state = "levando"; v.path = [{ x: P.whDoor.x, y: 118 }, { x: x.x - 14, y: 118 }]; }
  } else if (v.state === "levando") {
    if (follow(v, sp, dt)) { if (o) { o.estado = "pronto"; lastSig = ""; } v.pedido = null; v.state = "voltando"; v.path = [{ x: P.whDoor.x, y: 118 }, { x: P.whDoor.x, y: P.whDoor.y + 6 }]; }
  } else if (v.state === "voltando") {
    if (follow(v, sp, dt)) v.state = "separando";
  } else if (v.state === "idle") v.state = "separando";
}

// ---------- ações ----------
function contratarMotoboy(d) {
  const e = ent();
  if (d > 0) { if (e.motoboys >= ENT_CFG.motoboy.max) { toast(`No máximo ${ENT_CFG.motoboy.max} motoboys.`); return; } if (!pagarContratacao(ENT_CFG.motoboy.contratar, "um motoboy com moto")) return; e.motoboys++; banner("🛵 Motoboy contratado", "#2e7d32"); }
  else if (e.motoboys > 1) { if (e.pedidos.filter(o => o.estado === "rota").length >= e.motoboys) { toast("Espere o motoboy voltar da entrega."); return; } e.motoboys--; }
  ["manha", "tarde"].forEach(t => e.turnos[t].mot = Math.min(e.turnos[t].mot, e.motoboys));
  save(); lastSig = ""; renderSheet();
}
function mudarTurno(t, oque, d) {
  const e = ent(), lim = oque === "sep" ? eq().volantes : e.motoboys;
  e.turnos[t][oque] = Math.max(0, Math.min(lim, e.turnos[t][oque] + d)); e.turnosDefinidos = true;
  anunciar(`${NOME_TURNO[t]}: ${e.turnos[t].sep} separando, ${e.turnos[t].mot} motoboy(s).`); save(); lastSig = ""; renderSheet();
}
function mudarCapacidade(d) { const e = ent(); e.cap = Math.max(1, Math.min(8, e.cap + d)); anunciar(`Até ${e.cap} pedidos em andamento.`); save(); lastSig = ""; renderSheet(); }
function mudarRaio(d) { const e = ent(); e.raio = Math.max(0, Math.min(2, e.raio + d)); anunciar(`Entregas até bairros ${ENT_CFG.zonas[e.raio].nome}.`); save(); lastSig = ""; renderSheet(); }
function alternarParcial() { const e = ent(); e.autoParcial = !e.autoParcial; toast(e.autoParcial ? "Pedido com falta perto do prazo sai com o que tem (cobra só o enviado)." : "Pedidos com falta esperam a sua decisão."); save(); lastSig = ""; renderSheet(); }
function alternarAceite() { const e = ent(); e.auto = !e.auto; toast(e.auto ? "Aceite automático ligado: pedidos entram enquanto houver capacidade." : "Aceite automático desligado: você decide cada pedido."); save(); lastSig = ""; renderSheet(); }
function melhorarBalcao() {
  const e = ent(), c = ENT_CFG.balcao[e.balcao]; if (c == null) return;
  if (!pagarContratacao(c, "o balcão de expedição")) return; e.balcao++; banner(`📦 Balcão de expedição nível ${e.balcao}`, "#2e7d32"); save(); lastSig = ""; renderSheet();
}

// ---------- desenho: balcão de expedição e motos ----------
function desenharExpedicao() {
  const e = ent(), x = EXPED(), bx = x.x - 46;
  rr(bx, 46, 92, 64, 8, "#e9e4d6"); rr(bx + 3, 49, 86, 14, 5, "#2e7d32"); text("EXPEDIÇÃO", x.x, 59, 8, "#fff", "center", 800);
  // prateleira de bolsas: uma por pedido pronto (até 6)
  const prontos = e.pedidos.filter(o => o.estado === "pronto");
  for (let k = 0; k < 6; k++) { const px = bx + 8 + (k % 3) * 26, py = 68 + Math.floor(k / 3) * 18; rr(px, py, 22, 14, 3, k < prontos.length ? "#c62828" : "rgba(0,0,0,.08)"); if (k < prontos.length) text(String(prontos[k].id), px + 11, py + 10, 7, "#fff"); }
  rr(bx + 4, 104, 84, 6, 2, "#7c6a4a");
  // motos na calçada (as de serviço) e as que estão na rua
  const rota = e.pedidos.filter(o => o.estado === "rota"), paradas = Math.max(0, motosDeServico() - rota.length);
  for (let k = 0; k < paradas; k++) moto(bx + 10 + k * 22, 36, false);
  rota.forEach((o, k) => { const ida = zonaDe(o).ida, f = o.rota < ida ? o.rota / ida : 1 - (o.rota - ida) / ida, xx = x.x + f * (W + 220 - x.x); moto(xx, 12 + (k % 2) * 8, o.rota < ida); });
  if (pressao.aviso) { rr(bx - 4, 112, 100, 13, 5, "#b7773b"); text("⚠ LOJA SOFRENDO", x.x, 121.5, 7, "#fff", "center", 800); }
}
function moto(x, y, indo) {
  ctx.save(); ctx.translate(x, y); if (!indo) ctx.scale(-1, 1);
  rr(-9, -3, 18, 5, 2, "#c62828"); ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(-7, 3, 3, 0, 7); ctx.arc(7, 3, 3, 0, 7); ctx.fill();
  rr(-6, -10, 8, 8, 2, "#2e7d32"); rr(1, -9, 5, 4, 2, "#f2b233");
  ctx.restore();
}

// ---------- painel ----------
function linhaPedido(o) {
  const z = zonaDe(o), resta = Math.max(0, o.prazo - o.idade), f = faltando(o);
  const est = { novo: `Novo · aceite em ${Math.max(0, Math.ceil(ENT_CFG.aceitarEm - o.idade))} s`, aceito: f ? `Aceito · faltam ${f} itens no depósito` : "Aceito · esperando separação", separando: "Separando", pronto: "Pronto no balcão", rota: o.pago ? "Motoboy voltando" : "Na rua" }[o.estado];
  const c = el("div", "card proposta", `<div class="req"><span><b>#${o.id}</b> ${o.bairro} <span class="tag${o.zona === 2 ? " aviso" : ""}">${z.nome}</span></span><b>${o.estado === "rota" && o.pago ? `M ${fmt(o.valor)}` : `M ${fmt(o.estado === "novo" ? o.itens.reduce((a, i) => a + i.q * secPrice(SECTORS.find(d => d.id === i.sec), S.sec[i.sec].priceLvl), 0) + z.taxa : valorPedido(o) + z.taxa)}`}</b></div>
    <p class="note">${o.itens.map(i => `${SECTORS.find(d => d.id === i.sec).ic} ${i.q}${o.estado !== "novo" && i.res < i.q ? ` (${i.res} reservados)` : ""}`).join(" · ")}</p>
    <p class="note">${est}${o.estado !== "rota" ? ` · prazo ${resta > 0 ? `em ${tempoJogo(resta)} de jogo` : "<b>estourado</b>"}` : ""}</p>`);
  const g = el("div", "linha2");
  const bt = (txt, cls, fn, rot) => { const b = el("button", cls, txt); b.onclick = fn; if (rot) b.setAttribute("aria-label", rot); g.appendChild(b); };
  if (o.estado === "novo") { bt("Aceitar", "btn mini", () => { aceitarPedido(o.id); renderSheet(); }, `Aceitar pedido ${o.id}`); bt("Recusar", "plain mini", () => { recusarPedido(o.id); renderSheet(); }, `Recusar pedido ${o.id}`); }
  else if (o.estado === "aceito" && f) { bt("Enviar sem o que falta", "plain mini", () => { enviarSemFalta(o.id); renderSheet(); }, `Enviar pedido ${o.id} sem os itens em falta`); bt("Cancelar", "plain mini", () => { cancelarEntrega(o.id, `Pedido ${o.id} cancelado: o estoque reservado voltou ao depósito.`); renderSheet(); }, `Cancelar pedido ${o.id}`); }
  else if (["aceito", "separando", "pronto"].includes(o.estado)) bt("Cancelar", "plain mini", () => { cancelarEntrega(o.id, `Pedido ${o.id} cancelado: o estoque reservado voltou ao depósito.`); renderSheet(); }, `Cancelar pedido ${o.id}`);
  if (g.children.length) c.appendChild(g);
  return c;
}
function buildEntregas(body) {
  const e = ent();
  head("🛵", "#e3efe1", "Entregas", () => `${emAndamento()} de ${e.cap} pedidos em andamento · ${NOME_TURNO[turnoAgora()].split(" (")[0]} · ${motosDeServico()} motoboy(s) de serviço`);
  body.appendChild(el("p", "note", "Aceitar reserva o estoque do depósito. O cliente paga na entrega; atrasado, paga 25% menos. Pedido que nem saiu até o prazo é cancelado e o estoque volta."));
  body.appendChild(statsBox([
    ["Entregues hoje", () => `${ent().hoje.entregues} (${ent().hoje.noPrazo} no prazo)`],
    ["Receita das entregas", () => `M ${fmt(ent().hoje.receita)}`],
    ["Reservado no depósito", () => `${estoqueReservado()} caixas`],
    ["Pontualidade (3 dias)", () => { const p = pontualidade(); return p.tot ? `${pctTxt(p.taxa)} de ${p.tot}` : "—"; }],
  ]));
  // impacto na loja
  const imp = el("div", "card", `<h3>🏪 Loja × entregas</h3><p class="note" id="impTxt"></p>`);
  live(() => { const q = imp.querySelector("#impTxt"); if (!q) return; const h = ent().hoje, c = mediaBalde(h.com), s = mediaBalde(h.sem);
    const sep = volantes.filter(v => v.papel === "separar").length;
    q.innerHTML = `${pressao.aviso ? '<span class="tag ruim">As entregas estão prejudicando a loja</span> ' : sep ? '<span class="tag bom">Loja bem atendida</span> ' : ""}Agora: ${sep} volante(s) separando, gôndolas essenciais vazias ${pctTxt(pressao.vazio)}, ${pressao.fila.toFixed(1).replace(".", ",")} cliente(s) por caixa.`
      + (c && s && c.t > 5 && s.t > 5 ? `<br>Hoje, com separação: vazias ${pctTxt(c.vazio)} e fila ${c.fila.toFixed(1).replace(".", ",")}; sem separação: vazias ${pctTxt(s.vazio)} e fila ${s.fila.toFixed(1).replace(".", ",")}.` : ""); });
  body.appendChild(imp);
  // pedidos
  body.appendChild(el("div", "sec-title", "Pedidos"));
  const ab = el("button", "plain toggle", `<span>Aceite automático: <b>${e.auto ? "ligado" : "desligado"}</b></span>`); ab.setAttribute("aria-pressed", String(e.auto)); ab.onclick = alternarAceite; body.appendChild(ab);
  const ap = el("button", "plain toggle", `<span>Com falta perto do prazo, enviar o que tem: <b>${e.autoParcial ? "sim" : "não"}</b></span>`); ap.setAttribute("aria-pressed", String(!!e.autoParcial)); ap.onclick = alternarParcial; body.appendChild(ap);
  const lista = e.pedidos.slice().sort((a, b) => ["novo", "aceito", "separando", "pronto", "rota"].indexOf(a.estado) - ["novo", "aceito", "separando", "pronto", "rota"].indexOf(b.estado));
  if (!lista.length) body.appendChild(el("p", "note", "Nenhum pedido agora. Eles chegam ao longo do dia; com raio maior chegam mais, mas a moto demora mais."));
  lista.forEach(o => body.appendChild(linhaPedido(o)));
  // turnos e capacidade
  body.appendChild(el("div", "sec-title", "Turnos e capacidade"));
  const tc = el("div", "card", `<p class="note">Separadores saem dos volantes (${eq().volantes} contratados, aba Equipe): quem separa não repõe gôndola nem abre caixa. Motoboy custa M ${ENT_CFG.motoboy.salarioTurno} por turno de serviço.</p>`);
  ["manha", "tarde"].forEach(t => {
    tc.appendChild(el("p", "note", `<b>${NOME_TURNO[t]}</b>`));
    tc.appendChild(passo("Separando pedidos", () => `${ent().turnos[t].sep}`, () => mudarTurno(t, "sep", -1), () => mudarTurno(t, "sep", 1), `separadores, ${NOME_TURNO[t]}`));
    tc.appendChild(passo("Motoboys de serviço", () => `${ent().turnos[t].mot}`, () => mudarTurno(t, "mot", -1), () => mudarTurno(t, "mot", 1), `motoboys, ${NOME_TURNO[t]}`));
  });
  tc.appendChild(passo("Pedidos em andamento (máx.)", () => `${ent().cap}`, () => mudarCapacidade(-1), () => mudarCapacidade(1), "capacidade de pedidos"));
  tc.appendChild(passo("Raio de entrega", () => ENT_CFG.zonas[ent().raio].nome, () => mudarRaio(-1), () => mudarRaio(1), "raio de entrega"));
  tc.appendChild(el("p", "note", "Raio maior traz mais pedidos e taxas maiores, mas a moto fica mais tempo fora. Capacidade maior aceita mais, e reserva mais estoque do depósito."));
  body.appendChild(tc);
  // estrutura
  body.appendChild(el("div", "sec-title", "Estrutura"));
  const mc = el("div", "card", `<h3>🛵 Motoboys: ${e.motoboys}</h3><p class="note">Cada um leva um pedido por vez. Contratação com moto: M ${fmt(ENT_CFG.motoboy.contratar)}.</p>`);
  mc.appendChild(passo("Motoboys contratados", () => `${ent().motoboys}`, () => contratarMotoboy(-1), () => contratarMotoboy(1), "motoboys contratados")); body.appendChild(mc);
  const cb = ENT_CFG.balcao[e.balcao], bc = el("div", "card", `<h3>📦 Balcão de expedição: nível ${e.balcao}</h3><p class="note">Prateleiras de bolsas e etiquetas: cada nível separa 35% mais rápido.</p>`);
  if (cb != null) { const b = el("button", "btn", `Melhorar por M ${fmt(cb)}`); b.onclick = melhorarBalcao; bc.appendChild(b); } else bc.appendChild(el("p", "note", "Nível máximo."));
  body.appendChild(bc);
  // dias anteriores
  if (e.dias.length) { body.appendChild(el("div", "sec-title", "Dias anteriores"));
    e.dias.slice(0, 3).forEach(d => body.appendChild(el("div", "card", `<div class="req"><span>Dia ${d.dia}: ${d.entregues} entregues, ${d.noPrazo} no prazo</span><b>M ${fmt(d.receita)}</b></div><p class="note">${d.chegaram} chegaram · ${d.expirados} recusados ou expirados · ${d.cancelados} cancelados · ${d.parciais} sem itens em falta${d.com && d.sem ? ` · loja com separação: vazias ${pctTxt(d.com.vazio)}, sem: ${pctTxt(d.sem.vazio)}` : ""}</p>`))); }
}
function cartaoEntregas() {
  const c = el("div", "card"); c.innerHTML = `<h3>🛵 Entregas</h3><p class="note" id="entRes"></p>`;
  live(() => { const q = c.querySelector("#entRes"); if (!q) return; const e = ent(), novos = e.pedidos.filter(o => o.estado === "novo").length;
    q.innerHTML = `${novos ? `<b>${novos} pedido(s) esperando aceite.</b> ` : ""}${emAndamento()} em andamento · ${e.hoje.entregues} entregues hoje · ${e.motoboys} motoboy(s).${pressao.aviso ? ' <span class="tag ruim">loja sofrendo</span>' : ""}`; });
  const b = el("button", "btn", "Abrir as entregas"); b.onclick = () => openSheet("entregas"); c.appendChild(b);
  return c;
}

// ---------- capítulo 5: configuração ----------
const ENT_META = { noPrazo: 60, taxa: 0.8, minPedidos: 12 };
FASE_CFG.pitanga = {
  capitulo: 5, titulo: "Mercado Pitanga", lugar: "Centro",
  resumo: "Mercado do Centro com balcão de expedição e motos na calçada: a mesma equipe e o mesmo estoque atendem o salão e os pedidos de entrega.",
  intro: "Agora há <b>entregas</b>. Aceitar um pedido reserva o estoque do depósito; volantes separam e motoboys levam. Divida a equipe por <b>turno</b>, ajuste a <b>capacidade</b> e o <b>raio</b>, e fique de olho: quando muita gente separa pedidos, a loja pode sofrer. O cliente paga na entrega, uma única vez. A Ligeira e a Serra continuam atendendo, além do caminhão automático.",
  essenciais: ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria", "acougue"],
  dia: { vazioMax: 0.15, perdidosMax: 0.08, repMin: 3.9 },
  diasSeguidos: 4, lucroMedio: 420, fornecedores: "leve",
  aluguel: 110, fluxo: 1.1,
  aberturas: { frios: 3000, limpeza: 5000 },
  convite: {
    responsabilidades: "pedidos de entrega com prazo, reserva de estoque, separação por turno, motoboys, capacidade e raio de entrega, sem deixar o atendimento no salão cair.",
    comeca: "orçamento de M 3.000, seis setores abertos, encarregado de reposição e 2 volantes já contratados, 1 motoboy, depósito nível 6 (caminhão maior) e 2 caixas fixos de 4 (os volantes podem abrir os outros)."
  },
  estrutura: [
    { id: "motoboys", label: "Ter 2 motoboys", como: "Aba Carreira > Abrir as entregas > Estrutura.", have: () => ent().motoboys, need: 2, painel: "entregas" },
    { id: "turnos", label: "Definir os turnos: separação e motoboy de manhã e à tarde", como: "Pelo menos 1 separando e 1 motoboy em cada turno, escolhidos por você.", have: () => { const e = ent(); return e.turnosDefinidos && ["manha", "tarde"].every(t => e.turnos[t].sep >= 1 && e.turnos[t].mot >= 1) ? 1 : 0; }, need: 1, painel: "entregas" },
    { id: "balcao", label: "Montar o balcão de expedição (nível 1)", como: "Separação 35% mais rápida.", have: () => ent().balcao, need: 1, painel: "entregas" },
    { id: "capacidade", label: "Capacidade para 4 pedidos em andamento", como: "Mais capacidade aceita mais pedidos, e reserva mais estoque.", have: () => ent().cap, need: 4, painel: "entregas" },
  ],
  extras() {
    const e = ent(), p = pontualidade();
    return [
      { id: "noPrazo", label: `${ENT_META.noPrazo} entregas no prazo`, tipo: "gestao", have: e.totNoPrazo, need: ENT_META.noPrazo, como: "Conta a partir da chegada ao Pitanga. Entregas resolvidas enquanto o app estava fechado não contam." },
      { id: "pontual", label: `Pontualidade de ${pctTxt(ENT_META.taxa)} nos últimos 3 dias`, tipo: "gestao", have: p.dias >= 3 && p.tot >= ENT_META.minPedidos && p.taxa >= ENT_META.taxa ? 1 : 0, need: 1,
        mostra: () => p.tot ? `${pctTxt(p.taxa)} de ${p.tot}` : "sem dias fechados",
        como: `Entregues no prazo divididos por entregues + cancelados, com pelo menos ${ENT_META.minPedidos} pedidos nos 3 dias.` },
    ];
  },
  diaComo: () => "Um dia conta quando: gôndolas essenciais vazias até 15% do tempo, até 8% de clientes perdidos, fila média até 7 s, nenhum pedido cancelado, reputação de pelo menos 3,9 e nenhuma dívida.",
  avaliar(itens, L) {
    const h = ent().hoje, q = eq().hoje, fila = q.filaN ? q.filaSoma / q.filaN : 0;
    itens.push({ ok: fila <= 7, txt: `Fila média ${fila.toFixed(1).replace(".", ",")} s (máx. 7 s)` });
    itens.push({ ok: h.cancelados === 0, txt: h.cancelados ? `${h.cancelados} pedido(s) cancelado(s)` : "Nenhum pedido cancelado" });
  },
  fimDoDia(L) { fimDoDiaEquipe(L); fimDoDiaEntregas(L); },
  tick(dt) { tickEquipe(dt); tickEntregas(dt); },
  cartoes() { return [cartaoEntregas(), cartaoEquipe()]; },
  missao() {
    const e = ent(), novos = e.pedidos.filter(o => o.estado === "novo").length;
    if (novos && !e.auto) return { title: `${novos} pedido(s) de entrega esperando`, sub: "Aceite, recuse ou ligue o aceite automático", p: 0, ring: "🛵", go: () => openSheet("entregas") };
    return null;
  },
  orcamento: 3000,
  inicio() {
    S.tier = 1; S.money = this.orcamento; S.whLvl = 6; S.cashiers = 2;
    this.essenciais.forEach(id => { const st = S.sec[id]; st.open = true; st.staff = 1; st.shelfLvl = 2; st.shelf = shelfCap(st.shelfLvl); st.wh = 10; });
    S.gear.baskets = 18; S.gear.carts = 8; S.gear.collectors = 2; S.gear.colLvl = 2; S.park.price = 0;
    S.equipe = Object.assign(novaEquipe(), { encarregado: true, volantes: 2, plano: { normal: 0, pico: 0 }, planoDefinido: true });
    S.entregas = novasEntregas();
    const r = CARREIRA && CARREIRA.repCarreira ? CARREIRA.repCarreira : 3;
    S.rep = Math.max(3, Math.min(3.5, 3 + (r - 3.5) * 0.5));
    ACH.forEach(a => { if (a.ok()) S.ach[a.id] = true; });
  },
  carregar() {
    eq(); const e = ent();
    // o que estava nas mãos de um separador volta para a fila (as unidades continuam reservadas no pedido)
    e.pedidos.forEach(o => { if (o.estado === "separando") o.estado = "aceito"; });
  },
  reabrir(r) { const e = ent(); e.motoboys = 2; e.balcao = 1; e.cap = 4; e.turnosDefinidos = true; e.totNoPrazo = ENT_META.noPrazo; Object.assign(eq(), { encarregado: true, volantes: 2, planoDefinido: true }); reabrirComum(r); },
  reaberturaTxt: "2 motoboys, balcão de expedição, 2 volantes e o orçamento inicial do Pitanga (M 3.000)",
  previa: () => `<svg viewBox="0 0 220 120" class="previa" role="img" aria-label="Esquema do Mercado Pitanga: depósito à esquerda, balcão de expedição à direita da fachada com motos na calçada, três fileiras de gôndolas e entrada pela direita">
    <rect width="220" height="120" rx="10" fill="#c6c8b8"/><rect y="6" width="220" height="16" fill="#6f777c"/>
    <rect x="30" y="26" width="160" height="78" rx="4" fill="#f3f3ef" stroke="#2e7d32" stroke-width="1.5"/>
    <rect x="34" y="28" width="52" height="16" rx="2" fill="#8e7350"/><rect x="96" y="28" width="50" height="12" rx="2" fill="#2e7d32"/>
    <rect x="152" y="28" width="34" height="18" rx="2" fill="#e9e4d6" stroke="#2e7d32"/><text x="169" y="40" font-size="6" font-weight="800" fill="#2e7d32" text-anchor="middle">EXPED.</text>
    ${[0, 1, 2].map(i => `<rect x="${154 + i * 12}" y="10" width="9" height="6" rx="2" fill="#c62828"/>`).join("")}
    ${[0, 1, 2].map(c => [0, 1].map(r => `<rect x="${36 + c * 50}" y="${54 + r * 14}" width="42" height="6" rx="1.5" fill="#b89a6c"/>`).join("")).join("")}
    ${[0, 1].map(i => `<rect x="${80 + i * 26}" y="90" width="14" height="6" rx="1.5" fill="#4b5a62"/>`).join("")}
    <rect x="190" y="82" width="6" height="14" fill="#2e7d32"/><text x="196" y="78" font-size="7" font-weight="800" fill="#2e7d32">entrada</text></svg>`,
};

if (ENT_ATIVO) {
  GANCHOS.salariosEntrega = salariosEntrega;
  GANCHOS.whExtra = () => estoqueReservado();
  GANCHOS.faltaEstoque = id => ent().pedidos.reduce((a, o) => a + (o.estado === "aceito" && !o.parcial ? o.itens.filter(i => i.sec === id).reduce((x, i) => x + i.q - i.res, 0) : 0), 0);   // o caminhão traz primeiro o que falta nos pedidos
  gancho("desenharLoja", () => { desenharExpedicao(); });
  gancho("tocar", (x, y) => { const e = EXPED(); return x >= e.x - 50 && x <= e.x + 50 && y >= 30 && y <= 118 ? { kind: "exped" } : null; });
  gancho("bRect", sel => sel.kind === "exped" ? { x: EXPED().x - 50, y: 30, w: 100, h: 92 } : null);
  gancho("painel", (sel, body) => { if (sel.kind !== "exped") return null; buildEntregas(body); return true; });
  const a0 = GANCHOS.assinatura;
  GANCHOS.assinatura = () => { const e = ent(); return (a0 ? a0() : "") + `|ent${e.pedidos.map(o => o.id + o.estado + (o.pago ? 1 : 0) + faltando(o)).join(",")}${e.motoboys}${e.balcao}${e.cap}${e.raio}${e.auto}${e.autoParcial}${JSON.stringify(e.turnos)}${e.dias.length}`; };
  GANCHOS.aoVoltar = (days, away) => {
    if (days <= 0) return [];
    const e = ent(); let pagos = 0, valor = 0, canc = 0;
    for (const o of e.pedidos.slice()) {
      if (o.estado === "novo") { e.pedidos.splice(e.pedidos.indexOf(o), 1); continue; }
      if (o.estado === "rota" || (!faltando(o) && reservadas(o) > 0)) {       // completo: foi entregue enquanto você esteve fora (paga uma vez)
        if (!o.pago) { o.idade = 0; const v = entregar(o); e.hoje.noPrazo--; e.totNoPrazo--; e.hoje.entregues--; pagos++; valor += v; }
        e.pedidos.splice(e.pedidos.indexOf(o), 1);
      } else { devolver(o); e.pedidos.splice(e.pedidos.indexOf(o), 1); canc++; }
    }
    e.hoje = novoHojeEnt();                                // estatísticas de dias não jogados não contam para as metas
    const L = [];
    if (pagos) L.push(["Entregas concluídas enquanto você esteve fora", `${pagos} (+M ${fmt(valor)})`]);
    if (canc) L.push(["Pedidos cancelados por falta de estoque", `${canc}, estoque devolvido`]);
    return L;
  };
  gancho("lista", body => { body.appendChild(listaRow("🛵", "#e3efe1", "Expedição e entregas", () => { const e = ent(); return `${e.pedidos.filter(o => o.estado === "novo").length} novo(s), ${emAndamento()} em andamento de ${e.cap} · ${motosDeServico()} motoboy(s) de serviço · ${e.hoje.entregues} entregues hoje`; }, { kind: "exped" })); });
  PAINEIS.entregas = buildEntregas;
}
