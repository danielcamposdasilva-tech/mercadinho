// Clientes diversos, circulação acessível, caixa prioritário, ajuda da equipe e acessibilidade da interface.
// Testes simulados no Chrome sem placa de vídeo (não substituem aparelho físico nem leitor de tela real).
// Uso: node tools/teste-acessibilidade.mjs [url-do-index]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_JOGO = process.argv[2] || pathToFileURL(path.join(raiz, "www", "index.html")).href;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-acess-"));
const port = 9500 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
let ws, id = 0; const wait = new Map(); const erros = []; let falhas = 0, total = 0;
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const js = async e => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500)); return r.result.result.value; };
const ok = (c, t) => { total++; if (!c) falhas++; console.log(`${c ? "OK  " : "FALHA"} ${t}`); };
const pronto = async () => { for (let i = 0; i < 60; i++) { await sleep(150); if (await js("!!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("jogo não iniciou"); };
async function abrir(modo, query = "", limpar = true) {
  // a página atual não pode salvar ao sair (senão regrava o que acabamos de apagar)
  await js(`try { window.save = () => {}; ${limpar ? "localStorage.clear();" : ""} ${modo ? `sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${modo}" }))` : `sessionStorage.removeItem("mercadinho-sessao")`} } catch (e) {}`).catch(() => {});
  await send("Page.navigate", { url: URL_JOGO + query }); await pronto(); await js("hideModal(); window.__game.closeSheet()");
}
const tecla = async (key, code, vk, shift) => { const m = shift ? 8 : 0; await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, modifiers: m, text: key === "Enter" ? String.fromCharCode(13) : key.length === 1 ? key : undefined }); await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers: m }); await sleep(120); };

// Joga um percurso completo para cada perfil forçado e acompanha cada pessoa do começo ao fim.
const PERCURSO = `(perfis, comCarro) => {
  const g = window.__game, S = g.S, P = g.PERFIS;
  S.money = 5000; S.gear.baskets = 30; resetGear(); S.gear.collectors = 3; S.cashiers = tierNow().lanes; S.cashLvl = 4;
  openSectors().forEach(d => { S.sec[d.id].shelfLvl = 3; S.sec[d.id].staff = 3; S.sec[d.id].shelf = shelfCap(3); S.sec[d.id].wh = 30; });
  syncWorkers();
  // perfis forçados pela mesma função de perfil do jogo (substituída só no teste)
  let k = 0; const orig = perfilar;
  perfilar = c => { orig(c); const p = perfis[k++ % perfis.length]; c.perfil = p; c.vel = P[p].vel; c.hx = 0; c.hy = 1;
    c.cat = p === "cadeira" || p === "caoguia" ? ["pcd"] : p === "bengala" || p === "andador" ? ["idoso"] : []; if (p === "caoguia") c.cao = "#d9a35b"; if (p === "bebe") c.bebe = "#5b8fd6"; };
  const vistos = new Map(), estados = {}, max = {};
  let carros = 0, criados = 0;
  for (let t = 0; t < 20 * 300; t++) {
    spawnTimer = 99; carSpawnT = 99;                 // só entram os clientes do teste
    if (comCarro && t % 60 === 0 && carros < perfis.length) { spawnCar(); carros++; }
    if (!comCarro && t % 70 === 0 && criados < perfis.length * 2) { spawnCustomer(); criados++; }
    g.update(0.05);
    for (const c of g.customers) {
      if (!c.perfil || c.perfil === "padrao" && !vistos.has(c.id)) continue;
      if (!vistos.has(c.id)) vistos.set(c.id, { perfil: c.perfil, estados: new Set(), t0: t, fim: null, carro: !!c.car, cao: c.cao, bebe: c.bebe });
      const v = vistos.get(c.id); v.estados.add(c.state); v.ult = t;
      if (c.perfil !== v.perfil || (v.cao && c.cao !== v.cao) || (v.bebe && c.bebe !== v.bebe)) v.trocou = true;
    }
    if (t > 20 * 30 && vistos.size && [...vistos.keys()].every(id => !g.customers.some(c => c.id === id)) && (comCarro ? carros >= perfis.length && !g.pcars.length : criados >= perfis.length * 2)) break;
  }
  perfilar = orig;
  const res = [...vistos.values()].map(v => ({ perfil: v.perfil, carro: v.carro, estados: [...v.estados], duracao: ((v.ult - v.t0) * 0.05).toFixed(0), trocou: !!v.trocou }));
  const restantes = [...vistos.keys()].filter(id => g.customers.some(c => c.id === id)).length;
  // nenhum cão, carrinho ou equipamento vira entidade: só existem clientes, funcionários e carros
  const entidades = g.customers.every(c => typeof c.plan === "object");
  return { res, restantes, entidades, carros: g.pcars.length };
}`;

try {
  let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") erros.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]); });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { let s = 777; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; window.requestAnimationFrame = () => 0; })();` });
  await send("Page.navigate", { url: URL_JOGO }); await pronto();

  const TODOS = ["cadeira", "caoguia", "bengala", "andador", "bebe", "idoso"];
  for (const [nome, modo, q] of [["Livre", "livre", ""], ["bairro", "carreira", ""], ["Centro", null, "?cenario=centro"], ["Ipê", null, "?cenario=ipe"]]) {
    await abrir(modo, q);
    // 1. circulação: mesmas rotas do movimento, com a largura de cada perfil
    const v = await js("window.__game.verificarCirculacao()");
    ok(v.ok, `${nome}: ${v.rotas} rotas sem atravessar gôndolas, caixas, cestas, paredes ou vidro (${v.falhas.slice(0, 2).map(f => `${f.perfil} ${f.rota} × ${f.obstaculo}`).join("; ")})`);
    ok(v.menorCorredor >= v.maiorPegada, `${nome}: menor corredor entre gôndolas (${v.menorCorredor}) ≥ maior pegada (${v.maiorPegada}: cadeira de rodas)`);
    // 2. percurso completo a pé
    if (modo === "carreira") await js(`(() => { const S = window.__game.S; ["bebidas", "hortifruti"].forEach(id => S.sec[id].open = true); S.cashiers = 2; relayout(); syncWorkers(); })()`);
    if (!modo) await js(`(() => { const S = window.__game.S; S.cashiers = 3; ["bebidas", "hortifruti", "laticinios"].forEach(id => S.sec[id].open = true); relayout(); syncWorkers(); })()`);
    const a = await js(`(${PERCURSO})(${JSON.stringify(TODOS)}, false)`);
    const completos = a.res.filter(r => ["toStation", "walk", "shop", "toLane", "queue", "exit", "outside"].every(s => r.estados.includes(s)));
    ok(a.restantes === 0 && completos.length === a.res.length, `${nome}: ${a.res.length} clientes de 6 perfis chegaram, compraram, entraram na fila, pagaram e saíram (${a.res.filter(r => !completos.includes(r)).map(r => r.perfil + ":" + r.estados.join(">")).join(" | ") || "todos completos"})`);
    ok(TODOS.every(p => completos.some(r => r.perfil === p)), `${nome}: cada perfil fez o percurso inteiro (maior duração ${Math.max(...a.res.map(r => +r.duracao))} s)`);
    ok(a.res.every(r => !r.trocou) && a.entidades, `${nome}: cão-guia, carrinho e equipamentos ficaram com a mesma pessoa do começo ao fim (sem entidade separada)`);
    // 3. percurso de quem chega de carro
    const b = await js(`(${PERCURSO})(${JSON.stringify(TODOS)}, true)`);
    const bc = b.res.filter(r => r.carro && ["toStation", "walk", "shop", "toLane", "queue", "exit", "outside"].every(s => r.estados.includes(s)));
    ok(bc.length === b.res.length && bc.length >= 4 && b.restantes === 0 && b.carros === 0, `${nome}: clientes vindos do estacionamento completaram o percurso (${bc.length} de ${b.res.length}; perfis ${[...new Set(bc.map(r => r.perfil))].join(", ")}; carros que sobraram ${b.carros})`);
  }

  // 4. regras da fila prioritária, com clientes montados à mão
  await abrir("livre");
  const regras = await js(`(() => {
    const g = window.__game, S = g.S, cs = g.customers; cs.length = 0; S.cashiers = 1; g.acess().cortesiaBebe = false;
    let q = 0; const mk = (nome, cat, extra) => { const c = Object.assign({ id: 9000 + q, nome, lane: 0, state: "queue", qChegou: q + 1, qAt: q++, cat: cat || [], querPrio: true, plan: [], x: 0, y: 0, perfil: "padrao" }, extra || {}); cs.push(c); return c; };
    const ord = () => g.filaOrdenada(0).map(c => c.nome).join(",");
    const out = {};
    const A = mk("A"); g.lanes[0].servingId = A.id; mk("B"); mk("C", ["pcd"]);
    out.naoInterrompe = ord();                                     // A em atendimento; C passa à frente de B
    cs.length = 0; g.lanes[0].servingId = null; q = 0;
    mk("P", ["pcd"]); mk("I", ["idoso"]); mk("O", ["idoso", "idoso80"]); out.oitenta = ord();   // 80+ só passa da pessoa idosa 60+
    cs.length = 0; q = 0; mk("D1", ["pcd"]); mk("D2", ["gestante"]); mk("D3", ["tea"]); out.mesmaCategoria = ord();
    cs.length = 0; q = 0; mk("N"); mk("Bb", [], { bebe: "#fff" }); mk("L", ["lactante"]); out.bebeSemCortesia = ord();
    g.acess().cortesiaBebe = true; out.bebeComCortesia = ord(); g.acess().cortesiaBebe = false;
    cs.length = 0; q = 0; mk("X", [], { ultr: 3 }); mk("Y", ["pcd"]); out.limite = ord();
    cs.length = 0; q = 0; mk("N2"); mk("R", ["idoso"], { querPrio: false }); mk("Z", ["mobred"]); out.escolha = ord();
    // vários caixas: o prioritário é o 2; o caixa 1 segue a ordem de chegada
    S.cashiers = 3; g.acess().caixaPrio = 1; cs.length = 0; q = 0;
    mk("F1"); mk("F2", ["pcd"]); out.outroCaixa = ord();
    const c1 = { id: 1, cat: ["pcd"], querPrio: true }, c2 = { id: 2, cat: [], querPrio: true };
    mk("w1", [], { lane: 1 }); mk("w2", [], { lane: 2 }); mk("w3", [], { lane: 2 });
    out.escolhePrio = g.escolherCaixa(c1); mk("pp", ["pcd"], { lane: 1 }); out.escolheComum = g.escolherCaixa(c2);
    cs.length = 0; g.acess().caixaPrio = 0; S.cashiers = 1;
    return out; })()`);
  ok(regras.naoInterrompe === "A,C,B", `prioridade não interrompe quem já está sendo atendido (${regras.naoInterrompe})`);
  ok(regras.oitenta === "P,O,I", `80+ passa à frente só de outra pessoa idosa, não da pessoa com deficiência (${regras.oitenta})`);
  ok(regras.mesmaCategoria === "D1,D2,D3", `entre prioridades, vale a ordem de chegada (${regras.mesmaCategoria})`);
  ok(regras.bebeSemCortesia === "L,N,Bb" && regras.bebeComCortesia === "L,Bb,N", `carrinho de bebê não é prioridade legal; a cortesia opcional vem depois das legais (${regras.bebeSemCortesia} / ${regras.bebeComCortesia})`);
  ok(regras.limite === "X,Y", `cliente já ultrapassado 3 vezes não é ultrapassado de novo (${regras.limite})`);
  ok(regras.escolha === "Z,N2,R", `quem tem direito e prefere não usar mantém a ordem de chegada (${regras.escolha})`);
  ok(regras.outroCaixa === "F1,F2", `com vários caixas, o caixa comum atende por ordem de chegada (${regras.outroCaixa})`);
  ok(regras.escolhePrio === 1 && regras.escolheComum !== 1, `quem usa a prioridade vai ao caixa prioritário; os demais evitam quando há prioridade esperando (${regras.escolhePrio}, ${regras.escolheComum})`);

  // 5. simulação longa: um caixa e três caixas, muita gente com prioridade
  for (const caixas of [1, 3]) {
    await abrir("livre");
    const sim = await js(`(() => {
      const g = window.__game, S = g.S; S.money = 20000; S.tier = ${caixas > 1 ? 1 : 0}; S.park.lots.market = true; S.cashiers = ${caixas};
      ["bebidas", "hortifruti", "laticinios"].forEach(id => S.sec[id].open = true); relayout(); syncWorkers(); S.gear.baskets = 30; resetGear();
      openSectors().forEach(d => { S.sec[d.id].staff = 3; S.sec[d.id].staffLvl = 3; S.sec[d.id].shelfLvl = 3; });
      const orig = perfilar; let n = 0; perfilar = c => { orig(c); if (n++ % 3 === 0) { c.cat = ["idoso"]; c.querPrio = true; } };
      let interrompido = 0, troca = 0, maxFila = 0, ant = {}; const pagos = new Set(), entraram = new Set(), porCaixa = [0, 0, 0, 0], prioCaixa = [0, 0, 0, 0];
      for (let t = 0; t < 20 * 90 * 2; t++) {
        const antes = g.lanes.map(l => l.servingId);
        g.update(0.05);
        g.lanes.forEach((l, i) => { const a = antes[i]; if (a != null && l.servingId != null && l.servingId !== a) { const c = g.customers.find(c => c.id === a); if (c && c.state === "queue") interrompido++; } if (a == null && l.servingId != null) { porCaixa[i]++; const c = g.customers.find(c => c.id === l.servingId); if (c && c.cat && c.cat.length) prioCaixa[i]++; } });
        for (const c of g.customers) { if (c.state === "queue") { entraram.add(c.id); maxFila = Math.max(maxFila, c.qWait); } if (c.state === "exit" && entraram.has(c.id)) pagos.add(c.id); }
        // ordem entre clientes sem prioridade na mesma fila nunca se inverte
        for (let l = 0; l < S.cashiers; l++) { const q = g.filaOrdenada(l).filter(c => c.state === "queue" && !(c.cat && c.cat.length)); for (let i = 1; i < q.length; i++) if (q[i].qChegou < q[i - 1].qChegou) troca++; }
      }
      perfilar = orig;
      const desistiram = S.lastDay ? S.lastDay.lost : 0, presos = g.customers.filter(c => c.state === "queue" && c.qWait > 15.5).length;
      return { interrompido, troca, maxFila: +maxFila.toFixed(1), pagos: pagos.size, entraram: entraram.size, presos, desistiram, porCaixa, prioCaixa, servidos: S.served, prioHoje: g.acess().total.prio };
    })()`);
    ok(sim.interrompido === 0, `${caixas} caixa(s): nenhum atendimento interrompido em 2 dias (${sim.servidos} atendidos, ${sim.prioHoje} com prioridade)`);
    ok(sim.troca === 0, `${caixas} caixa(s): ordem estável entre clientes sem prioridade`);
    ok(sim.presos === 0 && sim.maxFila <= 15.5, `${caixas} caixa(s): ninguém esquecido na fila (maior espera ${sim.maxFila} s; limite de paciência 15 s; ${sim.pagos} de ${sim.entraram} que entraram na fila pagaram)`);
    ok(sim.porCaixa.slice(0, caixas).every(n => n > 0), `${caixas} caixa(s): todos os caixas atenderam (${sim.porCaixa.slice(0, caixas).join(", ")}; com prioridade: ${sim.prioCaixa.slice(0, caixas).join(", ")})`);
  }

  // 6. ajuda da equipe: pedidos resolvidos, ninguém preso
  await abrir("livre");
  const aj = await js(`(() => {
    const g = window.__game, S = g.S; S.gear.collectors = 2; S.gear.baskets = 30; resetGear(); S.money = 3000;
    const orig = perfilar; perfilar = c => { orig(c); c.pedeAjuda = true; };
    let maxAj = 0, pedidos = new Set(), resolvidos = new Set(), semAjuda = 0;
    for (let t = 0; t < 20 * 150; t++) { g.update(0.05);
      for (const w of g.collectors) { if (w.state === "ajuda" || w.state === "acompanha") { w._t = (w._t || 0) + 0.05; maxAj = Math.max(maxAj, w._t); } else w._t = 0; }
      for (const c of g.customers) if (c.ajuda) { pedidos.add(c.id); if (c.ajuda.estado === "concluida" || c.ajuda.estado === "sem") resolvidos.add(c.id); } }
    perfilar = orig;
    const abertos = g.customers.filter(c => c.ajuda && c.ajuda.estado === "pedindo" && c.ajuda.t > 8.1).length;
    return { pedidos: pedidos.size, resolvidos: resolvidos.size, maxAj: +maxAj.toFixed(1), abertos, ajudas: g.acess().total.ajudas, sem: g.acess().total.semAjuda, servidos: S.served, coletores: g.collectors.map(w => w.state) };
  })()`);
  ok(aj.ajudas > 0, `carrinheiro livre acompanha quem pede ajuda (${aj.ajudas} ajudas, ${aj.sem} sem ajuda de ${aj.pedidos} pedidos)`);
  ok(aj.maxAj <= 31 && aj.abertos === 0, `ajuda nunca prende funcionário (máx. ${aj.maxAj} s; limite 30 s) nem cliente (pedido expira em 8 s e a compra segue)`);
  ok(aj.servidos > 30, `com e sem ajuda, a compra continua (${aj.servidos} atendidos)`);

  // 7. teclado, lista acessível, Esc e foco
  await abrir("livre");
  await js(`document.getElementById("btnLista").focus()`); await tecla("Enter", "Enter", 13);
  let st = await js(`({ sheet: window.__game.ui.sheet, foco: document.activeElement && document.activeElement.id, linhas: document.querySelectorAll("#shBody .row").length })`);
  ok(st.sheet === "lista" && st.foco === "shTitle" && st.linhas >= 8, `botão Lista abre a lista em HTML e leva o foco ao título (${st.linhas} itens)`);
  const nomes = await js(`[...document.querySelectorAll("#shBody .row")].map(b => b.textContent.trim().replace(/\\s+/g, " ").slice(0, 40))`);
  ok(["Mercearia", "Caixa 1", "Cestas e carrinhos", "Depósito", "Estacionamento"].every(n => nomes.some(x => x.includes(n))), `lista inclui setores, caixas, cestas, depósito e estacionamento`);
  await tecla("Tab", "Tab", 9); await tecla("Tab", "Tab", 9);
  const focoLinha = await js(`document.activeElement.className`);
  await js(`[...document.querySelectorAll("#shBody .row")].find(b => b.textContent.includes("Caixa 1")).focus()`); await tecla("Enter", "Enter", 13);
  st = await js(`({ sheet: window.__game.ui.sheet, sel: window.__game.ui.sel && window.__game.ui.sel.kind, from: window.__game.ui.from, prio: document.getElementById("shBody").textContent.includes("Atendimento prioritário") })`);
  ok(/row/.test(focoLinha) && st.sheet === "building" && st.sel === "lane" && st.prio, `Tab chega aos itens; Enter abre o mesmo painel do toque (caixa com atendimento prioritário)`);
  await tecla("Escape", "Escape", 27);
  st = await js(`({ sheet: window.__game.ui.sheet, foco: document.activeElement && document.activeElement.id })`);
  ok(st.sheet === null && st.foco === "btnLista", `Esc fecha o painel e devolve o foco ao botão que abriu (${st.foco})`);
  const z0 = await js("window.__game.cam.s"); await tecla("+", "Equal", 187); const z1 = await js("window.__game.cam.s");
  const x0 = await js("window.__game.cam.x"); await tecla("ArrowRight", "ArrowRight", 39); const x1 = await js("window.__game.cam.x");
  await js(`document.getElementById("btnMenos").click()`); const z2 = await js("window.__game.cam.s");
  ok(z1 > z0 && x1 > x0 && z2 < z1, `teclado e botões mudam zoom e enquadramento sem gestos (${z0.toFixed(2)} → ${z1.toFixed(2)} → ${z2.toFixed(2)})`);
  await js(`document.querySelector('.nav-btn[data-tab="upgrade"]').focus()`); await tecla("Enter", "Enter", 13); await tecla("Escape", "Escape", 27);
  ok(await js(`document.activeElement.dataset.tab === "upgrade" && !window.__game.ui.sheet`), "Esc no painel Melhorar devolve o foco à aba Melhorar");
  await js(`document.getElementById("btnSettings").focus(); showIntro();`); await sleep(100);
  const noModal = await js(`document.getElementById("dialog").contains(document.activeElement)`);
  await tecla("Escape", "Escape", 27);
  ok(noModal && await js(`document.getElementById("modal").hidden && document.activeElement.id === "btnSettings"`), "janela recebe o foco, Esc fecha e o foco volta ao controle de origem");
  const sem = await js(`[...document.querySelectorAll("button")].filter(b => b.offsetParent !== null && !(b.getAttribute("aria-label") || b.textContent.trim())).length`);
  ok(sem === 0, `todo botão visível tem nome acessível (${sem} sem nome)`);
  await js(`openSheet("upgrade"); document.querySelector('[data-s="store"]').click()`); await sleep(100);
  const estados = await js(`(() => { openSheet("tasks"); return [...document.querySelectorAll(".act")].map(b => b.querySelector("i") && b.querySelector("i").textContent).filter(Boolean).length; })()`);
  ok(estados > 0, `botões de ação dizem o estado em texto (disponível, falta dinheiro, bloqueado), não só pela cor (${estados})`);
  const live = await js(`(() => { const a = document.getElementById("anuncio"); let n = 0; const o = new MutationObserver(() => n++); o.observe(a, { childList: true, characterData: true, subtree: true });
    for (let i = 0; i < 20 * 20; i++) window.__game.update(0.05); return new Promise(r => setTimeout(() => { o.disconnect(); r({ n, money: document.getElementById("moneyChip").getAttribute("aria-live") }); }, 300)); })()`);
  ok(live.n <= 6 && !live.money, `leitores de tela não recebem cada mudança de dinheiro ou movimento (${live.n} avisos em 20 s de jogo)`);

  // 8. movimento reduzido não muda a simulação
  const simA = async red => { await abrir("livre"); return js(`(() => { window.__game.PREFS.movReduzido = ${red}; let s = 5; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 20 * 90; i++) window.__game.update(0.05); const S = window.__game.S; return [S.money.toFixed(2), S.served, S.day, S.today.lost].join("|"); })()`); };
  const r0 = await simA(false), r1 = await simA(true);
  ok(r0 === r1, `reduzir movimento não muda a velocidade nem o resultado da simulação (${r0} = ${r1})`);

  // 9. partidas antigas carregam com valores padrão
  await abrir("livre");
  const antigo = { money: 777.5, day: 9, dayT: 10, rep: 3.7, tier: 1, branches: 0, earned: 5000, served: 300, seenIntro: true, cashiers: 2, cashLvl: 1, whLvl: 2, adsLvl: 0, mgrLvl: 0,
    sec: {}, gear: { baskets: 10, carts: 2, buyB: 1, buyC: 1, collectors: 1, colLvl: 0 }, today: { sales: 0, goods: 0, lost: 0, served: 0 }, lastSeen: Date.now(), ach: {}, stats: { tapGear: 0, hand: 0 } };
  ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria", "acougue", "frios", "limpeza", "pet", "utilidades", "farmacia", "floricultura"].forEach((k, i) => antigo.sec[k] = { open: i < 4, shelfLvl: 1, priceLvl: 0, staff: 1, staffLvl: 0, shelf: 3, wh: 4 });
  await js(`window.save = () => {}; localStorage.setItem("mercadinho-save-v4", ${JSON.stringify(JSON.stringify(antigo))})`);
  await abrir("livre", "", false);
  const la = await js(`(() => { const g = window.__game; for (let i = 0; i < 40; i++) g.update(0.05); save(); const s = JSON.parse(localStorage.getItem("mercadinho-save-v4")); return { money: g.S.money, day: g.S.day, tier: g.S.tier, acess: s.acess, park: !!s.park }; })()`);
  ok(la.money > 500 && la.day === 9 && la.tier === 1 && la.acess && la.acess.caixaPrio === 0 && la.acess.cortesiaBebe === false && la.park, `save antigo do Modo Livre (v4) carrega e recebe os campos novos com valor padrão (${JSON.stringify(la).slice(0, 160)})`);
  const carr = await js(`(() => { const c = { versao: 1, fase: "bairro", inicio: Date.now(), xp: 0, repCarreira: 0, conquistas: [], fases: {}, transicoes: 0, loja: Object.assign(${JSON.stringify(antigo)}, { tier: 0, cashiers: 1, fase: { bons: 1, nets: [10], hist: [], concluida: false } }) };
    window.save = () => {}; localStorage.setItem("mercadinho-carreira-v1", JSON.stringify(c)); return true; })()`);
  await abrir("carreira", "", false);
  const lc = await js(`(() => { const g = window.__game; for (let i = 0; i < 40; i++) g.update(0.05); save(); const c = JSON.parse(localStorage.getItem("mercadinho-carreira-v1")); const l = JSON.parse(localStorage.getItem("mercadinho-save-v4"));
    return { fase: g.FASE, bons: g.S.fase.bons, acess: !!(c.lojas ? c.lojas[c.ativa] : c.loja).acess, livre: l.money }; })()`);
  ok(carr && lc.fase === "bairro" && lc.bons === 1 && lc.acess && lc.livre === la.money, `save antigo da carreira carrega (fase e sequência mantidas), sem tocar no Modo Livre`);
  ok(erros.length === 0, `sem erros de script (${erros.slice(0, 3).join(" | ")})`);
} catch (e) { ok(false, "exceção: " + e.message); } finally { chrome.kill(); }
console.log(`\n${total - falhas} de ${total} verificações passaram`);
process.exit(falhas ? 1 : 0);
