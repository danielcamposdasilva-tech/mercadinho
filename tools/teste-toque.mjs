// Arraste, zoom, toque em gôndola, caixa, depósito e estacionamento, no celular e no computador.
// Uso: node tools/teste-toque.mjs [url-do-index]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_JOGO = process.argv[2] || pathToFileURL(path.join(raiz, "www", "index.html")).href;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-toque-"));
const port = 9450 + Math.floor(Math.random() * 40);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
let ws, id = 0; const wait = new Map(); const erros = []; let falhas = 0, total = 0;
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const js = async e => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };
const ok = (c, t) => { total++; if (!c) falhas++; console.log(`${c ? "OK  " : "FALHA"} ${t}`); };
const pronto = async () => { for (let i = 0; i < 60; i++) { await sleep(150); if (await js("!!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("jogo não iniciou"); };
const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", Object.assign({ type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" }, extra));
async function tocar(x, y) { await mouse("mousePressed", x, y); await sleep(40); await mouse("mouseReleased", x, y); await sleep(250); }
async function alvo(expr) { return js(`(() => { const g = window.__game, r = ${expr}; const p = g.toScreen(r.x + r.w / 2, r.y + r.h / 2); return { x: Math.round(p.x), y: Math.round(p.y) }; })()`); }
async function cenario(nome, url, modo, w, h) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  await js(`try { ${modo ? `sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${modo}" }))` : ""} } catch (e) {}`).catch(() => {});
  await send("Page.navigate", { url }); await pronto(); await js("hideModal(); window.__game.closeSheet()"); await sleep(400);
  const c0 = await js("({ x: window.__game.cam.x, y: window.__game.cam.y, s: window.__game.cam.s })");
  // zoom com a roda
  const cx = Math.round(w / 2), cy = Math.round(h / 2);
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: cx, y: cy, deltaX: 0, deltaY: -300 }); await sleep(500);
  const c2 = await js("window.__game.cam.s"); ok(c2 > c0.s * 1.05, `${nome}: roda do mouse aproxima (${c0.s.toFixed(2)} → ${c2.toFixed(2)})`);
  // arraste (depois do zoom: em tela larga a loja inteira cabe e a câmera fica presa nos limites)
  const c1a = await js("({ x: window.__game.cam.x, y: window.__game.cam.y })");
  await mouse("mousePressed", cx, cy); for (let k = 1; k <= 8; k++) { await mouse("mouseMoved", cx - k * 12, cy - k * 6); await sleep(16); } await mouse("mouseReleased", cx - 96, cy - 48); await sleep(600);
  const c1 = await js("({ x: window.__game.cam.x, y: window.__game.cam.y, sheet: window.__game.ui.sheet })");
  ok(Math.hypot(c1.x - c1a.x, c1.y - c1a.y) > 5 && !c1.sheet, `${nome}: arrastar move a câmera e não abre painel`);
  await js("window.__game.recenter(true)"); await sleep(400);
  // toques em objetos: as áreas de toque usam as mesmas posições do desenho
  for (const [rotulo, expr, kind] of [["gôndola", "g.bRect({ kind: 'shelf', i: 0 })", "shelf"], ["caixa", "g.bRect({ kind: 'lane', l: 0 })", "lane"], ["depósito", "g.bRect({ kind: 'wh' })", "wh"], ["estacionamento", "g.bRect({ kind: 'parking' })", "parking"]]) {
    await js(`(() => { const g = window.__game, r = ${expr.replace("g.", "g.")}; g.flyTo(r.x + r.w / 2, r.y + r.h / 2, g.cam.s, true); })()`); await sleep(300);
    const p = await alvo(expr); await tocar(p.x, p.y); await sleep(300);
    const sel = await js("window.__game.ui.sel && window.__game.ui.sel.kind");
    ok(sel === kind, `${nome}: tocar no ${rotulo} abre o painel certo (${sel})`);
    await js("window.__game.closeSheet()"); await sleep(200);
  }
}
try {
  let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } if (m.method === "Runtime.exceptionThrown") erros.push(m.params.exceptionDetails.text); });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: URL_JOGO }); await pronto(); await js("localStorage.clear()");
  for (const [w, h, rot] of [[390, 844, "celular"], [1280, 800, "computador"]]) {
    await cenario(`bairro/${rot}`, URL_JOGO, "carreira", w, h);
    await cenario(`centro/${rot}`, URL_JOGO + "?cenario=centro", null, w, h);
    await cenario(`ipe/${rot}`, URL_JOGO + "?cenario=ipe", null, w, h);
    await cenario(`livre/${rot}`, URL_JOGO, "livre", w, h);
  }
  ok(erros.length === 0, `sem erros de script (${erros.slice(0, 2).join(" | ")})`);
} catch (e) { ok(false, "exceção: " + e.message); } finally { chrome.kill(); }
console.log(`\n${total - falhas} de ${total} verificações passaram`);
process.exit(falhas ? 1 : 0);
