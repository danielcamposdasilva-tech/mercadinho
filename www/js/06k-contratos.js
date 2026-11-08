"use strict";
// =====================================================================
// 1.6: cada contrato de locação (galeria do atacarejo e lojas do shopping) abre numa ficha própria:
// - análise: aluguel, % das vendas, quanto já pagou, dívida, atrasos, risco, prazo e movimento que traz;
// - cobrar a dívida (uma tentativa por fechamento; pode pagar ou pedir prazo);
// - negociar a dívida: parcela em 3 fechamentos com 15% de desconto;
// - propor loja maior ou menor (outra unidade vaga onde o ramo cabe; o aluguel acompanha o tamanho);
// - prorrogar o contrato (+8 períodos, aluguel 5% maior);
// - encerrar antes do prazo pagando multa (ex.: liberar espaço para uma âncora). A dívida do inquilino é
//   abatida da multa.
// Galeria: 1 período = 1 dia. Shopping: 1 período = 1 semana.
// =====================================================================
const CT_CFG = { parcelas: 3, descontoParc: 0.15, prorroga: 8, aumentoProrroga: 0.05, multaFrac: 0.3, multaMaxPer: 10 };
const CT_AREA = { quiosque: 0.5, sala: 1, alimento: 0.8, pequena: 1, media: 1.4, ancora: 3 };
const ctPer = n => (typeof SH_ATIVO !== "undefined" && SH_ATIVO) ? (n === 1 ? "semana" : "semanas") : (n === 1 ? "dia" : "dias");
const ctFech = () => (typeof SH_ATIVO !== "undefined" && SH_ATIVO) ? "fechamento da semana" : "fechamento do dia";
const ctUnid = (L, uid) => L.unidades.find(x => x.id === uid);
const ctNomeU = u => u.nome || TAMANHOS[u.tam].nome;
function chanceCobranca(o) { return Math.max(0.25, Math.min(0.9, 0.8 - o.risco * 6 - o.atrasos * 0.1)); }
function multaEncerrar(o) { const bruta = Math.max(o.aluguel, Math.round(o.aluguel * Math.min(Math.max(0, o.resta), CT_CFG.multaMaxPer) * CT_CFG.multaFrac)); return { bruta, liquida: Math.max(0, bruta - Math.round(o.divida || 0)) }; }
function destinosMudanca(L, u, cfg) {
  const o = u.ocup;
  return L.unidades.filter(x => !x.ocup && x.tam !== u.tam && TAMANHOS[x.tam].ramos.includes(o.ramo) && (!cfg.ramos || cfg.ramos.includes(o.ramo)))
    .map(x => ({ u: x, aluguel: Math.max(1, Math.round(o.aluguel * (CT_AREA[x.tam] || 1) * (x.mult || 1) / ((CT_AREA[u.tam] || 1) * (u.mult || 1)))), maior: (CT_AREA[x.tam] || 1) * (x.mult || 1) > (CT_AREA[u.tam] || 1) * (u.mult || 1) }));
}
// ---------- ações (devolvem { ok, txt }) ----------
function cobrarDivida(L, uid) {
  const u = ctUnid(L, uid), o = u && u.ocup; if (!o || !(o.divida > 0)) return { ok: false, txt: "Não há dívida para cobrar." };
  if (o.cobradoDia === S.day) return { ok: false, txt: `Você já cobrou ${o.nome} neste período. Tente de novo depois do ${ctFech()}.` };
  o.cobradoDia = S.day;
  if (Math.random() < chanceCobranca(o)) { const v = Math.round(o.divida * 100) / 100; S.money += v; S.earned += v; S.today.outras = (S.today.outras || 0) + v; o.pagoTot = (o.pagoTot || 0) + v; o.divida = 0; o.atrasos = 0;
    return { ok: true, txt: `${o.nome} pagou a dívida: M ${fmt(v)} entraram no caixa.` }; }
  return { ok: false, pediuPrazo: true, txt: `${o.nome} disse que não consegue pagar agora e pediu prazo. Dá para negociar em parcelas ou tentar de novo depois do ${ctFech()}.` };
}
function negociarDivida(L, uid) {
  const u = ctUnid(L, uid), o = u && u.ocup; if (!o || !(o.divida > 0)) return { ok: false, txt: "Não há dívida para negociar." };
  if (o.parcela) return { ok: false, txt: "Já existe um acordo em andamento." };
  const total = Math.round(o.divida * (1 - CT_CFG.descontoParc)), valor = Math.ceil(total / CT_CFG.parcelas);
  o.parcela = { valor, resta: CT_CFG.parcelas, total }; o.divida = 0; o.atrasos = Math.max(0, o.atrasos - 1);
  return { ok: true, txt: `Acordo fechado: ${o.nome} paga M ${fmt(total)} em ${CT_CFG.parcelas} parcelas de M ${fmt(valor)}, junto com o aluguel.` };
}
function mudarInquilino(L, uid, destino, cfg) {
  const u = ctUnid(L, uid), o = u && u.ocup; if (!o) return { ok: false, txt: "Unidade vazia." };
  const d = destinosMudanca(L, u, cfg).find(x => x.u.id === destino); if (!d) return { ok: false, txt: "Essa unidade não está disponível para esse ramo." };
  if (d.maior && (o.atrasos > 0 || o.divida > 0)) return { ok: false, txt: `${o.nome} recusou: com dívida em aberto, não tem fôlego para uma loja maior. Resolva a dívida antes.` };
  d.u.ocup = o; u.ocup = null; o.aluguel = d.aluguel;
  L.propostas = L.propostas.filter(p => p.unidade !== d.u.id || p.renovacao);
  L.propostas.forEach(p => { if (p.renovacao && p.unidade === u.id) p.unidade = d.u.id; });
  return { ok: true, txt: `${o.nome} mudou para ${ctNomeU(d.u)} (${TAMANHOS[d.u.tam].nome.toLowerCase()}). Aluguel agora: M ${fmt(d.aluguel)} por ${ctPer(1)}. ${ctNomeU(u)} ficou vaga.` };
}
function prorrogarContrato(L, uid) {
  const u = ctUnid(L, uid), o = u && u.ocup; if (!o) return { ok: false, txt: "Unidade vazia." };
  if (o.atrasos >= 2) return { ok: false, txt: `Com ${o.atrasos} atrasos, resolva a dívida antes de prorrogar.` };
  o.resta = Math.max(0, o.resta) + CT_CFG.prorroga; o.diasContrato = (o.diasContrato || 0) + CT_CFG.prorroga; o.aluguel = Math.round(o.aluguel * (1 + CT_CFG.aumentoProrroga));
  L.propostas = L.propostas.filter(p => !(p.renovacao && p.unidade === u.id));
  return { ok: true, txt: `Contrato de ${o.nome} prorrogado por mais ${CT_CFG.prorroga} ${ctPer(CT_CFG.prorroga)}, com aluguel de M ${fmt(o.aluguel)}.` };
}
function encerrarContrato(L, uid) {
  const u = ctUnid(L, uid), o = u && u.ocup; if (!o) return { ok: false, txt: "Unidade vazia." };
  const m = multaEncerrar(o);
  if (S.money < m.liquida || S.money < 0) return { ok: false, txt: `Falta dinheiro: a multa é M ${fmt(m.liquida)} e o caixa tem M ${fmt(S.money)}.` };
  S.money -= m.liquida; S.today.outrasDesp = (S.today.outrasDesp || 0) + m.liquida;
  u.ocup = null; L.propostas = L.propostas.filter(p => p.unidade !== u.id);
  return { ok: true, txt: `Contrato de ${o.nome} encerrado. Multa paga: M ${fmt(m.liquida)}${o.divida > 0 ? ` (a dívida de M ${fmt(o.divida)} foi abatida)` : ""}. ${ctNomeU(u)} está livre para outra proposta.` };
}
// ---------- ficha do contrato ----------
function abrirContrato(L, uid, cfg, aviso) {
  const u = ctUnid(L, uid), o = u && u.ocup; if (!o) { hideModal(); return; }
  const R = RAMOS[o.ramo], risco = o.risco >= 0.06 ? "alto" : o.risco <= 0.015 ? "baixo (bom pagador)" : "médio", m = multaEncerrar(o), dest = destinosMudanca(L, u, cfg);
  const per = ctPer(1), refresh = () => { save(); lastSig = ""; if (typeof renderSheet === "function") renderSheet(); };
  const feito = r => { if (r.ok) { refresh(); anunciar(r.txt); } abrirContrato(L, uid, cfg, r); };
  showModal(`<h2>${R.ic} ${o.nome}</h2><p class="note" style="margin-top:-4px">${R.nome} · ${ctNomeU(u)} (${TAMANHOS[u.tam].nome.toLowerCase()})</p>
    ${aviso ? `<div class="${aviso.ok ? "card" : "warn"}" role="status">${aviso.txt}</div>` : ""}
    <table class="rep">
      <tr><td>Aluguel</td><td>M ${fmt(o.aluguel)} por ${per}${o.pct ? ` + ${Math.round(o.pct * 100)}% das vendas` : ""}</td></tr>
      ${o.carencia > 0 ? `<tr><td>Carência</td><td>mais ${o.carencia} ${ctPer(o.carencia)} sem aluguel fixo</td></tr>` : ""}
      <tr><td>Contrato</td><td>${o.resta > 0 ? `mais ${o.resta} ${ctPer(o.resta)}` : "vencido, esperando renovação"} (desde ${per} ${o.desde || "?"})</td></tr>
      <tr><td>Já pagou</td><td>M ${fmt(o.pagoTot || 0)}${o.ultPago != null ? ` · no último fechamento: ${o.ultPago ? `M ${fmt(o.ultPago)}` : "não pagou"}` : ""}</td></tr>
      ${o.pct && o.ultVendas != null ? `<tr><td>Vendas no último período</td><td>M ${fmt(o.ultVendas)}</td></tr>` : ""}
      <tr><td>Dívida</td><td class="${o.divida > 0 ? "neg" : ""}">${o.divida > 0 ? `M ${fmt(o.divida)} · ${o.atrasos} atraso${o.atrasos === 1 ? "" : "s"}` : "nenhuma"}</td></tr>
      ${o.parcela ? `<tr><td>Acordo</td><td>${o.parcela.resta} parcela(s) de M ${fmt(o.parcela.valor)}</td></tr>` : ""}
      <tr><td>Risco de atraso</td><td>${risco}</td></tr>
      <tr><td>Movimento que traz</td><td>+${Math.round(R.fluxo * 100)}%</td></tr>
    </table>
    ${o.divida > 0 ? `<h3 style="margin:10px 0 4px">Dívida</h3><div class="linha2">
      <button class="btn mini" id="ctCobrar"${o.cobradoDia === S.day ? " disabled" : ""}>Cobrar M ${fmt(o.divida)}</button>
      ${o.parcela ? "" : `<button class="plain mini" id="ctNeg"><span>Parcelar em ${CT_CFG.parcelas} com ${Math.round(CT_CFG.descontoParc * 100)}% de desconto</span></button>`}</div>
      <p class="note">Cobrar dá certo ${Math.round(chanceCobranca(o) * 100)}% das vezes (uma tentativa por ${ctFech()}). O acordo é garantido, mas você recebe menos.</p>` : ""}
    <h3 style="margin:10px 0 4px">Espaço</h3>
    ${dest.length ? dest.map(d => `<button class="plain mini" data-mudar="${d.u.id}" style="width:100%"><span>Propor ${d.maior ? "loja maior" : "loja menor"}: ${ctNomeU(d.u)} (${TAMANHOS[d.u.tam].nome.toLowerCase()}), aluguel M ${fmt(d.aluguel)}</span></button>`).join("")
      : `<p class="note">Nenhuma unidade vaga de outro tamanho onde ${R.nome.toLowerCase()} caiba agora.</p>`}
    <h3 style="margin:10px 0 4px">Prazo</h3>
    <button class="plain mini" id="ctProrr" style="width:100%"><span>Prorrogar por mais ${CT_CFG.prorroga} ${ctPer(CT_CFG.prorroga)} (aluguel M ${fmt(Math.round(o.aluguel * (1 + CT_CFG.aumentoProrroga)))})</span></button>
    <button class="plain mini" id="ctEnc" style="width:100%"><span>Encerrar antes do prazo: multa de M ${fmt(m.liquida)}${o.divida > 0 ? ` (M ${fmt(m.bruta)} menos a dívida)` : ""}</span></button>
    <p class="note">Encerrar libera a unidade para outra proposta, por exemplo para trazer uma âncora ou um ramo que falta.</p>
    <button class="btn" id="ctFechar" style="margin-top:8px">Fechar</button>`);
  const $c = k => document.getElementById(k);
  if ($c("ctCobrar")) $c("ctCobrar").onclick = () => feito(cobrarDivida(L, uid));
  if ($c("ctNeg")) $c("ctNeg").onclick = () => feito(negociarDivida(L, uid));
  document.querySelectorAll("#dialog [data-mudar]").forEach(b => b.onclick = () => { const r = mudarInquilino(L, uid, b.dataset.mudar, cfg); if (r.ok) { refresh(); anunciar(r.txt); hideModal(); toast(r.txt); } else abrirContrato(L, uid, cfg, r); });
  $c("ctProrr").onclick = () => feito(prorrogarContrato(L, uid));
  const be = $c("ctEnc"); be.onclick = () => {
    if (!be.dataset.armado) { be.dataset.armado = 1; be.querySelector("span").textContent = `Toque de novo para pagar M ${fmt(m.liquida)} e encerrar`; return; }
    const r = encerrarContrato(L, uid); if (r.ok) { refresh(); anunciar(r.txt); hideModal(); banner(`📄 Contrato de ${o.nome} encerrado`, "#b7773b"); toast(r.txt); } else abrirContrato(L, uid, cfg, r); };
  $c("ctFechar").onclick = hideModal;
}
