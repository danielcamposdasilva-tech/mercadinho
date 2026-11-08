"use strict";
// =====================================================================
// Acessibilidade para quem joga:
// - Lista de construções e serviços em HTML: seleciona setores, caixas, cestas, depósito, fachada,
//   estacionamento e terrenos sem tocar no cenário; abre os mesmos painéis e ações do toque.
// - Teclado: setas movem a câmera, + e − aproximam/afastam, 0 recentraliza, L abre a lista,
//   Esc fecha painel ou janela e devolve o foco a quem abriu.
// - Botões de zoom e enquadramento sem gestos; preferências de movimento reduzido e texto maior.
// - Avisos para leitores de tela só em eventos (compras, avisos, fim do dia), nunca a cada moeda.
// =====================================================================

// ---------- avisos para leitores de tela ----------
let ultimoAviso = { txt: "", t: 0 };
function anunciar(txt) {
  const el = document.getElementById("anuncio"); if (!el || !txt) return;
  const t = performance.now(); if (txt === ultimoAviso.txt && t - ultimoAviso.t < 4000) return;
  ultimoAviso = { txt, t };
  el.textContent = ""; setTimeout(() => { el.textContent = String(txt).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?/gu, "").trim(); }, 60);
}

// ---------- zoom e enquadramento sem gestos ----------
function zoomPasso(f) {
  const a = freeArea(); cam.anim = null; cam.vx = cam.vy = 0; camHome = null;
  zoomAt((a.left + a.right) / 2, (a.top + a.bottom) / 2, cam.s * f);
  if (overview) { overview = false; syncMapBtn(); }
}
function moverCamera(dx, dy) {
  cam.anim = null; cam.vx = cam.vy = 0; camHome = null;
  cam.x += dx / cam.s; cam.y += dy / cam.s; clampCam();
  if (overview) { overview = false; syncMapBtn(); }
}
function abrirLista() { if (ui.sheet === "lista") closeSheet(); else openSheet("lista"); }
$("btnLista").onclick = () => abrirLista();
$("btnMais").onclick = () => zoomPasso(1.3);
$("btnMenos").onclick = () => zoomPasso(1 / 1.3);

// ---------- teclado ----------
function botaoEscModal() {
  const d = $("dialog"), bs = d.querySelectorAll("button");
  return d.querySelector("[data-esc], #nao, #later, #ok") || (bs.length === 1 ? bs[0] : null);
}
document.addEventListener("keydown", e => {
  const modal = !$("modal").hidden;
  if (modal) {
    if (e.key === "Escape") { const b = botaoEscModal(); if (b) { e.preventDefault(); b.click(); } return; }
    if (e.key === "Tab") {                              // o foco não sai da janela aberta
      const f = [...$("dialog").querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])")].filter(x => !x.disabled);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
    return;
  }
  if (document.getElementById("menu") || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && t.closest && t.closest("#sheet")) return;     // dentro do painel, as setas rolam o painel
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const passo = 70, k = e.key;
  if (k === "ArrowLeft") moverCamera(-passo, 0); else if (k === "ArrowRight") moverCamera(passo, 0);
  else if (k === "ArrowUp") moverCamera(0, -passo); else if (k === "ArrowDown") moverCamera(0, passo);
  else if (k === "+" || k === "=") zoomPasso(1.3); else if (k === "-" || k === "_") zoomPasso(1 / 1.3);
  else if (k === "0") recenter(); else if (k === "l" || k === "L") abrirLista();
  else return;
  e.preventDefault();
});

// ---------- lista de construções e serviços ----------
function listaRow(ic, bg, titulo, subFn, sel, estadoFn) {
  const r = el("button", "row", `<div class="ic" style="background:${bg}" aria-hidden="true">${ic}</div><div><div class="t"></div><div class="s"></div></div><div class="go"></div>`);
  r.querySelector(".t").textContent = titulo;
  const s = r.querySelector(".s"), go = r.querySelector(".go");
  live(() => { s.textContent = subFn(); const e = estadoFn ? estadoFn() : null; go.textContent = e || "Abrir"; r.classList.toggle("locked", e === "Fechado" || e === "À venda" || e === "Bloqueado"); });
  r.onclick = () => select(sel, "lista");
  return r;
}
function buildLista(body) {
  head("☰", "#e4ece6", "Construções e serviços", "Escolha um item para ver detalhes e melhorar, sem tocar no cenário");
  if (GANCHOS.listaShopping) { GANCHOS.listaShopping(body); return; }        // capítulos 7 e 8: lista própria do shopping
  // resumo do momento (não é anunciado sozinho; é lido quando a pessoa chega nele)
  const rs = el("div", "card resumo", `<h3>Agora na loja</h3><p class="note" id="lsResumo"></p>`);
  live(() => {
    const dentro = customers.filter(c => c.state !== "outside" && c.state !== "gone").length;
    const filas = LANES.slice(0, nCaixas()).map((_, l) => { const q = laneQueue(l), p = DIV ? q.filter(c => nivelPrio(c) > 0 && l === caixaPrio()).length : 0;
      return `caixa ${l + 1}: ${q.length} na fila${p ? ` (${p} com prioridade)` : ""}`; }).join("; ");
    const aj = DIV ? customers.filter(c => c.ajuda && c.ajuda.estado === "pedindo").length : 0;
    rs.querySelector("#lsResumo").textContent = `${dentro} cliente${dentro === 1 ? "" : "s"} na loja. ${filas}.${aj ? ` ${aj} pedido${aj > 1 ? "s" : ""} de ajuda aguardando.` : ""} Vagas ocupadas: ${occupied()} de ${STALLS.length}.`;
  });
  body.appendChild(rs);
  body.appendChild(el("div", "sec-title", "Setores"));
  SHELVES.forEach((sh, i) => { const d = SECTORS[i], st = S.sec[d.id];
    body.appendChild(listaRow(d.ic, shade(d.color, 1.8), d.name, () => st.open ? `Prateleira ${st.shelf} de ${shelfCap(st.shelfLvl)} · depósito ${st.wh}` : `Fechado · abrir por M ${fmt(custoAbrir(d))}`,
      { kind: "shelf", i }, () => st.open ? (st.shelf === 0 ? "Vazia" : "Abrir") : "Fechado")); });
  body.appendChild(el("div", "sec-title", "Caixas"));
  LANES.forEach((_, l) => body.appendChild(listaRow("🧾", "#d6ead9", `Caixa ${l + 1}`,
    () => l >= nCaixas() ? "Fechado: contrate um operador" : `${laneQueue(l).length} na fila${DIV && l === caixaPrio() ? (S.cashiers > 1 ? " · caixa prioritário" : " · aplica a prioridade na fila") : ""}`,
    { kind: "lane", l }, () => l >= nCaixas() ? "Fechado" : "Abrir")));
  body.appendChild(el("div", "sec-title", "Loja e serviços"));
  body.appendChild(listaRow("🧺", "#fde2dc", "Cestas e carrinhos", () => `${ENT2 ? `Entrada do estacionamento: ${station.b} cestas e ${station.c} carrinhos; entrada da avenida: ${station2.b} cestas e ${station2.c} carrinhos` : `Na entrada: ${station.b} cestas e ${station.c} carrinhos`} · ${S.gear.collectors} carrinheiro${S.gear.collectors > 1 ? "s" : ""}`, { kind: "station" }));
  body.appendChild(listaRow("📦", "#e8dcc4", "Depósito", () => `${whUsed()} de ${whCap(S.whLvl)} caixas · nível ${S.whLvl + 1}`, { kind: "wh" }));
  body.appendChild(listaRow("📣", "#f6e3c4", "Fachada e gerência", () => `Propaganda nível ${S.adsLvl} · gerente ${S.mgrLvl ? "nível " + S.mgrLvl : "nenhum"}`, { kind: "sign" }));
  if (GANCHOS.lista) GANCHOS.lista(body);                                    // capítulos 5 e 6: expedição, atacado, docas, galeria
  body.appendChild(listaRow("🅿️", "#dfe8f4", "Estacionamento", () => `${occupied()} de ${STALLS.length} vagas ocupadas · ${inQ.length} aguardando`, { kind: "parking" }));
  if (SCENE.plot) body.appendChild(listaRow("🏗️", "#fff1c9", "Terreno de expansão", () => TIERS[S.tier + 1] ? `Próximo porte: ${TIERS[S.tier + 1].name}` : "Filiais", { kind: "expand" }));
  const lotes = LOTS.filter(L => L.cost > 0);
  if (lotes.length) {
    body.appendChild(el("div", "sec-title", "Terrenos"));
    lotes.forEach(L => body.appendChild(listaRow(L.kind === "park" ? "🅿️" : L.kind === "logi" ? "🚚" : "🏗️", "#e4ece6", L.name,
      () => owns(L.id) ? (building[L.id] > 0 ? "Em obra" : "Comprado") : `${lotBenefit(L)} · M ${fmt(L.cost)}`,
      { kind: "lot", id: L.id }, () => owns(L.id) ? "Seu" : lotReqs(L).some(q => !q.ok) ? "Bloqueado" : "À venda")));
  }
  body.appendChild(el("p", "note", "Atalhos de teclado: setas movem o cenário, + e − mudam o zoom, 0 recentraliza, L abre esta lista e Esc fecha o painel."));
}

// ---------- painel do caixa: atendimento prioritário ----------
function cartaoPrioridade(body, l) {
  const a = acess(), card = el("div", "card");
  const um = () => S.cashiers <= 1, eh = () => l === caixaPrio();
  card.appendChild(el("h3", "", "Atendimento prioritário"));
  const exp = el("p", "note"); card.appendChild(exp);
  live(() => {
    exp.textContent = l >= S.cashiers ? "Caixa fechado." : um()
      ? "Com um só caixa, ele atende todos e chama primeiro quem tem prioridade. Quem já está sendo atendido nunca é interrompido."
      : eh() ? "Este é o caixa prioritário (placa azul). Quem tem prioridade vem para cá e passa à frente; quando não há prioridade esperando, atende os demais."
        : `O caixa prioritário é o Caixa ${caixaPrio() + 1}. Este caixa atende por ordem de chegada.`;
  });
  card.appendChild(statsBox([
    ["Prioridade na fila", () => { const q = laneQueue(caixaPrio()); return `${q.filter(c => nivelPrio(c) > 0).length} de ${q.length}`; }],
    ["Atendidos com prioridade hoje", () => String(a.hoje.prio)],
    ["Ajudas da equipe hoje", () => `${a.hoje.ajudas}${a.hoje.semAjuda ? ` · ${a.hoje.semAjuda} sem ajuda` : ""}`],
  ]));
  if (!um() && l < S.cashiers) {
    const b = el("button", "plain toggle", `<span></span>`);
    live(() => { const on = eh(); b.setAttribute("aria-pressed", String(on)); b.firstChild.textContent = on ? "✓ Este é o caixa prioritário" : "Tornar este o caixa prioritário"; });
    b.onclick = () => { if (!eh()) { a.caixaPrio = l; save(); lastSig = ""; renderSheet(); toast(`Caixa ${l + 1} agora é o prioritário. Quem já está na fila de outro caixa continua nela.`); } };
    card.appendChild(b);
  }
  const cb = el("button", "plain toggle", `<span></span>`);
  live(() => { cb.setAttribute("aria-pressed", String(a.cortesiaBebe)); cb.firstChild.textContent = `${a.cortesiaBebe ? "✓ Ligada" : "Desligada"}: cortesia para quem está com bebê no carrinho`; });
  cb.onclick = () => { a.cortesiaBebe = !a.cortesiaBebe; save(); renderSheet(); toast(a.cortesiaBebe ? "Cortesia ligada: vem depois das prioridades legais." : "Cortesia desligada."); };
  card.appendChild(cb);
  const det = el("details", "regras", `<summary>Quem tem prioridade no jogo</summary>
    <ul>
      <li><b>Prioridade legal</b>: pessoas com deficiência, com transtorno do espectro autista, pessoas idosas (60 anos ou mais), gestantes, lactantes, pessoas com criança de colo e pessoas com mobilidade reduzida (Lei 10.048/2000, art. 1º; Lei 13.146/2015, art. 9º).</li>
      <li>Entre as pessoas idosas, quem tem <b>80 anos ou mais</b> passa à frente das demais pessoas idosas (Lei 10.741/2003, art. 3º, §2º). Não passa à frente de outras prioridades.</li>
      <li>Ninguém é interrompido: a prioridade vale para o <b>próximo</b> atendimento. Na mesma categoria, vale a ordem de chegada.</li>
      <li><b>Carrinho de bebê</b> não aparece nessas leis ("criança de colo" não é definida). No jogo é uma cortesia opcional da loja, que vem depois das prioridades legais.</li>
      <li>A prioridade é um dado da pessoa, não da aparência: há prioridades que não aparecem e pessoas de aparência idosa com menos de 60 anos. Quem tem direito escolhe se usa.</li>
      <li>Simplificação do jogo: um cliente sem prioridade é ultrapassado no máximo ${MAX_ULTRAPASSAGENS} vezes, para ninguém ficar esquecido.</li>
    </ul><p class="note">Resumo para o jogo, não é orientação jurídica. Leis estaduais e municipais não foram consideradas.</p>`);
  card.appendChild(det);
  body.appendChild(card);
}

// ---------- configurações de acessibilidade ----------
function opcoesAcess(body) {
  body.appendChild(el("div", "sec-title", "Acessibilidade"));
  const mk = (rot, chave, desc) => {
    const b = el("button", "plain toggle", `<span></span>`);
    const pintar = () => { b.setAttribute("aria-pressed", String(!!PREFS[chave])); b.firstChild.textContent = `${PREFS[chave] ? "✓ Ligado" : "Desligado"}: ${rot}`; };
    b.onclick = () => { PREFS[chave] = !PREFS[chave]; salvarPrefs(); pintar(); requestAnimationFrame(measureHudBox); anunciar(`${rot}: ${PREFS[chave] ? "ligado" : "desligado"}`); };
    pintar(); body.appendChild(b); if (desc) body.appendChild(el("p", "note", desc));
  };
  mk("reduzir movimento", "movReduzido", "Tira confetes, brilhos, balanços e deslizes de câmera. A velocidade do jogo não muda.");
  mk("texto maior", "textoGrande", "Aumenta os textos dos painéis, da barra inferior e do topo.");
  const lb = el("button", "plain", `<span>Lista de construções e serviços (tecla L)</span>`);
  lb.onclick = () => openSheet("lista"); body.appendChild(lb);
  body.appendChild(el("p", "note", "Teclado: Tab percorre os botões, setas movem o cenário, + e − mudam o zoom, 0 recentraliza, L abre a lista e Esc fecha o painel ou a janela aberta."));
}
