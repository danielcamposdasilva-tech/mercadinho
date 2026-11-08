// Testes da versão 1.6: fornecedores nos capítulos 4 e 5, duas distribuidoras de paletes no atacarejo e backup da partida.
// Uso: node tools/teste-v16.mjs   (CHROME=caminho do Chrome)
import { iniciar, carreiraEm, sleep } from "./lib-cdp.mjs";

const t = await iniciar();
const { js, ok, abrir, gravarCarreira, ls } = t;
const G = expr => js(`(() => { const g = window.__game, S = g.S; return ${expr}; })()`);
const modalTxt = () => js(`document.getElementById("modal").hidden ? "" : document.getElementById("dialog").textContent`);
const passar = s => js(`(() => { for (let i = 0; i < ${Math.round(s / 0.05)}; i++) window.__game.update(0.05); return 1; })()`);
try {
  // ===== 1. capítulo 4: fornecedores em modo leve =====
  await gravarCarreira(carreiraEm("restinga")); await abrir("carreira"); await js("hideModal()");
  const r1 = await G(`(() => ({ ativo: fornAtivo(), completo: fornCompleto(), fat: fatorCaminhao(), missao: missaoFornecedor(), forn: !!S.forn }))()`);
  ok(r1.ativo && !r1.completo && r1.fat === 1 && r1.missao === null, `Restinga: fornecedores ativos em modo leve (caminhão a preço normal, sem missão obrigatória)`);
  const r4 = await G(`(() => { const s = SECTORS.slice(0, slots()).filter(d => S.sec[d.id].open); S.money = 20000; SECTORS.forEach(d => S.sec[d.id].wh = 8); const o = planOrder(); return { hort: o.hortifruti || 0, total: o.total, emerg: FORN_CFG.emergencia }; })()`);
  ok(r4.hort > 0 && r4.total > 0, `Restinga: o caminhão continua enchendo o depósito como antes (com 8 caixas por setor ainda traz ${r4.total}; no Ipê pararia em ${r4.emerg})`);
  const r2 = await G(`(() => { S.money = 20000; SECTORS.forEach(d => S.sec[d.id].wh = 0); const o = g.oferta("serra", "mercearia"), m0 = S.money; const res = g.fazerPedido("serra", "mercearia");
    return { ok: res.ok, pago: Math.round((m0 - S.money) * 100) / 100, total: o.total, unit: o.unit, cheio: boxCost(SECTORS[0], S.sec.mercearia.priceLvl), reservado: g.reservado() }; })()`);
  ok(r2.ok && r2.pago === r2.total && Math.abs(r2.unit - r2.cheio * 0.75) < 0.011 && r2.reservado === 90, `Restinga: pedido à Serra pago na hora, 25% mais barato (M ${r2.unit} × M ${r2.cheio}), 90 caixas reservadas`);
  const r3 = await G(`(() => { const o = planOrder(); return { alvo: Object.keys(o).filter(k => k !== "total").map(k => o[k]), room: whCap(S.whLvl) - whUsed() - g.reservado() }; })()`);
  ok(r3.alvo.every(n => n <= Math.max(0, r3.room)), `Restinga: o caminhão automático respeita o espaço reservado para o pedido (sobra ${r3.room})`);
  await passar(200);
  const r5 = await G(`(() => ({ pend: g.fornEstado().pedidos.length, serra: g.fornEstado().recebidos.serra }))()`);
  ok(r5.pend === 0 && r5.serra === 1, `Restinga: o lote da Serra chegou depois de 2 dias de jogo (recebidos ${r5.serra})`);
  const r6 = await G(`(() => { S.sec.hortifruti.wh = 40; const L = { sales: 100 }; fornFimDoDia(L); return { wh: S.sec.hortifruti.wh, margem: L.margem != null }; })()`);
  ok(r6.wh === 40 && r6.margem, `Restinga: perecíveis não estragam no depósito (continua ${r6.wh}); a margem é calculada`);
  const r7 = await G(`(() => { g.openSheet("forn"); const t = document.getElementById("shBody").textContent; const n = document.querySelectorAll("#shBody .oferta").length; g.closeSheet(); return { n, preco: /preço normal/.test(t), perec: /Perecível/.test(t) }; })()`);
  ok(r7.n === 2 && r7.preco && !r7.perec, "Restinga: painel de fornecedores com as duas ofertas, avisando que o caminhão segue a preço normal");
  const r7b = await G(`(() => { g.select({ kind: "wh" }); const t = document.getElementById("shBody").textContent; const b = [...document.querySelectorAll("#shBody button")].some(x => /Negociar/.test(x.textContent)); g.closeSheet(); return { b, t: /preço normal/.test(t) }; })()`);
  ok(r7b.b && r7b.t, "Restinga: o painel do depósito tem o botão de negociar");

  // partida em andamento (salva antes da 1.6, sem S.forn): ganha os fornecedores e vê o aviso uma vez
  await G(`(() => { delete S.forn; save(); return 1; })()`);
  await abrir("carreira");
  const a1 = await modalTxt(), a1f = await G(`!!S.forn`);
  ok(/Novidade: fornecedores/.test(a1) && /Restinga/.test(a1) && a1f, `partida em andamento do capítulo 4 recebe os fornecedores com aviso ("${a1.slice(0, 60)}…")`);
  await js("hideModal()"); await abrir("carreira");
  ok(!/Novidade: fornecedores/.test(await modalTxt()), "o aviso não se repete ao abrir de novo");
  await js("hideModal()");

  // ===== 2. capítulo 5: pedidos e entregas usam o mesmo depósito =====
  await gravarCarreira(carreiraEm("pitanga")); await abrir("carreira"); await js("hideModal()");
  const p1 = await G(`(() => { S.money = 20000; S.sec.bebidas.wh = 0; const r = g.fazerPedido("ligeira", "bebidas"); return { ok: r.ok, ativo: fornAtivo() && !fornCompleto() }; })()`);
  await passar(40);
  const p2 = await G(`(() => ({ rec: g.fornEstado().recebidos.ligeira, wh: S.sec.bebidas.wh + (pending.bebidas || 0) + S.sec.bebidas.shelf }))()`);
  ok(p1.ok && p1.ativo && p2.rec === 1 && p2.wh >= 30, `Pitanga: pedido à Ligeira chega no mesmo dia (${p2.rec} recebido, bebidas ${p2.wh} caixas na loja)`);
  const p3 = await G(`(() => { const e = S.entregas; return { ok: whUsed() >= SECTORS.reduce((a, d) => a + S.sec[d.id].wh, 0), livre: g.livreDeposito() === whCap(S.whLvl) - whUsed() - g.reservado() }; })()`);
  ok(p3.ok && p3.livre, "Pitanga: espaço livre para pedidos desconta a reserva das entregas");

  // ===== 3. Ipê continua igual (completo) =====
  await gravarCarreira(carreiraEm("ipe")); await abrir("carreira"); await js("hideModal()");
  const i1 = await G(`(() => { S.sec.hortifruti.wh = 40; const L = { sales: 100 }; fornFimDoDia(L); return { completo: fornCompleto(), fat: fatorCaminhao(), wh: S.sec.hortifruti.wh, missao: !!missaoFornecedor() }; })()`);
  ok(i1.completo && i1.fat === 1.3 && i1.wh === 34 && i1.missao, `Ipê sem mudança: caminhão de emergência 30% mais caro, perecível estraga (40 → ${i1.wh}), missão do primeiro pedido`);

  // ===== 4. atacarejo: duas distribuidoras de paletes =====
  await gravarCarreira(carreiraEm("cajueiro")); await abrir("carreira"); await js("hideModal()");
  const c1 = await G(`(() => { const a = at(); S.money = 50000; a.depLvl = 2; const id = a.pos.find(p => p.sec).sec; const l = custoPalete(id, "ligeira"), s = custoPalete(id, "serra"); const m0 = S.money;
    const ok = comprarPaletes(id, 1, true, "serra"); const tr = a.transito[a.transito.length - 1];
    return { id, l, s, ok, pago: Math.round((m0 - S.money) * 100) / 100, n: tr.n, chega: tr.chega, forn: tr.forn, padrao: custoPalete(id) }; })()`);
  ok(c1.ok && c1.n === 3 && c1.forn === "serra" && Math.abs(c1.pago - c1.s * 3) < 0.02 && Math.abs(c1.s - c1.l * 0.85) < 0.02 && c1.padrao === c1.l, `Atacado Serra: lote de 3 paletes, 15% mais barato (M ${c1.s} × M ${c1.l}), pago M ${c1.pago}`);
  const c2 = await G(`(() => { const a = at(); comprarPaletes("${c1.id}", 1, true, "ligeira"); const n0 = a.transito.length; for (let i = 0; i < 400; i++) g.update(0.05);
    return { sobrou: a.transito.map(p => p.forn), carretas: a.carretas.length + Object.values(a.dep).reduce((x, y) => x + y, 0) }; })()`);
  ok(c2.sobrou.join() === "serra", `Ligeira chega em 14 s; a carreta da Serra ainda está a caminho depois de 20 s (${c2.sobrou})`);
  await passar(45);
  const c3 = await G(`at().transito.length`);
  ok(c3 === 0, "a carreta da Serra chega em 60 s");
  const c4 = await G(`(() => { const a = at(); a.transito = []; a.carretas = []; a.dep = {}; a.pos.forEach(p => { p.alto = 0; }); a.auto = true; a.autoForn = "serra"; S.money = 50000; for (let i = 0; i < 60; i++) g.update(0.05); return a.transito.map(p => p.forn + ":" + p.n); })()`);
  ok(c4.length && c4.every(x => x === "serra:3"), `compra automática pela Serra pede lotes de 3 (${c4.join(" ")})`);
  const c5 = await G(`(() => { g.openSheet("atacado"); const b = [...document.querySelectorAll("#shBody [aria-label]")].map(x => x.getAttribute("aria-label")); g.closeSheet(); return b.filter(x => /Distribuidora|Atacado Serra|Pedir/.test(x)).slice(0, 4); })()`).catch(e => [String(e)]);
  ok(c5.some(x => /^Distribuidora Ligeira/.test(x)) && c5.some(x => /^Atacado Serra/.test(x)), `painel do atacado: escolha da distribuidora com nome acessível (${c5[0]})`);
  // partida em andamento do atacarejo
  await G(`(() => { delete at().autoForn; at().auto = false; save(); return 1; })()`);
  await abrir("carreira");
  const c6 = await modalTxt();
  ok(/duas distribuidoras/.test(c6) && (await G(`at().autoForn`)) === "ligeira", "partida em andamento do atacarejo ganha a Serra com aviso e a compra automática segue na Ligeira");
  await js("hideModal()");

  // ===== 5. backup da partida =====
  await abrir("livre"); await js("hideModal()");
  await G(`(() => { S.day = 17; S.money = 4321; save(); return 1; })()`);
  const b1 = await js(`(async () => { const c = await gerarCodigo(); const r = await lerCodigo(c); const ruim = await lerCodigo(c.slice(0, -8) + "AAAAAAAA"); const lixo = await lerCodigo("oi");
    return { tam: c.length, pref: c.slice(0, 13), ok: r.ok, dia: r.ok && r.dados.livre.day, carr: r.ok && !!r.dados.carreira, ruim: ruim.ok, lixo: lixo.ok, erro: lixo.erro }; })()`);
  ok(b1.ok && b1.dia === 17 && b1.carr && b1.pref === "MERCADINHO.1." , `código de backup ida e volta (${b1.tam} caracteres, com Meu Mercado e carreira)`);
  ok(!b1.ruim && !b1.lixo, `código alterado ou inválido é recusado ("${b1.erro.slice(0, 50)}…")`);
  const b2 = await G(`(() => { g.openSheet("settings"); const b = [...document.querySelectorAll("#shBody button")].find(x => /Backup da partida/.test(x.textContent)); const tem = !!b; b && b.click(); return { tem, modal: document.getElementById("dialog").textContent.includes("Backup da partida") }; })()`);
  ok(b2.tem && b2.modal, "Configurações > Backup da partida abre a tela de backup");
  const codigo = await js(`gerarCodigo()`);
  const antesLivre = await ls("mercadinho-save-v4"), antesCarr = await ls("mercadinho-carreira-v1");
  // outro "aparelho": apaga tudo e importa pelo menu
  await abrir(null); await js(`localStorage.clear()`); await abrir(null);
  const b3 = await js(`(() => { const b = [...document.querySelectorAll("#menu button")].find(x => /Backup da partida/.test(x.textContent)); b && b.click(); return !!b; })()`);
  await js(`document.getElementById("bkCola").value = ${JSON.stringify(codigo)}; document.getElementById("bkLer").click(); 1`); await sleep(400);
  const b4 = await modalTxt();
  ok(b3 && /Código conferido/.test(b4) && /Meu Mercado: dia 17/.test(b4) && /Carreira: capítulo 6/.test(b4), "menu inicial: colar o código mostra o que tem nele antes de importar");
  await js(`document.getElementById("bkImp").click(); 1`);
  const b5 = await js(`document.getElementById("bkImp").textContent`);
  ok(/Toque de novo/.test(b5) && !(await ls("mercadinho-save-v4")), "importar pede um segundo toque e nada muda antes dele");
  await js(`window.__marca = 1; document.getElementById("bkImp").click(); 1`);
  for (let i = 0; i < 60; i++) { await sleep(150); if (await js("!window.__marca && !!(window.__boot && window.__boot.ok)").catch(() => false)) break; }
  const depoisLivre = await ls("mercadinho-save-v4"), depoisCarr = await ls("mercadinho-carreira-v1"), copia = await ls("mercadinho-copia-antes-importar");
  ok(depoisLivre === antesLivre && depoisCarr === antesCarr, "depois de importar, o Meu Mercado e a carreira ficam idênticos aos do outro aparelho");
  ok(!!copia && (await js(`!!document.getElementById("menu")`)), "o que havia antes fica numa cópia e o jogo volta ao menu");
  await abrir("livre"); await js("hideModal()");
  const b6 = await G(`({ dia: S.day, m: Math.round(S.money) })`);
  ok(b6.dia === 17, `a partida importada abre normalmente (dia ${b6.dia})`);

  // ===== 6. reputação explicada =====
  await abrir("livre"); await js("hideModal()");
  const rp = await G(`(() => { S.today.repCausas = null; const c = { x: 0, y: 0, path: [] }; leaveAngry(c, "😤 fila enorme"); leaveAngry(c, "😠 sem cesta"); changeRep(0.05, "rapido");
    const b = document.getElementById("repChip"); b.click(); const t = document.getElementById("dialog").textContent; hideModal();
    return { tag: b.tagName, t, causas: Object.keys(S.today.repCausas).join() }; })()`);
  ok(rp.tag === "BUTTON" && /Reputação/.test(rp.t) && /desistiram da fila/.test(rp.t) && /cesta/.test(rp.t) && /Para melhorar/.test(rp.t), `tocar nas estrelas explica os motivos do dia e como melhorar (${rp.causas})`);
  const rp2 = await G(`(() => { const rc = S.today.repCausas; endDay(); return !!(S.lastDay.repCausas && S.lastDay.repCausas.fila); })()`);
  ok(rp2, "o resumo de ontem guarda os motivos da reputação");
  // ===== 7. prateleira com limite e aviso sem repetição =====
  const pr = await G(`(() => { const st = S.sec.mercearia; st.shelfLvl = MAX_PRATELEIRA; const a = actions().find(x => x.key === "shelf:mercearia"); S.money = 1e6; const r = doAction("shelf:mercearia");
    st.shelfLvl = MAX_PRATELEIRA - 1; const r2 = doAction("shelf:mercearia"); return { maxed: a.maxed, r, r2, lvl: st.shelfLvl, info: a.info }; })()`);
  ok(pr.maxed && !pr.r && pr.r2 && pr.lvl === 7, `prateleira para no nível ${pr.lvl + 1} (${pr.info})`);
  const pc = await G(`(() => { const st = S.sec.mercearia; st.shelf = shelfCap(st.shelfLvl); st.wh = 20; ACONTECIMENTOS.length = 0; select({ kind: "shelf", i: 0 });
    const b = [...document.querySelectorAll("#shBody button")].find(x => /Repor à mão/.test(x.textContent)); for (let i = 0; i < 6; i++) b.click(); closeSheet();
    regAcontecimento("teste"); regAcontecimento("teste"); regAcontecimento("teste"); return ACONTECIMENTOS.slice(); })()`);
  ok(pc.filter(x => /cheia/.test(x)).length === 1 && pc.some(x => /teste \(×3\)/.test(x)), `prateleira cheia avisa uma vez; acontecimentos repetidos viram contagem (${pc.join(" | ").slice(0, 120)})`);
  const rl = await js(`(() => { abrirRelato(); document.getElementById("rlEnviar").click(); const t = document.getElementById("dialog").textContent, aberto = !document.getElementById("modal").hidden; hideModal(); return { aberto, t: /Escreva em uma linha/.test(t) }; })()`);
  ok(rl.aberto && rl.t, "relato sem descrição pede uma linha antes de enviar");

  // ===== 8. contratos da galeria (capítulo 6) =====
  await gravarCarreira(carreiraEm("cajueiro")); await abrir("carreira"); await js("hideModal()");
  const ct = await G(`(() => { const L = galeria(); const u = L.unidades[0]; u.ocup = { nome: "Açaí da Orla", ramo: "acai", aluguel: 30, pct: 0, diasContrato: 10, resta: 6, risco: 0.05, divida: 90, atrasos: 2, desde: 1, vendas: 0 };
    S.money = 5000; const m0 = S.money; const neg = negociarDivida(L, u.id); const o = u.ocup;
    const parc = o.parcela && o.parcela.valor; const pr = prorrogarContrato(L, u.id);
    const mul = multaEncerrar(o); const enc = encerrarContrato(L, u.id);
    return { neg: neg.ok, parc, resta: pr.ok ? o.resta : -1, alug: o.aluguel, mul: mul.liquida, enc: enc.ok, livre: !u.ocup, pago: Math.round(m0 - S.money) }; })()`);
  ok(ct.neg && ct.parc === Math.ceil(Math.round(90 * 0.85) / 3), `negociar dívida: 3 parcelas de M ${ct.parc} (15% de desconto)`);
  ok(ct.resta === 14 && ct.alug === 32, `prorrogar: +8 dias, aluguel 5% maior (M ${ct.alug})`);
  ok(ct.enc && ct.livre && ct.pago === ct.mul, `encerrar antes do prazo: multa de M ${ct.mul} paga e a sala fica livre`);
  const ct2 = await G(`(() => { const L = galeria(); const u = L.unidades[1]; u.ocup = { nome: "Lotérica Trevo", ramo: "loterica", aluguel: 45, pct: 0, diasContrato: 10, resta: 6, risco: 0.02, divida: 50, atrasos: 1, desde: 1, vendas: 0 };
    let r = [], m0 = S.money; for (let i = 0; i < 2; i++) r.push(cobrarDivida(L, u.id)); return { r: r.map(x => x.ok), seg: r[1].txt, ganho: Math.round(S.money - m0), div: u.ocup.divida }; })()`);
  ok(ct2.r[1] === false && /já cobrou|Não há dívida/.test(ct2.seg) && (ct2.r[0] ? ct2.ganho === 50 && ct2.div === 0 : ct2.div === 50), `cobrar: uma tentativa por fechamento (${ct2.r[0] ? "pagou M " + ct2.ganho : "pediu prazo"})`);
  const ct3 = await G(`(() => { g.openSheet("galeria"); const b = [...document.querySelectorAll("#shBody button")].find(x => /Abrir contrato/.test(x.textContent)); b && b.click(); const t = document.getElementById("dialog").textContent; hideModal(); g.closeSheet(); return { b: !!b, t }; })()`);
  ok(ct3.b && /Já pagou/.test(ct3.t) && /Prorrogar/.test(ct3.t) && /Encerrar antes do prazo/.test(ct3.t), "painel da galeria: cada contrato abre uma ficha com análise e ações");
  const ct4 = await G(`(() => { const L = galeria(); const u = L.unidades[2]; u.ocup = { nome: "X", ramo: "acai", aluguel: 30, pct: 0, diasContrato: 4, resta: 1, risco: 0, divida: 0, atrasos: 0, desde: 1, vendas: 0, parcela: { valor: 10, resta: 1, total: 10 } };
    const d = diaLocacao(L, GAL_CFG); return { pago: u.ocup ? u.ocup.ultPago : null, parc: u.ocup ? u.ocup.parcela : "x" }; })()`);
  ok(ct4.pago === 40 && ct4.parc === null, `parcela do acordo entra junto com o aluguel no fechamento (recebido M ${ct4.pago})`);

  // ===== 9. shopping: loja maior/menor e estrelas = satisfação =====
  await gravarCarreira(carreiraEm("brisa")); await abrir("carreira"); await js("hideModal()");
  const sh1 = await G(`(() => { const L = lojasSh(); L.unidades.forEach(u => u.ocup = null); const peq = L.unidades.find(u => u.tam === "pequena"), box = L.unidades.find(u => u.tam === "alimento");
    if (!peq || !box) return { erro: L.unidades.map(u => u.tam).join() };
    peq.ocup = { nome: "Açaí da Orla", ramo: "acai", aluguel: 40, pct: 0.05, diasContrato: 10, resta: 6, risco: 0.05, divida: 30, atrasos: 1, desde: 1, vendas: 0 };
    const ds = destinosMudanca(L, peq, SH_LOC()); const r = mudarInquilino(L, peq.id, box.id, SH_LOC());
    return { n: ds.length, ok: r.ok, txt: r.txt, novo: box.ocup && box.ocup.aluguel, velho: !peq.ocup }; })()`);
  ok(sh1.ok && sh1.velho && sh1.novo === 32, `shopping: o açaí devendo aceita ir para uma loja menor (box da praça, aluguel M ${sh1.novo}) ${sh1.erro || ""}`);
  const sh2 = await G(`(() => { document.getElementById("repChip").click(); const t = document.getElementById("dialog").textContent; hideModal(); return t; })()`);
  ok(/satisfação dos visitantes/.test(sh2) && /Limpeza/.test(sh2) && /Para melhorar/.test(sh2), "shopping: tocar nas estrelas mostra cada parcela da satisfação");

  // ===== 10. toque duplo em compra não compra duas vezes =====
  await gravarCarreira(carreiraEm("pitanga")); await abrir("carreira"); await js("hideModal()");
  const td = await G(`(() => { S.money = 16000; ent().balcao = 0; g.openSheet("entregas"); const achar = () => [...document.querySelectorAll("#shBody button")].find(x => /Melhorar por/.test(x.textContent));
    achar().click(); const depois1 = S.money; const b2 = achar(); b2 && b2.click(); const depois2 = S.money; g.closeSheet(); return { d1: 16000 - depois1, d2: depois1 - depois2, nivel: ent().balcao }; })()`);
  ok(td.d1 === 600 && td.d2 === 0 && td.nivel === 1, `toque duplo no balcão: comprou só o nível 1 (M ${td.d1}), o segundo toque foi ignorado`);
  await sleep(700);
  const td2 = await G(`(() => { g.openSheet("entregas"); const b = [...document.querySelectorAll("#shBody button")].find(x => /Melhorar por/.test(x.textContent)); const m0 = S.money; b.click(); g.closeSheet(); return { d: m0 - S.money, nivel: ent().balcao }; })()`);
  ok(td2.d === 1400 && td2.nivel === 2, "depois de um instante, o toque seguinte compra normalmente");

  const v = await G("APP_VERSAO"); ok(v === "1.6", `versão ${v}`);
} finally {
  const falhas = t.res.filter(r => !r[0]).length;
  console.log(`\n${t.res.length - falhas}/${t.res.length} verificações OK`); if (t.erros.length) console.log("erros JS:", t.erros.slice(0, 5));
  t.fim(); process.exit(falhas || t.erros.length ? 1 : 0);
}
