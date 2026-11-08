// Capturas dos clientes diversos, dos trajetos, do caixa prioritário e da lista acessível (Chrome instalado).
// Uso: node tools/capturas-acessibilidade.mjs [pasta-saida]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(raiz, "..", "capturas-interface", "acessibilidade"));
const BASE = pathToFileURL(path.join(raiz, "www", "index.html")).href;
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-capa-"));
const port = 9800 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
let ws, id = 0; const wait = new Map(); const erros = [];
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const js = async e => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
const pronto = async () => { for (let i = 0; i < 60; i++) { await sleep(150); if (await js("!!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("jogo não iniciou"); };
async function tela(w, h) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 700 }); }
async function foto(nome) { await sleep(500); const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, nome), Buffer.from(r.result.data, "base64")); console.log("foto", nome); }
async function abrir(modo, query = "") {
  await js(`try { localStorage.clear(); ${modo ? `sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${modo}" }))` : ""} } catch (e) {}`).catch(() => {});
  await send("Page.navigate", { url: BASE + query }); await pronto(); await js("hideModal()");
}
// cria clientes de cada perfil e deixa a loja andar; tudo pelo ciclo normal (chegada, compras, fila, saída)
const VITRINE = `window.__vitrine = (perfis, segundos) => {
  const g = window.__game, S = g.S;
  S.money = Math.max(S.money, 3000); S.gear.baskets = Math.max(S.gear.baskets, 24); resetGear();
  openSectors().forEach(d => { S.sec[d.id].shelf = shelfCap(S.sec[d.id].shelfLvl); S.sec[d.id].wh = 12; });
  perfis.forEach(p => { spawnCustomer(); const c = g.customers[g.customers.length - 1]; if (!c) return;
    c.perfil = p; c.vel = g.PERFIS[p].vel; c.cat = []; c.querPrio = true; c.idade = null;
    if (p === "cadeira" || p === "caoguia") c.cat = ["pcd"];
    if (p === "bengala" || p === "andador" || p === "idoso") { c.cat = ["idoso"]; c.hair = "#d9d9d9"; }
    if (p === "caoguia") c.cao = "#d9a35b"; if (p === "bebe") c.bebe = "#5b8fd6"; });
  for (let i = 0; i < 20 * segundos; i++) g.update(0.05);
};`;
try {
  let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } if (m.method === "Runtime.exceptionThrown") erros.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]); });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { let s = 2027; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; })();` });
  await tela(390, 844); await send("Page.navigate", { url: BASE }); await pronto();

  // 1. Modo Livre: compras e fila do caixa único (prioridade aplicada na fila)
  await abrir("livre"); await js(VITRINE);
  await js(`(() => { const S = window.__game.S; S.sec.bebidas.open = true; relayout(); syncWorkers(); __vitrine(["cadeira", "caoguia", "bengala", "andador", "bebe", "idoso"], 9); })()`);
  await js(`window.__game.flyTo(W / 2, FZ - 40, window.__game.camLimits().s0 * 1.7, true)`); await foto("01-livre-clientes-nas-gondolas.png");
  await js(`(() => { for (let i = 0; i < 20 * 7; i++) window.__game.update(0.05); window.__game.flyTo(LANES[0].x - 8, FZ + 50, window.__game.camLimits().s0 * 2.2, true); })()`); await foto("02-livre-fila-caixa-unico-com-prioridade.png");

  // 2. Bairro: chegada de carro e a pé, rampa, piso tátil e entrada
  await abrir("carreira"); await js(VITRINE);
  await js(`(() => { const g = window.__game; __vitrine(["cadeira", "caoguia", "andador", "bebe"], 1.2); g.flyTo(W - 10, FZ + 40, g.camLimits().s0 * 1.8, true); })()`); await foto("03-bairro-entrada-rampa-piso-tatil.png");
  await js(`(() => { const g = window.__game; for (let i = 0; i < 20 * 30; i++) g.update(0.05); g.flyTo(W / 2, H + 20, g.camLimits().s0 * 1.4, true); })()`); await foto("04-bairro-estacionamento-e-saidas.png");

  // 3. Centro: corredores mais largos, três caixas e caixa prioritário sinalizado
  await abrir(null, "?cenario=centro"); await js(VITRINE);
  await js(`(() => { const S = window.__game.S; S.tier = 1; S.cashiers = 3; ["bebidas", "hortifruti", "laticinios"].forEach(id => S.sec[id].open = true); relayout(); syncWorkers(); __vitrine(["cadeira", "caoguia", "bebe", "andador", "bengala", "idoso", "cadeira", "bebe"], 10); })()`);
  await js(`window.__game.flyTo(W / 2, FZ - 50, window.__game.camLimits().s0 * 1.5, true)`); await foto("05-centro-corredores.png");
  await js(`(() => { for (let i = 0; i < 20 * 6; i++) window.__game.update(0.05); window.__game.flyTo(LANES[1].x, FZ + 40, window.__game.camLimits().s0 * 1.5, true); })()`); await foto("06-centro-tres-caixas-prioritario.png");
  await js(`(() => { const g = window.__game; g.select({ kind: "lane", l: 0 }); })()`); await sleep(400);
  await js(`document.querySelector("#shBody details") && (document.querySelector("#shBody details").open = true)`); await foto("07-painel-do-caixa-prioridade.png");
  await js(`(() => { window.__game.closeSheet(); openSheet("lista"); })()`); await foto("08-lista-de-construcoes.png");
  await js(`(() => { closeSheet(); openSheet("settings"); document.getElementById("shBody").scrollTop = 999; })()`); await foto("09-configuracoes-acessibilidade.png");
  await js(`closeSheet(); toggleOverview()`); await sleep(800); await foto("10-centro-visao-geral.png");

  // 4. computador
  await tela(1280, 800); await abrir("livre"); await js(VITRINE);
  await js(`(() => { const S = window.__game.S; S.tier = 1; S.cashiers = 3; S.park.lots.market = true; ["bebidas", "hortifruti", "laticinios"].forEach(id => S.sec[id].open = true); relayout(); syncWorkers(); __vitrine(["cadeira", "caoguia", "bebe", "andador", "bengala", "idoso"], 12); openSheet("lista"); })()`);
  await foto("11-computador-lista-e-cenario.png");
  // foco visível pelo teclado
  await js(`(() => { closeSheet(); document.getElementById("btnLista").focus(); })()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await foto("12-computador-foco-visivel.png");
  console.log("erros:", erros.length, erros.slice(0, 3).join(" | "));
} finally { chrome.kill(); }
