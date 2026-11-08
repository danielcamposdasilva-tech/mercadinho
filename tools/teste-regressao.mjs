// Regression: run the same seeded simulation on two builds of the game and compare the state.
// usage: node regress.mjs <old.html> <new.html>
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withChrome(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const p = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "--window-size=390,844", "about:blank"], { stdio: "ignore" });
  try {
    let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(200); } }
    const target = ver.find(t => t.type === "page");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener("open", r, { once: true }));
    let id = 0; const wait = new Map(); const logs = [];
    ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
      if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("ERR " + m.params.args.map(a => a.value ?? a.description).join(" ")); });
    const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
    await send("Runtime.enable"); await send("Page.enable");
    const evalJs = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
    return await fn({ send, evalJs, logs });
  } finally { p.kill(); }
}

const INIT = save => `
(() => {
  let s = 12345; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const T0 = 1793814000000; Date.now = () => T0; window.requestAnimationFrame = () => 0; performance.now = () => 1000;
  // a versão nova abre na tela de modos; a sessão "livre" equivale ao jogo antigo (que ignora esta chave)
  try { sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "livre" })); } catch (e) {}
  // a versão nova tem clientes diversos e caixa prioritário (mudança intencional, testada em teste-acessibilidade.mjs);
  // aqui eles ficam desligados para provar que o resto do jogo continua idêntico à versão anterior
  window.__semDiversidade = true;
  try { localStorage.clear(); ${save ? `localStorage.setItem("mercadinho-save-v4", ${JSON.stringify(save)});` : ""} } catch (e) {}
})();`;

async function run(file, save, ref) {
  return withChrome(async ({ send, evalJs, logs }) => {
    await send("Page.addScriptToEvaluateOnNewDocument", { source: INIT(save) });
    await send("Page.navigate", { url: pathToFileURL(file).href });
    for (let i = 0; i < 50; i++) { await sleep(150); if (await evalJs("!!window.__game").catch(() => false)) break; }
    await sleep(400);
    const out = await evalJs(`(() => {
      const g = window.__game; const S0 = JSON.parse(JSON.stringify(g.S));
      // freeze the live loop, then step the simulation deterministically
      let s = 777; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0;
      return document.fonts.ready.then(() => new Promise(res => setTimeout(async () => {
        for (let i = 0; i < 20 * 90 * 3; i++) g.update(0.05);       // 3 game days
        const S = JSON.parse(JSON.stringify(g.S)); delete S.lastSeen; delete S0.lastSeen;
        const acts = g.actions().map(a => [a.key, a.cost, !!a.ok]);
        // one frame drawn with the same state: the scenery must be pixel-identical
        let frame = "";
        try { floorCache = null; draw(); await new Promise(r => setTimeout(r, 300)); draw(); frame = document.getElementById("c").toDataURL(); } catch (e) { frame = "ERRO " + e.message; }
        // pixels diferentes em relação ao quadro de referência (a outra versão)
        let difPx = null; const ref = ${JSON.stringify(ref || null)};
        if (ref) { const im = new Image(); im.src = ref; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d");
          x.drawImage(im, 0, 0); const A = x.getImageData(0, 0, c.width, c.height).data; x.clearRect(0, 0, c.width, c.height);
          const im2 = new Image(); im2.src = frame; await im2.decode(); x.drawImage(im2, 0, 0); const B = x.getImageData(0, 0, c.width, c.height).data;
          difPx = 0; for (let i = 0; i < A.length; i += 4) if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) difPx++; difPx = difPx / (A.length / 4); }
        res({ S0, S, cars: g.pcars.length, customers: g.customers.length, acts, stalls: g.STALLS.length, bills: g.bills(), frame, difPx });
      }, 300)));
    })()`);
    out.logs = logs; return out;
  });
}

async function makeSave(file) {
  return withChrome(async ({ send, evalJs }) => {
    await send("Page.addScriptToEvaluateOnNewDocument", { source: INIT(null) });
    await send("Page.navigate", { url: pathToFileURL(file).href });
    for (let i = 0; i < 50; i++) { await sleep(150); if (await evalJs("!!window.__game").catch(() => false)) break; }
    return evalJs(`(() => { const S = window.__game.S; S.money = 9000; S.tier = 1; S.day = 12; S.rep = 3.6; S.park.lots.park1 = true; S.park.lots.market = true; S.park.staff = 2; S.park.price = 1.5;
      S.sec.bebidas.open = true; S.sec.hortifruti.open = true; S.sec.laticinios.open = true; S.cashiers = 2; S.seenIntro = true; return JSON.stringify(S); })()`);
  });
}

const [oldF, newF] = process.argv.slice(2).map(f => path.resolve(f));
const save = await makeSave(oldF);
let fail = 0;
for (const [label, sv] of [["partida nova", null], ["save antigo", save]]) {
  const a = await run(oldF, sv); const b = await run(newF, sv, a.frame);
  // 1.5: equipe com nível individual (mudança intencional, testada em teste-v15.mjs). Aqui saem do estado os campos novos
  // e os preços de treino; o resto (dinheiro, clientes, carros, estoque) precisa continuar idêntico.
  const TREINO = new Set(["cashtrain", "traincol", "parktrain"]);
  const limpa = S => { if (!S) return S; S = JSON.parse(JSON.stringify(S)); delete S.cashEq; delete S.cashEqBase; if (S.gear) { delete S.gear.colEq; delete S.gear.colEqBase; } if (S.park) { delete S.park.eq; delete S.park.eqBase; }
    Object.values(S.sec || {}).forEach(st => { delete st.eq; delete st.eqBase; }); if (S.today) delete S.today.repCausas; if (S.lastDay) delete S.lastDay.repCausas; return S; };   // 1.6: motivos da reputação
  for (const o of [a, b]) { o.S0 = limpa(o.S0); o.S = limpa(o.S); o.acts = o.acts.filter(([k]) => !TREINO.has(k) && !k.startsWith("train:")); }
  const same = k => JSON.stringify(a[k]) === JSON.stringify(b[k]);
  const keys = ["S0", "S", "cars", "customers", "acts", "stalls", "bills", "frame"];
  // o quadro pode variar só no serrilhado do texto (carga da fonte): tolera até 0,3% dos pixels
  const diff = keys.filter(k => k === "frame" ? !(b.difPx != null && b.difPx <= 0.003) : !same(k));
  if (!same("frame")) console.log(`  quadro: ${(b.difPx * 100).toFixed(3)}% dos pixels diferentes${b.difPx <= 0.003 ? " (dentro da tolerância de texto)" : ""}`);
  console.log(`[${label}] antigo: dinheiro ${a.S.money.toFixed(2)}, dia ${a.S.day}, atendidos ${a.S.served}, carros ${a.S.park.served} | novo: dinheiro ${b.S.money.toFixed(2)}, dia ${b.S.day}, atendidos ${b.S.served}, carros ${b.S.park.served}`);
  console.log(`  erros antigo: ${a.logs.length} ${a.logs.slice(0, 3).join(" | ")}`);
  console.log(`  erros novo:   ${b.logs.length} ${b.logs.slice(0, 3).join(" | ")}`);
  console.log(`  diferenças: ${diff.length ? diff.join(", ") : "nenhuma"}`);
  for (const k of ["S0","S"]) if (!same(k)) { const fa = a[k], fb = b[k]; const ks = new Set([...Object.keys(fa), ...Object.keys(fb)]); console.log("   ", k, [...ks].filter(x => JSON.stringify(fa[x]) !== JSON.stringify(fb[x])).map(x => x + "=" + String(JSON.stringify(fa[x])).slice(0,80) + " / " + String(JSON.stringify(fb[x])).slice(0,80)).join(" ;; ")); }
  if (diff.includes("frame") && process.env.QUADROS) { for (const [n, o] of [["antigo", a], ["novo", b]]) fs.writeFileSync(path.join(process.env.QUADROS, `${label.replace(/ /g, "-")}-${n}.png`), Buffer.from(String(o.frame).split(",")[1] || "", "base64")); }
}
process.exit(fail ? 1 : 0);
