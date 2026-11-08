// Captura rápida de uma cena para inspeção visual.
// Uso: node tools/foto.mjs <saida.png> <modo|cenario=centro> "<js antes da foto>" [largura altura escala]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [saida, modo = "livre", script = "", w = 390, h = 844, esc = 2] = process.argv.slice(2);
let url = pathToFileURL(path.join(raiz, "www", "index.html")).href;
if (modo.startsWith("cenario=")) url += "?" + modo;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-foto-"));
const port = 9100 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
let ws, id = 0; const wait = new Map(); const erros = [];
const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
const js = async e => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
try {
  let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } if (m.method === "Runtime.exceptionThrown") erros.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]); });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: +esc, mobile: +w < 700 });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { let s = 31; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    try { localStorage.clear(); ${modo.startsWith("cenario=") ? "" : `sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${modo}" }))`}; } catch (e) {} })();` });
  await send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) { await sleep(150); if (await js("!!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) break; }
  await js("try { hideModal(); } catch (e) {}");
  const out = await js(`(async () => { ${script} })()`);
  if (out !== undefined) console.log("saída:", JSON.stringify(out).slice(0, 2000));
  await sleep(600);
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.resolve(saida), Buffer.from(r.result.data, "base64"));
  console.log("foto", saida, "erros:", erros.length, erros.slice(0, 3).join(" | "));
} finally { chrome.kill(); }
