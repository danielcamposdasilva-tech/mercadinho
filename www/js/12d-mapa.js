"use strict";
// =====================================================================
// Mapa da carreira: esquema (não é mapa real) com as lojas em ordem, região
// e distância aproximada entre cada par. Mesmos destinos e estados numa lista
// em HTML (acessível por teclado e leitor de tela); o desenho é só visual.
// Ações: assumir o próximo mercado, administrar uma loja concluída (com o
// último registro dela), reabrir loja sem estado guardado, continuar aqui.
// Distâncias são estimativas do jogo, marcadas como tal.
// =====================================================================
const MAPA_NOS = [            // rot: onde fica o nome (cima, baixo ou esq), para não cobrir linhas nem distâncias
  { id: "bairro", cap: 1, regiao: "Itapeba", curto: "Lagoa", x: 34, y: 150, rot: "baixo" },
  { id: "centro", cap: 2, regiao: "Centro", curto: "Espiga", x: 88, y: 102, rot: "cima" },
  { id: "ipe", cap: 3, regiao: "Centro", curto: "Ipê", x: 140, y: 160, rot: "baixo" },
  { id: "restinga", cap: 4, regiao: "Centro", curto: "Restinga", x: 192, y: 102, rot: "cima" },
  { id: "pitanga", cap: 5, regiao: "Centro", curto: "Pitanga", x: 244, y: 160, rot: "baixo" },
  { id: "cajueiro", cap: 6, regiao: "RJ-106", curto: "Cajueiro", x: 300, y: 62, rot: "esq" },
  { id: "brisa", cap: 7, regiao: "Centro", curto: "Brisa", x: 320, y: 132, rot: "baixo" },
  { id: "grande", cap: 8, regiao: "Orla (fictícia)", curto: "Grande", x: 252, y: 214, rot: "esq" },
];
// distância aproximada do anterior até esta loja (adaptação para o jogo, não medida em mapa: sempre estimativa)
const MAPA_DIST = { centro: "≈ 3 km", ipe: "≈ 600 m", restinga: "≈ 400 m", pitanga: "≈ 700 m", cajueiro: "≈ 6 km", brisa: "≈ 5 km", grande: "≈ 4 km" };
const nomeNo = n => FASE_CFG[n.id] ? FASE_CFG[n.id].titulo : `Capítulo ${n.cap}`;
function estadoNo(n) {
  if (n.dev || !FASE_CFG[n.id]) return { id: "dev", txt: "Bloqueada · em desenvolvimento", ic: "🔒" };
  const conc = CARREIRA.fases[n.id] && CARREIRA.fases[n.id].concluida;
  if (conc) return { id: "concluida", txt: "Concluída", ic: "✅" };
  if (n.id === CARREIRA.fase) return { id: "andamento", txt: "Em administração · capítulo em andamento", ic: "🏪" };
  if (n.id === proximaDisponivel()) return { id: "disponivel", txt: "Próxima etapa disponível", ic: "⭐" };
  return { id: "bloqueada", txt: "Bloqueada", ic: "🔒" };
}
function requisitoNo(n) {
  if (n.dev || !FASE_CFG[n.id]) return `O capítulo ${n.cap} ainda está em desenvolvimento. Ele aparece aqui para mostrar o caminho da carreira.`;
  const ant = MAPA_NOS.find(x => x.cap === n.cap - 1);
  return ant ? `Para desbloquear, conclua o capítulo ${ant.cap}: ${nomeNo(ant)}.` : "";
}
// último registro de uma loja: a loja aberta usa o estado ao vivo; as outras, o que foi salvo nelas
function registroLoja(id) {
  const L = id === FASE ? S : CARREIRA.lojas[id]; if (!L) return null;
  const sec = L.sec || {}, abertos = Object.values(sec).filter(x => x.open);
  const estoque = abertos.reduce((a, x) => a + (x.wh || 0) + (x.shelf || 0), 0);
  const equipe = abertos.reduce((a, x) => a + (x.staff || 0), 0) + (L.cashiers || 0) + ((L.gear && L.gear.collectors) || 0) + ((L.park && L.park.staff) || 0);
  const pend = L.forn && L.forn.pedidos ? L.forn.pedidos.length : 0;
  return { saldo: L.money || 0, estoque, equipe, rep: L.rep || 0, dia: L.day || 1, ultimo: L.lastDay || null, quando: id === FASE ? Date.now() : L.lastSeen, pend, reaberta: !!L.reaberta };
}
const dataHora = t => { if (!t) return "data desconhecida"; const d = new Date(t); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} às ${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`; };
const moeda = v => `${v < 0 ? "−" : ""}M ${fmt(Math.abs(v))}`;

// nome do ponto e, na loja aberta, o aviso "você está aqui" do mesmo lado (sem cobrir as distâncias)
function rotuloNo(n, aqui) {
  const nome = `${n.cap}. ${n.dev ? "em breve" : n.curto}`, txt = (x, y, t, a, cor, tam) => `<text x="${x}" y="${y}" font-size="${tam}" font-weight="800" text-anchor="${a}" fill="${cor}">${t}</text>`;
  const V = "VOCÊ ESTÁ AQUI", R = "#c9302c";
  if (n.rot === "cima") return txt(n.x, n.y - 19, nome, "middle", "#2a2620", 8) + (aqui ? `<path d="M${n.x} ${n.y - 28} l-5 -8 h10 z" fill="${R}"/>` + txt(n.x, n.y - 40, V, "middle", R, 7.5) : "");
  if (n.rot === "esq") return txt(n.x - 18, n.y + 3, nome, "end", "#2a2620", 8) + (aqui ? txt(n.x - 18, n.y + 13, "◀ " + V, "end", R, 7) : "");
  return txt(n.x, n.y + 24, nome, "middle", "#2a2620", 8) + (aqui ? txt(n.x, n.y + 34, "▲ " + V, "middle", R, 7) : "");
}
function svgMapa(sel) {
  const nos = MAPA_NOS, linhas = [];
  for (let i = 1; i < nos.length; i++) {
    const a = nos[i - 1], b = nos[i], dev = b.dev, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    linhas.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${dev ? "#9aa39c" : "#1f4d3a"}" stroke-width="3" stroke-dasharray="${dev ? "4 5" : "7 4"}" stroke-linecap="round"/>
      <rect x="${mx - 21}" y="${my - 6}" width="42" height="12" rx="6" fill="#fffcf4" stroke="#d6cdb3"/><text x="${mx}" y="${my + 3}" font-size="7.5" font-weight="800" text-anchor="middle" fill="#3b352a">${MAPA_DIST[b.id] || ""}</text>`);
  }
  const marcas = nos.map(n => {
    const e = estadoNo(n), aqui = n.id === FASE && !n.dev, s = n.id === sel;
    const cor = { concluida: "#2e7a57", andamento: "#f2b233", disponivel: "#3f74b8", bloqueada: "#8d877a", dev: "#8d877a" }[e.id];
    return `<g class="no-mapa" data-id="${n.id}" style="cursor:pointer">
      ${s ? `<circle cx="${n.x}" cy="${n.y}" r="18" fill="none" stroke="#f2b233" stroke-width="3"/>` : ""}
      <circle cx="${n.x}" cy="${n.y}" r="13" fill="${cor}" stroke="#fff" stroke-width="2.5"/>
      <text x="${n.x}" y="${n.y + 4.5}" font-size="12" text-anchor="middle">${e.ic}</text>
      ${rotuloNo(n, aqui)}
    </g>`;
  }).join("");
  // esquema: lagoa, mar e rodovia só como ambientação, fora de escala
  return `<svg viewBox="0 0 360 240" class="mapa-svg" aria-hidden="true" focusable="false">
    <rect width="360" height="240" rx="12" fill="#e9eedd"/>
    <path d="M0 226 C 70 214, 150 236, 220 224 S 330 214, 360 222 L360 240 L0 240 Z" fill="#a9d1e6"/>
    <text x="344" y="236" font-size="8" fill="#3c6f8a" font-weight="700" text-anchor="end">litoral</text>
    <ellipse cx="36" cy="72" rx="30" ry="13" fill="#bcdcea"/><text x="36" y="75" font-size="7.5" fill="#3c6f8a" font-weight="700" text-anchor="middle">lagoa</text>
    <path d="M0 34 C 120 44, 240 22, 360 32" stroke="#c7bf9f" stroke-width="7" fill="none"/><text x="200" y="22" font-size="7.5" fill="#6e6650" font-weight="700" text-anchor="end">rodovia (RJ-106)</text>
    <rect x="66" y="74" width="276" height="122" rx="16" fill="#dfe4d0" stroke="#c9cfb6" stroke-dasharray="3 3"/><text x="334" y="190" font-size="7.5" fill="#6e6650" font-weight="800" text-anchor="end">CENTRO</text>
    ${linhas.join("")}${marcas}
  </svg>`;
}

let mapaSel = null;
function abrirMapa(sel) {
  if (!NA_CARREIRA) return;
  closeSheet();
  mapaSel = sel && MAPA_NOS.some(n => n.id === sel) ? sel : (proximaDisponivel() || FASE);
  const disp = proximaDisponivel(); if (disp) { CARREIRA.convites[disp] = CARREIRA.convites[disp] || Date.now(); save(); }
  desenharMapa();
}
function desenharMapa() {
  const n = MAPA_NOS.find(x => x.id === mapaSel) || MAPA_NOS[0];
  const lista = MAPA_NOS.map((m, i) => { const e = estadoNo(m), dist = i ? `${MAPA_DIST[m.id] || ""} do anterior (estimativa)` : "ponto de partida";
    return `<li><button class="plain no-lista${m.id === mapaSel ? " toggle" : ""}" data-id="${m.id}" aria-pressed="${m.id === mapaSel}">
      <span class="ic-estado" aria-hidden="true">${e.ic}</span><span><b>Capítulo ${m.cap}: ${m.dev ? "em desenvolvimento" : nomeNo(m)}</b><small>${m.dev ? "" : m.regiao + " · "}${e.txt}${m.id === FASE && !m.dev ? " · você está aqui" : ""} · ${dist}</small></span></button></li>`; }).join("");
  showModal(`<h2>Mapa da carreira</h2>
    <p class="note" style="margin-top:-2px">Esquema fora de escala. Distâncias aproximadas são estimativas do jogo.</p>
    <div class="mapa-wrap">${svgMapa(mapaSel)}</div>
    <p class="legenda" aria-hidden="true"><span>🏪 em administração</span><span>✅ concluída</span><span>⭐ disponível</span><span>🔒 bloqueada</span></p>
    <div class="mapa-detalhe" id="mapaDet" aria-live="polite">${detalheNo(n)}</div>
    <h3 style="margin:12px 0 4px">Todas as lojas</h3>
    <ul class="lista-mapa">${lista}</ul>
    <button class="plain" id="ok" data-esc style="margin-top:8px;width:100%;justify-content:center"><span>Fechar o mapa</span></button>`);
  const d = document.getElementById("dialog"); d.classList.add("dialog-mapa");
  d.querySelectorAll(".no-mapa, .no-lista").forEach(b => b.addEventListener("click", () => { mapaSel = b.dataset.id; desenharMapa(); if (b.classList.contains("no-lista")) setTimeout(() => { const nb = document.querySelector(`.no-lista[data-id="${mapaSel}"]`); if (nb) nb.focus(); }, 40); }));
  ligarAcoesMapa(n);
  document.getElementById("ok").onclick = () => { d.classList.remove("dialog-mapa"); hideModal(); };
}
function detalheNo(n) {
  const e = estadoNo(n), cfg = FASE_CFG[n.id];
  const topo = `<h3>${e.ic} Capítulo ${n.cap}: ${n.dev ? "em desenvolvimento" : nomeNo(n)}</h3><p class="note">${n.dev ? "" : n.regiao + " · "}${e.txt}${n.id === FASE && !n.dev ? " · <b>você está aqui</b>" : ""}</p>`;
  if (e.id === "dev" || e.id === "bloqueada") return `${topo}<p class="note">🔒 ${requisitoNo(n)}</p>`;
  if (e.id === "disponivel") {
    return `${topo}<p>Os responsáveis pelo ${cfg.titulo} querem que você assuma a administração. ${cfg.resumo}</p>${previaSvg(n.id)}
      <p><b>Novas responsabilidades:</b> ${cfg.convite.responsabilidades}</p><p><b>O ${cfg.titulo} começa com:</b> ${cfg.convite.comeca}</p>
      <p><b>Vai com você:</b> experiência, reputação da carreira (${String(CARREIRA.repCarreira || 0).replace(".", ",")} ★) e conquistas. <b>Cada loja fica com o próprio caixa, estoque e equipe;</b> você pode voltar a elas pelo mapa.</p>
      <button class="btn" id="mAssumir">Assumir o novo mercado</button>
      <button class="plain" id="mFicar" style="margin-top:8px;width:100%;justify-content:center"><span>Continuar no ${CFG.titulo} por enquanto</span></button>`;
  }
  const r = registroLoja(n.id);
  if (!r) return `${topo}<p>A versão anterior do jogo não guardava o estado desta loja depois da conclusão. O registro do capítulo continua: concluído no dia ${CARREIRA.fases[n.id] ? CARREIRA.fases[n.id].dia : "?"}.</p>
      <p class="note">Ao reabrir, a loja começa com um estado compatível com a fase concluída: ${cfg.reaberturaTxt}. XP e conquistas não são concedidos de novo.</p>
      <button class="btn" id="mReabrir">Reabrir loja</button>`;
  const ult = r.ultimo ? `${moeda(r.ultimo.net)} no dia ${r.ultimo.day}` : "nenhum dia fechado";
  const stats = `<div class="stats"><div class="stat"><small>Saldo</small><b>${moeda(r.saldo)}</b></div><div class="stat"><small>Estoque</small><b>${fmt(r.estoque)} un.</b></div>
    <div class="stat"><small>Equipe</small><b>${r.equipe} pessoas</b></div><div class="stat"><small>Reputação</small><b>${r.rep.toFixed(1).replace(".", ",")} ★</b></div>
    <div class="stat"><small>Último resultado</small><b>${ult}</b></div>${r.pend ? `<div class="stat"><small>Pedidos a caminho</small><b>${r.pend}</b></div>` : ""}</div>`;
  if (n.id === FASE) return `${topo}${stats}<p class="note">Dados de agora (dia ${r.dia}).</p><button class="btn" id="mFicar">Continuar aqui</button>`;
  return `${topo}${stats}<p class="note">Registrado em ${dataHora(r.quando)}, no dia ${r.dia} da loja. Ao entrar, o tempo fora é processado uma vez pelo gerente, dentro do limite dele.</p>
    <button class="btn" id="mAdmin">Administrar loja</button>`;
}
function ligarAcoesMapa(n) {
  const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  const fechar = () => { document.getElementById("dialog").classList.remove("dialog-mapa"); hideModal(); };
  on("mAssumir", () => { fechar(); assumirProxima(); });
  on("mFicar", () => { fechar(); const nx = proximaDisponivel(); if (nx && n.id === nx) toast(`O convite continua no mapa (aba Carreira).`); });
  on("mAdmin", () => { fechar(); trocarLoja(n.id); });
  on("mReabrir", () => { fechar(); trocarLoja(n.id); });
}

// ---------- ao chegar numa loja pelo mapa: resumo da operação ----------
function lerTroca() {
  let t = null; try { t = JSON.parse(sessionStorage.getItem(CHAVE_TROCA) || "null"); sessionStorage.removeItem(CHAVE_TROCA); } catch (e) {}
  return t && t.para === FASE ? t : null;
}
function resumoOperacao(t, o) {
  const st = registroLoja(FASE), pend = S.forn && S.forn.pedidos ? S.forn.pedidos.length : 0;
  const fora = o ? `<table><tr><td>Tempo fora</td><td>${o.away >= 3600 ? Math.floor(o.away / 3600) + "h" + String(Math.floor(o.away % 3600 / 60)).padStart(2, "0") : Math.floor(o.away / 60) + " min"}</td></tr>
      <tr><td>Dias que passaram na loja</td><td>${o.days}</td></tr><tr><td>Lucro do gerente</td><td class="pos">+M ${fmt(o.gain)}</td></tr>
      ${o.pedidos && o.pedidos.length ? `<tr><td>Pedidos que chegaram</td><td>${o.pedidos.map(p => `${p.qtd} cx de ${secDef(p.sec).name}`).join(", ")}</td></tr>` : ""}
      ${(o.linhas || []).map(l => `<tr><td>${l[0]}</td><td>${l[1]}</td></tr>`).join("")}</table>
      ${o.away > o.counted ? `<div class="warn">O gerente só cobre ${mgrHours(S.mgrLvl)}h de ausência; o resto do tempo não rendeu.</div>` : ""}`
    : `<p class="note">Pouco tempo fora: nada a processar.</p>`;
  showModal(`<h2>${CFG.titulo}</h2><p class="note" style="margin-top:-4px">Capítulo ${CFG.capitulo} · ${CFG.lugar} · ${t.motivo === "assumir" ? "nova administração" : "resumo da operação"}</p>
    ${fora}
    <div class="stats"><div class="stat"><small>Saldo</small><b>${moeda(st.saldo)}</b></div><div class="stat"><small>Estoque</small><b>${fmt(st.estoque)} un.</b></div>
    <div class="stat"><small>Equipe</small><b>${st.equipe}</b></div><div class="stat"><small>Reputação</small><b>${st.rep.toFixed(1).replace(".", ",")} ★</b></div>${pend ? `<div class="stat"><small>A caminho</small><b>${pend} pedido${pend > 1 ? "s" : ""}</b></div>` : ""}</div>
    <p class="note">As finanças desta loja são separadas das outras.</p>
    <button class="btn" id="ok">Administrar</button>`);
  document.getElementById("ok").onclick = () => { hideModal(); save(); };
}
