// Testes da versão 1.5: evolução individual da equipe (repositores, operadores de caixa, carrinheiros e atendentes).
// Uso: node tools/teste-v15.mjs   (CHROME=caminho do Chrome)
import fs from "node:fs";
import { iniciar, carreiraEm, raiz } from "./lib-cdp.mjs";
import { ROBO_BASE, ROBOS } from "./robos-capitulos.mjs";

const t = await iniciar();
const { js, ok, abrir, gravarCarreira } = t;
const G = expr => js(`(() => { const g = window.__game, S = g.S; return ${expr}; })()`);
try {
  // ===== 1. save antigo: cada pessoa começa no nível que a equipe tinha =====
  await abrir(null);
  await js(`(() => { const S = JSON.parse(localStorage.getItem("mercadinho-save-v4") || "null"); return 1; })()`);
  await abrir("livre"); await js("hideModal()");
  await G(`(() => { const st = S.sec.mercearia; st.staff = 2; st.staffLvl = 3; delete st.eq; delete st.eqBase; S.cashiers = 2; S.cashLvl = 2; delete S.cashEq; delete S.cashEqBase;
    S.gear.collectors = 2; S.gear.colLvl = 1; delete S.gear.colEq; delete S.gear.colEqBase; S.park.staff = 2; S.park.train = 2; delete S.park.eq; delete S.park.eqBase; save(); return 1; })()`);
  await abrir("livre"); await js("hideModal()");
  const m = await G(`(() => { equipeSync(); return { rep: S.sec.mercearia.eq.map(p => p.v), cx: S.cashEq.map(p => p.v), col: S.gear.colEq.map(p => p.v), pk: S.park.eq.map(p => p.v),
    nomes: [...S.sec.mercearia.eq, ...S.cashEq, ...S.gear.colEq, ...S.park.eq].map(p => p.n) }; })()`);
  ok(m.rep.join() === "3,3" && m.cx.join() === "2,2" && m.col.join() === "1,1" && m.pk.join() === "2,2", `save antigo: cada pessoa começa no nível da equipe (repositores ${m.rep}, caixas ${m.cx}, carrinheiros ${m.col}, atendentes ${m.pk})`);
  ok(new Set(m.nomes).size === m.nomes.length, `cada pessoa tem um nome diferente (${m.nomes.join(", ")})`);

  // ===== 2. treino de uma pessoa só =====
  const t1 = await G(`(() => { S.money = 100000; const c0 = TIPOS_EQ.caixa.custo(S.cashEq[1].v); const m0 = S.money; treinarPessoa("caixa", null, 1);
    return { v: S.cashEq.map(p => p.v).join(), pago: Math.round((m0 - S.money) * 100) / 100, c0, t0: cashTime(nvCaixa(0)), t1: cashTime(nvCaixa(1)) }; })()`);
  ok(t1.v === "2,3" && t1.pago === t1.c0, `treinar a 2ª operadora sobe só ela (níveis ${t1.v}), custo M ${t1.pago}`);
  ok(t1.t1 < t1.t0, `cada caixa usa o tempo da sua operadora (${t1.t0.toFixed(2)} s × ${t1.t1.toFixed(2)} s por item)`);
  const t2 = await G(`(() => { const a = actions().find(x => x.key === "cashtrain"); const nome = S.cashEq[0].n; const ok = doAction("cashtrain"); return { ok, titulo: a.title, nome, v: S.cashEq.map(p => p.v).join() }; })()`);
  ok(t2.ok && t2.titulo.includes(t2.nome) && t2.v === "3,3", `botão "Treinar" da loja treina quem tem menos treino (${t2.titulo})`);
  const t3 = await G(`(() => { doAction("hire:mercearia"); equipeSync(); const eq = S.sec.mercearia.eq; return { n: eq.length, novo: eq[2].v, outros: eq.slice(0, 2).map(p => p.v).join() }; })()`);
  ok(t3.n === 3 && t3.novo === 0 && t3.outros === "3,3", "contratado novo começa no nível 1 e os outros mantêm o nível");
  const t4 = await G(`(() => { syncWorkers(); const ws = workers.filter(w => w.sec === 0); return ws.map(w => staffCarry(nvRep(w.sec, w.k)) + "/" + staffSpd(nvRep(w.sec, w.k))).join(" "); })()`);
  ok(/^4\/117 4\/117 3\/75$/.test(t4), `cada repositor leva e anda conforme o próprio nível (${t4})`);
  const t5 = await G(`(() => { const a = S.gear.colEq; treinarPessoa("col", null, 0, true); treinarPessoa("col", null, 0, true); return { v: a.map(p => p.v).join(), s0: colSpeed(nvCol(0)), s1: colSpeed(nvCol(1)) }; })()`);
  ok(t5.v === "3,1" && t5.s0 > t5.s1, `carrinheiros evoluem separados (níveis ${t5.v})`);
  const t6 = await G(`(() => { const o0 = gateTime("out"), i0 = gateTime("in"); treinarPessoa("park", null, 0, true); return { o0, o1: gateTime("out"), i0, i1: gateTime("in") }; })()`);
  ok(t6.o1 < t6.o0 && t6.i1 === t6.i0, "estacionamento: treinar o 1º atendente acelera só a cabine de saída, onde ele trabalha");
  const t7 = await G(`(() => { S.park.staff = 1; equipeSync(); const n = S.park.eq.length; S.park.staff = 2; equipeSync(); return { n, novo: S.park.eq[1].v }; })()`);
  ok(t7.n === 1 && t7.novo === 0, "dispensar e recontratar: quem volta começa do nível 1");
  // piso: cenário que sobe o nível da equipe (início de capítulo) sobe quem está abaixo
  const t8 = await G(`(() => { S.gear.colLvl = 2; equipeSync(); return S.gear.colEq.map(p => p.v).join(); })()`);
  ok(t8 === "3,2", `piso de nível (início de capítulo) sobe só quem está abaixo (${t8})`);
  // salva e reabre
  const antes = await G(`(() => { save(); return JSON.stringify([S.sec.mercearia.eq, S.cashEq, S.gear.colEq, S.park.eq]); })()`);
  await abrir("livre"); await js("hideModal()");
  const depois = await G(`JSON.stringify([S.sec.mercearia.eq, S.cashEq, S.gear.colEq, S.park.eq])`);
  ok(antes === depois, "níveis e nomes continuam iguais depois de fechar e abrir");

  // ===== 3. painel: cartão com uma linha por pessoa =====
  const ui = await G(`(() => { select({ kind: "shelf", i: 0 }); const b = [...document.querySelectorAll("#shBody .equipe-ind button")]; const nomes = b.map(x => x.getAttribute("aria-label"));
    const v0 = S.sec.mercearia.eq[2].v; b[2] && b[2].click(); const v1 = S.sec.mercearia.eq[2].v; closeSheet();
    select({ kind: "lane", l: 0 }); const bc = document.querySelectorAll("#shBody .equipe-ind button").length; closeSheet();
    select({ kind: "station" }); const bs = document.querySelectorAll("#shBody .equipe-ind button").length; closeSheet();
    select({ kind: "parking" }); const bp = document.querySelectorAll("#shBody .equipe-ind button").length; closeSheet();
    return { n: b.length, nomes, v0, v1, bc, bs, bp }; })()`);
  ok(ui.n === 3 && ui.nomes.every(x => /^Treinar .+, repositor, do nível \d+ para \d+, por M/.test(x)), `painel do setor: um botão de treino por repositor, com nome acessível ("${ui.nomes[0]}")`);
  ok(ui.v1 === ui.v0 + 1, "tocar no botão de uma pessoa treina essa pessoa");
  ok(ui.bc === 2 && ui.bs === 2 && ui.bp === 2, `painéis de caixa, cestas e estacionamento listam cada pessoa (${ui.bc}, ${ui.bs}, ${ui.bp})`);

  // ===== 4. sem sorteio no código novo e robôs de capítulos =====
  const src = fs.readFileSync(`${raiz}/www/js/11b-equipe-niveis.js`, "utf8");
  ok(!/Math\.random/.test(src), "o código da equipe individual não usa o sorteio do jogo (partidas continuam determinísticas)");
  const v = await G("APP_VERSAO"); ok(Number(v) >= 1.5, `versão ${v}`);
} finally {
  const falhas = t.res.filter(r => !r[0]).length;
  console.log(`\n${t.res.length - falhas}/${t.res.length} verificações OK`); if (t.erros.length) console.log("erros JS:", t.erros.slice(0, 5));
  t.fim(); process.exit(falhas || t.erros.length ? 1 : 0);
}
