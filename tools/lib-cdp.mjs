// Utilitários comuns dos testes por Chrome DevTools Protocol (sem dependências).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function iniciar({ url, largura = 390, altura = 844, semente = 5151, animar = false } = {}) {
  const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const URL_JOGO = url || pathToFileURL(path.join(raiz, "www", "index.html")).href;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcd-t-"));
  const port = 9300 + Math.floor(Math.random() * 400);
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
  let ws, id = 0; const wait = new Map(), erros = [], res = [];
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  const js = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result.result.value; };
  let list;
  for (let i = 0; i < 80 && !(list && list.find(t => t.type === "page")); i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { } await sleep(200); }
  ws = new WebSocket(list.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") erros.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n").slice(0, 3).join(" | ")); });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: largura, height: altura, deviceScaleFactor: 1, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { let s = ${semente}; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; ${animar ? "" : "window.requestAnimationFrame = () => 0;"} })();` });
  const esperarJogo = async () => { for (let i = 0; i < 100; i++) { await sleep(150); if (await js("!!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("jogo não iniciou: " + erros.join("; ")); };
  const abrir = async (modo, q = "") => {
    await js(`(() => { try { ${modo ? `sessionStorage.setItem("mercadinho-sessao", JSON.stringify({ modo: "${modo}" }))` : `sessionStorage.removeItem("mercadinho-sessao")`}; } catch (e) {} })()`).catch(() => {});
    await send("Page.navigate", { url: URL_JOGO + q }); await esperarJogo();
  };
  const esperarRecarga = async acao => { await js(`window.__marca = 1; ${acao}`); for (let i = 0; i < 100; i++) { await sleep(150); if (await js("!window.__marca && !!(window.__game && window.__boot && window.__boot.ok)").catch(() => false)) return; } throw new Error("não recarregou: " + erros.join("; ")); };
  const ls = k => js(`localStorage.getItem(${JSON.stringify(k)})`);
  const gravarCarreira = async (obj, extra = "") => { await abrir(null); await js(`localStorage.setItem("mercadinho-carreira-v1", ${JSON.stringify(JSON.stringify(obj))}); ${extra}`); };
  const carreira = async () => JSON.parse(await ls("mercadinho-carreira-v1"));
  const foto = async (arq, clip) => { const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) }); fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, Buffer.from(r.result.data, "base64")); };
  const ok = (cond, txt) => { res.push([!!cond, txt]); console.log(`${cond ? "OK  " : "FALHA"} ${txt}`); return !!cond; };
  const tamanho = (w, h) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: true });
  const fim = () => { try { ws.close(); } catch { } chrome.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } };
  await send("Page.navigate", { url: URL_JOGO }); await esperarJogo(); await js("localStorage.clear()");
  return { send, js, abrir, esperarRecarga, ls, gravarCarreira, carreira, foto, ok, res, erros, tamanho, fim, URL_JOGO };
}
// carreira com os capítulos até `ate` concluídos e a próxima fase pronta para começar
export const ORDEM = ["bairro", "centro", "ipe", "restinga", "pitanga", "cajueiro", "brisa", "grande"];
export function carreiraEm(fase, extra = {}) {
  const i = ORDEM.indexOf(fase), fases = {};
  ORDEM.slice(0, i).forEach((f, k) => fases[f] = { concluida: true, dia: 10 + k * 10, xp: 200, rep: 4.2, atendidos: 1000, faturamento: 20000, conquistas: 2, em: Date.now() });
  return Object.assign({ versao: 2, fase, ativa: fase, inicio: Date.now() - 864e5, xp: 200 * i, repCarreira: 4.2, conquistas: [], convites: {}, transicoes: i, fases, lojas: {} }, extra);
}
