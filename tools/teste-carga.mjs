// Carrega a página muitas vezes e registra qualquer arquivo que falhe ou erro de script.
// Uso: node tools/teste-carga.mjs <url> [vezes]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [url, vezes = "20"] = process.argv.slice(2);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-carga-"));
const port = 9500 + Math.floor(Math.random() * 200);
const p = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
let falhas = 0;
try {
  let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
  const ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0; const wait = new Map(); let ev = [];
  const reqs = new Map();
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === "Network.requestWillBeSent") reqs.set(m.params.requestId, m.params.request.url);
    if (m.method === "Network.loadingFailed") ev.push(`FALHOU ${reqs.get(m.params.requestId)} ${m.params.errorText}`);
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400 && !/favicon/.test(m.params.response.url)) ev.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
    if (m.method === "Runtime.exceptionThrown") ev.push("ERRO " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]); });
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  for (let i = 0; i < +vezes; i++) {
    ev = [];
    await send("Page.navigate", { url });
    await sleep(4000);
    const ok = await send("Runtime.evaluate", { expression: "!!(window.__game && (!window.__boot || window.__boot.ok))", returnByValue: true });
    const pronto = ok.result.result.value;
    if (!pronto) falhas++;
    if (ev.length || !pronto) { console.log(`carga ${i + 1}: ${pronto ? "jogo ok" : "JOGO NÃO INICIOU"} | ${ev.join(" | ")}`); }
  }
  console.log(`${vezes} cargas, ${falhas} sem jogo funcionando no fim`);
} finally { p.kill(); }
process.exit(falhas ? 1 : 0);
