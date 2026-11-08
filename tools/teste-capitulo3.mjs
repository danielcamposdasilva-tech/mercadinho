// Teste do capítulo 3, do mapa da carreira e da administração de várias lojas.
// Migração de partidas antigas (formato 1), troca entre as três lojas, pedidos pendentes,
// progresso offline sem duplicação, recusas de pedido, robô jogando o Supermercado Ipê e mapa em tela pequena.
// Uso: node tools/teste-capitulo3.mjs [url-do-index]   (padrão: www/index.html por file://)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_JOGO = process.argv[2] || pathToFileURL(path.join(raiz, "www", "index.html")).href;
const res = []; const ok = (cond, txt) => { res.push([!!cond, txt]); console.log(`${cond ? "OK  " : "FALHA"} ${txt}`); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-cap3-"));
const port = 9800 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
let ws, id = 0; const wait = new Map(); const erros = [];
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const js = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
async function esperarJogo() { for (let i = 0; i < 80; i++) { await sleep(150); if (await js("!!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("jogo não iniciou"); }
async function abrir(modo, q = "") {
  await js(`(() => { try { ${modo ? `sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${modo}" }))` : `sessionStorage.removeItem("mercadinho-sessao")`}; } catch (e) {} })()`).catch(() => {});
  await send("Page.navigate", { url: URL_JOGO + q }); await esperarJogo();
}
// troca de loja e assumir recarregam a página sozinhos: espera a nova carga
async function esperarRecarga(acao) { await js(`window.__marca = 1; ${acao}`); for (let i = 0; i < 80; i++) { await sleep(150); if (await js("!window.__marca && !!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("não recarregou"); }
const ls = k => js(`localStorage.getItem(${JSON.stringify(k)})`);
// grava um save de carreira com a página no menu (a página da carreira salva ao sair e sobrescreveria)
async function gravarCarreira(obj, extra = "") { await abrir(null); await js(`localStorage.setItem("mercadinho-carreira-v1", ${JSON.stringify(JSON.stringify(obj))}); ${extra}`); }
const carreira = async () => JSON.parse(await ls("mercadinho-carreira-v1"));
// CAPTURAS=pasta grava fotos dos modais da conclusão (o canvas fica parado: o teste desliga a animação)
const foto = async nome => { if (!process.env.CAPTURAS) return; const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(process.env.CAPTURAS, nome + ".png"), Buffer.from(r.result.data, "base64")); };
const modalTxt = () => js(`document.getElementById("modal").hidden ? "" : document.getElementById("dialog").textContent`);

// robô do Ipê: estrutura das metas, pedidos (Serra para secos, Ligeira para perecíveis), reforço da gôndola mais vazia
const ROBO = `(() => {
  const g = window.__game;
  window.__jogarDiaIpe = () => {
    const S = g.S, dia0 = S.day, PER = ["hortifruti", "laticinios", "padaria", "acougue"];
    const chegando = id => g.fornEstado().pedidos.filter(p => p.sec === id).reduce((a, p) => a + p.qtd, 0);
    for (let i = 0; i < 20 * 95 && S.day === dia0; i++) {
      if (i % 40 === 0) { const l = g.piles.findIndex((p, k) => k < g.LANES.length && p.b + p.c > 0); if (l >= 0) { const p = g.piles[l]; if (p.c > 0) { p.c--; g.station.c++; } else { p.b--; g.station.b++; } } }
      if (i % 20 === 0) {
        const reserva = g.bills() + 40;
        // pedidos: Serra para secos (lote grande, barato), Ligeira para perecíveis (pouco parado no depósito)
        const guardar = S.sec.acougue.open ? 0 : 400;
        for (const d of ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria", "acougue"]) {
          if (!S.sec[d].open) continue;
          const st = S.sec[d], est = st.wh + st.shelf + chegando(d), vend = Math.max(15, (S.fase.vendOntem && S.fase.vendOntem[d]) || 25);
          const serra = g.oferta("serra", d), lig = g.oferta("ligeira", d);
          const pend = f => g.fornEstado().pedidos.some(p => p.sec === d && p.forn === f);
          if (!PER.includes(d) && est < vend * 2 && !pend("serra") && !g.motivoRecusa(serra) && S.money - serra.total > reserva) g.fazerPedido("serra", d);
          else if (est < vend * (PER.includes(d) ? 0.8 : 0.5) && !pend("ligeira") && !g.motivoRecusa(lig) && S.money - lig.total > reserva + guardar / 2) g.fazerPedido("ligeira", d);
        }
        const precisa = { "storage": () => S.whLvl < 7, "cashhire": () => S.cashiers < 3, "buybasket": () => S.gear.buyB < 2, "open:acougue": () => !S.sec.acougue.open };
        const ordem = ["cashhire", "open:acougue", "storage", "buybasket"].filter(k => precisa[k]());
        const vs = (S.fase && S.fase.dia.vs) || {}, pior = Object.keys(vs).sort((a, b) => vs[b] - vs[a])[0];
        const grave = pior && vs[pior] > S.fase.dia.t * 0.12;
        const extra = grave ? (S.sec[pior].staff < 3 ? ["hire:" + pior] : nvMin("rep", pior) < 3 ? ["train:" + pior] : ["shelf:" + pior]) : [];
        if (S.day >= 4 && g.fornEstado().auto && S.fase.margens.length && S.fase.margens[S.fase.margens.length - 1] < 0.56) g.alternarAuto();   // jogador desliga a reposição cara
        const poupando = !S.sec.acougue.open && S.cashiers >= 3;      // guarda dinheiro para o Açougue antes de reforçar setores
        for (const k of (grave && !poupando ? extra.concat(ordem.slice(0, 1)) : ordem)) { const a = g.actions().find(x => x.key === k); if (a && a.ok && S.money - a.cost > g.bills() + 15) { g.doAction(k); break; } }
      }
      g.update(0.05);
    }
    return { dia: S.day, dinheiro: Math.round(S.money), bons: S.fase.bons, margem: S.lastDay && S.lastDay.margem };
  };
})()`;

// estado de uma loja, montado numa prévia do cenário (não toca em saves reais)
async function lojaDePrevia(cen, ajuste) {
  await abrir(null, `?cenario=${cen}`);
  return js(`(() => { const S = window.__game.S; ${ajuste}; return JSON.parse(JSON.stringify(S)); })()`);
}

try {
  let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") erros.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]); });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { let s = 5151; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; window.requestAnimationFrame = () => 0; })();` });
  await send("Page.navigate", { url: URL_JOGO }); await esperarJogo();
  await js("localStorage.clear()");
  const livre = { money: 321, day: 4, dayT: 0, rep: 3.2, tier: 0, seenIntro: true, lastSeen: Date.now(), sec: {} };
  await js(`localStorage.setItem("mercadinho-save-v4", ${JSON.stringify(JSON.stringify(livre))})`);

  // ===== 1. partida antiga (formato 1) com o Empório Espiga concluído: o caso do celular =====
  const centroAntigo = await lojaDePrevia("centro", `S.tier = 1; S.money = 4321.5; S.day = 31; S.cashiers = 3; S.whLvl = 2; S.served = 2500; S.earned = 40000; S.rep = 4.3;
    ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria"].forEach(id => { S.sec[id].open = true; S.sec[id].wh = 7; S.sec[id].shelf = 5; }); S.park.lots.park1 = true;
    S.fase = { dia: { t: 0, vazio: 0, vs: {}, promoVazio: 0, vend: {} }, bons: 9, nets: [300, 280, 310], hist: [], concluida: true, diaConclusao: 22, promo: null, promosOk: 3, promosFeitas: 4 };
    S.lastDay = { day: 30, sales: 900, goods: 300, bills: 200, interest: 0, net: 290, served: 120, lost: 3, rep: 4.3 }; S.lastSeen = Date.now()`);
  const v1 = { versao: 1, fase: "centro", inicio: Date.now() - 7200e3, xp: 400, repCarreira: 4.2, conquistas: [{ fase: "bairro", id: "c100", label: "Atender 100 clientes" }], transicoes: 1,
    fases: { bairro: { concluida: true, dia: 9, xp: 200, rep: 4.1, atendidos: 380, faturamento: 3900, conquistas: 2 }, centro: { concluida: true, dia: 22, xp: 200, rep: 4.3, atendidos: 1800, faturamento: 25000, conquistas: 3 } },
    loja: centroAntigo };
  await gravarCarreira(v1);
  await abrir("carreira");
  const m1 = await js(`(() => { const g = window.__game, c = g.CARREIRA; return { fase: c.fase, ativa: c.ativa, versao: c.versao, temLoja: "loja" in c, lojas: Object.keys(c.lojas), FASE: g.FASE, money: g.S.money, day: g.S.day,
    concl: g.S.fase.concluida, xp: c.xp, disp: g.proximaDisponivel(), modal: document.getElementById("dialog").textContent, sel: !!document.getElementById("mAssumir"), conv: !!c.convites.ipe, nos: document.querySelectorAll(".no-mapa").length, itens: document.querySelectorAll(".no-lista").length }; })()`);
  ok(m1.versao === 2 && !m1.temLoja && m1.fase === "centro" && m1.ativa === "centro" && m1.lojas.join() === "centro", `save antigo migrado para o formato 2 sem perder a loja (${JSON.stringify({ fase: m1.fase, ativa: m1.ativa, lojas: m1.lojas })})`);
  ok(m1.money === 4321.5 && m1.day === 31 && m1.concl && m1.xp === 400, `Empório Espiga continua com os dados atuais (M ${m1.money}, dia ${m1.day}, concluído, ${m1.xp} XP)`);
  ok(m1.disp === "ipe" && m1.modal.includes("Mapa da carreira") && m1.modal.includes("Supermercado Ipê") && m1.sel && m1.conv, "convite do capítulo 3 aparece no mapa assim que a atualização abre");
  ok(m1.nos === 8 && m1.itens === 8, `mapa: mesmos 8 destinos no desenho e na lista acessível (${m1.nos}/${m1.itens})`);
  ok(!m1.modal.includes("Requisitos para avançar") && (await js(`window.__game.faseReqs().length`)) > 0 && await js("window.__game.S.fase.concluida"), "metas do capítulo 2 não se repetem (fase continua concluída)");
  const bk = JSON.parse(await ls("mercadinho-carreira-v1-copia-formato-1"));
  ok(bk && bk.versao === 1 && bk.loja && bk.loja.money === 4321.5, "cópia de segurança do save antigo gravada antes da migração");
  ok((await carreira()).versao === 2, "save gravado no formato novo");
  const mis = await js(`missaoCarreira().title`);
  ok(/Ipê/.test(mis), `missão aponta para assumir o Ipê ("${mis}")`);
  await abrir("carreira");
  ok(!(await modalTxt()).includes("Mapa da carreira"), "convite automático aparece uma vez; depois fica no mapa e na missão");

  // ===== 2. partidas antigas ainda nos capítulos 1 e 2 =====
  const bairroMeio = await lojaDePrevia("bairro", `S.money = 88; S.day = 4; S.sec.bebidas.open = true; S.fase = { dia: { t: 0, vazio: 0, vs: {}, promoVazio: 0, vend: {} }, bons: 1, nets: [20], hist: [], concluida: false, promosOk: 0, promosFeitas: 0 }; S.lastSeen = Date.now()`);
  const centroMeio = JSON.parse(JSON.stringify(centroAntigo)); centroMeio.fase.concluida = false; centroMeio.fase.bons = 1; centroMeio.money = 999;
  for (const [rot, salvo] of [["capítulo 1", { versao: 1, fase: "bairro", xp: 0, repCarreira: 0, conquistas: [], fases: {}, transicoes: 0, loja: bairroMeio }],
                              ["capítulo 2", { versao: 1, fase: "centro", xp: 200, repCarreira: 4, conquistas: [], fases: { bairro: v1.fases.bairro }, transicoes: 1, loja: centroMeio }]]) {
    await gravarCarreira(salvo, `localStorage.removeItem("mercadinho-carreira-v1-copia-formato-1")`);
    await abrir("carreira");
    const r = await js(`(() => { const g = window.__game; return { FASE: g.FASE, money: g.S.money, day: g.S.day, bons: g.S.fase.bons, concl: g.S.fase.concluida, disp: g.proximaDisponivel(), mapa: document.getElementById("dialog").textContent.includes("Mapa da carreira") && !document.getElementById("modal").hidden }; })()`);
    ok(r.FASE === salvo.fase && r.money === salvo.loja.money && r.bons === 1 && !r.concl && !r.disp && !r.mapa, `partida antiga no ${rot} continua igual, sem convite (${JSON.stringify(r)})`);
  }

  // ===== 3. de volta ao caso do celular: reabrir o Mercadinho da Lagoa (sem dados no save antigo) =====
  await gravarCarreira(v1);
  await abrir("carreira");
  await js(`hideModal(); window.__game.abrirMapa("bairro")`);
  const rb = await js(`({ txt: document.getElementById("mapaDet").textContent, botao: !!document.getElementById("mReabrir") })`);
  ok(rb.botao && rb.txt.includes("não guardava") && rb.txt.includes("estado compatível"), "Mercadinho da Lagoa sem dados: oferece Reabrir loja e explica o estado compatível");
  await esperarRecarga(`document.getElementById("mReabrir").click()`);
  const rl = await js(`(() => { const g = window.__game, S = g.S, c = g.CARREIRA; return { FASE: g.FASE, fase: c.fase, ativa: c.ativa, beb: S.sec.bebidas.open, hort: S.sec.hortifruti.open, cx: S.cashiers, merc: S.sec.mercearia.shelfLvl, concl: S.fase.concluida, xp: c.xp, money: S.money, reab: !!S.reaberta,
    modal: document.getElementById("dialog").textContent, regBairro: JSON.stringify(c.fases.bairro) }; })()`);
  ok(rl.FASE === "bairro" && rl.ativa === "bairro" && rl.fase === "centro", `Lagoa aberta sem mudar o andamento da carreira (ativa ${rl.ativa}, capítulo ${rl.fase})`);
  ok(rl.beb && rl.hort && rl.cx === 2 && rl.merc === 2 && rl.concl && rl.reab, "Lagoa reaberta com estrutura compatível com a fase concluída");
  ok(rl.modal.includes("reaberto") && rl.modal.includes("compatível") && rl.xp === 400 && rl.regBairro === JSON.stringify(v1.fases.bairro), "explica a reabertura; XP e registro da conclusão intactos");
  await js(`hideModal(); window.__game.S.money = 1234; save()`);
  await abrir("carreira");
  ok(await js(`window.__game.FASE === "bairro" && window.__game.S.money === 1234`), "fechar e reabrir o app volta à última loja administrada (Lagoa, M 1.234)");

  // ===== 4. três lojas: assumir o Ipê, finanças separadas, pedidos que ficam na loja certa =====
  await esperarRecarga(`hideModal(); window.__game.trocarLoja("centro")`);
  const ce = await js(`(() => { const g = window.__game; return { FASE: g.FASE, money: g.S.money, modal: document.getElementById("dialog").textContent }; })()`);
  ok(ce.FASE === "centro" && ce.money === 4321.5 && ce.modal.includes("Empório Espiga"), `voltar ao Empório: saldo dele (M ${ce.money}) e resumo da operação`);
  await js(`hideModal(); window.__game.S.money = 5555; save()`);
  await esperarRecarga(`window.__game.assumirProxima()`);
  const ip = await js(`(() => { const g = window.__game, c = g.CARREIRA; return { FASE: g.FASE, fase: c.fase, W: g.W, nome: g.SCENE.nome, money: g.S.money, xp: c.xp, trans: c.transicoes, intro: document.getElementById("dialog").textContent, lojas: Object.keys(c.lojas).sort().join(), doca: g.S.park.lots.logi, setores: Object.entries(g.S.sec).filter(([k, v]) => v.open).length }; })()`);
  ok(ip.FASE === "ipe" && ip.fase === "ipe" && ip.W === 448 && ip.nome === "Supermercado Ipê" && ip.money === 2500 && ip.doca && ip.setores === 5, `Ipê com estrutura própria (${JSON.stringify(ip).slice(0, 160)})`);
  ok(ip.xp === 400 && ip.trans === 2 && ip.lojas === "bairro,centro,ipe" && ip.intro.includes("fornecedores"), "XP levado sem duplicar; as três lojas guardadas; introdução fala de fornecedores");
  const lj = (await carreira()).lojas;
  ok(lj.bairro.money === 1234 && lj.centro.money === 5555, "saldos da Lagoa e do Empório ficaram em cada loja");
  await js("hideModal()");
  await esperarRecarga(`window.__game.assumirProxima(); window.__marca = 0`).catch(() => {});
  ok(await js(`window.__game.FASE === "ipe" && window.__game.CARREIRA.transicoes === 2`), "assumir de novo não faz nada");

  // pedidos e recusas
  const pd = await js(`(() => { const g = window.__game, S = g.S;
    const o1 = g.oferta("ligeira", "mercearia"), o2 = g.oferta("serra", "mercearia");
    const cmp = { lq: o1.qtd, sq: o2.qtd, lu: o1.unit, su: o2.unit, lp: o1.prazo, sp: o2.prazo, le: o1.espaco, se: o2.espaco };
    const m0 = S.money; S.money = 5; const rd = g.fazerPedido("serra", "mercearia"); S.money = m0;
    const wh0 = S.sec.bebidas.wh; S.sec.bebidas.wh = 150; const re = g.fazerPedido("serra", "mercearia"); S.sec.bebidas.wh = wh0;
    S.sec.bebidas.wh = 10;                                    // depósito de 160 com 34 ocupadas: cabem os dois lotes (90 + 30)
    const a = g.fazerPedido("serra", "mercearia"), b = g.fazerPedido("ligeira", "hortifruti");
    return { cmp, rd, re, a: a.ok, b: b.ok, pend: g.fornEstado().pedidos.length, res: g.reservado(), money: S.money }; })()`);
  ok(pd.cmp.sq > pd.cmp.lq && pd.cmp.su < pd.cmp.lu && pd.cmp.sp > pd.cmp.lp && pd.cmp.se > pd.cmp.le, `ofertas comparáveis: Serra lote maior, mais barato, mais demorado e mais espaço (${JSON.stringify(pd.cmp)})`);
  ok(!pd.rd.ok && pd.rd.tipo === "dinheiro" && /custa M .* caixa tem M/.test(pd.rd.txt), `recusa por dinheiro explicada ("${pd.rd.txt.slice(0, 90)}…")`);
  ok(!pd.re.ok && pd.re.tipo === "espaco" && /ocupa 90 caixas e o depósito tem \d+ livres/.test(pd.re.txt), `recusa por espaço explicada ("${pd.re.txt.slice(0, 90)}…")`);
  if (!(pd.a && pd.b)) console.log("   ", JSON.stringify(pd).slice(0, 400));
  ok(pd.a && pd.b && pd.pend === 2 && pd.res === 120, `dois pedidos confirmados, espaço reservado (${pd.res} caixas)`);
  // a confirmação mostra custo, quantidade, prazo e espaço antes de pagar
  await js(`(() => { const S = window.__game.S; S.whLvl = 10; window.__game.ui.fornSec = "bebidas"; window.__game.openSheet("forn"); })()`);
  const ui = await js(`(() => { const t = document.getElementById("shBody").textContent; document.querySelector(".oferta .btn").click(); const d = document.getElementById("dialog").textContent; const sim = !!document.getElementById("sim"); hideModal(); window.__game.closeSheet(); return { t, d, sim }; })()`);
  if (process.env.DETALHE) console.log(JSON.stringify(ui).slice(0, 900));
  ok(["Quantidade", "Custo total", "Prazo", "Espaço no depósito"].every(k => ui.t.includes(k)) && ui.sim && ["Quantidade", "Custo total", "Prazo de entrega", "Espaço necessário"].every(k => ui.d.includes(k)), "painel e confirmação mostram quantidade, custo total, prazo e espaço antes de confirmar");
  await js(`(() => { window.__game.S.whLvl = 7; save(); })()`);
  const moneyIpe = await js("window.__game.S.money");

  // trocar para o Empório e voltar: pedidos na loja certa; offline processado uma vez
  await esperarRecarga(`window.__game.trocarLoja("centro")`);
  const c2 = await js(`(() => { const g = window.__game; return { money: g.S.money, forn: g.S.forn ? g.S.forn.pedidos.length : 0 }; })()`);
  ok(c2.money === 5555 && c2.forn === 0, "no Empório: saldo dele e nenhum pedido do Ipê");
  const ipeSalvo = (await carreira()).lojas.ipe;
  ok(ipeSalvo.forn.pedidos.length === 2 && ipeSalvo.money === moneyIpe, "pedidos pendentes e saldo do Ipê guardados na loja do Ipê");
  // simula 1 h longe do Ipê (o gerente cobre até 2 h no nível 0)
  await js(`(() => { const c = JSON.parse(localStorage.getItem("mercadinho-carreira-v1")); c.lojas.ipe.lastSeen = Date.now() - 3600e3; c.lojas.ipe.avgNet = 100; window.CARREIRA_ = c; CARREIRA.lojas.ipe = c.lojas.ipe; localStorage.setItem("mercadinho-carreira-v1", JSON.stringify(c)); })()`);
  await esperarRecarga(`hideModal(); window.__game.trocarLoja("ipe")`);
  const of = await js(`(() => { const g = window.__game, S = g.S; return { FASE: g.FASE, money: S.money, day: S.day, pend: S.forn.pedidos.length, rec: S.forn.recebidos, modal: document.getElementById("dialog").textContent, merc: S.sec.mercearia.wh }; })()`);
  ok(of.FASE === "ipe" && of.day === 9 && of.money > moneyIpe, `1 h fora: 8 dias processados no Ipê e lucro do gerente (M ${Math.round(moneyIpe)} → M ${Math.round(of.money)})`);
  ok(of.pend === 0 && of.rec.serra === 1 && of.rec.ligeira === 1 && of.modal.includes("Pedidos que chegaram"), "pedidos pendentes chegaram durante a ausência e aparecem no resumo");
  await js("hideModal()");
  await abrir("carreira");
  const of2 = await js(`(() => { const S = window.__game.S; return { money: S.money, day: S.day, rec: S.forn.recebidos.serra + S.forn.recebidos.ligeira }; })()`);
  ok(Math.abs(of2.money - of.money) < 0.01 && of2.day === of.day && of2.rec === 2, "reabrir o app não processa a mesma ausência de novo (saldo, dia e pedidos iguais)");
  ok(await js(`(() => { const g = window.__game; concluirFase(); concluirFase(); return g.CARREIRA.xp === 400; })()`), "XP não muda com chamadas repetidas de conclusão");

  // cancelar e repassar (recuperar uma compra ruim)
  const rc = await js(`(() => { const g = window.__game, S = g.S; S.money = 3000; S.whLvl = 12; const r = g.fazerPedido("serra", "hortifruti"); if (!r.ok) return { erro: r.txt || JSON.stringify(r) }; const m1 = S.money; g.cancelarPedido(r.pedido.id); const volta = S.money - m1;
    S.sec.padaria.wh = 30; const m2 = S.money; g.repassar("padaria"); return { custo: r.pedido.custo, volta, repasse: S.money - m2, wh: S.sec.padaria.wh, pend: g.fornEstado().pedidos.length }; })()`);
  if (rc.erro) console.log("   ", rc.erro);
  ok(Math.abs(rc.volta - rc.custo * 0.8) < 0.02 && rc.repasse > 0 && rc.wh === 20 && rc.pend === 0, `compra ruim tem conserto: cancelar devolve 80% (M ${rc.volta.toFixed(2)} de M ${rc.custo}), repasse libera espaço e devolve dinheiro`);
  const val = await js(`(() => { const g = window.__game, S = g.S; S.sec.hortifruti.wh = 50; S.dayT = 89.99; g.update(0.05); return { wh: S.sec.hortifruti.wh, perdas: S.lastDay.perdas, margem: S.lastDay.margem }; })()`);
  ok(val.wh === 43 && val.perdas > 0 && typeof val.margem === "number", `perecível parado estraga no fechamento (50 → ${val.wh} caixas, perdas M ${val.perdas})`);
  ok(JSON.parse(await ls("mercadinho-save-v4")).money === 321, "Modo Livre intacto depois de tudo isso");

  // ===== 5. robô joga o Ipê do começo =====
  const lim = JSON.parse(await ls("mercadinho-carreira-v1")); delete lim.lojas.ipe; lim.fase = "centro"; lim.ativa = "centro"; lim.transicoes = 1;
  await gravarCarreira(lim);
  await abrir("carreira"); await esperarRecarga(`hideModal(); window.__game.assumirProxima()`);
  await js("hideModal()"); await js(ROBO);
  let info = null, dias = 0; const trilha = [];
  for (; dias < 60; dias++) { info = await js("window.__jogarDiaIpe()"); trilha.push(`${info.dia - 1}:${info.bons}/${info.margem != null ? Math.round(info.margem * 100) : "-"}%`); if (await js("window.__game.S.fase.concluida")) break; }
  const fi = await js(`(() => { const g = window.__game, S = g.S; return { concl: S.fase.concluida, dia: S.day, reqs: g.faseReqs().map(r => r.id + ":" + (r.pct ? Math.round(r.have * 100) + "%" : Math.round(r.have)) + "/" + (r.pct ? Math.round(r.need * 100) + "%" : r.need)), rec: S.forn.recebidos, xp: g.CARREIRA.xp, fases: Object.keys(g.CARREIRA.fases).join(), recusas: S.forn.recusas }; })()`);
  if (!fi.concl || process.env.DETALHE) console.log("   dias (dia:sequência/margem):", trilha.join(" "), "\n   ", JSON.stringify(await js("window.__game.S.fase.hist.slice(-3)")));
  ok(fi.concl, `Supermercado Ipê concluído pelo robô no dia ${fi.dia} (${fi.reqs.join(", ")})`);
  ok(fi.xp === 600 && fi.fases === "bairro,centro,ipe", `XP do capítulo 3 concedido uma vez (${fi.xp})`);
  await sleep(1300); const fimTxt = await modalTxt(); await foto("14-capitulo3-concluido");
  if (!fimTxt.includes("Supermercado Restinga")) console.log("   ", fimTxt.slice(0, 400));
  ok(fimTxt.includes("Capítulo 3 concluído") && fimTxt.includes("Convite") && fimTxt.includes("Supermercado Restinga"), "conclusão do capítulo 3 traz o convite do capítulo 4");
  await js(`hideModal(); window.__game.abrirMapa("restinga")`); await sleep(300); await foto("15-mapa-convite-capitulo4");
  const c4 = await js(`(() => ({ det: document.getElementById("mapaDet").textContent, assumir: !!document.getElementById("mAssumir"), lista: [...document.querySelectorAll(".no-lista")].map(b => b.textContent.replace(/\\s+/g, " ").trim()) }))()`);
  ok(c4.det.includes("Supermercado Restinga") && c4.assumir, "capítulo 4 aparece como próxima etapa, com botão para assumir");
  ok(c4.lista.filter(t => t.includes("Concluída")).length === 3 && c4.lista.some(t => t.includes("Capítulo 4") && t.includes("disponível")) && c4.lista.filter(t => t.includes("Bloqueada")).length === 4, `lista acessível mostra 3 concluídas, o capítulo 4 disponível e 5 a 8 bloqueados`);
  await js("hideModal()"); await js("window.__jogarDiaIpe()");
  ok(await js("window.__game.S.fase.concluida && window.__game.FASE === 'ipe' && window.__game.CARREIRA.xp === 600"), "dá para continuar administrando o Ipê depois de concluir");
  await esperarRecarga(`window.__game.trocarLoja("bairro")`);
  ok(await js("window.__game.FASE === 'bairro' && window.__game.S.money >= 1234 && window.__game.CARREIRA.xp === 600"), "e voltar às lojas anteriores sem mexer no XP");

  // ===== 6. mapa em tela pequena =====
  await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await js(`hideModal(); window.__game.abrirMapa("ipe")`); await sleep(500);
  const tp = await js(`(() => { const d = document.getElementById("dialog"), r = d.getBoundingClientRect(), svg = d.querySelector(".mapa-svg").getBoundingClientRect();
    const fontes = [...d.querySelectorAll(".no-lista small, .no-lista b, .legenda span, .mapa-detalhe p")].map(e => parseFloat(getComputedStyle(e).fontSize));
    const alvos = [...d.querySelectorAll("button")].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(b => b.width && b.height).map(b => Math.min(b.width, b.height));
    return { w: r.width, sw: d.scrollWidth, cw: d.clientWidth, svgW: svg.width, minFonte: Math.min(...fontes), minAlvo: Math.min(...alvos), dentro: r.left >= 0 && r.right <= innerWidth }; })()`);
  ok(tp.sw <= tp.cw + 1 && tp.dentro, `mapa cabe em 360 px de largura sem rolagem lateral (janela ${Math.round(tp.w)} px, mapa ${Math.round(tp.svgW)} px)`);
  ok(tp.minFonte >= 12 && tp.minAlvo >= 40, `texto da lista e do detalhe com pelo menos 12 px (${tp.minFonte}) e botões com pelo menos 40 px (${Math.round(tp.minAlvo)})`);
  // teclado: a lista navega e seleciona
  const kb = await js(`(() => { const b = document.querySelectorAll(".no-lista")[0]; b.focus(); b.click(); return new Promise(r => setTimeout(() => r({ foco: document.activeElement && document.activeElement.dataset.id, det: document.getElementById("mapaDet").textContent.slice(0, 60) }), 120)); })()`);
  ok(kb.foco === "bairro" && kb.det.includes("Mercadinho da Lagoa"), `lista selecionável por teclado, foco mantido (${kb.foco})`);
  ok(erros.length === 0, `sem erros de script (${erros.slice(0, 3).join(" | ")})`);
} catch (e) { ok(false, "exceção: " + e.message); }
finally { chrome.kill(); }
const falhas = res.filter(r => !r[0]).length;
console.log(`\n${res.length - falhas} de ${res.length} verificações passaram`);
process.exit(falhas ? 1 : 0);
