"use strict";
// =====================================================================
// 1.6: backup da partida. Gera um código (texto) com o Meu Mercado e a carreira inteira, para guardar
// ou levar para outro aparelho (Android ↔ iPhone). Importar mostra o que tem no código e só substitui
// depois de confirmar; antes, o que estava no aparelho fica guardado numa cópia local.
// Formato: MERCADINHO.<v>.<z|j>.<soma>.<base64>  (z = JSON comprimido com gzip, j = JSON puro)
// =====================================================================
const BK_PREFIXO = "MERCADINHO", BK_VERSAO = 1, CHAVE_COPIA_IMPORTAR = "mercadinho-copia-antes-importar";
const bkSoma = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, "0"); };
const bkB64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const bkDeB64 = b => { const s = atob(b), u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; };
async function bkTransformar(u8, Stream, modo) { const r = new Blob([u8]).stream().pipeThrough(new Stream(modo)); return new Uint8Array(await new Response(r).arrayBuffer()); }
function bkDados() {
  try { if (typeof save === "function" && MODO !== "menu") save(); } catch (e) {}
  const d = { app: "mercadinho", versao: APP_VERSAO, feito: Date.now(), plataforma: typeof plataforma === "function" ? plataforma() : "" };
  try { const l = localStorage.getItem(CHAVE_LIVRE); if (l) d.livre = JSON.parse(l); } catch (e) {}
  try { const c = localStorage.getItem(CHAVE_CARREIRA); if (c) d.carreira = JSON.parse(c); } catch (e) {}
  return d;
}
async function gerarCodigo(dados) {
  const json = JSON.stringify(dados || bkDados()), soma = bkSoma(json), u8 = new TextEncoder().encode(json);
  let tipo = "j", corpo = u8;
  if (typeof CompressionStream === "function") { try { corpo = await bkTransformar(u8, CompressionStream, "gzip"); tipo = "z"; } catch (e) { corpo = u8; tipo = "j"; } }
  return `${BK_PREFIXO}.${BK_VERSAO}.${tipo}.${soma}.${bkB64(corpo)}`;
}
// devolve { ok, dados } ou { ok: false, erro }
async function lerCodigo(txt) {
  const t = String(txt || "").replace(/\s+/g, "");
  const m = /^MERCADINHO\.(\d+)\.([zj])\.([0-9a-f]{8})\.([A-Za-z0-9+/=]+)$/.exec(t);
  if (!m) return { ok: false, erro: t ? "Isso não parece um código de backup do Mercadinho. Copie o código inteiro, do MERCADINHO até o fim." : "Cole o código ou escolha o arquivo do backup." };
  if (+m[1] > BK_VERSAO) return { ok: false, erro: "Este código foi feito numa versão mais nova do jogo. Atualize o jogo neste aparelho e tente de novo." };
  let u8; try { u8 = bkDeB64(m[4]); } catch (e) { return { ok: false, erro: "O código está incompleto ou foi alterado. Copie de novo, inteiro." }; }
  if (m[2] === "z") {
    if (typeof DecompressionStream !== "function") return { ok: false, erro: "Este aparelho não consegue abrir o código comprimido. Atualize o navegador ou o sistema e tente de novo." };
    try { u8 = await bkTransformar(u8, DecompressionStream, "gzip"); } catch (e) { return { ok: false, erro: "O código está incompleto ou foi alterado. Copie de novo, inteiro." }; }
  }
  const json = new TextDecoder().decode(u8);
  if (bkSoma(json) !== m[3]) return { ok: false, erro: "O código está incompleto ou foi alterado (a conferência não bateu). Copie de novo, inteiro." };
  let d; try { d = JSON.parse(json); } catch (e) { return { ok: false, erro: "O código está danificado." }; }
  if (!d || d.app !== "mercadinho" || (!d.livre && !d.carreira)) return { ok: false, erro: "O código não tem nenhuma partida." };
  if (d.carreira && !migrarCarreira(JSON.parse(JSON.stringify(d.carreira)), false)) return { ok: false, erro: "A carreira dentro do código está danificada." };
  return { ok: true, dados: d };
}
function resumoBackup(d) {
  const out = [];
  if (d.livre) { const t = TIERS[d.livre.tier || 0] || TIERS[0]; out.push(`Meu Mercado: dia ${d.livre.day || 1}, ${t.name}, M ${fmt(d.livre.money || 0)}`); }
  if (d.carreira) { const c = migrarCarreira(JSON.parse(JSON.stringify(d.carreira)), false), f = c && FASE_CFG[c.fase];
    const n = c ? Object.values(c.fases || {}).filter(x => x && x.concluida).length : 0;
    out.push(f ? `Carreira: capítulo ${f.capitulo} (${f.titulo}), ${n} capítulo${n === 1 ? "" : "s"} concluído${n === 1 ? "" : "s"}` : "Carreira"); }
  return out;
}
function importarBackup(d) {
  try {
    const antes = { livre: localStorage.getItem(CHAVE_LIVRE), carreira: localStorage.getItem(CHAVE_CARREIRA), em: Date.now() };
    localStorage.setItem(CHAVE_COPIA_IMPORTAR, JSON.stringify(antes));
    if (d.livre) localStorage.setItem(CHAVE_LIVRE, JSON.stringify(d.livre));
    if (d.carreira) localStorage.setItem(CHAVE_CARREIRA, JSON.stringify(d.carreira));
  } catch (e) { toast("Não deu para gravar neste aparelho (sem espaço?). Nada foi alterado."); return false; }
  window.__semSalvar = true;                             // a partida aberta na tela não sobrescreve o que foi importado
  try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
  return true;
}
// ---------- tela ----------
function abrirBackup() {
  if (typeof closeSheet === "function") closeSheet();
  const web = !ehNativo();
  showModal(`<h2>💾 Backup da partida</h2>
    <p>Guarde um código com o seu progresso (Meu Mercado e carreira) ou leve a partida para outro aparelho, até de Android para iPhone.</p>
    <h3 style="margin:10px 0 4px">Guardar</h3>
    <div class="linha2"><button class="btn" id="bkCopiar">Copiar código</button>${navigator.share ? '<button class="plain" id="bkComp"><span>Compartilhar</span></button>' : ""}${web ? '<button class="plain" id="bkArq"><span>Salvar arquivo</span></button>' : ""}</div>
    <p class="note" id="bkInfo" aria-live="polite">Mande o código para você mesmo (WhatsApp, e-mail ou notas). Quem tiver o código tem a sua partida.</p>
    <h3 style="margin:10px 0 4px">Trazer de outro aparelho</h3>
    <label for="bkCola">Cole o código aqui</label>
    <textarea id="bkCola" rows="3" style="width:100%;box-sizing:border-box;font:inherit;font-size:12px;padding:8px;border-radius:10px;border:1px solid #9aa" placeholder="MERCADINHO.1..." autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <div class="linha2"><button class="plain" id="bkLer"><span>Conferir o código</span></button><label class="plain" style="cursor:pointer"><input type="file" id="bkArqIn" accept=".txt,text/plain" style="position:absolute;opacity:0;width:1px;height:1px"><span>Escolher arquivo</span></label></div>
    <div id="bkRes" aria-live="polite"></div>
    <button class="plain" id="bkFechar" style="margin-top:8px;width:100%;justify-content:center"><span>Fechar</span></button>`);
  const $b = k => document.getElementById(k), info = $b("bkInfo");
  let codigo = null; const pegar = async () => codigo || (codigo = await gerarCodigo());
  $b("bkCopiar").onclick = async () => { const c = await pegar();
    try { await navigator.clipboard.writeText(c); info.textContent = `Código copiado (${Math.ceil(c.length / 1024)} KB de texto). Cole numa conversa com você mesmo para guardar.`; toast("Código do backup copiado."); }
    catch (e) { $b("bkCola").value = c; $b("bkCola").select(); info.textContent = "Não deu para copiar sozinho: o código está selecionado na caixa abaixo. Copie com o menu do aparelho."; } };
  const bc = $b("bkComp"); if (bc) bc.onclick = async () => { const c = await pegar(); try { await navigator.share({ title: "Backup do Mercadinho da Esquina", text: c }); } catch (e) {} };
  const ba = $b("bkArq"); if (ba) ba.onclick = async () => { const c = await pegar(), a = document.createElement("a"), d = new Date();
    a.href = URL.createObjectURL(new Blob([c], { type: "text/plain" })); a.download = `mercadinho-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.txt`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); info.textContent = "Arquivo salvo na pasta de downloads."; };
  const conferir = async txt => {
    const r = await lerCodigo(txt), res = $b("bkRes"); if (!res) return;
    if (!r.ok) { res.innerHTML = `<div class="warn" role="alert">${r.erro}</div>`; return; }
    const quando = r.dados.feito ? new Date(r.dados.feito).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "?";
    res.innerHTML = `<div class="card"><p><b>Código conferido.</b> Feito em ${quando}${r.dados.versao ? `, versão ${r.dados.versao}` : ""}.</p><ul class="metas">${resumoBackup(r.dados).map(x => `<li>${x}</li>`).join("")}</ul>
      <p class="note">Isso substitui ${r.dados.livre && r.dados.carreira ? "o Meu Mercado e a carreira" : r.dados.livre ? "o Meu Mercado (a carreira fica como está)" : "a carreira (o Meu Mercado fica como está)"} deste aparelho. O que está aqui agora fica guardado numa cópia.</p>
      <button class="btn danger-btn" id="bkImp">Substituir pela partida do código</button></div>`;
    const bi = $b("bkImp"); bi.onclick = () => {
      if (!bi.dataset.armado) { bi.dataset.armado = 1; bi.textContent = "Toque de novo para confirmar"; return; }
      if (importarBackup(r.dados)) { hideModal(); toast("Partida importada. Abrindo o menu…"); setTimeout(() => { paused = true; location.reload(); }, 600); }
    };
  };
  $b("bkLer").onclick = () => conferir($b("bkCola").value);
  $b("bkCola").addEventListener("paste", () => setTimeout(() => conferir($b("bkCola").value), 30));
  $b("bkArqIn").onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) return; f.text().then(t => { $b("bkCola").value = t.trim(); conferir(t); }); };
  $b("bkFechar").onclick = hideModal;
}
// entradas: nas Configurações (dentro do jogo) e no menu inicial
{ const b0 = buildSettings;
  buildSettings = body => {
    b0(body);
    const b = el("button", "plain", `<span>💾 Backup da partida (levar para outro aparelho)</span>`); b.onclick = abrirBackup;
    body.insertBefore(b, body.querySelector(".danger") ? body.querySelector(".danger").previousSibling : null);
  }; }
{ const m0 = mostrarMenu;
  mostrarMenu = function () {
    m0();
    const box = document.querySelector("#menu .menu-box"); if (!box) return;
    const b = el("button", "plain mini menu-backup", `<span>💾 Backup da partida: guardar ou trazer de outro aparelho</span>`); b.onclick = abrirBackup;
    box.insertBefore(b, box.querySelector(".menu-nota"));
  }; }
