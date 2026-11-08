// Capturas da escolha de modo, da carreira e da transição (Chrome instalado, sem dependências).
// Uso: node tools/capturas-carreira.mjs <pasta-saida> [url-do-index]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(raiz, "..", "capturas-interface", "carreira"));
const URL_JOGO = process.argv[3] || pathToFileURL(path.join(raiz, "www", "index.html")).href;
fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-capc-"));
const port = 9900 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
let ws, id = 0; const wait = new Map(); const erros = [];
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const js = async e => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };
const pronto = async () => { for (let i = 0; i < 60; i++) { await sleep(150); if (await js("!!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("jogo não iniciou"); };
async function foto(nome, w = 390, h = 844) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 700 }); await sleep(700);
  const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, nome), Buffer.from(r.result.data, "base64")); console.log("foto", nome);
}
async function sessao(modo) { await js(`try { ${modo ? `sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${modo}" }))` : `sessionStorage.removeItem("mercadinho-sessao")`}; } catch (e) {}`); await send("Page.navigate", { url: URL_JOGO }); await pronto(); }
try {
  let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } if (m.method === "Runtime.exceptionThrown") erros.push(m.params.exceptionDetails.text); });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: URL_JOGO }); await pronto(); await js("localStorage.clear()");

  // carreira nova: introdução e loja do bairro
  await sessao("carreira"); await sleep(800); await foto("01-bairro-introducao.png");
  await js("hideModal()"); await sleep(2500); await foto("02-bairro-loja.png");
  await js("toggleOverview()"); await sleep(1200); await foto("03-bairro-visao-geral.png"); await js("toggleOverview()");
  await js("openSheet('expand')"); await sleep(900); await foto("04-bairro-painel-carreira.png"); await js("closeSheet()");
  // cumpre as metas de verdade (estrutura comprada e três dias bons registrados) para disparar a conclusão
  await js(`(() => { const S = window.__game.S; ["bebidas", "hortifruti"].forEach(id => { S.sec[id].open = true; S.sec[id].shelf = 4; S.sec[id].wh = 4; });
    S.sec.mercearia.shelfLvl = 2; S.whLvl = 1; S.cashiers = 2; S.fase.bons = 3; S.fase.nets = [120, 140, 150]; S.day = 9; relayout(); syncWorkers(); })()`);
  await sleep(2500); await foto("05-transicao-convite.png");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await js("document.getElementById('go').click()"); await pronto(); await sleep(800);
  await foto("06-centro-introducao.png");
  await js("hideModal(); iniciarPromo('bebidas')"); await sleep(3500); await foto("07-centro-loja-promocao.png");
  await js("toggleOverview()"); await sleep(1500); await foto("08-centro-visao-geral.png"); await foto("09-centro-visao-geral-1280.png", 1280, 800);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await js("toggleOverview(); openSheet('expand')"); await sleep(900); await foto("10-centro-painel-carreira.png");
  // tela inicial com as duas partidas
  await js(`localStorage.setItem("mercadinho-save-v4", JSON.stringify({ money: 812, day: 6, tier: 0, seenIntro: true }))`);
  await sessao(null); await sleep(600); await foto("00-tela-inicial.png");
  console.log("erros:", erros.length, erros.slice(0, 3).join(" | "));
} finally { chrome.kill(); }
