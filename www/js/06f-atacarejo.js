"use strict";
// =====================================================================
// Capítulo 6 (Atacarejo Cajueiro, à beira da RJ-106): venda em volume e galeria de lojas.
// - Comerciantes compram FARDOS (6 unidades) direto dos paletes da faixa de paletes do salão e pagam
//   no balcão do atacado. Fardo sai 28% mais barato por unidade: margem menor, volume maior.
// - Paletes (8 fardos) são comprados à parte, chegam de carreta e precisam ser descarregados nas docas.
//   Empilhadeiras são divididas entre a doca (descarregar) e o salão (levar palete do depósito para a faixa).
//   Carreta esperando demais paga taxa de permanência (uma vez por carreta).
// - O depósito de paletes e as posições no salão são limitados: espaço é uma decisão.
// - Galeria com 4 salas (06g): propostas chegam, o jogador escolhe inquilinos, acompanha aluguel,
//   ocupação e despesas. Prepara a mudança para o shopping.
// =====================================================================
const AT_CFG = {
  fardo: 6, palete: 8, precoFardo: 0.72, custoFardo: 0.8,
  posicoes: [6, 9], posCusto: 2500, depCap: [8, 12, 16], depCusto: [1800, 4000],
  docas: [1, 2], docaCusto: 3500, op: { contratar: 300, salario: 22, max: 4 }, balcao: { contratar: 250, salario: 18, max: 2 },
  nivelCusto: 1200, niveisMax: 2, isolar: 4,              // 1.4: estoque vertical (pulmão aéreo) por posição
  chegada: 14, permanencia: 18, multa: 35, descarga: 3.5, levar: 5, atendimento: 3.2, paciencia: 9, pacienciaFila: 22,
};
const AT_ATIVO = NA_CARREIRA && FASE === "cajueiro";
// 1.6: duas distribuidoras de paletes. A Ligeira é a de sempre (1 palete, chega rápido); a Serra vende em lote
// de 3 paletes do mesmo setor, 15% mais barato, mas a carreta demora e o lote ocupa o porta-paletes desde o pedido.
const AT_FORN = {
  ligeira: { id: "ligeira", nome: "Distribuidora Ligeira", ic: "🚐", fator: 1, chegada: 14, lote: 1, resumo: "1 palete por vez, preço cheio, chega em 14 s" },
  serra: { id: "serra", nome: "Atacado Serra", ic: "🚛", fator: 0.85, chegada: 60, lote: 3, resumo: "lote de 3 paletes do mesmo setor, 15% mais barato, chega em 60 s" },
};
const GAL_CFG = { ramos: TAMANHOS.sala.ramos, cadaProposta: 40, validade: 45, maxPropostas: 3, custoFixo: 20, custoVaga: 10, custoOcupada: 4 };
const novoAtac = () => ({ nPos: 6, pos: Array.from({ length: 9 }, () => ({ sec: null, fardos: 0 })), dep: {}, depLvl: 0, docas: 1, ops: 2, opsDoca: 1, balcao: 1,
  carretas: [], transito: [], seq: 1, auto: false, hoje: novoHojeAt(), dias: [], totFardos: 0, totMultas: 0 });
const novoHojeAt = () => ({ fardos: 0, receita: 0, custo: 0, comerciantes: 0, perdidos: 0, multas: 0, multaValor: 0, paletes: 0, descidas: 0, subidas: 0, urgentes: 0, isoladoS: 0 });
function at() {
  if (!S.atac) S.atac = novoAtac();
  const a = S.atac; a.dep = a.dep || {}; a.soltos = a.soltos || {}; a.carretas = a.carretas || []; a.transito = a.transito || []; a.hoje = Object.assign(novoHojeAt(), a.hoje || {}); a.dias = a.dias || [];
  while (a.pos.length < 9) a.pos.push({ sec: null, fardos: 0 });
  a.pos.forEach(p => { p.niveis = p.niveis || 0; p.alto = p.alto || 0; }); a.pulmao = a.pulmao || "preventiva";
  return a;
}
function galeria() { if (!S.galeria) S.galeria = novoConjunto([1, 2, 3, 4].map(i => ({ id: "g" + i, tam: "sala", nome: `Sala ${i}` }))); return S.galeria; }
const secDefAt = id => SECTORS.find(d => d.id === id);
const precoFardo = id => Math.round(AT_CFG.fardo * secPrice(secDefAt(id), S.sec[id].priceLvl) * AT_CFG.precoFardo * 100) / 100;
const custoPalete = (id, fid) => Math.round(AT_CFG.fardo * AT_CFG.palete * boxCost(secDefAt(id), S.sec[id].priceLvl) * AT_CFG.custoFardo * AT_FORN[fid || "ligeira"].fator * 100) / 100;
const chegadaDe = p => p.chega || AT_CFG.chegada;
const depCapAt = () => AT_CFG.depCap[at().depLvl];
const depUsado = () => Object.values(at().dep).reduce((a, n) => a + n, 0);
const paletesChegando = () => at().transito.reduce((a, p) => a + p.n, 0) + at().carretas.reduce((a, c) => a + c.restante, 0);
const noCaminho = id => at().transito.reduce((s, p) => s + (p.itens[id] || 0), 0) + at().carretas.reduce((s, c) => s + (c.itens[id] || 0), 0);
// 1.4: estoque vertical. Cada posição pode ter até 2 níveis de porta-paletes no alto; o alto não está à venda.
const altoLivre = id => at().pos.slice(0, at().nPos).reduce((s, p) => s + (p.sec === id ? Math.max(0, p.niveis - p.alto - (p.subindo ? 1 : 0)) : 0), 0);
// trecho isolado em frente à posição durante a manobra: fica dentro da coluna, nunca no corredor (rota acessível livre)
const zonaIsolada = k => { const pp = posPalete(k); return { x: pp.x - 3, y: pp.stand - 16, w: pp.w + 6, h: 24 }; };
// preventiva: no pico só desce do alto se o depósito não tiver palete daquele setor (posição vazia é pior que a manobra)
const podeDescer = (a, p) => a.pulmao === "urgente" || !isRush() || (p && !(a.dep[p.sec] > 0));
function totalFardosAt(id) {            // conferência: tudo o que existe de um setor, em fardos
  const a = at(), P8 = AT_CFG.palete;
  let n = a.pos.reduce((s, p) => s + (p.sec === id ? p.fardos + p.alto * P8 : 0), 0) + (a.dep[id] || 0) * P8 + noCaminho(id) * P8 + (a.soltos[id] || 0);
  n += empilhadeiras.reduce((s, e) => s + (e.carga === id ? P8 : 0), 0);
  n += comerciantes.reduce((s, c) => s + c.plano.reduce((t, it) => t + (it.sec === id ? it.got : 0), 0), 0);
  return n;
}
function instalarNivel(k) {
  const a = at(), p = a.pos[k]; if (!p || k >= a.nPos || p.niveis >= AT_CFG.niveisMax) return false;
  if (!pagarContratacao(AT_CFG.nivelCusto, "um nível de porta-paletes no alto")) return false;
  p.niveis++; banner(`🏗️ Posição ${k + 1}: ${p.niveis} nível(is) no alto`, "#e8711a"); anunciar(`Posição ${k + 1} agora guarda ${p.niveis} palete(s) no alto.`); save(); lastSig = ""; renderSheet(); return true;
}
function alternarPulmao() { const a = at(); a.pulmao = a.pulmao === "urgente" ? "preventiva" : "urgente";
  toast(a.pulmao === "urgente" ? "Descida do alto também no horário de pico: mais rápida, com corredor isolado e alguma espera." : "Descida do alto só fora do pico; no pico, a empilhadeira traz do depósito."); save(); lastSig = ""; renderSheet(); }
function guardarSoltos(a, sec, n) { a.soltos[sec] = (a.soltos[sec] || 0) + n; while (a.soltos[sec] >= AT_CFG.palete) { a.soltos[sec] -= AT_CFG.palete; a.dep[sec] = (a.dep[sec] || 0) + 1; } }
function autoTxt() {
  const a = at(), st = a.autoSt; if (!a.auto) return "desligada";
  if (!st || st.tipo === "ok") return "ligada, estoque garantido";
  if (st.tipo === "comprando") return `ligada, comprando ${nomeSetor(st.sec).toLowerCase()}`;
  if (st.tipo === "cheio") return "ligada, mas o depósito de paletes está cheio";
  return `ligada, esperando saldo (faltam M ${fmt(Math.max(1, st.falta))})`;
}
// por que uma posição está vazia: a causa real, não sempre "compre paletes"
function causaVazia() {
  const a = at(), vaz = a.pos.slice(0, a.nPos).filter(p => p.sec && !p.fardos);
  if (!vaz.length) return null;
  const salao = a.ops - a.opsDoca, sec = vaz.map(p => p.sec);
  if (sec.some(id => (a.dep[id] || 0) > 0)) return salao > 0 ? { n: vaz.length, title: "Empilhadeira levando palete", sub: "A posição vazia já vai ser abastecida", aviso: false }
    : { n: vaz.length, title: "Nenhuma empilhadeira no salão", sub: "Há paletes no depósito: passe um operador da doca para o salão", aviso: true };
  if (sec.some(id => a.carretas.some(c => c.itens[id] > 0))) {
    if (a.opsDoca === 0) return { n: vaz.length, title: "Carreta parada na doca", sub: "Ponha uma empilhadeira na doca para descarregar", aviso: true };
    if (depUsado() >= depCapAt()) return { n: vaz.length, title: "Depósito de paletes cheio", sub: "A carreta espera espaço: amplie o porta-paletes ou libere posições", aviso: true };
    return { n: vaz.length, title: "Carreta descarregando", sub: "O palete chega em instantes", aviso: false };
  }
  if (sec.some(id => a.transito.some(p => p.itens[id] > 0))) { const t = Math.max(0, Math.ceil(Math.min(...a.transito.filter(p => sec.some(id => p.itens[id] > 0)).map(p => chegadaDe(p) - p.t))));
    return { n: vaz.length, title: "Palete a caminho", sub: `Chega de carreta em cerca de ${t} s`, aviso: false }; }
  if (a.auto && a.autoSt && a.autoSt.tipo === "saldo") return { n: vaz.length, title: "Compra automática sem saldo", sub: `Faltam M ${fmt(Math.max(1, a.autoSt.falta))} para o próximo palete`, aviso: true };
  if (a.auto && a.autoSt && a.autoSt.tipo === "cheio") return { n: vaz.length, title: "Depósito de paletes cheio", sub: "A compra automática não tem onde guardar", aviso: true };
  if (a.auto) return { n: vaz.length, title: "Compra automática pedindo", sub: "O pedido sai em instantes", aviso: false };
  return { n: vaz.length, title: `${vaz.length} posição(ões) de palete sem estoque`, sub: "Compre paletes ou ligue a compra automática", aviso: true };
}
const salariosAtac = () => AT_ATIVO ? at().ops * AT_CFG.op.salario + at().balcao * AT_CFG.balcao.salario : 0;

// ---------- geometria: faixa de paletes, balcão do atacado, docas e galeria ----------
const FAIXA = () => ({ y0: 132 + Math.ceil(slots() / COLS) * 74 - 6, y1: FZ - 16 });
function posPalete(k) {          // 3 por coluna, nas três primeiras colunas (os corredores ficam livres)
  const col = Math.floor(k / 3), j = k % 3, x0 = LOJA.colunas[col] + 4, f = FAIXA();
  return { x: x0 + j * 36, y: f.y0 + 6, w: 30, h: 22, cx: x0 + j * 36 + 15, stand: f.y0 + 42 };
}
const BALCAO_AT = () => { const x0 = LOJA.colunas[3], f = FAIXA(); return { x: x0 + 10, y: f.y0 + 4, w: 92, h: 22, serve: { x: x0 + 56, y: f.y0 + 42 } }; };
const DOCA = k => ({ x: DEP.x + 8 + k * 64, y: 2, w: 58, h: 34 });
const GAL = k => ({ x: W + 22, y: 126 + k * 58, w: 160, h: 50 });

// ---------- compras de paletes, carretas e docas ----------
function comprarPaletes(id, n, silencioso, fid) {
  const fo = AT_FORN[fid || "ligeira"]; n = Math.max(n, fo.lote);
  const a = at(), c = Math.round(custoPalete(id, fo.id) * n * 100) / 100;
  if (S.money < c || S.money < 0) { if (!silencioso) toast(`Falta dinheiro: ${n} palete(s) de ${nomeSetor(id)} custam M ${fmt(c)}.`); return false; }
  if (depUsado() + paletesChegando() + n > depCapAt()) { if (!silencioso) toast(`O depósito de paletes não comporta: ${depUsado()} guardados e ${paletesChegando()} a caminho, de ${depCapAt()}.`); return false; }
  S.money -= c; S.today.outrasDesp = (S.today.outrasDesp || 0) + c; a.hoje.custo += c; a.hoje.paletes += n;
  const ult = a.transito[a.transito.length - 1];
  if (ult && ult.t < 3 && (ult.forn || "ligeira") === fo.id) { ult.itens[id] = (ult.itens[id] || 0) + n; ult.n += n; }        // pedidos seguidos da mesma distribuidora vão na mesma carreta
  else a.transito.push({ id: a.seq++, itens: { [id]: n }, n, t: 0, forn: fo.id, chega: fo.chegada });
  a.pedidosForn = a.pedidosForn || {}; a.pedidosForn[fo.id] = (a.pedidosForn[fo.id] || 0) + n;
  if (!silencioso) anunciar(`${n} palete(s) de ${nomeSetor(id)} pedidos à ${fo.nome}: M ${fmt(c)}. Chegam de carreta em cerca de ${fo.chegada} s.`);
  lastSig = ""; return true;
}
function tickCarretas(dt, a) {
  for (let k = a.transito.length - 1; k >= 0; k--) { const p = a.transito[k]; p.t += dt; if (p.t >= chegadaDe(p)) { a.transito.splice(k, 1); a.carretas.push({ id: p.id, itens: p.itens, restante: p.n, espera: 0, multada: false, doca: null }); lastSig = ""; } }
  // carretas encostam nas docas livres, por ordem de chegada
  a.carretas.forEach(c => { if (c.doca == null) { const livre = [...Array(a.docas).keys()].find(d => !a.carretas.some(o => o.doca === d)); if (livre != null) c.doca = livre; } });
  a.carretas.forEach(c => { if (c.doca == null || c.restante > 0) c.espera += dt;
    if (!c.multada && c.espera > AT_CFG.permanencia) { c.multada = true; S.money -= AT_CFG.multa; S.today.outrasDesp = (S.today.outrasDesp || 0) + AT_CFG.multa; a.hoje.multas++; a.hoje.multaValor += AT_CFG.multa; a.totMultas++;
      float(DOCA(c.doca || 0).x + 29, 40, `⏱️ taxa de permanência -M ${AT_CFG.multa}`, "#c9513a"); toastOnce("multaDoca", "Carreta parada demais: taxa de permanência cobrada. Ponha mais empilhadeiras na doca, abra outra doca ou libere espaço no depósito de paletes."); } });
}
// ---------- empilhadeiras ----------
const empilhadeiras = [];
function syncEmpilhadeiras(a) {
  while (empilhadeiras.length < a.ops) empilhadeiras.push({ id: 900 + empilhadeiras.length, x: P.whDoor.x, y: P.whDoor.y + 6, path: [], tarefa: null, t: 0, carga: null });
  while (empilhadeiras.length > a.ops) { const e = empilhadeiras.pop(); devolverTarefa(e); }
  empilhadeiras.forEach((e, i) => e.lugar = i < a.opsDoca ? "doca" : "salao");
}
function devolverTarefa(e) {        // a carga em trânsito volta para onde estava (nada se perde, nada duplica)
  const a = at(); if (!e.tarefa) return;
  if (e.tarefa.tipo === "descarregar" && e.carga) { const c = a.carretas.find(x => x.id === e.tarefa.carreta); if (c) { c.itens[e.carga] = (c.itens[e.carga] || 0) + 1; c.restante++; } else a.dep[e.carga] = (a.dep[e.carga] || 0) + 1; }
  if (e.tarefa.tipo === "levar" && e.carga) { a.dep[e.carga] = (a.dep[e.carga] || 0) + 1; const p = a.pos[e.tarefa.pos]; if (p) p.reservada = false; }
  if (e.tarefa.tipo === "subir") { if (e.carga) a.dep[e.carga] = (a.dep[e.carga] || 0) + 1; const p = a.pos[e.tarefa.pos]; if (p) { p.subindo = false; p.isolada = false; } }
  if (e.tarefa.tipo === "descer") { const p = a.pos[e.tarefa.pos]; if (p) { p.reservada = false; p.isolada = false; } }
  e.tarefa = null; e.carga = null;
}
function passoEmpilhadeira(e, dt, a) {
  const sp = 70;
  if (!e.tarefa) {
    if (e.lugar === "doca") {
      const c = a.carretas.find(x => x.doca != null && x.restante > 0);
      if (c && depUsado() < depCapAt()) { const id = Object.keys(c.itens).find(k => c.itens[k] > 0); c.itens[id]--; c.restante--; e.carga = id; e.tarefa = { tipo: "descarregar", carreta: c.id }; e.t = 0;
        const d = DOCA(c.doca); e.path = [{ x: e.x, y: 118 }, { x: d.x + 29, y: 118 }]; }
      else if (Math.abs(e.x - P.whDoor.x) > 2 || Math.abs(e.y - (P.whDoor.y + 6)) > 2) { if (!e.path.length) e.path = [{ x: P.whDoor.x, y: P.whDoor.y + 6 }]; follow(e, sp, dt); }
    } else {
      const kd = a.pos.findIndex((p, i) => i < a.nPos && p.sec && p.fardos === 0 && !p.reservada && p.alto > 0 && podeDescer(a, p));
      const ks = kd < 0 && !isRush() ? a.pos.findIndex((p, i) => i < a.nPos && p.sec && p.fardos > 0 && !p.subindo && p.niveis > p.alto && (a.dep[p.sec] || 0) > 1) : -1;   // sobe só o que sobra: 1 palete fica no depósito
      const k = kd >= 0 ? -1 : a.pos.findIndex((p, i) => i < a.nPos && p.sec && p.fardos === 0 && !p.reservada && (a.dep[p.sec] || 0) > 0);
      if (kd >= 0) { const p = a.pos[kd], pp = posPalete(kd), cor = corredorPara(e.x, pp.cx); p.reservada = true; e.tarefa = { tipo: "descer", pos: kd }; e.t = 0;
        e.path = [{ x: cor, y: e.y }, { x: cor, y: pp.stand - 4 }, { x: pp.cx, y: pp.stand - 4 }]; }
      else if (k < 0 && ks >= 0) { const p = a.pos[ks], pp = posPalete(ks), cor = corredorPara(P.whDoor.x, pp.cx); p.subindo = true; a.dep[p.sec]--; e.carga = p.sec; e.tarefa = { tipo: "subir", pos: ks }; e.t = 0;
        e.path = [{ x: P.whDoor.x, y: P.whDoor.y + 6 }, { x: cor, y: P.whDoor.y + 6 }, { x: cor, y: pp.stand - 4 }, { x: pp.cx, y: pp.stand - 4 }]; }
      else if (k >= 0) { const p = a.pos[k], pp = posPalete(k), cor = corredorPara(P.whDoor.x, pp.cx); p.reservada = true; a.dep[p.sec]--; e.carga = p.sec; e.tarefa = { tipo: "levar", pos: k };
        e.path = [{ x: P.whDoor.x, y: P.whDoor.y + 6 }, { x: cor, y: P.whDoor.y + 6 }, { x: cor, y: pp.stand - 4 }, { x: pp.cx, y: pp.stand - 4 }]; }
      else if (!e.path.length && Math.abs(e.x - P.whDoor.x) > 2) e.path = routeTo(e, P.whDoor.x, P.whDoor.y + 6);
      if (!e.tarefa) follow(e, sp, dt);
    }
    return;
  }
  if (e.tarefa.tipo === "descer" || e.tarefa.tipo === "subir") {         // manobra no alto: isola o trecho em frente à posição por alguns segundos
    if (!follow(e, sp, dt)) return;
    const k = e.tarefa.pos, p = a.pos[k];
    if (!p || !p.sec || (e.tarefa.tipo === "subir" && p.sec !== e.carga)) { devolverTarefa(e); return; }
    if (!p.isolada) {
      if (e.tarefa.tipo === "descer" ? !podeDescer(a, p) : isRush()) { if (e.tarefa.tipo === "descer") { p.reservada = false; e.tarefa = null; } else devolverTarefa(e); return; }   // preventiva: o pico começou, fica para depois
      if (comerciantes.some(c => c.alvo === k && c.estado === "pegando")) return;      // espera quem está pegando fardos sair do trecho
      p.isolada = true; e.t = 0; e.tarefa.semDeposito = isRush() && a.pulmao !== "urgente"; anunciar(`Posição ${k + 1} isolada por ${AT_CFG.isolar} segundos para a empilhadeira. Os corredores continuam livres.`); }
    e.t += dt; a.hoje.isoladoS += dt; if (e.t < AT_CFG.isolar) return;
    if (e.tarefa.tipo === "descer") { if (p.alto > 0) { p.alto--; p.fardos += AT_CFG.palete; a.hoje.descidas++; if (e.tarefa.semDeposito) a.hoje.semDeposito = (a.hoje.semDeposito || 0) + 1; if (isRush()) { a.hoje.urgentes++; if (comerciantes.some(c => c.alvo === k && c.estado !== "saindo")) changeRep(-0.01, "manobra"); } } p.reservada = false; }
    else { p.alto++; e.carga = null; a.hoje.subidas++; p.subindo = false; }
    p.isolada = false; e.tarefa = null; const cor = corredorPara(e.x, P.whDoor.x); e.path = [{ x: cor, y: e.y }, { x: cor, y: P.whDoor.y + 6 }, { x: P.whDoor.x, y: P.whDoor.y + 6 }]; lastSig = "";
    return;
  }
  if (e.tarefa.tipo === "descarregar") {
    if (!follow(e, sp, dt)) return;
    e.t += dt; if (e.t < AT_CFG.descarga) return;
    a.dep[e.carga] = (a.dep[e.carga] || 0) + 1; e.carga = null; e.tarefa = null; e.path = [{ x: P.whDoor.x, y: 118 }, { x: P.whDoor.x, y: P.whDoor.y + 6 }];
    a.carretas = a.carretas.filter(c => c.restante > 0 || empilhadeiras.some(o => o.tarefa && o.tarefa.carreta === c.id)); lastSig = "";
  } else if (e.tarefa.tipo === "levar") {
    if (!follow(e, sp, dt)) return;
    const p = a.pos[e.tarefa.pos]; if (p) { if (p.sec === e.carga) p.fardos += AT_CFG.palete; else a.dep[e.carga] = (a.dep[e.carga] || 0) + 1; p.reservada = false; }
    e.carga = null; e.tarefa = null; const pp = posPalete(0), cor = corredorPara(e.x, P.whDoor.x); e.path = [{ x: cor, y: e.y }, { x: cor, y: P.whDoor.y + 6 }, { x: P.whDoor.x, y: P.whDoor.y + 6 }]; lastSig = "";
  }
}

// ---------- comerciantes ----------
const comerciantes = []; let tCom = 0;
function novoComerciante(a) {
  const disp = [...new Set(a.pos.slice(0, a.nPos).map(p => p.sec).filter(Boolean))]; if (!disp.length) return;
  const n = Math.min(disp.length, 1 + (Math.random() < 0.45 ? 1 : 0)), secs = disp.slice().sort(() => Math.random() - 0.5).slice(0, n);
  const c = { id: 1000 + Math.floor(Math.random() * 1e6), x: -24, y: FZ + 16, path: [], plano: secs.map(s => ({ sec: s, q: 2 + Math.floor(Math.random() * 3), got: 0 })), passo: 0, estado: "entrando", espera: 0, valor: 0,
    skin: pick(SKIN), hair: pick(HAIR), shirt: pick(["#5d4037", "#37474f", "#455a64", "#6d4c41", "#2e7d32"]) };
  c.path = [{ x: 12, y: FZ + 16 }, { x: 24, y: FZ + 10 }];
  comerciantes.push(c); a.hoje.comerciantes++;
}
function irParaPalete(c, a) {
  const it = c.plano[c.passo]; let k = a.pos.findIndex((p, i) => i < a.nPos && p.sec === it.sec && p.fardos > 0); if (k < 0) k = a.pos.findIndex((p, i) => i < a.nPos && p.sec === it.sec);
  if (k < 0) { c.passo++; return proximoComerciante(c, a); }
  const pp = posPalete(k), cor = corredorPara(c.x, pp.cx); c.alvo = k;
  c.path = [{ x: cor, y: c.y }, { x: cor, y: pp.stand }, { x: pp.cx, y: pp.stand }]; c.estado = "andando"; c.espera = 0;
}
function proximoComerciante(c, a) {
  if (c.passo < c.plano.length) return irParaPalete(c, a);
  if (!c.plano.some(i => i.got > 0)) { sairComerciante(c, a, "😠 sem palete"); return; }
  const b = BALCAO_AT(), cor = corredorPara(c.x, b.serve.x); c.estado = "fila"; c.espera = 0; c.qAt = tAbs();
  c.path = [{ x: cor, y: c.y }, { x: cor, y: b.serve.y }, { x: b.serve.x, y: b.serve.y }];
}
function sairComerciante(c, a, motivo) {
  if (motivo) { a.hoje.perdidos++; changeRep(-0.06, "comerciante"); float(c.x, c.y - 18, motivo, "#c9513a");
    c.plano.forEach(i => { if (i.got) { const k = a.pos.findIndex((p, j) => j < a.nPos && p.sec === i.sec); if (k >= 0) a.pos[k].fardos += i.got; else guardarSoltos(a, i.sec, i.got); i.got = 0; } }); }   // devolve o que pegou
  c.estado = "saindo"; const cor = corredorPara(c.x, 0); c.path = [{ x: cor, y: c.y }, { x: cor, y: FZ + 10 }, { x: 12, y: FZ + 16 }, { x: -30, y: FZ + 16 }];
}
const filaAtac = () => comerciantes.filter(c => c.estado === "fila" || c.estado === "pagando").sort((x, y) => x.qAt - y.qAt);
let tBalcao = [0, 0];
function tickComerciantes(dt, a) {
  // chegada: mais comerciantes com boa reputação e galeria ocupada (lotérica e farmácia atraem gente)
  const temPalete = a.pos.slice(0, a.nPos).some(p => p.sec);
  const taxa = (1 / 8) * (0.7 + S.rep * 0.08) * (1 + fluxoInquilinos(galeria())) * (isRush() ? 1.3 : 1);
  if (temPalete && comerciantes.length < 14 && Math.random() < taxa * dt) novoComerciante(a);
  const fila = filaAtac(), b = BALCAO_AT();
  for (let i = comerciantes.length - 1; i >= 0; i--) {
    const c = comerciantes[i], sp = 62, chegou = follow(c, sp, dt);
    if (c.estado === "entrando" && chegou) { c.passo = 0; irParaPalete(c, a); }
    else if (c.estado === "andando" && chegou) c.estado = "pegando";
    else if (c.estado === "pegando") {
      const it = c.plano[c.passo], p = a.pos[c.alvo];
      if (p && p.sec === it.sec && p.fardos > 0 && !p.isolada) { c.espera += dt; if (c.espera >= 0.8) { c.espera = 0; p.fardos--; it.got++; if (it.got >= it.q) { c.passo++; proximoComerciante(c, a); } } }
      else { c.espera += dt; if (c.espera > AT_CFG.paciencia || (it.got > 0 && c.espera > 2)) { if (!it.got) float(c.x, c.y - 18, "😕", "#c9513a"); c.passo++; proximoComerciante(c, a); } }
    } else if (c.estado === "fila") {
      const pos = fila.indexOf(c); if (chegou) { const alvo = { x: b.serve.x - pos * 20, y: b.serve.y }; if (Math.abs(c.x - alvo.x) > 1) c.path = [alvo]; }
      c.espera += dt; if (c.espera > AT_CFG.pacienciaFila + 6 * (a.balcao - 1)) { sairComerciante(c, a, "😤 fila do atacado"); continue; }
    } else if (c.estado === "saindo" && chegou) comerciantes.splice(i, 1);
  }
  // balcão: cada operador atende um comerciante por vez
  for (let k = 0; k < a.balcao; k++) {
    const c = filaAtac()[k]; if (!c || c.estado !== "fila" || Math.abs(c.x - (b.serve.x - k * 20)) > 3) { tBalcao[k] = 0; continue; }
    tBalcao[k] += dt; if (tBalcao[k] < AT_CFG.atendimento) continue; tBalcao[k] = 0;
    const v = c.plano.reduce((s, it) => s + it.got * precoFardo(it.sec), 0), nf = c.plano.reduce((s, it) => s + it.got, 0);
    S.money += v; S.earned += v; S.today.outras = (S.today.outras || 0) + v; a.hoje.receita += v; a.hoje.fardos += nf; a.totFardos += nf; changeRep(0.02, "fardos");
    float(b.serve.x, b.serve.y - 30, `📦 ${nf} fardos +M ${fmt(v)}`, "#2e7a57");
    c.plano.forEach(it => it.got = 0); sairComerciante(c, a, null);
  }
}

// ---------- tick, fim do dia e reposição automática ----------
let tAutoPal = 0;
function tickAtacado(dt) {
  const a = at();
  tickCarretas(dt, a); syncEmpilhadeiras(a); empilhadeiras.forEach(e => passoEmpilhadeira(e, dt, a)); tickComerciantes(dt, a);
  tickLocacao(galeria(), GAL_CFG, dt);
  // fardos soltos (devolvidos) voltam para a posição vazia do mesmo setor
  for (let k = 0; k < a.nPos; k++) { const p = a.pos[k]; if (p.sec && !p.fardos && !p.reservada && a.soltos[p.sec] > 0) { p.fardos = a.soltos[p.sec]; a.soltos[p.sec] = 0; } }
  if (a.auto) { tAutoPal += dt; if (tAutoPal > 2) { tAutoPal = 0;      // mantém 2 paletes por setor da faixa (depósito + caminho)
    const secs = [...new Set(a.pos.slice(0, a.nPos).map(p => p.sec).filter(Boolean))];
    let st = { tipo: "ok" };
    for (const id of secs) { const tem = (a.dep[id] || 0) + noCaminho(id);
      if (tem >= 2 + altoLivre(id)) continue;
      const fo = AT_FORN[a.autoForn || "ligeira"], c = custoPalete(id, fo.id) * fo.lote, falta = c + bills() + 60 - S.money;
      if (depUsado() + paletesChegando() + fo.lote > depCapAt()) { st = { tipo: "cheio", sec: id }; continue; }
      if (falta >= 0) { if (st.tipo === "ok") st = { tipo: "saldo", sec: id, falta }; continue; }
      comprarPaletes(id, fo.lote, true, fo.id); st = { tipo: "comprando", sec: id }; break; }
    a.autoSt = st; } } else a.autoSt = null;
}
function fecharGaleria() {           // antes do fechamento: aluguéis e custos da galeria entram no resultado do dia
  const d = diaLocacao(galeria(), GAL_CFG);
  S.money += d.receita - d.despesas; S.today.outras = (S.today.outras || 0) + d.receita; S.today.outrasDesp = (S.today.outrasDesp || 0) + d.despesas;
  S.today.linhas = (S.today.linhas || []).concat([["Galeria: aluguéis recebidos", `M ${fmt(d.receita)}`], ["Galeria: manutenção e vagas", `-M ${fmt(d.despesas)}`]]);
}
function fimDoDiaAtacado(L) {
  const a = at(), h = a.hoje, tot = h.comerciantes;
  const d = { dia: L.day, fardos: h.fardos, receita: Math.round(h.receita), custo: Math.round(h.custo), comerciantes: tot, perdidos: h.perdidos, multas: h.multas, paletes: h.paletes, descidas: h.descidas, subidas: h.subidas, urgentes: h.urgentes, isoladoS: Math.round(h.isoladoS) };
  a.dias.unshift(d); a.dias.length = Math.min(a.dias.length, 5); L.atacado = d; a.hoje = novoHojeAt();
}

// ---------- ações ----------
function atribuirPosicao(k, d) {
  const a = at(), p = a.pos[k]; if (!p || k >= a.nPos) return;
  const opcoes = [null, ...openSectors().map(s => s.id)], i = opcoes.indexOf(p.sec), novo = opcoes[(i + d + opcoes.length) % opcoes.length];
  if (p.reservada || p.subindo || p.isolada) { toast("A empilhadeira está trabalhando nesta posição. Tente em alguns segundos."); return; }
  if (p.fardos > 0 && p.sec) { guardarSoltos(a, p.sec, p.fardos); p.fardos = 0; }
  if (p.alto > 0 && p.sec) { a.dep[p.sec] = (a.dep[p.sec] || 0) + p.alto; p.alto = 0; }     // paletes do alto descem para o depósito   // 1.3: fardos voltam como fardos (antes arredondava para palete inteiro)
  p.sec = novo; anunciar(`Posição ${k + 1}: ${novo ? nomeSetor(novo) : "livre"}.`); save(); lastSig = ""; renderSheet();
}
function mudarOps(d) {
  const a = at();
  if (d > 0) { if (a.ops >= AT_CFG.op.max) { toast(`No máximo ${AT_CFG.op.max} empilhadeiras.`); return; } if (!pagarContratacao(AT_CFG.op.contratar, "um operador de empilhadeira")) return; a.ops++; }
  else if (a.ops > 1) a.ops--;
  a.opsDoca = Math.min(a.opsDoca, a.ops); save(); lastSig = ""; renderSheet();
}
function mudarOpsDoca(d) { const a = at(); a.opsDoca = Math.max(0, Math.min(a.ops, a.opsDoca + d)); anunciar(`${a.opsDoca} na doca, ${a.ops - a.opsDoca} no salão.`); save(); lastSig = ""; renderSheet(); }
function mudarBalcao(d) {
  const a = at();
  if (d > 0) { if (a.balcao >= AT_CFG.balcao.max) return; if (!pagarContratacao(AT_CFG.balcao.contratar, "um caixa do atacado")) return; a.balcao++; }
  else if (a.balcao > 1) a.balcao--;
  save(); lastSig = ""; renderSheet();
}
function ampliar(oque) {
  const a = at();
  if (oque === "pos") { if (a.nPos >= AT_CFG.posicoes[1]) return; if (!pagarContratacao(AT_CFG.posCusto, "a ampliação da faixa de paletes")) return; a.nPos = AT_CFG.posicoes[1]; banner("🟨 Faixa de paletes ampliada: 9 posições", "#e8711a"); }
  else if (oque === "dep") { const c = AT_CFG.depCusto[a.depLvl]; if (c == null) return; if (!pagarContratacao(c, "a porta-paletes")) return; a.depLvl++; banner(`🏗️ Depósito de paletes: ${depCapAt()} lugares`, "#e8711a"); }
  else if (oque === "doca") { if (a.docas >= 2) return; if (!pagarContratacao(AT_CFG.docaCusto, "a segunda doca")) return; a.docas = 2; banner("🚛 Segunda doca aberta", "#e8711a"); }
  save(); lastSig = ""; renderSheet();
}
function escolherFornAuto(fid) { const a = at(); if (!AT_FORN[fid]) return; a.autoForn = fid; const fo = AT_FORN[fid];
  toast(`Compra automática pela ${fo.nome}: ${fo.resumo}.`); save(); lastSig = ""; renderSheet(); }
function alternarAutoPal() { const a = at(); a.auto = !a.auto; toast(a.auto ? "Compra automática: mantém 2 paletes de cada setor da faixa (no depósito ou a caminho)." : "Compra de paletes manual."); save(); lastSig = ""; renderSheet(); }

// ---------- desenho ----------
function desenharAtacado() {
  const a = at(), f = FAIXA();
  // faixa demarcada
  ctx.fillStyle = "rgba(242,178,51,.12)"; ctx.fillRect(8, f.y0, LOJA.colunas[2] + LOJA.gondola - 2, f.y1 - f.y0);
  ctx.strokeStyle = "rgba(200,140,20,.7)"; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeRect(8, f.y0, LOJA.colunas[2] + LOJA.gondola - 2, f.y1 - f.y0); ctx.setLineDash([]);
  text("FAIXA DE PALETES · VENDA EM FARDOS", 12, f.y0 - 3, 7, "#b8530c", "left", 800);
  for (let k = 0; k < 9; k++) {
    const p = a.pos[k], r = posPalete(k);
    if (k >= a.nPos) { ctx.strokeStyle = "rgba(120,100,60,.45)"; ctx.setLineDash([3, 3]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]); text("🔒", r.cx, r.y + 15, 9, "#8e7350"); continue; }
    rr(r.x, r.y + r.h - 5, r.w, 5, 1, "#a07a45"); rr(r.x + 2, r.y + r.h - 3, 4, 3, 0, "#7a5a2e"); rr(r.x + r.w - 6, r.y + r.h - 3, 4, 3, 0, "#7a5a2e");
    if (p.sec) { const d = secDefAt(p.sec), n = Math.min(8, p.fardos);
      for (let j = 0; j < n; j++) { const cx = r.x + 1 + (j % 4) * 7, cy = r.y + r.h - 11 - Math.floor(j / 4) * 7; rrs(cx, cy, 7, 6, 1, d.color, shade(d.color, .6), .7); }
      rr(r.cx - 9, r.y - 9, 18, 10, 4, p.fardos ? "#fff" : "#c9513a"); text(p.fardos ? `${d.ic}${p.fardos}` : "VAZIO", r.cx, r.y - 1.5, p.fardos ? 6.5 : 5.5, p.fardos ? "#333" : "#fff");
    } else text("livre", r.cx, r.y + 12, 6.5, "#8e7350");
    if (p.niveis) { ctx.strokeStyle = "#5d6d7e"; ctx.lineWidth = 1.4; ctx.strokeRect(r.x - 1, r.y - 22, r.w + 2, 12 * p.niveis - 2 > 0 ? 11 : 11);
      for (let j = 0; j < p.niveis; j++) { const yy = r.y - 21 + 0; const xx = r.x + 1 + j * (r.w / 2); rr(xx, yy, r.w / 2 - 3, 9, 1, j < p.alto && p.sec ? secDefAt(p.sec).color : "rgba(93,109,126,.18)"); }
      text("ALTO", r.x + r.w + 9, r.y - 14, 5, "#5d6d7e"); }
    if (p.isolada) { const z = zonaIsolada(k); ctx.strokeStyle = "#f57c00"; ctx.setLineDash([3, 2]); ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
      [z.x + 2, z.x + z.w - 2].forEach(x => { ctx.fillStyle = "#f57c00"; ctx.beginPath(); ctx.moveTo(x, z.y + z.h - 8); ctx.lineTo(x + 3, z.y + z.h); ctx.lineTo(x - 3, z.y + z.h); ctx.fill(); }); }
  }
  // balcão do atacado
  const b = BALCAO_AT(); rr(b.x, b.y, b.w, b.h, 5, "#e8711a"); rr(b.x + 3, b.y + 3, b.w - 6, 9, 3, "#fff3e6"); text("CAIXA ATACADO", b.x + b.w / 2, b.y + 10, 6.5, "#b8530c", "center", 800);
  for (let k = 0; k < a.balcao; k++) person({ x: b.serve.x - k * 20, y: b.y - 6, id: 950 + k, skin: SKIN[k + 1], hair: HAIR[k + 2] }, { body: "#e8711a", cap: "#2e7d32" });
  // docas e carretas (na rua de cima, sobre o depósito)
  for (let k = 0; k < 2; k++) { const d = DOCA(k);
    if (k >= a.docas) { ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.setLineDash([4, 4]); ctx.strokeRect(d.x, d.y + 2, d.w, d.h - 4); ctx.setLineDash([]); text("DOCA 2 🔒", d.x + d.w / 2, d.y + 20, 6.5, "#fff"); continue; }
    rr(d.x, 34, d.w, 6, 1, "#f2b233"); for (let i = 0; i < 6; i++) rr(d.x + 2 + i * 10, 35, 5, 4, 0, "#333");
    text(`DOCA ${k + 1}`, d.x + d.w / 2, 46 - 1, 6, "#4a3b22", "center", 800); }
  a.carretas.forEach((c, i) => { const d = c.doca != null ? DOCA(c.doca) : { x: DEP.x - 80 - i * 64, y: 2, w: 58 }; carreta(d.x, 6, c); });
  // empilhadeiras
  empilhadeiras.forEach(e => { rr(e.x - 8, e.y - 6, 16, 11, 3, "#f2b233"); rr(e.x - 6, e.y - 13, 9, 8, 2, "#333"); rr(e.x + 7, e.y - 10, 2, 14, 0, "#555");
    if (e.carga) rr(e.x + 8, e.y - 6, 10, 9, 1, secDefAt(e.carga).color); ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(e.x - 5, e.y + 5, 2.4, 0, 7); ctx.arc(e.x + 5, e.y + 5, 2.4, 0, 7); ctx.fill(); });
  desenharGaleria();
}
function carreta(x, y, c) {
  rr(x, y, 44, 24, 3, "#eceff1"); rr(x + 44, y + 4, 14, 20, 3, "#e8711a"); rr(x + 47, y + 7, 8, 7, 2, "#9ad0ec");
  text(`${c.restante}🟫`, x + 22, y + 16, 7, "#4a3b22", "center", 800);
  if (c.espera > AT_CFG.permanencia * 0.6) { rr(x + 4, y - 9, 36, 9, 4, c.multada ? "#c9513a" : "#b7773b"); text(c.multada ? "MULTA" : `${Math.max(0, Math.ceil(AT_CFG.permanencia - c.espera))} s`, x + 22, y - 2.5, 6, "#fff", "center", 800); }
}
function desenharGaleria() {
  const g = galeria(), x0 = W + 14, y0 = 112;
  rr(x0, y0, 176, 4 * 58 + 22, 10, "#d9d2c3"); rr(x0 + 4, y0 + 4, 168, 14, 5, "#e8711a"); text("GALERIA CAJUEIRO", x0 + 88, y0 + 14, 8, "#fff", "center", 800);
  g.unidades.forEach((u, k) => { const r = GAL(k), o = u.ocup, R = o && RAMOS[o.ramo];
    rr(r.x, r.y + 2, r.w, r.h, 6, o ? "#fbf8f1" : "#ece6d8");
    if (o) { rr(r.x, r.y + 2, r.w, 12, 5, R.cor); text(`${R.ic} ${o.nome}`.slice(0, 30), r.x + r.w / 2, r.y + 11, 6.5, "#fff", "center", 800); text(o.atrasos ? "⚠ atraso" : R.nome, r.x + r.w / 2, r.y + 30, 7, o.atrasos ? "#c9513a" : "#555");
      if (o.resta <= 0) text("contrato vencido", r.x + r.w / 2, r.y + 42, 6.5, "#b7773b"); }
    else { text("ALUGA-SE", r.x + r.w / 2, r.y + 24, 9, "#b8530c", "center", 800); text(u.nome, r.x + r.w / 2, r.y + 38, 6.5, "#8e7350"); }
  });
  const np = g.propostas.length; if (np) { rr(x0 + 124, y0 - 10, 50, 14, 7, "#c9302c"); text(`${np} proposta${np > 1 ? "s" : ""}`, x0 + 149, y0 + 0.5, 6.5, "#fff", "center", 800); }
}
function pessoasAtac() { return comerciantes.map(c => ({ id: c.id, x: c.x, y: c.y, com: c })); }
function desenharComerciante(v) { const c = v.com; person(c, { body: c.shirt, moving: c.path.length > 0, mood: c.estado === "saindo" && c.plano.every(i => !i.got) ? null : undefined, box: c.plano.some(i => i.got) ? "📦" : null });
  rr(c.x - 11, c.y - 36, 22, 8, 4, "#5d4037"); text("CNPJ", c.x, c.y - 30, 5.6, "#fff"); }

// ---------- painéis ----------
function buildAtacado(body) {
  const a = at();
  head("📦", "#fde9d6", "Atacado: paletes e docas", () => `${a.hoje.fardos} fardos hoje · ${comerciantes.length} comerciante(s) no salão · ${a.carretas.length} carreta(s)`);
  body.appendChild(el("p", "note", `Fardo = ${AT_CFG.fardo} unidades, ${Math.round((1 - AT_CFG.precoFardo) * 100)}% mais barato por unidade que na gôndola. O palete (${AT_CFG.palete} fardos) custa ${Math.round(AT_CFG.custoFardo * 100)}% do preço de caixa: a margem é menor, o volume é maior.`));
  body.appendChild(statsBox([
    ["Comerciantes hoje", () => `${at().hoje.comerciantes} (${at().hoje.perdidos} perdidos)`],
    ["Receita do atacado", () => `M ${fmt(at().hoje.receita)}`],
    ["Depósito de paletes", () => `${depUsado()} de ${depCapAt()} · ${paletesChegando()} a caminho`],
    ["Taxas de doca hoje", () => at().hoje.multas ? `${at().hoje.multas} (M ${fmt(at().hoje.multaValor)})` : "nenhuma"],
  ]));
  // posições
  body.appendChild(el("div", "sec-title", `Faixa de paletes (${a.nPos} posições)`));
  const pc = el("div", "card"); pc.appendChild(el("p", "note", "Escolha o setor de cada posição. A empilhadeira do salão traz um palete do depósito quando a posição esvazia."));
  for (let k = 0; k < a.nPos; k++) { const p = a.pos[k];
    pc.appendChild(passo(`Posição ${k + 1}`, () => { const q = at().pos[k]; return q.sec ? `${secDefAt(q.sec).ic} ${nomeSetor(q.sec)} · ${q.fardos} fardos` : "livre"; }, () => atribuirPosicao(k, -1), () => atribuirPosicao(k, 1), `setor da posição ${k + 1}`)); }
  if (a.nPos < AT_CFG.posicoes[1]) { const b = el("button", "btn", `Ampliar para ${AT_CFG.posicoes[1]} posições por M ${fmt(AT_CFG.posCusto)}`); b.onclick = () => ampliar("pos"); pc.appendChild(b); }
  body.appendChild(pc);
  // estoque vertical
  body.appendChild(el("div", "sec-title", "Estoque no alto (porta-paletes)"));
  const vc = el("div", "card", `<p class="note">Cada posição pode guardar até ${AT_CFG.niveisMax} paletes no alto (M ${fmt(AT_CFG.nivelCusto)} por nível). O alto não está à venda: quando a posição esvazia, a empilhadeira desce o palete em ${AT_CFG.isolar} s, sem ir ao depósito, isolando só o trecho em frente à posição (os corredores continuam livres). Fora do pico, ela sobe paletes do depósito para o alto. A compra automática também abastece o alto.</p>`);
  const pb = el("button", "plain toggle", `<span>Descer do alto no horário de pico: <b>${a.pulmao === "urgente" ? "sim (urgente)" : "não (só fora do pico)"}</b></span>`); pb.setAttribute("aria-pressed", String(a.pulmao === "urgente")); pb.onclick = alternarPulmao; vc.appendChild(pb);
  for (let k = 0; k < a.nPos; k++) { const p = a.pos[k];
    const row = el("div", "req", `<span>Posição ${k + 1}${p.sec ? ` (${nomeSetor(p.sec)})` : ""}: chão ${p.fardos} fardos · alto ${p.alto} de ${p.niveis} palete(s)${p.isolada ? " · <b>isolada agora</b>" : ""}</span>`);
    if (p.niveis < AT_CFG.niveisMax) { const b = el("button", "plain mini", `<span>+ nível (M ${fmt(AT_CFG.nivelCusto)})</span>`); b.setAttribute("aria-label", `Instalar nível no alto na posição ${k + 1} por M ${fmt(AT_CFG.nivelCusto)}`); b.onclick = () => instalarNivel(k); row.appendChild(b); }
    vc.appendChild(row); }
  const dd = a.dias[0]; if (dd && (dd.descidas || dd.subidas)) vc.appendChild(el("p", "note", `Ontem: ${dd.descidas} descida(s) do alto (${dd.urgentes || 0} no pico), ${dd.subidas} subida(s), trechos isolados por ${dd.isoladoS || 0} s.`));
  body.appendChild(vc);
  // compra de paletes
  body.appendChild(el("div", "sec-title", "Comprar paletes"));
  const cc = el("div", "card");
  const ab = el("button", "plain toggle", `<span>Compra automática (2 por setor da faixa): <b id="atAutoSt">${autoTxt()}</b></span>`); live(() => { const q = ab.querySelector("#atAutoSt"); if (q) q.textContent = autoTxt(); }); ab.setAttribute("aria-pressed", String(a.auto)); ab.onclick = alternarAutoPal; cc.appendChild(ab);
  // distribuidora: rápida ou barata (vale para os botões e para a compra automática)
  const fsel = AT_FORN[ui.atForn] ? ui.atForn : (a.autoForn || "ligeira");
  const seg = el("div", "acts setores-forn"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Distribuidora de paletes");
  Object.values(AT_FORN).forEach(fo => { const bt = el("button", "plain mini" + (fo.id === fsel ? " toggle" : ""), `<span>${fo.ic} ${fo.nome}</span>`);
    bt.setAttribute("aria-pressed", String(fo.id === fsel)); bt.setAttribute("aria-label", `${fo.nome}: ${fo.resumo}`);
    bt.onclick = () => { ui.atForn = fo.id; lastSig = ""; renderSheet(); }; seg.appendChild(bt); });
  cc.appendChild(seg);
  const fo = AT_FORN[fsel];
  cc.appendChild(el("p", "note", `${fo.ic} <b>${fo.nome}</b>: ${fo.resumo}. ${fo.lote > 1 ? "O lote inteiro reserva lugar no porta-paletes desde o pedido." : "Bom para não deixar posição vazia."}`));
  const g = el("div", "linha2");
  openSectors().forEach(d => { const b = el("button", "plain mini", `<span>${d.ic} ${d.name}: ${fo.lote} palete${fo.lote > 1 ? "s" : ""} M ${fmt(custoPalete(d.id, fo.id) * fo.lote)} · fardo M ${fmt(precoFardo(d.id))} · tem ${a.dep[d.id] || 0}${noCaminho(d.id) ? ` · ${noCaminho(d.id)} a caminho` : ""}</span>`);
    b.setAttribute("aria-label", `Pedir ${fo.lote} palete${fo.lote > 1 ? "s" : ""} de ${d.name} à ${fo.nome} por M ${fmt(custoPalete(d.id, fo.id) * fo.lote)}`);
    b.onclick = () => { comprarPaletes(d.id, fo.lote, false, fo.id); renderSheet(); }; g.appendChild(b); });
  cc.appendChild(g);
  if ((a.autoForn || "ligeira") !== fsel) { const bu = el("button", "plain", `<span>Usar a ${fo.nome} também na compra automática</span>`); bu.onclick = () => escolherFornAuto(fsel); cc.appendChild(bu); }
  else cc.appendChild(el("p", "note", `A compra automática usa a ${fo.nome}.`));
  cc.appendChild(el("p", "note", `Carreta parada mais de ${AT_CFG.permanencia} s paga M ${AT_CFG.multa} de taxa de permanência: lote grande pede empilhadeira na doca.`));
  const cd = AT_CFG.depCusto[a.depLvl]; if (cd != null) { const b = el("button", "plain", `<span>Porta-paletes: ${depCapAt()} → ${AT_CFG.depCap[a.depLvl + 1]} lugares por M ${fmt(cd)}</span>`); b.onclick = () => ampliar("dep"); cc.appendChild(b); }
  body.appendChild(cc);
  // equipe
  body.appendChild(el("div", "sec-title", "Empilhadeiras e docas"));
  const ec = el("div", "card", `<p class="note">Cada operador custa M ${AT_CFG.op.salario} por dia (contratação M ${AT_CFG.op.contratar}). Na doca, descarrega carretas; no salão, leva paletes à faixa. Uma posição vazia vende nada; uma carreta parada paga taxa.</p>`);
  ec.appendChild(passo("Operadores de empilhadeira", () => `${at().ops}`, () => mudarOps(-1), () => mudarOps(1), "operadores de empilhadeira"));
  ec.appendChild(passo("Deles, na doca", () => `${at().opsDoca} (salão: ${at().ops - at().opsDoca})`, () => mudarOpsDoca(-1), () => mudarOpsDoca(1), "operadores na doca"));
  ec.appendChild(passo("Caixas no balcão do atacado", () => `${at().balcao}`, () => mudarBalcao(-1), () => mudarBalcao(1), "caixas do atacado"));
  if (a.docas < 2) { const b = el("button", "btn", `Abrir a segunda doca por M ${fmt(AT_CFG.docaCusto)}`); b.onclick = () => ampliar("doca"); ec.appendChild(b); } else ec.appendChild(el("p", "note", "Duas docas: duas carretas descarregam ao mesmo tempo."));
  body.appendChild(ec);
  if (a.dias.length) { body.appendChild(el("div", "sec-title", "Dias anteriores"));
    a.dias.slice(0, 3).forEach(d => body.appendChild(el("div", "req", `<span>Dia ${d.dia}: ${d.fardos} fardos, ${d.comerciantes} comerciantes (${d.perdidos} perdidos)${d.multas ? `, ${d.multas} taxa(s) de doca` : ""}</span><b>M ${fmt(d.receita)}</b>`))); }
}
function buildGaleria(body) {
  const g = galeria();
  head("🏬", "#fde9d6", "Galeria Cajueiro", () => `${ocupadas(g).length} de ${g.unidades.length} salas ocupadas · ${g.propostas.length} proposta(s)`);
  body.appendChild(el("p", "note", "Quatro salas ao lado do atacarejo. Escolha os inquilinos pelas propostas: aluguel, prazo, risco de atraso e quanto movimento trazem. Salas vagas custam condomínio. Aqui você aprende o que vai usar no shopping."));
  painelLocacao(body, g, GAL_CFG);
}
function cartaoAtacado() {
  const c = el("div", "card"); c.innerHTML = `<h3>📦 Atacado e 🏬 galeria</h3><p class="note" id="atRes"></p>`;
  live(() => { const q = c.querySelector("#atRes"); if (!q) return; const a = at(), g = galeria(), cv = causaVazia();
    q.innerHTML = `${a.hoje.fardos} fardos vendidos hoje${cv ? ` · <span class="tag ${cv.aviso ? "ruim" : "aviso"}">${cv.n} posição(ões) vazia(s): ${cv.title.toLowerCase()}</span>` : ""}${a.auto ? ` · compra automática ${autoTxt().replace(/^ligada, ?/, "")}` : ""}${a.carretas.some(x => x.espera > AT_CFG.permanencia * 0.6) ? ' · <span class="tag aviso">carreta esperando</span>' : ""} · galeria ${ocupadas(g).length}/${g.unidades.length}${g.propostas.length ? ` · <b>${g.propostas.length} proposta(s)</b>` : ""}`; });
  const g = el("div", "linha2"); const b1 = el("button", "btn", "Paletes e docas"); b1.onclick = () => openSheet("atacado"); const b2 = el("button", "btn", "Galeria"); b2.onclick = () => openSheet("galeria"); g.appendChild(b1); g.appendChild(b2); c.appendChild(g);
  return c;
}

// ---------- capítulo 6: configuração ----------
const AT_META = { fardos: 400, ocupacao: 0.75, perdidosMax: 0.12 };
FASE_CFG.cajueiro = {
  capitulo: 6, titulo: "Atacarejo Cajueiro", lugar: "RJ-106",
  resumo: "Atacarejo à beira da rodovia: galpão largo, docas de carretas, estacionamento amplo e uma pequena galeria de lojas ao lado.",
  intro: "Aqui o volume manda. <b>Comerciantes</b> compram <b>fardos</b> direto dos paletes na faixa do salão e pagam no balcão do atacado. Compre paletes da Ligeira (rápida) ou da Serra (lote de 3, mais barato), descarregue as carretas nas <b>docas</b> antes da taxa de permanência e divida as empilhadeiras entre doca e salão. Ao lado, a <b>galeria</b> tem quatro salas: escolha inquilinos e acompanhe aluguel, ocupação e despesas.",
  essenciais: ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria", "acougue"],
  dia: { vazioMax: 0.15, perdidosMax: 0.08, repMin: 3.9 },
  diasSeguidos: 3, lucroMedio: 900,
  aluguel: 220, fluxo: 1.0,
  aberturas: { frios: 3000, limpeza: 4000 },
  convite: {
    responsabilidades: "venda em fardos para comerciantes, compra de paletes, docas e taxa de permanência, empilhadeiras divididas entre doca e salão, e a galeria com propostas, aluguéis, ocupação e despesas.",
    comeca: "orçamento de M 6.000, seis setores no varejo, faixa com 6 posições de palete, 2 empilhadeiras, 1 doca, 1 caixa no balcão do atacado e a galeria vazia.",
  },
  estrutura: [
    { id: "posicoes", label: "Ampliar a faixa para 9 posições de palete", como: "Aba Carreira > Paletes e docas.", have: () => at().nPos, need: 9, painel: "atacado" },
    { id: "operadores", label: "Ter 3 operadores de empilhadeira", como: "Divida entre doca e salão conforme as carretas e as posições vazias.", have: () => at().ops, need: 3, painel: "atacado" },
    { id: "docas", label: "Abrir a segunda doca", como: "Duas carretas descarregam ao mesmo tempo.", have: () => at().docas, need: 2, painel: "atacado" },
    { id: "balcao", label: "Dois caixas no balcão do atacado", como: "Comerciante desiste se a fila demorar.", have: () => at().balcao, need: 2, painel: "atacado" },
    { id: "galeria", label: "Ocupar 3 das 4 salas da galeria", como: "Aba Carreira > Galeria. Aceite propostas.", have: () => ocupadas(galeria()).length, need: 3, painel: "galeria" },
  ],
  extras() {
    const a = at(), g = galeria(), ds = g.dias.slice(0, 3), okGal = ds.length >= 3 && ds.every(d => d.ocupacao >= AT_META.ocupacao && d.resultado > 0);
    return [
      { id: "fardos", label: `${AT_META.fardos} fardos vendidos`, tipo: "gestao", have: a.totFardos, need: AT_META.fardos, como: "Mantenha as posições abastecidas e a fila do balcão curta." },
      { id: "galeriaRes", label: `Galeria com ${pctTxt(AT_META.ocupacao)} de ocupação e resultado positivo por 3 dias`, tipo: "gestao", have: okGal ? 1 : 0, need: 1,
        mostra: () => ds.length ? `${ds.filter(d => d.ocupacao >= AT_META.ocupacao && d.resultado > 0).length} de 3 dias` : "sem dias fechados", como: "Resultado = aluguéis recebidos menos manutenção, condomínio das vagas e limpeza." },
    ];
  },
  diaComo: () => `Um dia conta quando: gôndolas essenciais vazias até 15% do tempo, até 8% de clientes do varejo perdidos, até ${pctTxt(AT_META.perdidosMax)} dos comerciantes perdidos, nenhuma taxa de doca, reputação de pelo menos 3,9 e nenhuma dívida.`,
  avaliar(itens) {
    const h = at().hoje, pc = h.comerciantes ? h.perdidos / h.comerciantes : 0;
    itens.push({ ok: pc <= AT_META.perdidosMax, txt: `Comerciantes perdidos ${pctTxt(pc)} (máx. ${pctTxt(AT_META.perdidosMax)})` });
    itens.push({ ok: h.multas === 0, txt: h.multas ? `${h.multas} taxa(s) de permanência na doca` : "Nenhuma taxa de doca" });
  },
  fimDoDia(L) { fimDoDiaAtacado(L); },
  tick(dt) { tickAtacado(dt); },
  cartoes() { return [cartaoAtacado()]; },
  missao() {
    const a = at(), g = galeria();
    if (g.propostas.length && ocupadas(g).length < 3) return { title: `${g.propostas.length} proposta(s) para a galeria`, sub: "Escolha os inquilinos das salas", p: ocupadas(g).length / 4, ring: "🏬", go: () => openSheet("galeria") };
    const cv = causaVazia();
    if (cv && cv.aviso) return { title: cv.title, sub: cv.sub, p: 0, ring: "📦", go: () => openSheet("atacado") };
    return null;
  },
  orcamento: 6000,
  inicio() {
    S.tier = 1; S.money = this.orcamento; S.whLvl = 6; S.cashiers = 3;
    this.essenciais.forEach(id => { const st = S.sec[id]; st.open = true; st.staff = 1; st.shelfLvl = 2; st.shelf = shelfCap(st.shelfLvl); st.wh = 12; });
    S.gear.baskets = 20; S.gear.carts = 14; S.gear.collectors = 2; S.gear.colLvl = 2; S.park.price = 0;
    S.atac = novoAtac(); S.atac.pos[0].sec = "mercearia"; S.atac.pos[1].sec = "bebidas"; S.atac.pos[2].sec = "mercearia"; S.atac.pos[0].fardos = 8; S.atac.pos[1].fardos = 8; S.atac.pos[2].fardos = 8;
    S.atac.dep = { mercearia: 1, bebidas: 1 };
    S.galeria = null; const g = galeria(); gerarProposta(g, GAL_CFG);
    const r = CARREIRA && CARREIRA.repCarreira ? CARREIRA.repCarreira : 3;
    S.rep = Math.max(3, Math.min(3.5, 3 + (r - 3.5) * 0.5));
    ACH.forEach(x => { if (x.ok()) S.ach[x.id] = true; });
  },
  carregar() { const a = at(); galeria(); a.pos.forEach(p => p.reservada = false);
    if (!a.autoForn) { a.autoForn = "ligeira"; if (!introFasePendente) S.avisoPal16 = true; } },      // 1.6: partida em andamento ganha a Serra
  reabrir(r) { const a = at(); a.nPos = 9; a.ops = 3; a.docas = 2; a.balcao = 2; a.totFardos = AT_META.fardos; reabrirComum(r); },
  reaberturaTxt: "faixa de 9 posições, 3 empilhadeiras, 2 docas, 2 caixas no atacado e o orçamento inicial do Cajueiro (M 6.000)",
  previa: () => `<svg viewBox="0 0 220 120" class="previa" role="img" aria-label="Esquema do Atacarejo Cajueiro: galpão largo com depósito e docas de carretas no alto, faixa de paletes no salão, balcão do atacado e a galeria com quatro salas à direita">
    <rect width="220" height="120" rx="10" fill="#bfcf94"/><rect y="4" width="220" height="16" fill="#6f777c"/>
    <rect x="98" y="6" width="26" height="12" rx="2" fill="#eceff1"/><rect x="128" y="6" width="26" height="12" rx="2" fill="#eceff1"/>
    <rect x="10" y="22" width="150" height="84" rx="4" fill="#f3f3ef" stroke="#e8711a" stroke-width="1.5"/>
    <rect x="86" y="24" width="72" height="14" rx="2" fill="#8e7350"/><rect x="18" y="24" width="56" height="12" rx="2" fill="#e8711a"/>
    ${[0, 1, 2, 3].map(c => [0, 1].map(r => `<rect x="${14 + c * 36}" y="${44 + r * 12}" width="30" height="5" rx="1.5" fill="#b89a6c"/>`).join("")).join("")}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => `<rect x="${14 + k * 11}" y="72" width="9" height="8" rx="1" fill="#d9822b"/>`).join("")}<rect x="120" y="72" width="34" height="8" rx="2" fill="#e8711a"/>
    ${[0, 1, 2].map(i => `<rect x="${60 + i * 26}" y="92" width="12" height="6" rx="1.5" fill="#4b5a62"/>`).join("")}
    <rect x="166" y="30" width="46" height="70" rx="4" fill="#d9d2c3"/>${[0, 1, 2, 3].map(k => `<rect x="170" y="${36 + k * 16}" width="38" height="12" rx="2" fill="${["#2e7a57", "#3c8d40", "#ece6d8", "#d9822b"][k]}"/>`).join("")}
    <text x="189" y="112" font-size="7" font-weight="800" fill="#b8530c" text-anchor="middle">galeria</text></svg>`,
};

if (AT_ATIVO) {
  GANCHOS.aluguel = () => CFG && CFG.aluguel != null ? CFG.aluguel : tierNow().rent;
  GANCHOS.fluxo = () => (CFG && CFG.fluxo ? CFG.fluxo : 1) * (1 + fluxoInquilinos(galeria()));
  GANCHOS.salarios = () => salariosAtac();
  GANCHOS.antesDoFechamento = fecharGaleria;
  GANCHOS.obstaculos = () => { const a = at(), o = []; for (let k = 0; k < a.nPos; k++) { const r = posPalete(k); o.push({ x: r.x, y: r.y, w: r.w, h: r.h, nome: "palete " + (k + 1) }); } const b = BALCAO_AT(); o.push({ x: b.x, y: b.y, w: b.w, h: b.h, nome: "balcão do atacado" }); return o; };
  gancho("desenharLoja", () => { desenharAtacado(); });
  const p0 = GANCHOS.pessoas; GANCHOS.pessoas = () => pessoasAtac().concat(p0 ? p0() || [] : []);
  const d0 = GANCHOS.desenharPessoa; GANCHOS.desenharPessoa = v => v.com ? desenharComerciante(v) : d0 && d0(v);
  gancho("tocar", (x, y) => {
    const f = FAIXA(), inR = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (y >= f.y0 - 8 && y <= f.y1 && x >= 8 && x <= LOJA.colunas[3] + LOJA.gondola) return { kind: "atacado" };
    for (let k = 0; k < 2; k++) if (inR(DOCA(k))) return { kind: "atacado" };
    if (x >= W + 14 && x <= W + 190 && y >= 100 && y <= 112 + 4 * 58 + 22) return { kind: "galeria" };
    return null;
  });
  gancho("bRect", sel => sel.kind === "atacado" ? { x: 4, y: FAIXA().y0 - 12, w: LOJA.colunas[3] + LOJA.gondola, h: FAIXA().y1 - FAIXA().y0 + 16 } : sel.kind === "galeria" ? { x: W + 10, y: 98, w: 184, h: 4 * 58 + 40 } : null);
  gancho("painel", (sel, body) => { if (sel.kind === "atacado") { buildAtacado(body); return true; } if (sel.kind === "galeria") { buildGaleria(body); return true; } return null; });
  gancho("lista", body => {
    body.appendChild(listaRow("📦", "#fde9d6", "Faixa de paletes, docas e balcão do atacado", () => { const a = at(); return `${a.pos.slice(0, a.nPos).filter(p => p.sec && p.fardos).length} de ${a.nPos} posições com fardos · ${a.carretas.length} carreta(s) · ${filaAtac().length} na fila do atacado`; }, { kind: "atacado" }));
    body.appendChild(listaRow("🏬", "#fde9d6", "Galeria Cajueiro", () => { const g = galeria(); return `${ocupadas(g).length} de ${g.unidades.length} salas ocupadas · ${g.propostas.length} proposta(s)`; }, { kind: "galeria" }));
  });
  const a0 = GANCHOS.assinatura;
  GANCHOS.assinatura = () => { const a = at(); return (a0 ? a0() : "") + `|at${a.nPos}${a.ops}${a.opsDoca}${a.docas}${a.balcao}${a.depLvl}${a.auto}${a.autoForn || ""}${a.pos.map(p => p.sec).join(",")}${a.carretas.length}${a.transito.length}${a.dias.length}|${sigLocacao(galeria())}`; };
  GANCHOS.aoVoltar = (days) => {
    if (days <= 0) return [];
    const a = at(); let desc = 0;
    // carretas a caminho e paradas: descarregadas sem taxa (cabem até a capacidade; o resto continua na doca)
    a.transito.forEach(p => a.carretas.push({ id: p.id, itens: p.itens, restante: p.n, espera: 0, multada: true, doca: null })); a.transito = [];
    a.carretas.forEach(c => { Object.keys(c.itens).forEach(id => { while (c.itens[id] > 0 && depUsado() < depCapAt()) { c.itens[id]--; c.restante--; a.dep[id] = (a.dep[id] || 0) + 1; desc++; } }); c.espera = 0; c.doca = null; });
    a.carretas = a.carretas.filter(c => c.restante > 0);
    empilhadeiras.forEach(e => devolverTarefa(e));
    a.pos.forEach((p, k) => { if (k < a.nPos && p.sec && p.fardos === 0 && a.dep[p.sec] > 0) { a.dep[p.sec]--; p.fardos = AT_CFG.palete; } p.reservada = false; });
    a.hoje = novoHojeAt();
    const saiu = locacaoAoVoltar(galeria(), GAL_CFG, days);
    const L = [];
    if (desc) L.push(["Paletes descarregados enquanto você esteve fora", String(desc)]);
    if (saiu) L.push(["Contratos da galeria encerrados", `${saiu} sala(s) vaga(s)`]);
    const ren = galeria().propostas.filter(p => p.renovacao).length; if (ren) L.push(["Renovações esperando resposta", String(ren)]);
    return L;
  };
  PAINEIS.atacado = buildAtacado; PAINEIS.galeria = buildGaleria;
}
