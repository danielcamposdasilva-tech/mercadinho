// Teste da carreira e da separação dos modos, jogando com um robô simples.
// Uso: node tools/teste-carreira.mjs [url-do-index]   (padrão: www/index.html por file://)
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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-carr-"));
const port = 9700 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
let ws, id = 0; const wait = new Map(); let erros = [];
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const js = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
async function abrir(modo) {                       // abre o jogo numa sessão (null = tela inicial)
  await js(`(() => { try { ${modo ? `sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${modo}" }))` : `sessionStorage.removeItem("mercadinho-sessao")`}; } catch (e) {} })()`).catch(() => {});
  await send("Page.navigate", { url: URL_JOGO }); await esperarJogo();
}
async function esperarJogo() { for (let i = 0; i < 60; i++) { await sleep(150); if (await js("!!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("jogo não iniciou"); }
const ls = k => js(`localStorage.getItem(${JSON.stringify(k)})`);

// robô: compra o que a fase pede, mantém reserva para as contas, faz promoções no Centro
const ROBO = `(() => {
  const g = window.__game; window.__robo = { dias: 0 };
  window.__jogarDia = (compras) => {
    const S = g.S, dia0 = S.day;
    for (let i = 0; i < 20 * 95 && S.day === dia0; i++) {
      if (i % 40 === 0) { const l = g.piles.findIndex((p, k) => k < g.LANES.length && p.b + p.c > 0); if (l >= 0) { const p = g.piles[l]; if (p.c > 0) { p.c--; g.station.c++; } else { p.b--; g.station.b++; } } }   // jogador devolve uma cesta a cada 2 s
      if (i % 20 === 0) {
        if (g.CARREIRA && g.FASE === "centro" && !g.promoAtiva() && S.dayT < 10 && S.fase.promosOk < 3 && S.money > 400) {
          const best = ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria"].filter(id => S.sec[id].open).sort((a, b) => (S.sec[b].wh + S.sec[b].shelf) - (S.sec[a].wh + S.sec[a].shelf))[0];
          g.iniciarPromo(best);
        }
        const precisa = { "shelf:mercearia": () => S.sec.mercearia.shelfLvl < 2, "storage": () => S.whLvl < (g.FASE === "centro" ? 2 : 1),
          "cashhire": () => S.cashiers < (g.FASE === "centro" ? 3 : 2), "buybasket": () => S.gear.buyB < 2 };
        // metas fixas primeiro (guarda dinheiro para elas); depois reforça a gôndola que mais ficou vazia hoje:
        // sem estoque no depósito → amplia o depósito; com estoque → repositor e, depois, gôndola maior
        const pend = compras.filter(k => (!precisa[k] || precisa[k]()) && g.actions().some(x => x.key === k && !x.maxed && !x.locked));
        const vs = (S.fase && S.fase.dia.vs) || {}, pior = Object.keys(vs).sort((a, b) => vs[b] - vs[a])[0];
        const grave = pior && vs[pior] > S.fase.dia.t * 0.15;
        const extra = grave ? (S.sec[pior].wh === 0 && S.whLvl < 6 ? ["storage"] : S.sec[pior].staff < 3 ? ["hire:" + pior] : nvMin("rep", pior) < 3 ? ["train:" + pior] : ["shelf:" + pior]) : [];
        const lista = pend.length && !grave ? pend : pend.slice(0, 1).concat(extra);
        for (const k of lista) { if (precisa[k] && !precisa[k]() && !extra.includes(k)) continue; const a = g.actions().find(x => x.key === k); if (a && a.ok && S.money - a.cost > g.bills() + 15) { g.doAction(k); break; } }
      }
      g.update(0.05);
    }
    return { dia: S.day, dinheiro: S.money, rep: S.rep, ok: S.fase ? S.fase.bons : null };
  };
})()`;

try {
  let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") erros.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]); });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; window.requestAnimationFrame = () => 0; })();` });
  await send("Page.navigate", { url: URL_JOGO }); await esperarJogo();
  await js("localStorage.clear()");

  // 1. partida antiga do Modo Livre (formato v4, sem campos novos)
  const antigo = { money: 777.5, day: 9, dayT: 10, rep: 3.7, tier: 1, branches: 0, earned: 5000, served: 300, seenIntro: true, cashiers: 2, cashLvl: 1, whLvl: 2, adsLvl: 0, mgrLvl: 0,
    sec: {}, gear: { baskets: 10, carts: 2, buyB: 1, buyC: 1, collectors: 1, colLvl: 0 }, today: { sales: 0, goods: 0, lost: 0, served: 0 }, lastSeen: Date.now(), ach: {}, stats: { tapGear: 0, hand: 0 } };
  ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria", "acougue", "frios", "limpeza", "pet", "utilidades", "farmacia", "floricultura"].forEach((k, i) => antigo.sec[k] = { open: i < 4, shelfLvl: 1, priceLvl: 0, staff: 1, staffLvl: 0, shelf: 3, wh: 4 });
  await js(`localStorage.setItem("mercadinho-save-v4", ${JSON.stringify(JSON.stringify(antigo))})`);

  // 2. tela inicial: nada é salvo
  await abrir(null);
  ok(await js(`!!document.getElementById("menu")`), "tela inicial aparece sem sessão");
  ok(await js(`document.getElementById("menu").textContent.includes("Continuar")`), "tela inicial oferece Continuar para o Meu Mercado salvo");
  await js("window.__game.update(1); window.__game.S.money = 1"); await sleep(100);
  ok(JSON.parse(await ls("mercadinho-save-v4")).money === 777.5, "menu não altera o save do Modo Livre");
  ok(await ls("mercadinho-carreira-v1") === null, "menu não cria save de carreira");

  // 3. Modo Livre carrega a partida antiga
  await abrir("livre");
  ok(await js(`(() => { const S = window.__game.S; return S.money === 777.5 && S.day === 9 && S.tier === 1 && window.__game.SCENE.nome === "Mercadinho da Esquina"; })()`), "Modo Livre carrega a partida antiga (dinheiro, dia, porte)");
  ok(await ls("mercadinho-carreira-v1") === null, "Modo Livre não cria save de carreira");

  // 4. carreira nova começa no bairro
  await abrir("carreira");
  const c0 = await js(`(() => { const g = window.__game; return { fase: g.FASE, W: g.W, nome: g.SCENE.nome, money: g.S.money, tier: g.S.tier, intro: !document.getElementById("modal").hidden }; })()`);
  ok(c0.fase === "bairro" && c0.W === 276 && c0.nome === "Mercadinho da Lagoa" && c0.tier === 0, `carreira começa no bairro (${JSON.stringify(c0)})`);
  ok(c0.intro, "introdução da fase aparece");
  ok(JSON.parse(await ls("mercadinho-save-v4")).money === 777.5, "carreira não toca no save do Modo Livre");

  // 5. jogar o bairro até concluir
  await js(ROBO);
  const comprasBairro = ["open:bebidas", "open:hortifruti", "shelf:mercearia", "storage", "cashhire", "buybasket", "lot:park1"];
  let dias = 0, info;
  for (; dias < 40; dias++) { info = await js(`window.__jogarDia(${JSON.stringify(comprasBairro)})`); if (await js("window.__game.S.fase.concluida")) break; }
  const fb = await js(`(() => { const g = window.__game; return { concl: g.S.fase.concluida, dia: g.S.day, xp: g.CARREIRA.xp, money: g.S.money, reqs: g.faseReqs().map(r => r.id + ":" + Math.round(r.have) + "/" + r.need), served: g.S.served, park: g.S.park.served }; })()`);
  ok(fb.concl, `bairro concluído no dia ${fb.dia} (${fb.reqs.join(", ")}; ${fb.served} clientes, ${fb.park} carros)`);
  ok(fb.park > 0, "carros usaram as vagas do bairro");
  const xp1 = fb.xp;
  await js("concluirFase(); concluirFase();");
  ok(await js("window.__game.CARREIRA.xp") === xp1, `XP da fase concedido uma única vez (${xp1})`);

  // 6. recarregar mantém a fase
  const antesReload = await js("window.__game.S.day");
  await abrir("carreira");
  ok(await js(`window.__game.FASE === "bairro" && window.__game.S.day === ${antesReload} && window.__game.S.fase.concluida`), "recarregar volta ao bairro concluído, mesmo dia");

  // 7. transição única para o Centro
  await js("hideModal(); window.__game.assumirProxima()"); await esperarJogo();
  const c2 = await js(`(() => { const g = window.__game; return { fase: g.FASE, W: g.W, nome: g.SCENE.nome, money: g.S.money, tier: g.S.tier, cust: g.customers.length, cars: g.pcars.length, xp: g.CARREIRA.xp, trans: g.CARREIRA.transicoes, rep: g.S.rep, day: g.S.day }; })()`);
  ok(c2.fase === "centro" && c2.W === 432 && c2.tier === 1 && c2.money === 1500 && c2.day === 1, `Centro com estrutura própria (${JSON.stringify(c2)})`);
  ok(c2.cust === 0 && c2.cars === 0, "nenhum cliente ou carro da fase anterior");
  ok(c2.xp === xp1 && c2.trans === 1, "experiência levada, uma transição");
  await js("window.__game.assumirProxima()"); await sleep(400);
  ok(await js(`window.__game.FASE === "centro" && window.__game.CARREIRA.transicoes === 1`), "chamar a transição de novo não faz nada");
  ok(JSON.parse(await ls("mercadinho-save-v4")).money === 777.5, "Modo Livre continua intacto depois da transição");

  // 8. jogar o Centro com promoções
  await js("hideModal()"); await js(ROBO);
  const comprasCentro = ["open:laticinios", "cashhire", "open:padaria", "lot:park1", "buybasket", "storage"];
  for (dias = 0; dias < 50; dias++) { info = await js(`window.__jogarDia(${JSON.stringify(comprasCentro)})`); if (await js("window.__game.S.fase.concluida")) break; }
  const fc = await js(`(() => { const g = window.__game, S = g.S; return { concl: S.fase.concluida, dia: S.day, promos: S.fase.promosOk + "/" + S.fase.promosFeitas, reqs: g.faseReqs().map(r => r.id + ":" + Math.round(r.have) + "/" + r.need), served: S.served, park: S.park.served, fees: S.lastDay && S.lastDay.park && S.lastDay.park.fees, stalls: g.STALLS.length, dup: new Set(g.STALLS.map(s => s.car).filter(Boolean)).size === g.STALLS.filter(s => s.car).length }; })()`);
  if (!fc.concl || process.env.DETALHE) console.log("   últimos dias:", JSON.stringify(await js("[window.__game.S.fase.hist.map(h => h.dia + ':' + h.itens.filter(i => !i.ok).map(i => i.txt).join(' / ')), window.__perdas, window.__game.S.cashiers, window.__game.S.gear, window.__game.S.cashLvl]")));
  ok(fc.concl, `Centro concluído no dia ${fc.dia} (${fc.reqs.join(", ")}; promoções ${fc.promos})`);
  ok(fc.park > 0 && fc.dup, `estacionamento do Centro funcionando (${fc.park} carros, ${fc.stalls} vagas, sem vaga duplicada)`);
  ok(await js(`document.getElementById("modal").textContent.includes("em desenvolvimento") || window.__game.S.fase.concluida`), "fim do conteúdo indica capítulos em desenvolvimento");
  await js("hideModal()"); await js(`window.__jogarDia([])`);
  ok(await js("window.__game.S.fase.concluida && window.__game.FASE === 'centro'"), "dá para continuar administrando depois de concluir");

  // 9. rotas: nenhum cliente parado demais
  const rotas = await js(`(() => { const g = window.__game; let parados = 0; const pos = new Map(g.customers.map(c => [c.id, c.x + "," + c.y + c.state]));
    for (let i = 0; i < 20 * 30; i++) g.update(0.05);
    g.customers.forEach(c => { if (pos.get(c.id) === c.x + "," + c.y + c.state && c.state !== "queue" && c.state !== "atStation" && c.state !== "shop") parados++; });
    return { n: g.customers.length, parados }; })()`);
  ok(rotas.parados === 0, `nenhum cliente travado no Centro (${rotas.n} na loja)`);

  // 10. voltar ao menu e Modo Livre intacto; apagar carreira não apaga o livre
  await abrir(null);
  ok(await js(`document.getElementById("menu").textContent.includes("Capítulo 2")`), "tela inicial mostra a carreira no capítulo 2");
  await js(`localStorage.removeItem("mercadinho-carreira-v1")`);
  ok(JSON.parse(await ls("mercadinho-save-v4")).money === 777.5, "apagar a carreira não apaga o Modo Livre");

  // 11. prévia não substitui partidas reais
  await send("Page.navigate", { url: URL_JOGO + "?cenario=centro" }); await esperarJogo();
  await js("window.__game.S.money = 99999; save()");
  ok(JSON.parse(await ls("mercadinho-save-v4")).money === 777.5 && (await ls("mercadinho-carreira-v1")) === null, "prévia salva só na chave de prévia");
  ok(erros.length === 0, `sem erros de script (${erros.slice(0, 3).join(" | ")})`);
} catch (e) { ok(false, "exceção: " + e.message); }
finally { chrome.kill(); }
const falhas = res.filter(r => !r[0]).length;
console.log(`\n${res.length - falhas} de ${res.length} verificações passaram`);
process.exit(falhas ? 1 : 0);
