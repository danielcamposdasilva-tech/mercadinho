"use strict";
// =====================================================================
// 1.4: diagnóstico automático, ligado por padrão com aviso (pode ser desligado nas Configurações).
// Destino: planilha do Daniel no Google Drive, por um app da web do Apps Script (endereço em versao.json,
// campo "diag", ou na constante abaixo). Sem login: identificador aleatório por instalação, que o jogador
// pode trocar. Nunca envia nome, e-mail, IP (o Apps Script não recebe) nem o save completo.
// Fila local limitada (200 eventos), envio em lote ao abrir, a cada 3 minutos e ao sair; sem internet a
// fila espera. Cada evento tem id aleatório: o servidor ignora repetidos, então reenviar não duplica.
// Não usa Math.random (as partidas e os testes continuam determinísticos) e não roda nada no loop de desenho.
// =====================================================================
const DIAG_URL_PADRAO = "";                     // preenchido quando o app da web do Apps Script for publicado
const CHAVE_DIAG = "mercadinho-diag";
const DIAG_MAX = 200, DIAG_LOTE = 50;
const rndId = (n = 10) => { const a = new Uint8Array(n); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < n; i++) a[i] = (Date.now() * (i + 7)) & 255; } return [...a].map(b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join(""); };
let DG = null;
function dg() {
  if (DG) return DG;
  try { DG = JSON.parse(localStorage.getItem(CHAVE_DIAG) || "null"); } catch (e) { DG = null; }
  DG = Object.assign({ id: rndId(8), ligado: true, avisado: false, fila: [], url: "", iniciados: [], hb: 0, limpo: true }, DG || {});
  return DG;
}
function gravarDg() { try { localStorage.setItem(CHAVE_DIAG, JSON.stringify(dg())); } catch (e) {} }
const urlDiag = () => dg().url || DIAG_URL_PADRAO;
// tira e-mails e números longos (telefone, documento) de qualquer texto livre
const limparTexto = t => String(t || "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]").replace(/\+?\d[\d\s().-]{7,}\d/g, "[número]").slice(0, 1500);
function regDiag(tipo, dados, prio = 0) {
  const d = dg(); if (!d.ligado || MODO === "previa") return;
  if (dados && dados.texto) dados.texto = limparTexto(dados.texto);
  d.fila.push({ i: rndId(12), t: tipo, ts: Date.now(), v: APP_VERSAO, p: plataforma(), m: MODO, f: FASE || "", d: typeof S !== "undefined" && S ? S.day : 0, pr: prio, x: dados || {} });
  while (d.fila.length > DIAG_MAX) { const k = d.fila.findIndex(e => e.pr === 0); d.fila.splice(k >= 0 ? k : 0, 1); }   // descarta primeiro os de menor prioridade
  gravarDg();
}
let enviando = false;
function enviarDiag(saindo) {
  const d = dg(), url = urlDiag(); if (!d.ligado || !url || !d.fila.length || enviando) return;
  if (navigator.onLine === false) return;
  const lote = d.fila.slice(0, DIAG_LOTE), corpo = JSON.stringify({ inst: d.id, eventos: lote }), ids = new Set(lote.map(e => e.i));
  const tirar = () => { d.fila = d.fila.filter(e => !ids.has(e.i)); gravarDg(); };
  if (saindo && navigator.sendBeacon) { try { if (navigator.sendBeacon(url, new Blob([corpo], { type: "text/plain" }))) tirar(); } catch (e) {} return; }
  enviando = true;
  fetch(url, { method: "POST", mode: "no-cors", body: corpo, headers: { "Content-Type": "text/plain" } }).then(() => { tirar(); enviando = false; if (d.fila.length) setTimeout(enviarDiag, 3000); }).catch(() => { enviando = false; });
}
function alternarDiag() {
  const d = dg(); d.ligado = !d.ligado; if (!d.ligado) d.fila = []; gravarDg();
  toast(d.ligado ? "Envio de dados de diagnóstico ligado." : "Envio desligado. A fila que não tinha sido enviada foi apagada."); lastSig = ""; renderSheet();
}
function trocarIdDiag() { const d = dg(); d.id = rndId(8); d.fila = []; gravarDg(); toast(`Novo identificador: ${d.id}`); lastSig = ""; renderSheet(); }
// endereço da planilha pode chegar pelo versao.json do site (sem precisar de APK novo)
function configDiag() {
  if (MODO === "previa") return;
  const base = ehNativo() ? SITE_JOGO : (location.protocol.startsWith("http") ? "" : null); if (base == null) return;
  fetch(base + "versao.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(v => {
    if (v && typeof v.diag === "string" && /^https:\/\/script\.google(usercontent)?\.com\//.test(v.diag) && v.diag !== dg().url) { dg().url = v.diag; gravarDg(); enviarDiag(); }
  }).catch(() => {});
}
// ---------- sinais coletados ----------
if (MODO !== "previa") {
  const d = dg(), agora = Date.now();
  // encerramento sem saída limpa (batimento recente e sem pagehide): provável fechamento forçado ou travamento
  if (!d.limpo && d.hb && agora - d.hb < 10 * 60e3) regDiag("encerramento", { haS: Math.round((agora - d.hb) / 1000) }, 1);
  d.limpo = false; d.hb = agora; gravarDg();
  setInterval(() => { const x = dg(); x.hb = Date.now(); x.limpo = false; gravarDg(); }, 10e3);
  // tempo ativo (visível e com toque no último minuto) e visível parado
  let ultToque = agora, tAtivo = 0, tVisivel = 0, tUlt = agora, visivelDesde = agora;
  ["pointerdown", "keydown", "touchstart"].forEach(ev => addEventListener(ev, () => { ultToque = Date.now(); }, { passive: true, capture: true }));
  const contar = () => { const t = Date.now(), dt = Math.min(5000, t - tUlt); tUlt = t; if (document.visibilityState === "visible") { tVisivel += dt; if (t - ultToque < 60e3) tAtivo += dt; } };
  // congelamento: o relógio não andou por mais de 5 s com a tela visível o tempo todo
  setInterval(() => { const t = Date.now(), gap = t - tUlt; if (document.visibilityState === "visible" && gap > 5000 && t - visivelDesde > gap + 1000) regDiag("congelamento", { ms: gap }, 1); contar(); }, 1000);
  const fecharSessao = () => { contar(); if (tVisivel > 5000) regDiag("tempo", { ativoS: Math.round(tAtivo / 1000), visivelS: Math.round(tVisivel / 1000) }); tAtivo = 0; tVisivel = 0; };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { fecharSessao(); enviarDiag(true); } else { visivelDesde = Date.now(); tUlt = Date.now(); } });
  addEventListener("pagehide", () => { fecharSessao(); const x = dg(); x.limpo = true; gravarDg(); enviarDiag(true); });
  // erros de JavaScript (até 5 diferentes por sessão)
  const vistos = new Set();
  const erro = (msg, onde) => { msg = String(msg || "").slice(0, 200); if (vistos.has(msg) || vistos.size >= 5) return; vistos.add(msg); regDiag("erro", { msg, onde: String(onde || "").slice(0, 120) }, 2); };
  addEventListener("error", e => erro(e.message, (e.filename || "").split("/").pop() + ":" + e.lineno));
  addEventListener("unhandledrejection", e => erro(e.reason && (e.reason.message || e.reason), "promessa"));
  (window.__erros || []).forEach(e => erro(e.m, "início"));
  if (MODO !== "menu") {
    regDiag("sessao", { aparelho: aparelho(), tela: `${innerWidth}x${innerHeight}`, saldo: Math.round(S.money), cap: CFG ? CFG.capitulo : null, trapaca: !!(S.trapacas || (CARREIRA && CARREIRA.trapacas)) });
    if (NA_CARREIRA && FASE && !d.iniciados.includes(FASE)) { d.iniciados.push(FASE); gravarDg(); regDiag("capitulo", { acao: "iniciou", dia: S.day }); }
  }
  setTimeout(() => { configDiag(); enviarDiag(); }, 5000);
  setInterval(() => enviarDiag(), 180e3);
}
// fechamento de cada dia: indicadores agregados (não cada clique) e bloqueios
let diagVermelho = 0, diagObraAviso = -99;
if (typeof endDay === "function" && MODO !== "menu" && MODO !== "previa") { const e0 = endDay;
  endDay = function () {
    e0();
    const ld = S.lastDay || {}, x = { saldo: Math.round(S.money), net: Math.round(ld.net || 0), atend: ld.served || 0, perd: ld.lost || 0, rep: Math.round((S.rep || 0) * 10) / 10 };
    if (NA_CARREIRA && FASE === "cajueiro" && S.atac) { const a = S.atac, dd = a.dias[0] || {}; Object.assign(x, { fardos: dd.fardos, multas: dd.multas, vazias: a.pos.slice(0, a.nPos).filter(p => p.sec && !p.fardos).length, auto: !!a.auto, alto: a.pos.reduce((s, p) => s + (p.alto || 0), 0) }); }
    if (NA_CARREIRA && (FASE === "brisa" || FASE === "grande") && S.shop && S.shop.dias && S.shop.dias[0]) { const r = S.shop.dias[0]; Object.assign(x, { recusados: r.recusados, sat: Math.round(r.sat * 100), ocup: Math.round(r.ocupacao * 100) }); }
    if (NA_CARREIRA && FASE === "grande" && S.obra) Object.assign(x, { obra: S.obra.fase, pct: Math.round(S.obra.pct) });
    if (S.credito) x.credito = Math.round(S.credito.principalRest + S.credito.jurosRest);
    regDiag("dia", x);
    diagVermelho = S.money < 0 ? diagVermelho + 1 : 0;
    if (diagVermelho === 3) regDiag("bloqueio", { tipo: "vermelho", saldo: Math.round(S.money) }, 1);
    if (NA_CARREIRA && FASE === "grande" && S.obra && S.obra.fase !== "operacao" && typeof previsaoObra === "function" && S.day - diagObraAviso >= 5) {
      const p = previsaoObra(), m = motivoParada(); if ((p && p.sobra < 0) || m === "dinheiro") { diagObraAviso = S.day; regDiag("bloqueio", { tipo: "obra", motivo: m, sobra: p ? p.sobra : null, pct: Math.round(S.obra.pct) }, 1); } }
  };
}
if (typeof concluirFase === "function") { const c0 = concluirFase; concluirFase = function (forcar) { const r = c0(forcar); if (NA_CARREIRA && S.fase && S.fase.concluida) regDiag("capitulo", { acao: forcar ? "concluiu (trapaça)" : "concluiu", dia: S.day }, 1); return r; }; }
if (typeof marcarTrapaca === "function") { const m0 = marcarTrapaca; marcarTrapaca = function (oque) { regDiag("trapaca", { oque }); return m0(oque); }; }
if (typeof aplicarResgate === "function") { const a0 = aplicarResgate; aplicarResgate = function (origem) { const r = a0(origem); if (r) regDiag("resgate", { origem, antes: r.antes, depois: r.depois }, 1); return r; }; }
// ---------- aviso da primeira abertura e controle nas Configurações ----------
function avisoDiag() {                // aviso na tela inicial (não cobre o cenário do jogo); aparece uma vez
  const d = dg(), box = document.querySelector("#menu .menu-box"); if (d.avisado || !d.ligado || !box) return;
  const b = document.createElement("div"); b.id = "avisoDiag"; b.setAttribute("role", "status"); b.className = "menu-nota";
  b.style.cssText = "background:#1f3a2d;color:#eef4ef;border-radius:12px;padding:10px 12px;text-align:left;margin-top:10px";
  b.innerHTML = `Este jogo envia <b>dados anônimos de diagnóstico</b> (erros, travamentos e em que capítulo cada partida está) para ajudar a corrigir problemas. Nada de nome, e-mail ou contatos. Dá para desligar em Configurações.
    <div style="display:flex;gap:8px;margin-top:8px"><button id="dgOk" class="btn mini">Entendi</button><button id="dgNao" class="plain mini"><span>Desligar</span></button></div>`;
  box.appendChild(b); d.avisado = true; gravarDg();
  const fim = () => b.remove();
  b.querySelector("#dgOk").onclick = fim; b.querySelector("#dgNao").onclick = () => { fim(); const x = dg(); x.ligado = false; x.fila = []; gravarDg(); toast("Envio de dados de diagnóstico desligado."); };
}
if (MODO === "menu") setTimeout(avisoDiag, 300);
{ const bs0 = buildSettings;
  buildSettings = body => { bs0(body); const d = dg();
    const t = el("button", "plain toggle", `<span>Enviar dados de diagnóstico: <b>${d.ligado ? "sim" : "não"}</b></span>`); t.setAttribute("aria-pressed", String(d.ligado)); t.onclick = alternarDiag;
    const i = el("p", "note", `Identificador desta instalação: <b>${d.id}</b>${d.fila.length ? ` · ${d.fila.length} evento(s) na fila` : ""}. São enviados erros, travamentos, tempo de jogo e o resumo de cada dia (saldo, capítulo, atendimentos), nunca nome, e-mail ou o save completo.`);
    const tr = el("button", "plain mini", "<span>Trocar identificador</span>"); tr.onclick = trocarIdDiag;
    const ref = body.querySelector(".danger"); [t, i, tr].forEach(n => body.insertBefore(n, ref ? ref.previousSibling : null)); };
}
