"use strict";
// =====================================================================
// 1.3: ferramentas fora da jogabilidade
//   · "Relatar problema": o jogador escreve, revisa o diagnóstico e envia pelo WhatsApp do responsável.
//     Nada é enviado sem o toque do jogador; o save completo nunca vai junto.
//   · Aviso de nova versão (só no APK): consulta um arquivo pequeno no site do jogo.
//   · Painel de trapaças (modo desenvolvedor): 7 toques na versão nas Configurações + código.
//     Todo uso fica marcado no save (S.trapacas / CARREIRA.trapacas).
// =====================================================================
const APP_VERSAO = "1.6";
const SITE_JOGO = "https://danielcamposdasilva-tech.github.io/mercadinho/";
const WHATS_SUPORTE = "5521988612660";
const DEV_HASH = 1898547767;                  // código do modo desenvolvedor (só o hash fica no jogo)
const ehNativo = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function plataforma() {
  if (ehNativo()) return "APK Android";
  const sa = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  return sa ? "app da tela inicial" : "navegador";
}
function abrirExterno(url) { if (ehNativo()) location.href = url; else window.open(url, "_blank", "noopener"); }

// ---------- últimos acontecimentos (avisos e faixas mostrados ao jogador) ----------
const ACONTECIMENTOS = [];
function regAcontecimento(txt) { if (!txt) return;
  const linha = `d${typeof S !== "undefined" && S ? S.day : "?"} ${String(txt).replace(/<[^>]+>/g, "").slice(0, 90)}`, ult = ACONTECIMENTOS[ACONTECIMENTOS.length - 1];
  if (ult && ult.replace(/ \(×\d+\)$/, "") === linha) { const n = +((/ \(×(\d+)\)$/.exec(ult) || [])[1] || 1) + 1; ACONTECIMENTOS[ACONTECIMENTOS.length - 1] = `${linha} (×${n})`; return; }     // repetido em seguida: conta, não ocupa outra linha
  ACONTECIMENTOS.push(linha); if (ACONTECIMENTOS.length > 12) ACONTECIMENTOS.shift(); }
// toast é declarado em 13-hud-loop (carregado depois): o embrulho é feito quando todos os scripts já rodaram
setTimeout(() => { if (typeof toast !== "function" || typeof banner !== "function") return; const t0 = toast, b0 = banner;
  toast = msg => { regAcontecimento(msg); return t0(msg); };
  banner = (txt, color) => { regAcontecimento(txt); return b0(txt, color); }; }, 0);

// ---------- diagnóstico revisável ----------
function aparelho() {
  const ua = navigator.userAgent || "", m = ua.match(/Android [\d.]+;[^)]*/) || ua.match(/(iPhone|iPad)[^)]*/) || ua.match(/\(([^)]*)\)/);
  return (m ? m[0] : ua).replace(/; wv/, "").slice(0, 70);
}
function diagnosticoLinhas() {
  const L = [`Versão ${APP_VERSAO} · ${plataforma()}`, `Aparelho: ${aparelho()} · tela ${innerWidth}x${innerHeight}`];
  const modo = MODO === "carreira" ? `Carreira, capítulo ${CFG ? CFG.capitulo : "?"} (${CFG ? CFG.titulo : FASE})` : MODO === "livre" ? "Meu Mercado (modo livre)" : MODO;
  L.push(`Modo: ${modo} · dia ${S.day} · saldo M ${fmt(S.money)}`);
  if (NA_CARREIRA && FASE === "grande" && S.obra) { const o = S.obra, m = typeof motivoParada === "function" && o.fase !== "operacao" ? motivoParada() : null;
    L.push(`Obra: ${o.fase}, ${Math.round(o.pct)}%, licenças ${Object.values(o.lic).filter(x => x.ok).length}/5${m ? `, ${MOTIVO_TXT[m]}` : ""}${o.resgate ? ", resgate usado" : ""}`); }
  if (NA_CARREIRA && FASE === "cajueiro" && S.atac) { const a = S.atac; L.push(`Atacado: ${a.totFardos} fardos, ${a.nPos} posições, ${a.ops} empilhadeiras (${a.opsDoca} na doca), compra automática ${a.auto ? "ligada" : "desligada"}`); }
  if (S.trapacas || (CARREIRA && CARREIRA.trapacas)) L.push("Trapaças usadas nesta partida");
  const er = (window.__erros || []).slice(-5); if (er.length) L.push("Erros: " + er.map(e => e.m).join(" | "));
  return L;
}
function textoRelato(desc, comDiag, comAcont, id) {
  let t = `Mercadinho da Esquina, relato ${id}\n\n${desc.trim() || "(sem descrição)"}`;
  if (comDiag) t += "\n\n— Diagnóstico —\n" + diagnosticoLinhas().join("\n");
  if (comAcont && ACONTECIMENTOS.length) t += "\n\n— Últimos acontecimentos —\n" + ACONTECIMENTOS.slice(-10).join("\n");
  return t.slice(0, 1800);
}
function abrirRelato() {
  closeSheet();
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  showModal(`<h2>Relatar problema</h2>
    <p>Conte o que aconteceu. A mensagem abre no WhatsApp do responsável pelo jogo; você vê tudo antes de enviar e nada sai sem o seu toque.</p>
    <label for="rlDesc"><b>O que aconteceu?</b></label>
    <textarea id="rlDesc" rows="4" style="width:100%;box-sizing:border-box;font:inherit;padding:8px;border-radius:10px;border:1px solid #9aa" placeholder="Ex.: no capítulo 8 a obra parou e não consigo fazer nada"></textarea>
    <label class="toggle-linha"><input type="checkbox" id="rlDiag" checked> Incluir o diagnóstico (versão, aparelho, capítulo, saldo, erros)</label><br>
    <label class="toggle-linha"><input type="checkbox" id="rlAc" checked> Incluir os últimos acontecimentos do jogo</label>
    <p class="note">Vai junto (você pode editar no WhatsApp):</p>
    <pre id="rlPrev" style="white-space:pre-wrap;max-height:160px;overflow:auto;font-size:12px;background:#f3efe6;color:#222;padding:8px;border-radius:8px" tabindex="0" aria-label="Texto que será enviado"></pre>
    <div class="linha2"><button class="btn" id="rlEnviar">Abrir no WhatsApp</button><button class="plain" id="rlCopiar"><span>Copiar texto</span></button></div>
    <button class="plain" id="rlFechar"><span>Cancelar</span></button>`);
  const $r = k => document.getElementById(k), txt = () => textoRelato($r("rlDesc").value, $r("rlDiag").checked, $r("rlAc").checked, id);
  const atualizar = () => { $r("rlPrev").textContent = txt(); };
  ["rlDesc", "rlDiag", "rlAc"].forEach(k => $r(k).addEventListener("input", atualizar)); ["rlDiag", "rlAc"].forEach(k => $r(k).addEventListener("change", atualizar)); atualizar();
  $r("rlEnviar").onclick = () => {
    if (!$r("rlDesc").value.trim() && !$r("rlEnviar").dataset.semTexto) {      // 1.6: relato vazio não ajuda; pede uma linha (segundo toque envia assim mesmo)
      $r("rlEnviar").dataset.semTexto = 1; $r("rlEnviar").textContent = "Enviar sem descrição";
      const w = document.createElement("div"); w.className = "warn"; w.setAttribute("role", "alert"); w.textContent = "Escreva em uma linha o que aconteceu ou o que você esperava. Sem isso fica difícil achar o problema.";
      $r("rlDesc").after(w); $r("rlDesc").focus(); return; }
    if (typeof regDiag === "function") regDiag("relato", { codigo: id, texto: txt() }, 2); abrirExterno(`https://wa.me/${WHATS_SUPORTE}?text=${encodeURIComponent(txt())}`); hideModal(); toast(`Relato ${id} pronto no WhatsApp.`); };
  $r("rlCopiar").onclick = async () => { try { await navigator.clipboard.writeText(txt()); toast("Texto copiado."); } catch (e) { const r = document.createRange(); r.selectNodeContents($r("rlPrev")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Texto selecionado: copie com o menu do aparelho."); } };
  $r("rlFechar").onclick = hideModal;
  setTimeout(() => { const d = $r("rlDesc"); if (d) d.focus(); }, 60);
}

// ---------- aviso de nova versão (APK; na web o próprio site já atualiza) ----------
const CHAVE_AVISO_VERSAO = "mercadinho-aviso-versao";
const versaoMaior = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
function verificarNovaVersao() {
  if (!ehNativo() || MODO === "previa") return;
  const ctl = window.AbortController ? new AbortController() : null; if (ctl) setTimeout(() => ctl.abort(), 6000);
  fetch(SITE_JOGO + "versao.json?t=" + Date.now(), { cache: "no-store", signal: ctl ? ctl.signal : undefined }).then(r => r.ok ? r.json() : null).then(v => {
    if (!v || !v.versao || !versaoMaior(v.versao, APP_VERSAO)) return;
    let visto = null; try { visto = localStorage.getItem(CHAVE_AVISO_VERSAO); } catch (e) {}
    banner(`⬆️ Versão ${v.versao} disponível`, "#1f5fa8");
    if (visto === v.versao) return;
    try { localStorage.setItem(CHAVE_AVISO_VERSAO, v.versao); } catch (e) {}
    const mostrar = () => { showModal(`<h2>Nova versão: ${v.versao}</h2><p>${v.novidades || "Há uma versão nova do Mercadinho da Esquina."}</p><p>Baixe e instale <b>por cima</b> da atual, sem desinstalar: seu progresso continua.</p>
      <div class="linha2"><button class="btn" id="nvBaixar">Abrir a página de download</button><button class="plain" id="nvDepois"><span>Depois</span></button></div>`);
      document.getElementById("nvBaixar").onclick = () => { hideModal(); abrirExterno(v.pagina || SITE_JOGO + "baixar/"); };
      document.getElementById("nvDepois").onclick = hideModal; };
    if (document.getElementById("modal").hidden) mostrar(); else filaModal.push(mostrar);
  }).catch(() => {});
}

// ---------- painel de trapaças ----------
const hashDev = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
let devToques = 0, devT = 0, devAberto = false;
function toqueVersao() {
  const t = Date.now(); devToques = t - devT < 1500 ? devToques + 1 : 1; devT = t;
  if (devToques >= 7) { devToques = 0; if (devAberto) abrirPainelDev(); else pedirCodigoDev(); }
}
function pedirCodigoDev() {
  closeSheet();
  showModal(`<h2>Modo desenvolvedor</h2><label for="devCod">Código</label><input id="devCod" type="password" autocomplete="off" style="width:100%;box-sizing:border-box;font:inherit;padding:8px;border-radius:10px;border:1px solid #9aa">
    <div class="linha2"><button class="btn" id="devOk">Entrar</button><button class="plain" id="devNao"><span>Cancelar</span></button></div>`);
  const ok = () => { if (hashDev("mercadinho:" + document.getElementById("devCod").value.trim()) === DEV_HASH) { devAberto = true; hideModal(); setTimeout(abrirPainelDev, 160); } else toast("Código incorreto."); };
  document.getElementById("devOk").onclick = ok; document.getElementById("devCod").addEventListener("keydown", e => { if (e.key === "Enter") ok(); });
  document.getElementById("devNao").onclick = hideModal;
  setTimeout(() => { const d = document.getElementById("devCod"); if (d) d.focus(); }, 60);
}
function marcarTrapaca(oque) {
  S.trapacas = (S.trapacas || []).concat([{ oque, dia: S.day, em: Date.now() }]).slice(-30);
  if (NA_CARREIRA && CARREIRA) CARREIRA.trapacas = (CARREIRA.trapacas || 0) + 1;
}
function devDinheiro(v, definir) {
  marcarTrapaca(definir ? `definir saldo ${v}` : `+${v}`);
  S.money = definir ? v : S.money + v; if (!definir && v > 0) S.earned += 0;    // não conta como faturamento
  save(); toast(`Saldo: M ${fmt(S.money)}`); abrirPainelDev();
}
function devAvancar(n) { marcarTrapaca(`avançar ${n} dia(s)`); hideModal(); for (let i = 0; i < n; i++) endDay(); save(); toast(`${n} dia(s) avançado(s).`); }
function devConcluir() { if (!NA_CARREIRA) return; marcarTrapaca(`concluir capítulo ${FASE}`); hideModal(); concluirFase(true); save(); }
function devResgate() { if (!(NA_CARREIRA && FASE === "grande")) return; marcarTrapaca("resgate da obra"); const r = aplicarResgate("trapaca"); hideModal(); if (r) mostrarResgate(r); else toast("A previsão já fecha: nada a completar."); }
function devIrCapitulo(id, recomecar) {
  if (!NA_CARREIRA || !FASES[id]) return;
  marcarTrapaca(`${recomecar ? "recomeçar" : "ir para"} ${id}`); save();
  try { const atual = localStorage.getItem(CHAVE_CARREIRA); if (atual) localStorage.setItem("mercadinho-carreira-v1-copia-antes-trapaca", atual); } catch (e) {}
  const alvo = FASES[id].ordem;
  Object.keys(FASES).forEach(f => {
    const o = FASES[f].ordem;
    if (o < alvo && !(CARREIRA.fases[f] && CARREIRA.fases[f].concluida)) CARREIRA.fases[f] = { concluida: true, dia: 1, xp: 0, rep: 3.5, atendidos: 0, faturamento: 0, conquistas: 0, em: Date.now(), trapaca: true };
    if (recomecar && o >= alvo) { delete CARREIRA.lojas[f]; delete CARREIRA.fases[f]; }
  });
  if (recomecar || FASES[CARREIRA.fase].ordem < alvo) CARREIRA.fase = id;
  CARREIRA.convites[id] = CARREIRA.convites[id] || Date.now();
  CARREIRA.ativa = id; gravarCarreira();
  window.__semSalvar = true; paused = true; location.reload();
}
function abrirPainelDev() {
  closeSheet();
  const caps = NA_CARREIRA ? Object.keys(FASES).sort((a, b) => FASES[a].ordem - FASES[b].ordem) : [];
  showModal(`<h2>🛠️ Modo desenvolvedor</h2><p class="note">Saldo agora: <b>M ${fmt(S.money)}</b> · dia ${S.day}. Todo uso fica marcado na partida.</p>
    <div class="linha2"><button class="btn mini" data-dv="1000">+M 1.000</button><button class="btn mini" data-dv="10000">+M 10.000</button><button class="btn mini" data-dv="100000">+M 100.000</button></div>
    <label for="devSaldo">Definir saldo</label><div class="linha2"><input id="devSaldo" type="number" inputmode="numeric" style="font:inherit;padding:6px;border-radius:8px;border:1px solid #9aa;width:9em"><button class="plain mini" id="devDef"><span>Definir</span></button><button class="plain mini" id="devZera"><span>Zerar dívida</span></button></div>
    <div class="linha2"><button class="plain mini" id="devD1"><span>Avançar 1 dia</span></button><button class="plain mini" id="devD7"><span>Avançar 7 dias</span></button></div>
    ${NA_CARREIRA ? `<div class="linha2"><button class="plain mini" id="devConc"><span>Concluir o capítulo atual</span></button>${FASE === "grande" ? '<button class="plain mini" id="devResg"><span>Resgate da obra</span></button>' : ""}</div>
    <p class="note"><b>Escolher capítulo.</b> "Ir" abre a loja (ou cria, se ainda não existe) e marca os anteriores como concluídos sem XP. "Recomeçar" apaga este capítulo e os seguintes e começa do zero. Uma cópia do save é guardada antes.</p>
    ${caps.map(id => `<div class="req"><span>${FASE_CFG[id] ? `${FASE_CFG[id].capitulo}. ${FASE_CFG[id].titulo}` : id}${id === FASE ? " (aberto)" : ""}</span><span><button class="plain mini" data-ir="${id}"><span>Ir</span></button> <button class="plain mini" data-rec="${id}"><span>Recomeçar</span></button></span></div>`).join("")}` : ""}
    <button class="btn" id="devFechar">Fechar</button>`);
  const d = document.getElementById("dialog");
  d.querySelectorAll("[data-dv]").forEach(b => b.onclick = () => devDinheiro(+b.dataset.dv));
  document.getElementById("devDef").onclick = () => { const v = Math.round(+document.getElementById("devSaldo").value); if (isFinite(v)) devDinheiro(v, true); };
  document.getElementById("devZera").onclick = () => devDinheiro(Math.max(0, S.money), true);
  document.getElementById("devD1").onclick = () => devAvancar(1); document.getElementById("devD7").onclick = () => devAvancar(7);
  const c = document.getElementById("devConc"); if (c) c.onclick = devConcluir;
  const rg = document.getElementById("devResg"); if (rg) rg.onclick = devResgate;
  d.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => devIrCapitulo(b.dataset.ir, false));
  d.querySelectorAll("[data-rec]").forEach(b => b.onclick = () => { if (b.dataset.armado) devIrCapitulo(b.dataset.rec, true); else { b.dataset.armado = 1; b.firstChild.textContent = "Toque de novo"; } });
  document.getElementById("devFechar").onclick = hideModal;
}

// entradas nas Configurações: relatar problema e versão (7 toques abre o modo desenvolvedor)
{ const b0 = buildSettings;
  buildSettings = body => {
    b0(body);
    const r = el("button", "plain", `${iconSvg("i-help")}<span>Relatar problema</span>`); r.onclick = abrirRelato;
    body.insertBefore(r, body.querySelector(".danger") ? body.querySelector(".danger").previousSibling : null);
    const v = el("button", "plain mini", `<span>Mercadinho da Esquina · versão ${APP_VERSAO}</span>`); v.setAttribute("aria-label", `Versão ${APP_VERSAO}`); v.onclick = toqueVersao; body.appendChild(v);
  }; }
if (MODO !== "menu") setTimeout(verificarNovaVersao, 4000);
