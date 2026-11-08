"use strict";
// =====================================================================
// 1.6: tocar nas estrelas (reputação) explica de onde vem a nota e o que fazer para melhorar.
// - Mercados (Livre e capítulos 1 a 6): cada mudança de reputação guarda o motivo no dia (changeRep com causa,
//   em S.today.repCausas). A tela mostra hoje e ontem, do que mais tirou para o que mais deu, com uma dica.
// - Shopping (capítulos 7 e 8): as estrelas são a satisfação dos visitantes; a tela mostra cada parcela.
// =====================================================================
const REP_CAUSAS = {
  fila: { nome: "Clientes desistiram da fila do caixa", dica: "Contrate ou treine operadores de caixa; no capítulo 4, ponha volantes no caixa no pico." },
  gondola: { nome: "Clientes não acharam o produto na gôndola", dica: "Contrate ou treine repositores, aumente a prateleira e mantenha o depósito abastecido." },
  nada: { nome: "Clientes saíram sem achar nada", dica: "Gôndolas vazias: reponha (repositores, depósito, pedidos) e abra mais setores." },
  cesta: { nome: "Clientes saíram por falta de cesta ou carrinho", dica: "Compre mais cestas e carrinhos, contrate carrinheiros ou toque nas cestas acumuladas no caixa." },
  irritado: { nome: "Clientes saíram irritados", dica: "Veja o relatório do dia para saber onde a loja travou." },
  estacionamento: { nome: "Carros desistiram do estacionamento", dica: "Compre mais vagas; se houver vagas livres e fila na cancela, contrate ou treine atendentes." },
  lotacao: { nome: "Visitantes recusados por lotação", dica: "Aumente a capacidade com limpeza e segurança." },
  entregaCancelada: { nome: "Entregas canceladas", dica: "Aceite só o que o estoque e os motoboys dão conta; ajuste capacidade e raio." },
  entregaAtrasada: { nome: "Entregas atrasadas", dica: "Mais motoboys, separação no turno e raio menor." },
  entregaParcial: { nome: "Entregas enviadas sem tudo", dica: "Mantenha estoque para os pedidos aceitos." },
  comerciante: { nome: "Comerciantes foram embora sem comprar", dica: "Posições de palete abastecidas e balcão do atacado sem fila." },
  manobra: { nome: "Manobra de empilhadeira no pico com cliente perto", dica: "Use a descida do alto preventiva (só fora do pico)." },
  rapido: { nome: "Clientes atendidos rápido no caixa", dica: "" },
  atendido: { nome: "Clientes atendidos (com espera)", dica: "Fila curta (menos de 5 s) rende mais que o dobro de estrelas por cliente." },
  ajuda: { nome: "Clientes ajudados pela equipe", dica: "" },
  entregaPrazo: { nome: "Entregas no prazo", dica: "" },
  fardos: { nome: "Vendas de fardos no atacado", dica: "" },
};
const repTxt = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2).replace(".", ",");
const estrelasTxt = v => v.toFixed(1).replace(".", ",");
function linhasCausas(rc) {
  return Object.entries(rc || {}).filter(([, q]) => Math.abs(q.v) >= 0.005).sort((a, b) => a[1].v - b[1].v)
    .map(([k, q]) => ({ k, v: q.v, n: q.n, nome: (REP_CAUSAS[k] || { nome: k }).nome, dica: (REP_CAUSAS[k] || {}).dica || "" }));
}
function tabelaCausas(lin) {
  if (!lin.length) return `<p class="note">Nada mudou a reputação ainda.</p>`;
  return `<table class="rep">${lin.map(l => `<tr><td>${l.nome} (${l.n})</td><td class="${l.v < 0 ? "neg" : "pos"}">${repTxt(l.v)}</td></tr>`).join("")}</table>`;
}
function abrirReputacao() {
  if (typeof closeSheet === "function") closeSheet();
  const metaTxt = NA_CARREIRA && CFG && CFG.dia && CFG.dia.repMin && !CFG.semGondolas ? `<p>Meta do capítulo: pelo menos <b>${estrelasTxt(CFG.dia.repMin)}</b> para o dia contar.</p>` : "";
  if (typeof SH_ATIVO !== "undefined" && SH_ATIVO) {
    const fs = fatoresSatisfacao(), sat = satisfacaoAgora(), s = sh();
    const ruins = fs.filter(f => f.dica && f.v < f.max - 0.005).sort((a, b) => (a.v - a.max) - (b.v - b.max)).slice(0, 3);
    showModal(`<h2>⭐ Reputação ${estrelasTxt(S.rep)}</h2>
      <p>No shopping, as estrelas são a <b>satisfação dos visitantes</b> (agora ${Math.round(sat * 100)}%, a nota acompanha aos poucos). 5 estrelas = 100%.</p>
      <table class="rep"><tr><td>Base</td><td>50%</td></tr>${fs.filter(f => f.v || f.max).map(f => `<tr><td>${f.nome}</td><td class="${f.v < 0 ? "neg" : f.v < f.max - 0.005 ? "" : "pos"}">${f.v >= 0 ? "+" : "−"}${Math.abs(Math.round(f.v * 100))}%${f.max > 0 ? ` de ${Math.round(f.max * 100)}%` : ""}</td></tr>`).join("")}</table>
      <h3 style="margin:10px 0 4px">Para melhorar</h3>
      ${ruins.length ? `<ul class="metas">${ruins.map(f => `<li>${f.dica}</li>`).join("")}</ul>` : `<p class="note">Tudo no melhor que dá agora. Mantenha limpeza, segurança e lojas ocupadas.</p>`}
      ${s.hoje && s.hoje.recusados ? `<p class="note">Nesta semana, ${s.hoje.recusados} visitante(s) recusado(s) por lotação.</p>` : ""}
      <button class="btn" id="repOk">Entendi</button>`);
    document.getElementById("repOk").onclick = hideModal; return;
  }
  const hoje = linhasCausas(S.today && S.today.repCausas), ontem = linhasCausas(S.lastDay && S.lastDay.repCausas);
  const piores = [...hoje, ...ontem].filter(l => l.v < 0 && l.dica).sort((a, b) => a.v - b.v).filter((l, i, a) => a.findIndex(x => x.k === l.k) === i).slice(0, 3);
  showModal(`<h2>⭐ Reputação ${estrelasTxt(S.rep)}</h2>
    <p>As estrelas sobem quando o cliente é bem atendido e caem quando ele desiste ou sai sem o que queria. Mais estrelas trazem mais clientes${NA_CARREIRA ? "" : " e liberam o próximo porte da loja"}.</p>
    ${metaTxt}
    <h3 style="margin:10px 0 4px">Hoje</h3>${tabelaCausas(hoje)}
    ${S.lastDay ? `<h3 style="margin:10px 0 4px">Ontem (dia ${S.lastDay.day})</h3>${S.lastDay.repCausas ? tabelaCausas(ontem) : `<p class="note">Sem detalhes de ontem (o motivo passou a ser guardado na versão 1.6).</p>`}` : ""}
    <h3 style="margin:10px 0 4px">Para melhorar</h3>
    ${piores.length ? `<ul class="metas">${piores.map(l => `<li><b>${l.nome}:</b> ${l.dica}</li>`).join("")}</ul>` : `<p class="note">Nenhuma perda importante. Fila curta no caixa é o que mais rende estrelas.</p>`}
    <button class="btn" id="repOk">Entendi</button>`);
  document.getElementById("repOk").onclick = hideModal;
}
// o resumo de ontem guarda os motivos do dia que fechou
{ const e0 = endDay;
  endDay = function () { const rc = S.today && S.today.repCausas; const r = e0.apply(this, arguments); if (rc && S.lastDay) S.lastDay.repCausas = rc; return r; }; }
// a estrela do topo é um botão (index.html)
{ const b = document.getElementById("repChip"); if (b) b.onclick = abrirReputacao; }
