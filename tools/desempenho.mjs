// Mede quadros por segundo em condições iguais (Chrome sem placa de vídeo, 390x844, densidade 2,
// mesmo sorteio, 4 s de medição depois de 3 s de aquecimento), com e sem as otimizações.
// Uso: node tools/desempenho.mjs [url-do-index]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] || pathToFileURL(path.join(raiz, "www", "index.html")).href;

async function medir(url, sessao, visao, semOtimizar) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-fps-"));
  const port = 9600 + Math.floor(Math.random() * 90);
  const p = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
  try {
    let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
    const ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener("open", r, { once: true }));
    let id = 0; const wait = new Map();
    ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
    const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
    await send("Page.enable"); await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { let s = 99; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
      ${sessao ? `try { sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${sessao}" })); } catch (e) {}` : ""} ${semOtimizar ? "window.__semOtimizar = true;" : ""} })();` });
    await send("Page.navigate", { url });
    await sleep(1500);
    await send("Runtime.evaluate", { expression: `try { hideModal(); } catch (e) {} ${visao ? "toggleOverview();" : ""}` });
    await sleep(3000);
    const r = await send("Runtime.evaluate", { expression: `new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else r(n / 4); })(); })`, awaitPromise: true, returnByValue: true });
    return r.result.result.value;
  } finally { p.kill(); }
}
const casos = [
  ["Meu Mercado", BASE, "livre"], ["Bairro", BASE + "?cenario=bairro"], ["Centro", BASE + "?cenario=centro"],
];
console.log("cenário | vista | sem otimização | com otimização (quadros/s)");
for (const [nome, url, ses] of casos.filter(c => !process.env.FILTRO || c[0] === process.env.FILTRO)) for (const visao of [false, true]) {
  const a = await medir(url, ses, visao, true), b = await medir(url, ses, visao, false);
  console.log(`${nome} | ${visao ? "geral" : "normal"} | ${a.toFixed(1)} | ${b.toFixed(1)}`);
}
