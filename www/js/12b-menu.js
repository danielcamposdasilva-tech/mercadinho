"use strict";
// =====================================================================
// Tela inicial: escolha de modo. Cada modo tem a própria partida salva;
// apagar um modo nunca toca no outro. A escolha recarrega a página.
// =====================================================================
function entrarModo(modo) {
  try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({ modo })); } catch (e) {}
  paused = true; location.reload();
}
function voltarAoMenu() {
  save();
  try { sessionStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
  paused = true; location.reload();
}
function resumoLivre() {
  const s = lerJSON(localStorage, CHAVE_LIVRE); if (!s) return null;
  const t = TIERS[s.tier || 0] || TIERS[0];
  return `Dia ${s.day || 1} · ${t.name} · M ${fmt(s.money || 0)}`;
}
function resumoCarreira() {
  const c = migrarCarreira(lerJSON(localStorage, CHAVE_CARREIRA), false); if (!c || !FASE_CFG[c.ativa]) return null;
  const f = FASE_CFG[c.ativa], lj = c.lojas[c.ativa], dia = lj && lj.day ? ` · dia ${lj.day}` : "";
  const outra = c.ativa !== c.fase && FASE_CFG[c.fase] ? ` · em andamento: capítulo ${FASE_CFG[c.fase].capitulo}` : "";
  return `Capítulo ${f.capitulo}: ${f.titulo}${dia}${outra}`;
}
function confirmarApagar(nome, outro, chave, modo) {
  showModal(`<h2>Apagar ${nome}?</h2><p>A partida salva de <b>${nome}</b> será apagada deste aparelho. <b>${outro}</b> não é afetado.</p>
    <button class="btn danger-btn" id="sim">Apagar e começar de novo</button>
    <button class="plain" id="nao" style="margin-top:8px;width:100%;justify-content:center"><span>Cancelar</span></button>`);
  document.getElementById("sim").onclick = () => { try { localStorage.removeItem(chave); } catch (e) {} entrarModo(modo); };
  document.getElementById("nao").onclick = () => { hideModal(); };
}
function mostrarMenu() {
  const rl = resumoLivre(), rc = resumoCarreira();
  const m = document.createElement("div"); m.id = "menu"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Escolha de modo");
  m.innerHTML = `<div class="menu-box">
    <div class="menu-logo"><span>MERCADINHO</span><small>DA ESQUINA</small></div>
    <p class="menu-sub">Escolha como quer jogar. Cada modo tem o seu próprio progresso.</p>
    <div class="modo">
      <div class="modo-ic">🏪</div>
      <div class="modo-tx"><h3>Meu Mercado</h3><p>Modo livre: cresça o seu mercado no seu ritmo, de mercadinho a rede.</p>${rl ? `<p class="salvo">Salvo: ${rl}</p>` : ""}</div>
      <div class="modo-bt"><button class="btn" id="mLivre">${rl ? "Continuar" : "Começar"}</button>${rl ? `<button class="plain mini" id="mLivreNovo"><span>Novo jogo</span></button>` : ""}</div>
    </div>
    <div class="modo">
      <div class="modo-ic">🗺️</div>
      <div class="modo-tx"><h3>Carreira em Maricá</h3><p>Campanha por fases: comece num mercado de bairro e assuma empreendimentos maiores.</p>${rc ? `<p class="salvo">Salvo: ${rc}</p>` : ""}</div>
      <div class="modo-bt"><button class="btn" id="mCarr">${rc ? "Continuar" : "Começar carreira"}</button>${rc ? `<button class="plain mini" id="mCarrNovo"><span>Nova carreira</span></button>` : ""}</div>
    </div>
    <p class="menu-nota">Cenários inspirados em Maricá; estabelecimentos e nomes são fictícios.</p>
  </div>`;
  document.body.appendChild(m);
  m.querySelector("#mLivre").onclick = () => entrarModo("livre");
  m.querySelector("#mCarr").onclick = () => entrarModo("carreira");
  const ln = m.querySelector("#mLivreNovo"); if (ln) ln.onclick = () => confirmarApagar("o Meu Mercado", "A carreira", CHAVE_LIVRE, "livre");
  const cn = m.querySelector("#mCarrNovo"); if (cn) cn.onclick = () => confirmarApagar("a carreira", "O Meu Mercado", CHAVE_CARREIRA, "carreira");
  setTimeout(() => m.querySelector("#mLivre").focus(), 50);
}
