"use strict";
// =====================================================================
// Locação de espaços (capítulos 6, 7 e 8): galeria do atacarejo e lojas do shopping.
// Um "conjunto" (L) guarda unidades, propostas e o histórico. Quem usa passa um cfg com os ramos
// aceitos, os custos e o nome do lugar. Os inquilinos são fictícios e genéricos.
// Dinheiro: aluguel entra uma vez por dia fechado (fimDoDia). Fora do app não há cobrança extra:
// o lucro médio do gerente (avgNet) já inclui os aluguéis.
// =====================================================================
const RAMOS = {
  farmacia:   { nome: "Farmácia", ic: "💊", cor: "#2e7a57", base: 60, fluxo: 0.05, risco: 0.01, cat: "servicos", nomes: ["Drogaria Boa Saúde", "Farmácia Bem-Estar", "Drogaria Lagoa Azul"] },
  loterica:   { nome: "Lotérica", ic: "🍀", cor: "#3c8d40", base: 45, fluxo: 0.06, risco: 0.02, cat: "servicos", nomes: ["Lotérica Trevo da Sorte", "Lotérica Sorte Grande"] },
  chaveiro:   { nome: "Chaveiro e consertos", ic: "🔑", cor: "#8a6a4a", base: 18, fluxo: 0.01, risco: 0.04, cat: "servicos", nomes: ["Chaveiro Rápido", "Conserta Tudo"] },
  lanchonete: { nome: "Lanchonete", ic: "🥪", cor: "#d9822b", base: 38, fluxo: 0.04, risco: 0.05, cat: "alimentacao", nomes: ["Lanchonete Sabor da Lagoa", "Pastelaria do Trevo", "Cantinho do Salgado"] },
  otica:      { nome: "Ótica", ic: "👓", cor: "#4a6fa5", base: 42, fluxo: 0.02, risco: 0.02, cat: "servicos", nomes: ["Ótica Visão Clara", "Ótica Bom Olhar"] },
  salao:      { nome: "Salão de beleza", ic: "💇", cor: "#b5487a", base: 30, fluxo: 0.02, risco: 0.04, cat: "servicos", nomes: ["Salão Bela Restinga", "Studio Maré Alta"] },
  celular:    { nome: "Assistência de celular", ic: "📱", cor: "#5b6b73", base: 34, fluxo: 0.03, risco: 0.05, cat: "eletronicos", nomes: ["Cell Conserto", "Tela Nova Assistência"] },
  acai:       { nome: "Açaí e sorvetes", ic: "🍧", cor: "#6b3fa0", base: 32, fluxo: 0.03, risco: 0.05, cat: "alimentacao", nomes: ["Açaí da Orla", "Gelato da Lagoa"] },
  // shopping (capítulos 7 e 8)
  moda:       { nome: "Moda", ic: "👗", cor: "#c2185b", base: 70, fluxo: 0.05, risco: 0.03, cat: "moda", nomes: ["Brisa Moda", "Vitrine Tropical", "Ateliê Maré"] },
  calcados:   { nome: "Calçados", ic: "👟", cor: "#795548", base: 60, fluxo: 0.04, risco: 0.03, cat: "moda", nomes: ["Passo Certo Calçados", "Pé na Areia"] },
  eletro:     { nome: "Eletrônicos", ic: "🎧", cor: "#37474f", base: 80, fluxo: 0.05, risco: 0.03, cat: "eletronicos", nomes: ["Ponto Digital", "Conecta Eletrônicos"] },
  livraria:   { nome: "Livraria e papelaria", ic: "📚", cor: "#5d4037", base: 45, fluxo: 0.03, risco: 0.02, cat: "lazer", nomes: ["Livraria Página da Lagoa", "Papelaria Lápis de Cor"] },
  brinquedos: { nome: "Brinquedos", ic: "🧸", cor: "#f57c00", base: 50, fluxo: 0.04, risco: 0.03, cat: "lazer", nomes: ["Mundo Brincar", "Pião Colorido"] },
  esportes:   { nome: "Esportes", ic: "⚽", cor: "#2e7d32", base: 65, fluxo: 0.04, risco: 0.03, cat: "moda", nomes: ["Arena Esportes", "Remo & Cia"] },
  restaurante:{ nome: "Restaurante", ic: "🍽️", cor: "#bf360c", base: 70, fluxo: 0.06, risco: 0.04, cat: "alimentacao", nomes: ["Restaurante Peixe da Lagoa", "Cantina da Praça", "Grelhados Maricá Sol"] },
  cafe:       { nome: "Café", ic: "☕", cor: "#6d4c41", base: 30, fluxo: 0.03, risco: 0.03, cat: "alimentacao", nomes: ["Café Coqueiral", "Grão da Serra Café"] },
  academia:   { nome: "Academia", ic: "🏋️", cor: "#455a64", base: 90, fluxo: 0.05, risco: 0.03, cat: "lazer", nomes: ["Academia Corpo e Mar", "Movimento Fit"] },
  cinema:     { nome: "Cinema", ic: "🎬", cor: "#1a237e", base: 220, fluxo: 0.16, risco: 0.01, cat: "lazer", nomes: ["Cine Brisa (3 salas)", "Cine Lagoa"] },
  mercado:    { nome: "Supermercado", ic: "🛒", cor: "#2e7d32", base: 260, fluxo: 0.18, risco: 0.01, cat: "ancora", nomes: ["Supermercado Bom Lar", "Mercado Família da Orla"] },
  depto:      { nome: "Loja de departamentos", ic: "🏬", cor: "#ad1457", base: 240, fluxo: 0.15, risco: 0.01, cat: "ancora", nomes: ["Magazine Ventania", "Departamentos Litoral"] },
  quiosque:   { nome: "Quiosque", ic: "🛍️", cor: "#00838f", base: 16, fluxo: 0.01, risco: 0.06, cat: "quiosque", nomes: ["Capinhas & Cia", "Doce de Coco da Vó", "Bijus da Praia", "Óculos de Sol Express"] },
};
const CAT_NOME = { servicos: "Serviços", alimentacao: "Alimentação", eletronicos: "Eletrônicos", moda: "Moda e calçados", lazer: "Lazer e cultura", ancora: "Âncora", quiosque: "Quiosques" };
// tamanho da unidade: multiplica o aluguel e diz que ramos cabem
const TAMANHOS = {
  sala:     { nome: "Sala", mult: 1, ramos: ["farmacia", "loterica", "chaveiro", "lanchonete", "otica", "salao", "celular", "acai"] },
  pequena:  { nome: "Loja pequena", mult: 1, ramos: ["otica", "celular", "acai", "cafe", "livraria", "calcados", "chaveiro", "loterica"] },
  media:    { nome: "Loja média", mult: 1.4, ramos: ["moda", "calcados", "eletro", "brinquedos", "esportes", "farmacia", "academia", "livraria"] },
  alimento: { nome: "Praça de alimentação", mult: 1, ramos: ["restaurante", "lanchonete", "cafe", "acai"] },
  ancora:   { nome: "Âncora", mult: 1, ramos: ["mercado", "depto", "cinema"] },
  quiosque: { nome: "Quiosque", mult: 1, ramos: ["quiosque"] },
};
const novoConjunto = unidades => ({ unidades: unidades.map(u => Object.assign({ ocup: null }, u)), propostas: [], seq: 1, tProp: 0, dias: [], hoje: { receita: 0, despesas: 0 }, despejos: 0, totDias: 0 });
const ocupadas = L => L.unidades.filter(u => u.ocup);
const taxaOcupacao = L => L.unidades.length ? ocupadas(L).length / L.unidades.length : 0;
const fluxoInquilinos = L => ocupadas(L).reduce((a, u) => a + (RAMOS[u.ocup.ramo] ? RAMOS[u.ocup.ramo].fluxo : 0), 0);
const categoriasAtivas = L => [...new Set(ocupadas(L).map(u => RAMOS[u.ocup.ramo].cat))];
const sorteio = arr => arr[Math.floor(Math.random() * arr.length)];

function gerarProposta(L, cfg, renovar) {
  if (renovar) { const u = renovar, o = u.ocup;
    const p = { id: L.seq++, unidade: u.id, ramo: o.ramo, nome: o.nome, aluguel: Math.round(o.aluguel * 1.06), pct: o.pct || 0, dias: o.diasContrato, risco: o.risco, idade: 0, renovacao: true };
    L.propostas.push(p); return p; }
  const vagas = L.unidades.filter(u => !u.ocup && !L.propostas.some(p => p.unidade === u.id)); if (!vagas.length) return null;
  const u = sorteio(vagas), T = TAMANHOS[u.tam], ramos = T.ramos.filter(r => !cfg.ramos || cfg.ramos.includes(r)); if (!ramos.length) return null;
  // o mix conta: ramos repetidos pagam menos e trazem menos gente
  const ramo = sorteio(ramos), R = RAMOS[ramo], rep = ocupadas(L).filter(x => x.ocup.ramo === ramo).length;
  const firme = Math.random();                                   // proposta firme (paga bem, risco baixo) ou aventureira
  const p = { id: L.seq++, unidade: u.id, ramo, nome: sorteio(R.nomes), aluguel: Math.round(R.base * T.mult * (u.mult || 1) * (cfg.fatorAluguel || 1) * (0.8 + firme * 0.45) * (rep ? 0.85 : 1)),
    pct: cfg.pctVendas ? Math.round((cfg.pctVendas[0] + Math.random() * (cfg.pctVendas[1] - cfg.pctVendas[0])) * 100) / 100 : 0,
    dias: 8 + Math.floor(Math.random() * 13), risco: Math.round(R.risco * (firme > 0.7 ? 2.2 : firme < 0.3 ? 0.6 : 1) * 1000) / 1000, idade: 0, repetido: rep > 0 };
  L.propostas.push(p); return p;
}
function aceitarProposta(L, id) {
  const k = L.propostas.findIndex(p => p.id === id); if (k < 0) return false;
  const p = L.propostas[k], u = L.unidades.find(x => x.id === p.unidade); if (!u || (u.ocup && !p.renovacao)) { L.propostas.splice(k, 1); return false; }
  u.ocup = { nome: p.nome, ramo: p.ramo, aluguel: p.aluguel, pct: p.pct, diasContrato: p.dias, resta: p.dias, risco: p.risco, divida: 0, atrasos: 0, desde: S.day, vendas: 0 };
  L.propostas.splice(k, 1); L.propostas = L.propostas.filter(q => q.unidade !== u.id);
  return true;
}
function recusarProposta(L, id) { const k = L.propostas.findIndex(p => p.id === id); if (k < 0) return false; const p = L.propostas[k]; L.propostas.splice(k, 1);
  if (p.renovacao) { const u = L.unidades.find(x => x.id === p.unidade); if (u && u.ocup && u.ocup.resta <= 0) u.ocup = null; } return true; }
function despejar(L, uid) { const u = L.unidades.find(x => x.id === uid); if (!u || !u.ocup || u.ocup.atrasos < 2) return false; u.ocup = null; L.despejos++; return true; }
// tempo real: propostas novas chegam quando há vagas; propostas velhas expiram
function tickLocacao(L, cfg, dt) {
  L.tProp += dt;
  if (L.tProp >= cfg.cadaProposta && L.propostas.filter(p => !p.renovacao).length < (cfg.maxPropostas || 3)) { L.tProp = 0; gerarProposta(L, cfg); }
  for (let k = L.propostas.length - 1; k >= 0; k--) { const p = L.propostas[k]; p.idade += dt; if (!p.renovacao && p.idade > cfg.validade) L.propostas.splice(k, 1); }
}
// fechamento do dia: cobra aluguéis (com atrasos possíveis), desconta custos e vence contratos
function diaLocacao(L, cfg, extraReceita) {
  let receita = 0, atrasou = 0; const fins = [];
  ocupadas(L).forEach(u => {
    const o = u.ocup, car = o.carencia > 0, devido = (car ? 0 : o.aluguel) + (o.pct ? o.vendas * o.pct : 0);   // 1.4: carência negociada não cobra o aluguel fixo
    if (car) o.carencia--;
    const parc = o.parcela && o.parcela.resta > 0 ? o.parcela.valor : 0;       // 1.6: dívida negociada em parcelas (06k)
    if (Math.random() < o.risco) { o.divida += devido; o.atrasos++; atrasou++; o.ultPago = 0; }
    else { const pago = devido + o.divida + parc; receita += pago; o.divida = 0; o.pagoTot = (o.pagoTot || 0) + pago; o.ultPago = pago; if (parc) { o.parcela.resta--; if (o.parcela.resta <= 0) o.parcela = null; } if (o.atrasos > 0 && Math.random() < 0.5) o.atrasos--; }
    o.ultVendas = o.vendas; o.vendas = 0; o.resta--;
    if (o.resta <= 0) fins.push(u);
  });
  fins.forEach(u => { if (!L.propostas.some(p => p.unidade === u.id && p.renovacao)) gerarProposta(L, cfg, u); });
  // contrato vencido e renovação recusada ou ignorada por 1 dia: a loja sai
  ocupadas(L).forEach(u => { if (u.ocup.resta <= -1) { u.ocup = null; L.propostas = L.propostas.filter(p => p.unidade !== u.id); } });
  const vagas = L.unidades.length - ocupadas(L).length;
  const despesas = cfg.custoFixo + cfg.custoVaga * vagas + cfg.custoOcupada * ocupadas(L).length;
  receita += extraReceita || 0;
  const d = { dia: S.day, ocupacao: taxaOcupacao(L), receita: Math.round(receita), despesas: Math.round(despesas), resultado: Math.round(receita - despesas), atrasos: atrasou, cats: categoriasAtivas(L).length };
  L.dias.unshift(d); L.dias.length = Math.min(L.dias.length, 7); L.totDias++;
  return d;
}
// enquanto o app estava fechado: os contratos andam, sem dinheiro novo (já está no lucro médio do gerente)
function locacaoAoVoltar(L, cfg, days) {
  let saiu = 0;
  ocupadas(L).forEach(u => { u.ocup.resta -= days; u.ocup.vendas = 0; if (u.ocup.resta <= -1) { u.ocup = null; saiu++; } });
  L.propostas = L.propostas.filter(p => !p.renovacao || L.unidades.some(u => u.id === p.unidade && u.ocup));
  ocupadas(L).forEach(u => { if (u.ocup.resta <= 0 && !L.propostas.some(p => p.renovacao && p.unidade === u.id)) gerarProposta(L, cfg, u); });
  L.propostas = L.propostas.filter(p => p.renovacao);                  // propostas comuns já expiraram
  return saiu;
}
const mediaDias = (L, n, campo) => { const ds = L.dias.slice(0, n); return ds.length ? ds.reduce((a, d) => a + d[campo], 0) / ds.length : 0; };

// ---------- painel ----------
function cartaoUnidade(L, u, cfg, onMuda) {
  const T = TAMANHOS[u.tam], o = u.ocup, R = o && RAMOS[o.ramo];
  const c = el("div", "card proposta", o
    ? `<div class="req"><span>${R.ic} <b>${o.nome}</b> <span class="tag">${u.nome || T.nome}</span></span><b>M ${fmt(o.aluguel)}/dia${o.pct ? ` + ${Math.round(o.pct * 100)}%` : ""}</b></div>
       <p class="note">${R.nome}${o.carencia > 0 ? ` · <span class="tag aviso">carência: mais ${o.carencia} sem aluguel fixo</span>` : ""} · contrato: ${o.resta > 0 ? `mais ${o.resta} dia(s)` : "<b>vencido, espera renovação</b>"}${o.divida > 0 ? ` · <span class="tag ruim">deve M ${fmt(o.divida)} (${o.atrasos} atraso${o.atrasos === 1 ? "" : "s"})</span>` : ""}</p>`
    : `<div class="req"><span>🏷️ <b>${u.nome || T.nome}</b> <span class="tag aviso">vaga</span></span><b>custa M ${fmt(cfg.custoVaga)}/dia</b></div><p class="note">Cabe: ${T.ramos.filter(r => !cfg.ramos || cfg.ramos.includes(r)).map(r => RAMOS[r].nome.toLowerCase()).join(", ")}.</p>`);
  if (o && typeof abrirContrato === "function") { const b = el("button", "plain mini", `<span>Abrir contrato</span>`); b.setAttribute("aria-label", `Abrir o contrato de ${o.nome}`); b.onclick = () => abrirContrato(L, u.id, cfg); c.appendChild(b); }
  if (o && o.atrasos >= 2) { const b = el("button", "plain mini", `<span>Encerrar contrato por falta de pagamento</span>`); b.onclick = () => { if (despejar(L, u.id)) { toast(`${o.nome} saiu. A dívida de M ${fmt(o.divida)} ficou para a cobrança.`); onMuda(); } }; c.appendChild(b); }
  return c;
}
function cartaoProposta(L, p, cfg, onMuda) {
  const R = RAMOS[p.ramo], u = L.unidades.find(x => x.id === p.unidade), T = u && TAMANHOS[u.tam];
  const risco = p.risco >= 0.06 ? '<span class="tag ruim">risco alto de atraso</span>' : p.risco <= 0.015 ? '<span class="tag bom">bom pagador</span>' : '<span class="tag">risco médio</span>';
  const c = el("div", "card proposta", `<div class="req"><span>${R.ic} <b>${p.nome}</b>${p.renovacao ? ' <span class="tag bom">renovação</span>' : ""}</span><b>M ${fmt(p.aluguel)}/dia${p.pct ? ` + ${Math.round(p.pct * 100)}% das vendas` : ""}</b></div>
    <p class="note">${R.nome} para ${u ? (u.nome || T.nome).toLowerCase() : "?"} · ${p.dias} dias de contrato · ${risco}${p.repetido ? ' · <span class="tag aviso">ramo repetido</span>' : ""} · traz ${Math.round(R.fluxo * 100)}% mais movimento${p.renovacao ? "" : ` · vale por ${Math.max(0, Math.ceil(cfg.validade - p.idade))} s`}</p>`);
  const g = el("div", "linha2");
  const a = el("button", "btn mini", "Aceitar"); a.setAttribute("aria-label", `Aceitar proposta de ${p.nome}`); a.onclick = () => { if (aceitarProposta(L, p.id)) { banner(`🤝 ${p.nome} assinou`, "#2e7a57"); anunciar(`${p.nome} ocupou ${u ? (u.nome || T.nome) : "a unidade"}.`); } onMuda(); };
  const r = el("button", "plain mini", "Recusar"); r.setAttribute("aria-label", `Recusar proposta de ${p.nome}`); r.onclick = () => { recusarProposta(L, p.id); onMuda(); };
  g.appendChild(a); g.appendChild(r); c.appendChild(g);
  return c;
}
function painelLocacao(body, L, cfg) {
  const onMuda = () => { save(); lastSig = ""; renderSheet(); };
  body.appendChild(statsBox([
    ["Ocupação", () => `${ocupadas(L).length} de ${L.unidades.length} (${pctTxt(taxaOcupacao(L))})`],
    ["Aluguéis por dia", () => `M ${fmt(ocupadas(L).reduce((a, u) => a + u.ocup.aluguel, 0))}`],
    ["Custos por dia", () => `M ${fmt(cfg.custoFixo + cfg.custoVaga * (L.unidades.length - ocupadas(L).length) + cfg.custoOcupada * ocupadas(L).length)}`],
    ["Resultado (3 dias)", () => L.dias.length ? `M ${fmt(mediaDias(L, 3, "resultado"))}${mediaDias(L, 3, "resultado") < 0 ? " (negativo)" : ""}/dia` : "—"],
  ]));
  body.appendChild(el("div", "sec-title", `Propostas (${L.propostas.length})`));
  if (!L.propostas.length) body.appendChild(el("p", "note", ocupadas(L).length < L.unidades.length ? `Novas propostas chegam a cada ${Math.round(cfg.cadaProposta)} s enquanto houver vaga.` : "Tudo ocupado. Renovações aparecem quando um contrato vence."));
  L.propostas.slice().sort((a, b) => (b.renovacao ? 1 : 0) - (a.renovacao ? 1 : 0)).forEach(p => body.appendChild(cartaoProposta(L, p, cfg, onMuda)));
  body.appendChild(el("div", "sec-title", "Unidades"));
  L.unidades.forEach(u => body.appendChild(cartaoUnidade(L, u, cfg, onMuda)));
  if (L.dias.length) { body.appendChild(el("div", "sec-title", "Dias anteriores"));
    L.dias.slice(0, 3).forEach(d => body.appendChild(el("div", "req", `<span>Dia ${d.dia}: ocupação ${pctTxt(d.ocupacao)}${d.atrasos ? `, ${d.atrasos} atraso(s)` : ""}</span><b>${d.resultado < 0 ? "-" : "+"}M ${fmt(Math.abs(d.resultado))}</b>`))); }
}
const sigLocacao = L => L.propostas.map(p => p.id).join(",") + "/" + L.unidades.map(u => u.ocup ? u.ocup.nome + u.ocup.resta + u.ocup.atrasos : "-").join(",") + L.dias.length;
