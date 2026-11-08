"use strict";
// =====================================================================
// 1.4: crédito opcional em todos os capítulos e no modo Livre.
// "Crédito Mumbuca": nome escolhido pelo Daniel (Mumbuca é o nome do povo e da moeda do jogo); regras do jogo, sem ligação com instituições reais.
// Regras: um contrato por vez; juros fixos de 12% no total; 16 parcelas, uma por fechamento (dia, ou
// semana no shopping); a parcela nunca passa de 40% da receita bruta do fechamento nem deixa o saldo
// negativo (o que faltar alonga o prazo, sem multa); quitação antecipada só com os juros da parcela atual.
// Só os juros entram como despesa no resultado do dia; o valor emprestado e o principal das parcelas não
// contam como lucro nem prejuízo (metas e gerente usam o resultado). Os juros do vermelho (5%) continuam.
// No capítulo 8 antes da inauguração: só depois da licença de instalação, limite ligado ao aluguel já
// pré-locado e cobrança começando 2 semanas depois da inauguração.
// Nada muda numa partida que nunca contratou: o estado S.credito só existe depois do contrato.
// =====================================================================
const CR_CFG = { juros: 0.12, parcelas: 16, tetoReceita: 0.4, nome: "Crédito Mumbuca", pisos: [800, 1500, 2500, 3500, 4500, 6000, 8000, 8000], obraMin: 3000, obraMax: 8000, carenciaObra: 2 };
const CR_SEMANA = () => NA_CARREIRA && (FASE === "brisa" || FASE === "grande");
const crUnid = (n = 1) => CR_SEMANA() ? (n === 1 ? "semana" : "semanas") : (n === 1 ? "dia" : "dias");
const crObraAntes = () => NA_CARREIRA && FASE === "grande" && typeof ob === "function" && S.obra && S.obra.fase !== "operacao";
function limiteCredito() {
  if (S.credito) return 0;
  if (crObraAntes()) {
    if (!(typeof licOk === "function" && licOk("instalacao"))) return 0;
    const L = typeof lojasSh === "function" ? lojasSh() : null, alug = L ? ocupadas(L).reduce((a, u) => a + u.ocup.aluguel, 0) : 0;
    return Math.round(Math.max(CR_CFG.obraMin, Math.min(CR_CFG.obraMax, alug * 6)) / 100) * 100;
  }
  const ordem = NA_CARREIRA && typeof FASES !== "undefined" && FASES[FASE] ? FASES[FASE].ordem : Math.min(7, S.tier || 0);
  const piso = CR_CFG.pisos[Math.max(0, Math.min(7, ordem | 0))];
  return Math.round(Math.min(piso * 4, Math.max(piso, Math.max(0, S.avgNet || 0) * 10)) / 100) * 100;
}
const motivoSemCredito = () => S.credito ? "Já existe um contrato: quite este antes de pedir outro." : crObraAntes() && !licOk("instalacao") ? "Na obra, o crédito abre depois da licença de instalação." : "";
function simularCredito(valor) {
  const juros = Math.round(valor * CR_CFG.juros), total = valor + juros, parcela = Math.ceil(total / CR_CFG.parcelas);
  const vermelho = Math.round(valor * (Math.pow(1 + DEBT_INTEREST, CR_CFG.parcelas) - 1));
  return { valor, juros, total, parcela, vermelho, inicio: crObraAntes() ? `${CR_CFG.carenciaObra} semanas depois da inauguração` : `no próximo fechamento (${crUnid()} ${S.day})` };
}
function contratarCredito(valor) {
  const lim = limiteCredito(); valor = Math.round(valor);
  if (!lim || valor <= 0 || valor > lim) { toast(motivoSemCredito() || "Valor acima do limite."); return false; }
  const s = simularCredito(valor);
  S.credito = { valor, juros: s.juros, total: s.total, parcela: s.parcela, principalRest: valor, jurosRest: s.juros, pagas: 0, alongado: 0, inicio: S.day, aguardaObra: crObraAntes(), carenciaAte: crObraAntes() ? null : S.day, ultBruto: 0 };
  S.money += valor;                                              // fora do resultado do dia (não é lucro)
  S.today.linhas = (S.today.linhas || []).concat([[`${CR_CFG.nome}: valor recebido (fora do resultado)`, `+M ${fmt(valor)}`]]);
  banner(`🏦 Crédito de M ${fmt(valor)} contratado`, "#2e7a57"); anunciar(`Crédito de M ${fmt(valor)} contratado. Parcela de M ${fmt(s.parcela)} por ${crUnid()}, começando ${s.inicio}.`);
  if (typeof regDiag === "function") regDiag("credito", { acao: "contratou", valor });
  save(); lastSig = ""; renderSheet(); return true;
}
const custoQuitar = () => { const c = S.credito; return c ? Math.round(c.principalRest + Math.min(c.jurosRest, c.juros / CR_CFG.parcelas)) : 0; };
function quitarCredito() {
  const c = S.credito; if (!c) return false; const v = custoQuitar();
  if (S.money < v) { toast(`Para quitar agora faltam M ${fmt(v - S.money)}.`); return false; }
  const jur = Math.round(Math.min(c.jurosRest, c.juros / CR_CFG.parcelas));
  S.money -= v; S.today.outrasDesp = (S.today.outrasDesp || 0) + jur;
  S.today.linhas = (S.today.linhas || []).concat([[`${CR_CFG.nome}: quitação antecipada (juros M ${fmt(jur)})`, `-M ${fmt(v)}`]]);
  encerrarCredito("quitado antes"); banner("🏦 Crédito quitado", "#2e7a57"); save(); lastSig = ""; renderSheet(); return true;
}
function encerrarCredito(como) {
  const c = S.credito; S.creditoHist = (S.creditoHist || []).concat([{ valor: c.valor, juros: c.juros, inicio: c.inicio, fim: S.day, como }]).slice(-5);
  if (typeof regDiag === "function") regDiag("credito", { acao: como, valor: c.valor });
  delete S.credito;
}
function emCarencia(c) {
  if (c.aguardaObra) { if (S.obra && S.obra.inaugurado != null) { c.aguardaObra = false; c.carenciaAte = S.obra.inaugurado + CR_CFG.carenciaObra; } else return true; }
  return S.day < c.carenciaAte;
}
// cobra uma parcela (ou parte dela); devolve o valor pago
function cobrarParcela(c, brutoRef) {
  const restante = c.principalRest + c.jurosRest; if (restante <= 0) return 0;
  const devido = Math.min(c.parcela, restante), teto = CR_CFG.tetoReceita * Math.max(0, brutoRef);
  const pago = Math.round(Math.max(0, Math.min(devido, teto, S.money)) * 100) / 100; if (pago < devido - 0.01) c.alongado++;
  if (pago <= 0) return 0;
  const jur = Math.min(c.jurosRest, pago * c.juros / c.total); c.jurosRest -= jur; c.principalRest = Math.max(0, c.principalRest - (pago - jur));
  if (c.principalRest + c.jurosRest < 0.5) { c.principalRest = 0; c.jurosRest = 0; }
  S.money -= pago; c.pagas += pago >= devido - 0.01 ? 1 : 0;
  return { pago, jur };
}
const brutoHoje = () => { const t = S.today; return (t.sales || 0) + (t.outras || 0) + ((t.park && t.park.fees) || 0); };
{ const endDay0 = endDay;
  endDay = function () {
    const c = S.credito;
    if (c && !emCarencia(c)) {
      const r = cobrarParcela(c, Math.max(brutoHoje(), c.ultBruto || 0));
      if (r) { S.today.outrasDesp = (S.today.outrasDesp || 0) + r.jur;          // só os juros entram no resultado
        S.today.linhas = (S.today.linhas || []).concat([[`${CR_CFG.nome}: parcela (juros M ${fmt(r.jur)}, principal fora do resultado)`, `-M ${fmt(r.pago)}`]]); }
      else S.today.linhas = (S.today.linhas || []).concat([[`${CR_CFG.nome}: parcela adiada (receita ou saldo baixos, prazo alongado)`, "M 0"]]);
    }
    endDay0();
    const c2 = S.credito;
    if (c2) { const ld = S.lastDay || {}; c2.ultBruto = (ld.sales || 0) + (ld.outras || 0) + ((ld.park && ld.park.fees) || 0);
      if (c2.principalRest + c2.jurosRest <= 0) { encerrarCredito("quitado"); banner("🏦 Crédito quitado", "#2e7a57"); save(); } }
  };
}
{ const off0 = offlineProgress;
  offlineProgress = function () {
    const r = off0(); const c = S.credito;
    if (r && c && r.days > 0) {
      let pago = 0, n = 0;
      for (let d = 0; d < r.days && S.credito; d++) { if (emCarencia(c)) continue; const x = cobrarParcela(c, Math.max(c.ultBruto || 0, Math.max(0, S.avgNet || 0) * 3)); if (x) { pago += x.pago; n++; } }
      if (pago > 0) { r.linhas = (r.linhas || []).concat([[`${CR_CFG.nome}: parcelas pagas enquanto você esteve fora`, `${n} · -M ${fmt(pago)}`]]); r.gain -= pago; }
      if (c.principalRest + c.jurosRest <= 0) encerrarCredito("quitado");
    }
    return r;
  };
}
// ---------- painel ----------
function buildCredito(body) {
  const c = S.credito;
  head("🏦", "#e3eef7", CR_CFG.nome, c ? `Contrato ativo: faltam M ${fmt(Math.round(c.principalRest + c.jurosRest))}` : `Limite agora: M ${fmt(limiteCredito())}`);
  body.appendChild(el("p", "note", `Crédito opcional, para investir com planejamento. Juros fixos de ${Math.round(CR_CFG.juros * 100)}% no total, ${CR_CFG.parcelas} parcelas (uma por ${crUnid()}), sem multa. A parcela nunca passa de ${Math.round(CR_CFG.tetoReceita * 100)}% da receita do fechamento nem deixa o saldo negativo: se faltar, o prazo se alonga. Ficar no vermelho continua custando ${Math.round(DEBT_INTEREST * 100)}% por fechamento.`));
  if (c) {
    const rest = Math.round(c.principalRest + c.jurosRest), car = c.aguardaObra ? `começa ${CR_CFG.carenciaObra} semanas depois da inauguração` : S.day < c.carenciaAte ? `começa em ${c.carenciaAte - S.day} ${crUnid(c.carenciaAte - S.day)}` : "em andamento";
    body.appendChild(el("div", "card", `<h3>Contrato ativo</h3><table><tr><td>Valor recebido</td><td>M ${fmt(c.valor)}</td></tr><tr><td>Juros do contrato</td><td>M ${fmt(c.juros)}</td></tr><tr><td>Parcela</td><td>M ${fmt(c.parcela)} por ${crUnid()} (${car})</td></tr>
      <tr><td>Parcelas pagas</td><td>${c.pagas} de ${CR_CFG.parcelas}${c.alongado ? ` · ${c.alongado} adiada(s)` : ""}</td></tr><tr><td><b>Falta pagar</b></td><td><b>M ${fmt(rest)}</b></td></tr></table>`));
    const q = el("button", "btn", `Quitar agora (M ${fmt(custoQuitar())})`); q.setAttribute("aria-label", `Quitar o crédito agora por M ${fmt(custoQuitar())}, só com os juros da parcela atual`); q.onclick = quitarCredito; body.appendChild(q);
    return;
  }
  const lim = limiteCredito();
  if (!lim) { body.appendChild(el("p", "note", `<b>${motivoSemCredito() || "Sem limite disponível agora."}</b>`)); return; }
  body.appendChild(el("p", "note", crObraAntes() ? `Na obra, o limite depende do aluguel já assinado na pré-locação (6 semanas dele, de M ${fmt(CR_CFG.obraMin)} a M ${fmt(CR_CFG.obraMax)}).` : `O limite acompanha o lucro médio da loja (cerca de 10 ${crUnid(10)} dele).`));
  [0.25, 0.5, 1].forEach(f => { const v = Math.max(100, Math.round(lim * f / 100) * 100), s = simularCredito(v);
    const card = el("div", "card", `<div class="req"><span><b>M ${fmt(v)}</b></span><b>${CR_CFG.parcelas} × M ${fmt(s.parcela)}</b></div>
      <p class="note">Juros M ${fmt(s.juros)} · total M ${fmt(s.total)} · cobrança ${s.inicio}. No vermelho, os mesmos M ${fmt(v)} por ${CR_CFG.parcelas} ${crUnid(2)} custariam cerca de M ${fmt(s.vermelho)} de juros.</p>`);
    const b = el("button", "btn mini", `Contratar M ${fmt(v)}`); b.setAttribute("aria-label", `Contratar crédito de M ${fmt(v)}: ${CR_CFG.parcelas} parcelas de M ${fmt(s.parcela)}, juros de M ${fmt(s.juros)}, total M ${fmt(s.total)}`);
    b.onclick = () => contratarCredito(v); card.appendChild(b); body.appendChild(card); });
  if (S.creditoHist && S.creditoHist.length) body.appendChild(el("p", "note", `Contratos anteriores: ${S.creditoHist.map(h => `M ${fmt(h.valor)} (${h.como})`).join(", ")}.`));
}
PAINEIS.credito = buildCredito;
const crSub = () => S.credito ? `Contrato ativo · faltam M ${fmt(Math.round(S.credito.principalRest + S.credito.jurosRest))}` : limiteCredito() ? `Limite M ${fmt(limiteCredito())}` : (motivoSemCredito() || "Sem limite agora");
{ const bu0 = buildUpgrade;
  buildUpgrade = (body, acts) => { bu0(body, acts);
    const r = el("button", "row", `<div class="ic" style="background:#e3eef7">🏦</div><div><div class="t">Crédito (opcional)</div><div class="s"></div></div><div class="go">Ver</div>`);
    const s = r.querySelector(".s"); live(() => { s.textContent = crSub(); }); r.onclick = () => openSheet("credito"); body.appendChild(r); };
}
{ const bl0 = buildLista;
  buildLista = body => { bl0(body);
    const b = el("button", "plain", `<span>🏦 Crédito (opcional): </span><span class="crS"></span>`); const s = b.querySelector(".crS"); live(() => { s.textContent = crSub(); });
    b.onclick = () => openSheet("credito"); body.appendChild(b); };
}
{ const mc = document.getElementById("moneyChip");
  if (mc) { mc.style.cursor = "pointer"; mc.title = "Saldo e crédito"; mc.addEventListener("click", () => { if (typeof openSheet === "function" && MODO !== "menu") openSheet("credito"); }); }
}
