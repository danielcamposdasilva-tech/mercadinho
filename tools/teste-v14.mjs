// Testes da versão 1.4: crédito (Livre, capítulo 8 antes de abrir, offline), reunião da semana no shopping
// (padrão, decisões com efeito, políticas, ocorrência), estoque vertical no atacarejo (conferência de fardos,
// trecho isolado fora dos corredores, compra automática) e diagnóstico (fila, filtro, desligar, envio em lote).
// Uso: node tools/teste-v14.mjs   (CHROME=caminho do Chrome)
import { iniciar, carreiraEm, sleep } from "./lib-cdp.mjs";
import { ROBO_BASE, ROBOS } from "./robos-capitulos.mjs";

const t = await iniciar();
const { js, ok, abrir, gravarCarreira } = t;
const G = expr => js(`(() => { const g = window.__game, S = g.S, C = g.CARREIRA; return ${expr}; })()`);
const recarregar = async () => { await abrir("carreira"); await js("hideModal()"); };
const robo = async codigo => { await js("hideModal()"); await js(ROBO_BASE); await js(`window.__passo = ${codigo}`); };
const dia = () => G(`(() => { window.__perdas = {}; window.__dia(window.__passo); return { dia: S.day, concl: S.fase ? S.fase.concluida : false }; })()`);

try {
  // ===== 1. crédito no modo Livre =====
  await abrir("livre"); await js("hideModal()"); await robo("() => {}");
  for (let d = 0; d < 4; d++) await dia();
  const c1 = await G(`(() => { const lim = limiteCredito(), m0 = S.money, n0 = S.today.outras || 0; const ok1 = contratarCredito(lim); const ok2 = contratarCredito(100);
    return { lim, ok1, ok2, delta: Math.round(S.money - m0), outras: (S.today.outras || 0) - n0, parc: S.credito.parcela, tot: S.credito.total }; })()`);
  ok(c1.lim >= 800 && c1.ok1 && !c1.ok2 && c1.delta === c1.lim && c1.outras === 0, `crédito Livre: limite M ${c1.lim}, recebido fora do resultado, um contrato por vez`);
  ok(c1.tot === Math.round(c1.lim * 1.12) && c1.parc === Math.ceil(c1.tot / 16), `crédito: 16 parcelas de M ${c1.parc}, total M ${c1.tot} (12%)`);
  let neg = false, pagas = 0, somaJ = 0, somaD = 0;
  for (let d = 0; d < 30; d++) { const r = await G(`(() => { const c = S.credito, j0 = c ? c.jurosRest : 0, p0 = c ? c.principalRest + c.jurosRest : 0, m0 = S.money; window.__perdas = {}; window.__dia(window.__passo);
      const c2 = S.credito; return { money: S.money, pago: p0 - (c2 ? c2.principalRest + c2.jurosRest : 0), jur: j0 - (c2 ? c2.jurosRest : 0), fim: !c2, net: S.lastDay.net, delta: S.money - m0 }; })()`);
    if (r.money < 0) neg = true; if (r.pago > 0) pagas++; somaJ += r.jur; somaD += r.delta - r.net + r.pago - r.jur; if (r.fim) break; }
  const c2 = await G(`({ ativo: !!S.credito, hist: (S.creditoHist || []).length, pagas: S.credito ? S.credito.pagas : 16 })`);
  ok(!neg && pagas >= 10, `crédito: ${pagas} parcelas cobradas em 30 dias, saldo nunca negativo (${c2.ativo ? "ainda ativo" : "quitado"})`);
  ok(Math.abs(somaD) < 2, `crédito: só os juros entram no resultado do dia (diferença acumulada M ${somaD.toFixed(2)}, juros pagos M ${Math.round(somaJ)})`);
  const q = await G(`(() => { if (!S.credito) { S.avgNet = Math.max(S.avgNet, 200); contratarCredito(limiteCredito()); } const v = custoQuitar(), c = S.credito, m = S.money + 100000; S.money = m; const okq = quitarCredito(); return { okq, v, pago: Math.round(m - S.money), ativo: !!S.credito, princ: Math.round(c.principalRest) }; })()`);
  ok(q.okq && !q.ativo && q.pago === q.v && q.v <= q.princ + 30, `crédito: quitação antecipada sem multa (M ${q.v} para principal de M ${q.princ})`);
  const pn = await G(`(() => { S.money = 50; contratarCredito(Math.min(limiteCredito(), 800)); S.money = 5; S.today.sales = 0; S.today.outras = 0; S.credito.ultBruto = 0; const r0 = S.credito.principalRest + S.credito.jurosRest; endDay(); return { pago: r0 - (S.credito.principalRest + S.credito.jurosRest), alongado: S.credito.alongado }; })()`);
  ok(pn.pago === 0 && pn.alongado >= 1, `crédito: sem receita, a parcela é adiada (prazo alongado), sem cobrar do saldo`);
  // offline
  const of = await G(`(() => { S.money = 3000; S.avgNet = 200; S.lastSeen = Date.now() - 3 * 3600e3; S.credito.carenciaAte = 0; const r = offlineProgress(); return { money: Math.round(S.money), linhas: JSON.stringify(r && r.linhas || []) }; })()`);
  ok(of.money >= 0 && /parcelas pagas/.test(of.linhas), `crédito offline: parcelas cobradas na volta, saldo M ${of.money}`);
  const ui = await G(`(() => { g.openSheet("credito"); const h = document.getElementById("shBody").textContent; g.closeSheet(); g.openSheet("upgrade"); const u = document.getElementById("shBody").textContent; g.closeSheet(); return { h: /Contrato ativo|Contratar/.test(h) && /12%/.test(h), u: /Crédito/.test(u) }; })()`);
  ok(ui.h && ui.u, "crédito: painel com juros, parcelas e total; entrada no Melhorar");

  // ===== 2. crédito no capítulo 8 antes da inauguração =====
  await gravarCarreira(carreiraEm("grande")); await recarregar();
  const g1 = await G(`(() => { const a = limiteCredito(); S.obra.lic.estudo = S.obra.lic.previa = S.obra.lic.audiencia = S.obra.lic.instalacao = { ok: true, t: 0 }; S.obra.fase = "obra"; const b = limiteCredito(); contratarCredito(b);
    const m = S.money; endDay(); endDay(); return { a, b, pagou: Math.round(m - S.money) < 0 ? 0 : S.credito.pagas, aguarda: S.credito.aguardaObra }; })()`);
  ok(g1.a === 0 && g1.b >= 3000 && g1.b <= 8000 && g1.pagou === 0 && g1.aguarda, `crédito na obra: só após a licença de instalação (limite M ${g1.b}), sem parcelas antes de abrir`);
  const g2 = await G(`(() => { S.obra.fase = "operacao"; S.obra.inaugurado = S.day; endDay(); const p1 = S.credito.pagas; endDay(); endDay(); S.money += 5000; S.credito.ultBruto = 5000; endDay(); return { p1, p2: S.credito.pagas, ate: S.credito.carenciaAte }; })()`);
  ok(g2.p1 === 0 && g2.p2 >= 1, `crédito na obra: cobrança começa 2 semanas depois da inauguração (pagas ${g2.p2})`);

  // ===== 3. reunião da semana: sem o jogador decidir, o capítulo 7 não avança =====
  await gravarCarreira(carreiraEm("brisa")); await recarregar(); await js("window.__semReuniao = true"); await robo(ROBOS.brisa);
  let r = null, d = 0; for (; d < 40; d++) { r = await dia(); if (r.concl) break; }
  const sem = await G(`(() => { const it = FASE_CFG.brisa.extras().find(x => x.id === "reunioes"); return { dec: decididas(), it: !!it, hist: S.shop.r14.hist[0] ? S.shop.r14.hist[0].linhas.join(" ") : "" }; })()`);
  ok(!r.concl && sem.it && sem.dec === 0 && /não contou/.test(sem.hist), `reunião: sem nenhuma escolha do jogador, 40 semanas e o capítulo 7 não conclui (reuniões decididas: ${sem.dec})`);
  await js("window.__semReuniao = false");
  await gravarCarreira(carreiraEm("brisa")); await recarregar(); await robo(ROBOS.brisa);
  r = null; d = 0; for (; d < 40; d++) { r = await dia(); if (r.concl) break; }
  const pad = await G(`({ hist: S.shop.r14.hist.length, dec: decididas() })`);
  ok(r.concl && pad.hist > 0 && pad.dec >= 4, `reunião: escolhendo cada decisão (mesmo a padrão), o capítulo 7 é concluído (dia ${r.dia}, ${pad.dec} reuniões) e o relatório traz o efeito`);
  const btn = await G(`(() => { g.openSheet("reuniao"); const t = document.getElementById("shBody").textContent; g.closeSheet(); return /Seguir o padrão em tudo/.test(t); })()`);
  ok(!btn, "reunião: não há mais o botão de seguir o padrão em tudo");

  // ===== 4. reunião: decisões com efeito =====
  await gravarCarreira(carreiraEm("brisa")); await recarregar(); await robo(ROBOS.brisa);
  for (let k = 0; k < 3; k++) await dia();
  const e = await G(`(() => { const r = r14(), res = {}; S.money += 30000;
    const cap0 = capacidade(); r.dec = r.dec.filter(d => d.area !== "operacao"); r.dec.push(Object.assign(decOperacao.call ? (() => { r.ultOp = null; const s = sh(); s.dias.unshift(Object.assign({}, s.dias[0] || {}, { recusa: 0.2, picoDentro: 99, cap: 10, recusados: 9 })); r.desg = Object.fromEntries(Object.keys(r.desg).map(k => [k, 0])); return decOperacao(); })() : null, { esc: 0, conf: false, feito: null }));
    const dl = decisao("lotacao"); res.tipoOp = dl && dl.tipo; escolher("lotacao", 1); res.capRazao = Math.round(capacidade() / cap0 * 100) / 100;
    // manutenção programada zera o desgaste no fechamento
    r.desg.escada = 0.9; r.ultOp = "lotacao"; r.dec = r.dec.filter(d => d.area !== "operacao"); const dm = Object.assign(decOperacao(), { esc: 0, conf: false }); r.dec.push(dm); res.tipoMan = dm.tipo; escolher(dm.tipo, 1); fecharSemanaShopping(); res.desg = r.desg[dm.dados.eq];
    return res; })()`);
  ok(e.tipoOp === "lotacao" && Math.abs(e.capRazao - 1.15) < 0.08, `reunião: entrada auxiliar aumenta a capacidade em ~15% (×${e.capRazao})`);
  ok(e.tipoMan === "manutencao" && e.desg === 0, "reunião: manutenção programada zera o desgaste no fechamento da semana");
  const an = await G(`(() => { const r = r14(), L = lojasSh(); L.unidades.filter(u => u.tam !== "ancora").slice(0, 4).forEach(u => u.ocup = null); L.propostas = []; const dc = Object.assign(decContratos(), { esc: 0, conf: false }); r.dec = r.dec.filter(d => d.area !== "contratos"); r.dec.push(dc);
    if (dc.tipo !== "composicao") return { tipo: dc.tipo }; escolher("composicao", 1); const cat = dc.dados.cat; for (let i = 0; i < 2; i++) gerarProposta(L, SH_LOC()); return { tipo: dc.tipo, cat, ok: L.propostas.slice(-2).every(p => RAMOS[p.ramo].cat === cat), receb: r.anuncio.recebidas }; })()`);
  ok(an.tipo === "composicao" && an.ok && an.receb === 2, `reunião: anunciar vaga traz as 2 próximas propostas do ramo pedido (${an.cat})`);
  const ng = await G(`(() => { const r = r14(), L = lojasSh(); const u = L.unidades.find(x => x.tam === "ancora" && !x.ocup) || L.unidades.find(x => x.tam === "ancora"); u.ocup = null; L.propostas = []; const p = { id: L.seq++, unidade: u.id, ramo: "depto", nome: "Teste Âncora", aluguel: 300, pct: 0.05, dias: 12, risco: 0.01, idade: 0 }; L.propostas.push(p);
    const dc = Object.assign(decContratos(), { esc: 0, conf: false }); r.dec = r.dec.filter(d => d.area !== "contratos"); r.dec.push(dc); const k = dc.opcoes.findIndex(o => o.id === "carencia"); escolher("negociar", k);
    const m0 = S.money; const dd = diaLocacao(L, SH_LOC()); return { k, car: u.ocup && u.ocup.carencia, nome: u.ocup && u.ocup.nome, rec: dd.receita }; })()`);
  ok(ng.k > 0 && ng.nome === "Teste Âncora" && ng.car === 1, `reunião: carência para âncora assina na hora e não cobra o aluguel fixo nas primeiras semanas`);
  const oc = await G(`(() => { const r = r14(); r.dec = r.dec.filter(d => d.tipo !== "seguranca"); r.ocorr = null; r.ocorrSem = 0; S.dayT = 1; SH_MOD.tick(0.1); const nome = r.ocorr && r.ocorr.nome; const s0 = SH_MOD.sat(); resolverOcorrencia(false); const s1 = SH_MOD.sat(); return { nome, s0, s1 }; })()`);
  ok(oc.nome && oc.s1 < oc.s0, `reunião: ocorrência leve (${oc.nome}); deixar a ronda baixa a satisfação um pouco`);
  const pol = await G(`(() => { const r = r14(); r.manual.operacao = 3; r.decididas = 2; alternarPolitica("operacao"); const antes = r.pol.operacao; r.decididas = 4; alternarPolitica("operacao"); return { antes, depois: r.pol.operacao }; })()`);
  ok(!pol.antes && pol.depois, "reunião: política só libera depois de 4 reuniões decididas pelo jogador e 3 escolhas na área");
  const ac = await G(`(() => { g.openSheet("reuniao"); const b = [...document.querySelectorAll("#shBody button")]; g.closeSheet(); return { n: b.length, rot: b.filter(x => x.getAttribute("aria-label") || x.textContent.trim()).length }; })()`);
  ok(ac.n > 3 && ac.rot === ac.n, `reunião: painel com ${ac.n} botões, todos com nome acessível`);
  // equipe no limite: equipamentos aumentam a capacidade por pessoa; Grande comporta mais; contagem e aviso do estacionamento
  const eqp = await G(`(() => { const s = sh(); S.money += 20000; s.limpeza = 10; s.seguranca = 10; const l0 = capLimpeza(), s0 = capSeguranca(); mudarEquipeSh("limpeza", 1); const n = s.limpeza;
    comprarEquipSh("limpeza"); comprarEquipSh("seguranca"); g.openSheet("operacao"); const h = document.getElementById("shBody").textContent; g.closeSheet();
    select({ kind: "sign" }); const sg = document.getElementById("shBody").textContent; closeSheet();
    return { sg: /Pessoas no shopping/.test(sg) && !/Clientes na loja/.test(sg), n, rl: capLimpeza() / l0, rs: capSeguranca() / s0, h: /Central de câmeras/.test(h) && /Equipe máxima: 10/.test(h), dica: dicaLotacao() }; })()`);
  ok(eqp.n === 10 && Math.abs(eqp.rl - 1.3) < 0.02 && Math.abs(eqp.rs - 1.3) < 0.02 && eqp.h, `equipe no limite (10): lavadora de piso e central de câmeras dão +30% de capacidade por pessoa`);
  ok(eqp.sg, "shopping: o painel de divulgação mostra as pessoas no shopping (não mais 'clientes na loja' zerado)");
  ok(/reforço temporário/.test(eqp.dica), `aviso de lotação com equipe e equipamentos no máximo aponta o reforço da reunião`);
  const pk = await G(`(() => { const c = { x: 10, y: 10 }; STALLS.forEach(s => { s.car = null; s.res = null; }); window.__t = []; const t0 = toast; toast = m => window.__t.push(m); const st0 = S.park.staff; S.park.staff = 1; delete toasted.parkfila; delete toasted.parkfull; avisoDesistiu(c);
    STALLS.forEach(s => s.res = 999); delete toasted.parkfull; avisoDesistiu(c); STALLS.forEach(s => s.res = null);
    S.park.staff = PK.maxStaff; delete toasted.parkfila; delete toasted.parkfull; avisoDesistiu(c); S.park.staff = st0; toast = t0; return window.__t; })()`);
  ok(/Fila na cancela/.test(pk[0] || "") && /lotado/.test(pk[1] || "") && /Amplie/.test(pk[2] || "") && !pk.slice(2).some(m => /Fila/.test(m)), "estacionamento: fila na cancela só com vagas livres e atendentes abaixo do máximo; com 4 atendentes nunca culpa a cancela");

  // ===== 5. estoque vertical no atacarejo =====
  await gravarCarreira(carreiraEm("cajueiro")); await recarregar(); await robo(ROBOS.cajueiro);
  await G(`(() => { window.__manuais = 0; const c0 = comprarPaletes; comprarPaletes = (id, n, sil) => { if (!sil) window.__manuais++; return c0(id, n, sil); }; return 1; })()`);
  const zonas = await G(`(() => { let ruim = 0; for (let k = 0; k < 9; k++) { const z = zonaIsolada(k); LOJA.corredores.forEach(x => { if (x >= z.x && x <= z.x + z.w) ruim++; }); } return ruim; })()`);
  ok(zonas === 0, "vertical: o trecho isolado de cada posição nunca cobre um corredor (rota acessível sempre livre)");
  let rc = null, furo = [], descPico = 0, pegouIsolada = 0;
  for (let k = 0; k < 40; k++) {
    rc = await G(`(() => { const a = at(); if (S.day === 3) { S.money += 25000; for (let k = 0; k < a.nPos; k++) { instalarNivel(k); instalarNivel(k); } }
      const secs = SECTORS.map(d => d.id), t0 = {}, v0 = a.totFardos; secs.forEach(id => t0[id] = totalFardosAt(id));
      let comp = {}, vend = {}; const c0 = comprarPaletes; comprarPaletes = (id, n, sil) => { const ok = c0(id, n, sil); if (ok) comp[id] = (comp[id] || 0) + n * AT_CFG.palete; return ok; };
      let pico = 0, isol = 0;
      const d0 = S.day; window.__perdas = {};
      for (let i = 0; i < 2000 && S.day === d0; i++) { if (i % 40 === 0) __recolher(); if (i % 20 === 0) window.__passo(i);
        const antes = {}; secs.forEach(id => antes[id] = a.pos.reduce((s, p) => s + (p.sec === id ? p.fardos : 0), 0));
        const desc0 = a.hoje.descidas, sd0 = a.hoje.semDeposito || 0; g.update(0.05);
        if (a.hoje.descidas > desc0 && (a.hoje.semDeposito || 0) === sd0 && isRush() && S.dayT - RUSH[0] * DAY_LEN > AT_CFG.isolar + 0.2 && a.pulmao !== "urgente") pico++;   // começada no pico sem ser por falta no depósito
        }
      comprarPaletes = c0;
      // vendas = fardos vendidos no balcão + o que está nas mãos já conta em totalFardosAt
      const vendidos = a.totFardos - v0;
      const t1 = {}; secs.forEach(id => t1[id] = totalFardosAt(id));
      const somaT0 = secs.reduce((s, id) => s + t0[id], 0), somaT1 = secs.reduce((s, id) => s + t1[id], 0), somaC = Object.values(comp).reduce((s, v) => s + v, 0);
      return { dia: S.day, concl: S.fase.concluida, reqs: g.faseReqs().filter(q => q.have < q.need).map(q => q.id + ":" + Math.round(q.have * 100) / 100 + "/" + q.need).join(" "), conf: Math.round(somaT0 + somaC - vendidos - somaT1), pico, isol, alto: a.pos.reduce((s, p) => s + p.alto, 0) }; })()`);
    if (rc.conf !== 0) furo.push(`d${rc.dia}:${rc.conf}`); descPico += rc.pico; pegouIsolada += rc.isol;
    if (rc.concl) break;
  }
  const man = await G("window.__manuais");
  ok(rc.concl && man === 0, `vertical: robô só com compra automática conclui o atacarejo com níveis no alto (dia ${rc.dia}, ${man} compras manuais)${rc.concl ? "" : " falta: " + rc.reqs}`);
  ok(!furo.length, `vertical: fardos (chão + alto + depósito + caminho + soltos + nas mãos) só mudam por compra e venda${furo.length ? " — " + furo.slice(0, 5).join(" ") : ""}`);
  ok(descPico === 0, "vertical: no modo preventivo, no pico só desce do alto quando o depósito não tem palete daquele setor");
  const vs = await G(`(() => { const a = at(); a.pos[0].sec = a.pos[0].sec || "mercearia"; a.pos[0].niveis = 1; a.pos[0].alto = 1; a.pos[0].fardos = 0; a.pos[0].isolada = true; const c = { estado: "pegando", alvo: 0, plano: [{ sec: a.pos[0].sec, q: 2, got: 0 }], passo: 0, espera: 0, x: 0, y: 0, path: [] };
    a.pos[0].fardos = 5; comerciantes.push(c); for (let i = 0; i < 20; i++) tickComerciantes(0.05, a); const pegou = c.plano[0].got; comerciantes.splice(comerciantes.indexOf(c), 1); a.pos[0].isolada = false; return pegou; })()`);
  ok(vs === 0, "vertical: ninguém pega fardos de uma posição isolada");
  const ant = await G(`(() => { delete S.atac.pos[1].niveis; delete S.atac.pos[1].alto; delete S.atac.pulmao; save(); return 1; })()`);
  await recarregar();
  const ant2 = await G(`({ n: at().pos[1].niveis, a: at().pos[1].alto, p: at().pulmao })`);
  ok(ant2.n === 0 && ant2.a === 0 && ant2.p === "preventiva", "vertical: save antigo sem estrutura abre com zero níveis, sem perda");
  const pv = await G(`(() => { g.openSheet("atacado"); const h = document.getElementById("shBody").textContent; g.closeSheet(); return /Estoque no alto/.test(h) && /nível/.test(h); })()`);
  ok(pv, "vertical: painel do atacado mostra o estoque no alto e a compra de níveis");

  // ===== 6. diagnóstico =====
  const dg1 = await G(`(() => { const d = dg(); const n0 = d.fila.length; let chamadas = 0; const r0 = Math.random; Math.random = () => { chamadas++; return r0(); };
    regDiag("teste", { texto: "meu email é fulano@exemplo.com e telefone 21 98861-2660" }); Math.random = r0;
    const ev = d.fila[d.fila.length - 1]; return { cresceu: d.fila.length === n0 + 1, chamadas, txt: ev.x.texto, id: d.id, v: ev.v, ap: APP_VERSAO }; })()`);
  ok(dg1.cresceu && dg1.chamadas === 0 && !/@|98861/.test(dg1.txt) && dg1.v === dg1.ap, `diagnóstico: evento na fila sem e-mail nem telefone ("${dg1.txt}") e sem usar o sorteio do jogo`);
  const dg2 = await G(`(() => { const d = dg(); for (let i = 0; i < 260; i++) regDiag("x", { i }); const n = d.fila.length; regDiag("erro", { msg: "a" }, 2); return { n, temErro: d.fila.some(e => e.t === "erro") }; })()`);
  ok(dg2.n <= 200 && dg2.temErro, `diagnóstico: fila limitada a 200 eventos (${dg2.n}), erros preservados`);
  const dg3 = await js(`new Promise(res => { const d = dg(); const bodies = []; const f0 = window.fetch; window.fetch = (u, o) => { bodies.push(JSON.parse(o.body)); return Promise.resolve({}); };
    d.url = "https://script.google.com/macros/s/TESTE/exec"; const n0 = d.fila.length; enviarDiag();
    setTimeout(() => { window.fetch = f0; res({ n0, lote: bodies[0] ? bodies[0].eventos.length : 0, inst: bodies[0] && bodies[0].inst === d.id, depois: d.fila.length, envios: bodies.length }); }, 3600); })`);
  ok(dg3.lote === 50 && dg3.inst && dg3.depois < dg3.n0, `diagnóstico: envio em lotes de 50 com o identificador (${dg3.n0} → ${dg3.depois} na fila após ${dg3.envios} envio(s))`);
  const dg4 = await js(`new Promise(res => { const d = dg(); const n0 = d.fila.length; const f0 = window.fetch; window.fetch = () => Promise.reject(new Error("offline")); enviando = false; enviarDiag();
    setTimeout(() => { window.fetch = f0; res({ n0, n1: d.fila.length }); }, 300); })`);
  ok(dg4.n1 === dg4.n0, "diagnóstico: sem internet, a fila espera (nada se perde)");
  const dg5 = await G(`(() => { alternarDiag(); const d = dg(); const n = d.fila.length; regDiag("y", {}); const n2 = d.fila.length; alternarDiag(); return { n, n2, lig: d.ligado }; })()`);
  ok(dg5.n === 0 && dg5.n2 === 0 && dg5.lig, "diagnóstico: desligar apaga a fila e para de registrar; ligar de novo funciona");
  const dg6 = await G(`(() => { g.openSheet("settings"); const h = document.getElementById("shBody").textContent; g.closeSheet(); return /Enviar dados de diagnóstico/.test(h) && /Identificador/.test(h) && h.includes(APP_VERSAO); })()`);
  ok(dg6, "diagnóstico: Configurações mostram o controle, o identificador e a versão 1.4");
  await G(`(() => { localStorage.removeItem("mercadinho-diag"); DG = null; return 1; })()`);
  await abrir(null); await sleep(800);
  const av = await js(`(() => { const b = document.getElementById("avisoDiag"); const t = b ? b.textContent : ""; if (b) b.querySelector("#dgOk").click(); return { t, some: !document.getElementById("avisoDiag"), avisado: dg().avisado }; })()`);
  ok(/diagnóstico/.test(av.t) && av.some && av.avisado, "diagnóstico: aviso na tela inicial na primeira abertura, some ao tocar em Entendi e não volta");
  await recarregar(); await sleep(400);
  const ses = await G(`dg().fila.filter(e => e.t === "sessao").length + (document.getElementById("avisoDiag") ? 100 : 0)`);
  ok(ses >= 1 && ses < 100, "diagnóstico: a abertura do jogo registra uma sessão e o aviso não aparece dentro do jogo");

  ok(!t.erros.length, `sem erros de JavaScript (${t.erros.slice(0, 3).join(" / ")})`);
} catch (e) { console.error(e); ok(false, "exceção: " + String(e).slice(0, 400)); }
finally {
  const f = t.res.filter(r => !r[0]).length;
  console.log(`\n${t.res.length - f}/${t.res.length} verificações OK`);
  t.fim(); process.exit(f ? 1 : 0);
}
