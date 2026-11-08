// Testes dos capítulos 4 a 8 da carreira em Maricá.
// Uso: node tools/teste-capitulos4a8.mjs   (CHROME=caminho do Chrome, se não for o padrão do Windows)
// Cobre: saves antigos (Ipê em andamento e concluído), transições do capítulo 3 ao 8 jogadas por robô,
// retomada depois de fechar, troca de loja e tempo fora com entregas, carretas, contratos e eventos pendentes,
// XP e recompensas sem duplicação, lista acessível do shopping e mapa em tela pequena.
import path from "node:path";
import { iniciar, carreiraEm, raiz, sleep } from "./lib-cdp.mjs";
import { ROBO_BASE, ROBOS } from "./robos-capitulos.mjs";

const DIR = path.join(raiz, "capturas", "capitulos4a8");
const t = await iniciar({ largura: 1000, altura: 760 });
const { js, ok, abrir, esperarRecarga, gravarCarreira, foto, tamanho } = t;
const G = expr => js(`(() => { const g = window.__game, S = g.S, C = g.CARREIRA; return ${expr}; })()`);
const MAXDIAS = { restinga: 40, pitanga: 40, cajueiro: 40, brisa: 40, grande: 45 };
async function prepararRobo(fase) { await js("hideModal()"); await js(ROBO_BASE); await js(`window.__passo = ${ROBOS[fase]}`); }
const jogarDia = () => js(`(() => { window.__perdas = {}; window.__dia(window.__passo); const S = window.__game.S; return { dia: S.day, concl: S.fase.concluida }; })()`);
const meioDia = n => js(`(() => { const g = window.__game; for (let i = 0; i < ${n}; i++) { if (i % 40 === 0) __recolher(); if (i % 20 === 0) window.__passo(i); g.update(0.05); } return g.S.dayT; })()`);
const recarregar = async () => { await abrir("carreira"); await js("hideModal()"); };
// volta para a loja `para` passando por `via`; `fora` em horas simula o tempo que a loja ficou fechada
async function irEVoltar(via, para, fora = 0) {
  await esperarRecarga(`window.__game.trocarLoja(${JSON.stringify(via)})`); await js("hideModal()");
  const okVia = await G(`g.FASE === ${JSON.stringify(via)}`);
  await esperarRecarga(`(() => { const g = window.__game; ${fora ? `g.CARREIRA.lojas[${JSON.stringify(para)}].lastSeen = Date.now() - ${fora} * 3600e3;` : ""} g.trocarLoja(${JSON.stringify(para)}); })()`);
  const modal = await js(`document.getElementById("dialog").textContent`); await js("hideModal()");
  return { okVia, modal };
}
const estado = () => G(`({ money: Math.round(S.money * 100) / 100, day: S.day, xp: C.xp, fases: JSON.stringify(C.fases), trans: C.transicoes })`);

try {
  // ===== 1. saves de antes do capítulo 4 =====
  await gravarCarreira(carreiraEm("ipe")); await recarregar();
  await G(`(() => { for (let i = 0; i < 200; i++) g.update(0.05); g.S.money = 5555; save(); return 1; })()`);
  await recarregar();
  const a1 = await G(`({ fase: C.fase, FASE: g.FASE, concl: S.fase.concluida, disp: g.proximaDisponivel(), xp: C.xp, money: S.money })`);
  await js("window.__game.abrirMapa('restinga')"); await sleep(200);
  const m1 = await js(`(() => ({ det: document.getElementById("mapaDet").textContent, nos: document.querySelectorAll(".no-mapa").length, itens: document.querySelectorAll(".no-lista").length, assumir: !!document.getElementById("mAssumir"), txt: document.getElementById("dialog").textContent }))()`);
  ok(a1.fase === "ipe" && a1.FASE === "ipe" && !a1.concl && a1.disp === null && a1.xp === 400 && a1.money === 5555, `save com o Ipê em andamento abre igual, sem convite antecipado (${JSON.stringify(a1)})`);
  ok(m1.nos === 8 && m1.itens === 8 && m1.det.includes("🔒") && m1.det.includes("conclua o capítulo 3") && !m1.assumir, "mapa mostra 8 capítulos; o 4 bloqueado pede a conclusão do 3");
  ok(!m1.txt.includes("em desenvolvimento") && (m1.txt.match(/estimativa/g) || []).length >= 7, "mapa sem 'em desenvolvimento' e com todas as distâncias marcadas como estimativa");
  await js("hideModal()");

  // Ipê concluído (como o jogo grava ao cumprir as metas)
  await G(`(() => { S.fase.concluida = true; S.fase.diaConclusao = S.day; C.fases.ipe = { concluida: true, dia: S.day, xp: 200, rep: 4.1, atendidos: 900, faturamento: 18000, conquistas: 1, em: Date.now() }; C.xp = 600; save(); return 1; })()`);
  await recarregar();
  const a2 = await G(`({ disp: g.proximaDisponivel(), xp: C.xp, modal: document.getElementById("dialog").textContent })`);
  ok(a2.disp === "restinga" && a2.xp === 600, `save com o Ipê concluído recebe o convite do capítulo 4 sem ganhar XP de novo (${a2.xp})`);
  await js("window.__game.abrirMapa('restinga')"); await sleep(200); await foto(path.join(DIR, "teste", "mapa-convite-cap4.png"));
  await js("hideModal()");

  // ===== 2. capítulos 4 a 8 em sequência, jogados pelo robô =====
  let anterior = "ipe";
  for (const fase of ["restinga", "pitanga", "cajueiro", "brisa", "grande"]) {
    const antes = await estado(), lojaAnt = await G(`Math.round(C.lojas[${JSON.stringify(anterior)}].money)`);
    await esperarRecarga(`window.__game.assumirProxima()`);
    const ini = await G(`({ FASE: g.FASE, fase: C.fase, xp: C.xp, trans: C.transicoes, intro: document.getElementById("dialog").textContent, ant: Math.round(C.lojas[${JSON.stringify(anterior)}].money) })`);
    ok(ini.FASE === fase && ini.fase === fase && ini.xp === antes.xp && ini.trans === antes.trans + 1 && ini.ant === lojaAnt && ini.intro.length > 40,
      `${anterior} → ${fase}: loja nova aberta com introdução, XP intacto (${ini.xp}) e a loja anterior preservada (M ${ini.ant})`);
    await js("window.__game.assumirProxima()"); await sleep(400);
    ok(await G(`g.FASE === ${JSON.stringify(fase)} && C.transicoes === ${ini.trans}`), `${fase}: assumir de novo não cria outra transição`);
    await prepararRobo(fase);

    let r = null, dias = 0;
    for (; dias < MAXDIAS[fase]; dias++) {
      r = await jogarDia();
      if (r.dia === 4) {
        await G(`(() => { recenter(); draw(); hud(); return 1; })()`); await foto(path.join(DIR, "teste", `cena-${ORD(fase)}-${fase}.png`));
        // retomada depois de fechar o app (sem tempo fora)
        const e0 = await estado(); await G(`(save(), 1)`); await recarregar(); const e1 = await estado();
        ok(e0.money === e1.money && e0.day === e1.day && e0.xp === e1.xp, `${fase}: fechar e abrir de novo retoma o mesmo dia e saldo (dia ${e1.day}, M ${e1.money})`);
        await prepararRobo(fase);
        if (fase === "pitanga") await testeEntregas();
        if (fase === "cajueiro") await testeAtacarejo();
        if (fase === "brisa") await testeShopping();
        if (fase === "grande") await testeObra();
        await prepararRobo(fase);
      }
      if (r.concl) break;
    }
    const fim = await G(`({ concl: S.fase.concluida, dia: S.day, xp: C.xp, rec: C.fases[${JSON.stringify(fase)}], reqs: g.faseReqs().map(q => q.id + ":" + (Math.round(q.have * 100) / 100) + "/" + q.need).join(" ") })`);
    ok(fim.concl && fim.rec && fim.rec.concluida, `${fase}: capítulo concluído pelo robô no dia ${fim.dia} (${fim.reqs})`);
    ok(fim.rec && fim.xp === antes.xp + fim.rec.xp, `${fase}: XP do capítulo somado uma vez (+${fim.rec && fim.rec.xp})`);
    await sleep(1300); await js("hideModal()");
    await jogarDia(); await recarregar();
    const dep = await G(`({ xp: C.xp, rec: JSON.stringify(C.fases[${JSON.stringify(fase)}]) })`);
    ok(dep.xp === fim.xp && dep.rec === JSON.stringify(fim.rec), `${fase}: jogar mais um dia e reabrir não repete XP nem recompensa`);
    anterior = fase;
  }

  // ===== 3. fim da carreira =====
  const fimC = await G(`({ disp: g.proximaDisponivel(), concl: Object.keys(C.fases).filter(k => C.fases[k].concluida).length, missao: typeof missaoCarreira === "function" ? (missaoCarreira() || {}).title : "" })`);
  ok(fimC.disp === null && fimC.concl === 8, `carreira com os 8 capítulos concluídos e nenhum convite pendente (${fimC.missao || "sem missão"})`);
  await js("window.__game.abrirMapa()"); await sleep(200); await foto(path.join(DIR, "teste", "mapa-carreira-completa.png"));
  const lista = await js(`[...document.querySelectorAll(".no-lista")].map(b => b.textContent.replace(/\\s+/g, " ").trim())`);
  ok(lista.length === 8 && lista.filter(x => x.includes("Concluída")).length === 8 && lista.some(x => x.includes("Capítulo 8") && x.includes("você está aqui")), "lista acessível do mapa: 8 concluídas e o shopping grande marcado como 'você está aqui'");
  await js("hideModal()");
  // voltar às lojas antigas com os saldos de cada uma
  for (const id of ["restinga", "ipe"]) {
    const salvo = await G(`Math.round(C.lojas[${JSON.stringify(id)}].money)`), xp = await G("C.xp");
    await esperarRecarga(`window.__game.trocarLoja(${JSON.stringify(id)})`); await js("hideModal()");
    const v = await G(`({ F: g.FASE, m: Math.round(S.money), xp: C.xp })`);
    ok(v.F === id && Math.abs(v.m - salvo) <= 1 && v.xp === xp, `voltar ao ${id} pelo mapa mantém o saldo da loja (M ${v.m}) e o XP`);
  }

  // ===== 4. mapa em tela pequena =====
  await tamanho(360, 740); await js("window.__game.abrirMapa('grande')"); await sleep(300);
  const pq = await js(`(() => { const s = document.querySelector(".mapa-svg").getBoundingClientRect(), d = document.getElementById("dialog");
    const bts = [...document.querySelectorAll(".no-lista, #dialog button")].filter(b => b.offsetParent);
    return { svg: Math.round(s.width), scroll: document.documentElement.scrollWidth, dlg: Math.round(d.getBoundingClientRect().width), menor: Math.min(...bts.map(b => b.getBoundingClientRect().height)), n: bts.length }; })()`);
  ok(pq.svg <= 360 && pq.scroll <= 360 && pq.dlg <= 360, `mapa cabe em 360 px sem rolagem lateral (desenho ${pq.svg}px, página ${pq.scroll}px)`);
  ok(pq.menor >= 40, `botões do mapa com altura de toque adequada em 360 px (menor ${pq.menor}px em ${pq.n})`);
  await foto(path.join(DIR, "teste", "mapa-360px.png"));
  await js("hideModal()"); await tamanho(1000, 760);

  ok(t.erros.length === 0, `sem erros de script (${t.erros.slice(0, 3).join(" / ")})`);
} catch (e) { ok(false, "exceção: " + e.message); console.log(t.erros); }

function ORD(f) { return { restinga: "4", pitanga: "5", cajueiro: "6", brisa: "7", grande: "8" }[f]; }

// ---- capítulo 5: pedidos em andamento ao trocar de loja e depois de horas fora ----
async function testeEntregas() {
  await meioDia(700);
  const snap = () => G(`(() => { const e = S.entregas; return { ped: e.pedidos.map(o => o.id + (o.estado === "separando" ? "aceito" : o.estado) + (o.pago ? "$" : "")).join(","), n: e.pedidos.filter(o => o.estado !== "novo").length, res: estoqueReservado(), money: Math.round(S.money * 100) / 100, tot: e.totNoPrazo, wh: Object.values(S.sec).map(s => s.wh).join("/") }; })()`);
  const s0 = await snap();
  const v = await irEVoltar("ipe", "pitanga");
  const s1 = await snap();
  ok(v.okVia && s0.n > 0 && s1.ped === s0.ped && s1.res === s0.res && s1.money === s0.money && s1.tot === s0.tot,
    `entregas: ${s0.n} pedido(s) em andamento voltam iguais depois de visitar outra loja (reservado ${s1.res}, M ${s1.money}; separação interrompida volta para a fila)`);
  if (s1.ped !== s0.ped || s1.money !== s0.money) console.log("   ", JSON.stringify(s0), "\n   ", JSON.stringify(s1));
  await prepararRobo("pitanga"); await meioDia(500);
  const s2 = await snap();
  const v2 = await irEVoltar("ipe", "pitanga", 3);
  const s3 = await snap(), dia = await G(`({ d: S.day, avg: S.avgNet })`);
  ok(s2.n > 0 && s3.n === 0 && s3.res === 0 && s3.money >= s2.money && s3.tot === s2.tot,
    `entregas: depois de 3 h fora os ${s2.n} pedido(s) pendentes foram pagos uma vez ou cancelados com o estoque devolvido, sem contar para as metas`);
  ok(/esteve fora|Entregas|Pedidos cancelados/.test(v2.modal), "entregas: a tela de boas-vindas resume o que aconteceu com os pedidos");
  await recarregar(); const s4 = await snap();
  ok(s4.money === s3.money && (await G("S.day")) === dia.d, `entregas: abrir de novo não paga nada outra vez (M ${s4.money})`);
}
// ---- capítulo 6: carretas e contratos da galeria ----
async function testeAtacarejo() {
  await meioDia(600);
  const snap = () => G(`(() => { const a = S.atac, gl = S.galeria; return { money: Math.round(S.money * 100) / 100, day: S.day, avg: S.avgNet, mgr: mgrEff(S.mgrLvl), car: a.carretas.length + a.transito.length, ocup: ocupadas(gl).map(u => u.id + ":" + u.ocup.resta).join(","), nOc: ocupadas(gl).length, dep: JSON.stringify(a.dep) }; })()`);
  const s0 = await snap();
  await irEVoltar("pitanga", "cajueiro"); const s1 = await snap();
  ok(s1.money === s0.money && s1.ocup === s0.ocup && s1.car === s0.car, `atacarejo: carretas (${s0.car}) e contratos da galeria (${s0.nOc}) intactos depois de visitar outra loja`);
  const v = await irEVoltar("pitanga", "cajueiro", 4); const s2 = await snap();
  const dias = s2.day - s1.day, esperado = Math.round(s1.money + Math.round(Math.max(0, s1.avg) * dias * s1.mgr));
  ok(dias > 0 && Math.abs(Math.round(s2.money) - esperado) <= 1, `atacarejo: 4 h fora = ${dias} dia(s) pelo lucro médio; aluguéis e carretas não somam dinheiro em dobro (M ${Math.round(s2.money)}, esperado ${esperado})`);
  ok(s2.car <= s1.car && (await G("S.atac.carretas.every(c => !c.doca) && S.atac.transito.length === 0")), "atacarejo: carretas pendentes foram descarregadas sem taxa de espera");
  await recarregar(); const s3 = await snap();
  ok(s3.money === s2.money && s3.ocup === s2.ocup && s3.day === s2.day, "atacarejo: abrir de novo não repete o tempo fora");
}
// ---- capítulo 7: contratos, evento agendado e lista acessível do shopping ----
async function testeShopping() {
  const lst = await G(`(() => { const b = document.createElement("div"); buildLista(b); return b.textContent.replace(/\\s+/g, " "); })()`);
  if (!/Lojas e contratos/.test(lst)) console.log("   ", lst.slice(0, 300));
  ok(/Lojas e contratos/.test(lst) && /Operação/.test(lst) && /Calendário/.test(lst) && /Estacionamento/.test(lst) && !/(gôndola|Caixa 1|Setores)/i.test(lst), "shopping: lista acessível adaptada (lojas, operação e calendário, sem gôndolas)");
  await G(`(() => { const s = sh(); if (!s.eventos[S.day + 1]) agendarEvento(S.day + 1, "feira"); return 1; })()`);
  const snap = () => G(`(() => { const s = sh(), L = lojasSh(); return { money: Math.round(S.money * 100) / 100, day: S.day, avg: S.avgNet, mgr: mgrEff(S.mgrLvl), ev: JSON.stringify(s.eventos), ocup: ocupadas(L).map(u => u.id + ":" + u.ocup.resta).join(","), rel: s.relatorios.length }; })()`);
  const s0 = await snap();
  await irEVoltar("cajueiro", "brisa"); const s1 = await snap();
  ok(s1.money === s0.money && s1.ev === s0.ev && s1.ocup === s0.ocup, "shopping: contratos e evento agendado intactos depois de visitar outra loja");
  await irEVoltar("cajueiro", "brisa", 4); const s2 = await snap();
  const dias = s2.day - s1.day, extra = await G(`sh().relatorios.filter(r => r.nome.includes("enquanto você esteve fora")).reduce((a, r) => a + r.receitas, 0)`);
  const esperado = Math.round(s1.money + Math.round(Math.max(0, s1.avg) * dias * s1.mgr) + extra);
  ok(dias > 0 && Math.abs(Math.round(s2.money) - esperado) <= 1 && extra > 0, `shopping: evento que caiu no tempo fora acontece uma vez (receita M ${extra}); saldo confere (M ${Math.round(s2.money)})`);
  await recarregar(); const s3 = await snap();
  ok(s3.money === s2.money && s3.rel === s2.rel, "shopping: abrir de novo não repete o evento nem o tempo fora");
}
// ---- capítulo 8: obra e licenças durante o tempo fora ----
async function testeObra() {
  const snap = () => G(`(() => { const o = S.obra; return { money: Math.round(S.money * 100) / 100, day: S.day, pct: Math.round(o.pct * 10) / 10, fase: o.fase, lic: Object.keys(o.lic).filter(k => o.lic[k].ok).length, gasto: Math.round(o.gasto) }; })()`);
  const s0 = await snap();
  await irEVoltar("brisa", "grande"); const s1 = await snap();
  ok(s1.money === s0.money && s1.pct === s0.pct && s1.lic === s0.lic, `obra: andamento (${s1.pct}%, ${s1.lic} licença(s)) intacto depois de visitar outra loja`);
  await irEVoltar("brisa", "grande", 2); const s2 = await snap();
  ok(s2.day > s1.day && s2.pct >= s1.pct && s2.pct <= 100 && s2.lic >= s1.lic, `obra: 2 h fora avançam licenças/obra no ritmo do gerente (${s1.pct}% → ${s2.pct}%, licenças ${s1.lic} → ${s2.lic})`);
  await recarregar(); const s3 = await snap();
  ok(s3.money === s2.money && s3.pct === s2.pct && s3.gasto === s2.gasto, "obra: abrir de novo não avança a obra nem cobra material outra vez");
}

const falhas = t.res.filter(r => !r[0]).length;
console.log(`\n${t.res.length - falhas} de ${t.res.length} verificações OK${falhas ? `, ${falhas} FALHA(S)` : ""}`);
t.fim(); process.exit(falhas ? 1 : 0);
