// Capturas de tela dos cenários (Chrome instalado, sem dependências).
// Uso: node tools/capturas.mjs <url-base> <pasta-saida>
// Ex.: node tools/capturas.mjs http://127.0.0.1:8765/ ../capturas-interface
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

async function shot(url, file, w, h, script, waitMs = 2500) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-shot-"));
  const port = 9800 + Math.floor(Math.random() * 150);
  const p = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  try {
    let list; for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
    const ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener("open", r, { once: true }));
    let id = 0; const wait = new Map(), errs = [];
    ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
      if (m.method === "Runtime.exceptionThrown") errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
    const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
    await send("Runtime.enable"); await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 700 });
    await send("Page.navigate", { url });
    await sleep(1500);
    if (script) await send("Runtime.evaluate", { expression: script, awaitPromise: true });
    await sleep(waitMs);
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(outDir, file), Buffer.from(r.result.data, "base64"));
    const fps = await send("Runtime.evaluate", { expression: `new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); })(); })`, awaitPromise: true, returnByValue: true });
    console.log(file, "erros:", errs.length, errs.slice(0, 2).join(" | "), "quadros/s:", fps.result.result.value);
  } finally { p.kill(); }
}

// fecha a introdução e mostra a cena: "visao" = vista geral; "rua" = câmera na rua principal
const prep = modo => `(async () => {
  try { document.querySelector("#modal") && (document.querySelector("#modal").hidden = true); } catch (e) {}
  const g = window.__game; if (!g) return;
  if (${JSON.stringify(modo)} === "visao") toggleOverview();
  if (${JSON.stringify(modo)} === "rua") { truck.state = "away"; truck.timer = 99; onibus.estado = "chega"; onibus.x = PONTO_X + 160; g.flyTo(PONTO_X - 30, -10, 1.6, true); }
})()`;

for (const c of ["bairro", "centro"]) {
  await shot(`${base}?cenario=${c}`, `cenario-${c}-rua-390.png`, 390, 844, prep("rua"));
  await shot(`${base}?cenario=${c}`, `cenario-${c}-visao-390.png`, 390, 844, prep("visao"));
  await shot(`${base}?cenario=${c}`, `cenario-${c}-visao-1280.png`, 1280, 800, prep("visao"));
}
await shot(base, `cenario-livre-390.png`, 390, 844, prep(null));
