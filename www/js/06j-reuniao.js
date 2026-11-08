"use strict";
// =====================================================================
// 1.4: reunião da semana no shopping (capítulo 7 e capítulo 8 depois da inauguração).
// No início de cada semana, até três decisões (contratos, operação e calendário), cada uma com uma resposta
// padrão já marcada e gratuita. Quem não quiser decidir não faz nada: o padrão vale. No fim da semana, o
// relatório mostra o efeito de cada escolha. Catálogo: negociar contrato (pedir mais ou dar carência a uma
// âncora), composição por pesquisa (anunciar vaga para um ramo), ponto crítico de lotação (entrada auxiliar
// ou seguranças na entrada), limpeza (mutirão ou horário antes do pico), segurança (ronda reforçada e
// ocorrências leves), manutenção programada por desgaste, preparação de evento (reforço ou fila organizada),
// campanha e agenda de eventos. Depois de decidir 3 vezes numa área, dá para entregar a área a uma política.
// Opção paga é cobrada na hora da escolha (entra no resultado da semana) e trava a decisão.
// Nenhuma janela obrigatória: a reunião aparece no cartão do shopping, na missão e na lista acessível.
// =====================================================================
const R14 = { anuncio: 150, entrada: 120, entradaCap: 0.15, segEntradaCap: 0.08, segEntradaSat: -0.02, mutirao: 100, programada: 90, reforcoPessoa: 80, reforcoN: 2, fila: 150, ronda: 60,
  desgaste: [1 / 300, 1 / 700, 1 / 1500], ocorrChance: 0.4, ocorrEspera: 20, ocorrSat: -0.05, ocorrDur: 25, negociarMais: 0.1, carencia: 2, deleg: 3 };
const r14Ativo = () => SH_ATIVO && (FASE === "brisa" || (typeof operando === "function" && operando()));
const reforcoN = () => FASE === "grande" ? 4 : R14.reforcoN;
const R14_META = 4;                                                      // reuniões decididas pelo jogador para a meta do capítulo
const decididas = () => (S.shop && S.shop.r14 && S.shop.r14.decididas) || 0;
const AREA_NOME = { contratos: "Contratos", operacao: "Operação", calendario: "Calendário" };
const POL_NOME = { contratos: "Política de locação: aceitar sozinho bons pagadores de ramos em falta", operacao: "Supervisor de operação: resolve lotação, limpeza, ocorrências e manutenção", calendario: "Produtor de eventos: aplica o reforço quando o público previsto passa da capacidade" };
const CAT_PROCURA = ["alimentacao", "moda", "lazer", "servicos", "eletronicos", "quiosque"];
const CAT_IC = { servicos: "💊", alimentacao: "🍽️", eletronicos: "🎧", moda: "👗", lazer: "🎬", quiosque: "🛍️" };
function r14() {
  const s = sh(); if (!s.r14) s.r14 = { sem: null, dec: [], manual: { contratos: 0, operacao: 0, calendario: 0 }, pol: { contratos: false, operacao: false, calendario: false }, desg: {}, anuncio: null, ocorr: null, ocorrSem: null, hist: [], sujSoma: 0, sujT: 0, recAnt: null, sujAnt: null };
  const r = s.r14; lay().equip.forEach(q => { if (r.desg[q.id] == null) r.desg[q.id] = 0.15 + 0.1 * lay().equip.indexOf(q); }); return r;
}
const decisao = tipo => r14().dec.find(d => d.tipo === tipo);
const escolha = tipo => { const d = decisao(tipo); return d && r14Ativo() ? d.opcoes[d.esc].id : null; };
const maxDesg = () => { const r = r14(); return Math.max(0, ...Object.values(r.desg)); };
// ---------- geração da reunião ----------
function catsFaltando() { const L = lojasSh(), tem = categoriasAtivas(L); return CAT_PROCURA.filter(c => !tem.includes(c) && L.unidades.some(u => !u.ocup && TAMANHOS[u.tam].ramos.some(r => RAMOS[r].cat === c))); }
function decContratos() {
  const L = lojasSh(), props = L.propostas.filter(p => !p.renovacao).sort((a, b) => b.aluguel - a.aluguel);
  if (props.length) { const p = props[0], u = L.unidades.find(x => x.id === p.unidade), anc = u && u.tam === "ancora";
    return { tipo: "negociar", area: "contratos", titulo: `Negociar com ${p.nome}`, txt: `${RAMOS[p.ramo].nome} oferece M ${fmt(p.aluguel)} por semana${p.pct ? ` + ${Math.round(p.pct * 100)}% das vendas` : ""}. Ocupação agora ${pctTxt(taxaOcupacao(L))}: quanto mais cheio o shopping, mais o lojista resiste a pagar mais.`, dados: { prop: p.id },
      opcoes: [{ id: "normal", rot: "Seguir com Aceitar ou Recusar", desc: "A proposta continua na lista, como sempre." },
        { id: "mais", rot: `Pedir ${Math.round(R14.negociarMais * 100)}% a mais`, desc: `Se topar, assina já com M ${fmt(Math.round(p.aluguel * (1 + R14.negociarMais)))}. Chance de desistir: cerca de ${Math.round(chanceDesistir() * 100)}%.`, agora: true },
        ...(anc ? [{ id: "carencia", rot: `Oferecer carência de ${R14.carencia} semanas`, desc: "A âncora assina já e paga só a % das vendas nas primeiras semanas; âncora aberta traz muito público.", agora: true }] : [])] }; }
  const falta = catsFaltando();
  if (falta.length) { const c = falta[0];
    return { tipo: "composicao", area: "contratos", titulo: "Pesquisa com os visitantes", txt: `Os visitantes mais procuram: ${falta.slice(0, 3).map(x => CAT_IC[x] + " " + CAT_NOME[x].toLowerCase()).join(", ")}. Os balões no cenário mostram o que falta.`, dados: { cat: c },
      opcoes: [{ id: "acaso", rot: "Deixar as propostas virem ao acaso", desc: "Nenhum custo." }, { id: "anunciar", rot: `Anunciar vaga para ${CAT_NOME[c].toLowerCase()} (M ${R14.anuncio})`, desc: "As próximas 2 propostas para lojas vagas vêm desse ramo, quando couber.", custo: R14.anuncio }] }; }
  return null;
}
const chanceDesistir = () => Math.min(0.7, 0.15 + 0.5 * taxaOcupacao(lojasSh()));
function decOperacao() {
  const s = sh(), r = r14(), ult = s.dias[0], Y = lay();
  const eqPior = Object.keys(r.desg).sort((a, b) => r.desg[b] - r.desg[a])[0], q = Y.equip.find(x => x.id === eqPior);
  const cand = [];
  if (r.desg[eqPior] >= 0.6 && s.manut < 2 && !s.panes.some(p => p.id === eqPior))
    cand.push({ tipo: "manutencao", area: "operacao", titulo: `${q.nome}: sinal de desgaste`, txt: `Desgaste ${Math.round(r.desg[eqPior] * 100)}%. Equipamento gasto quebra mais (conserto avulso M ${SH_CFG.conserto} e satisfação em queda).`, dados: { eq: eqPior },
      opcoes: [{ id: "esperar", rot: "Esperar", desc: "Sem custo agora; o risco de pane continua subindo." }, { id: "programada", rot: `Manutenção programada fora do horário (M ${R14.programada})`, desc: "Feita à noite, no fechamento desta semana: o desgaste volta a zero.", custo: R14.programada }] });
  if (ult && (ult.recusa > 0.03 || ult.picoDentro >= ult.cap * 0.9))
    cand.push({ tipo: "lotacao", area: "operacao", titulo: "Ponto crítico: entrada lotada", txt: `Semana passada: pico de ${ult.picoDentro} pessoas para ${ult.cap} lugares e ${ult.recusados} recusados.`, dados: {},
      opcoes: [{ id: "nada", rot: "Deixar como está", desc: "Sem custo." }, { id: "entrada", rot: `Abrir a entrada auxiliar (M ${R14.entrada})`, desc: `+${Math.round(R14.entradaCap * 100)}% de capacidade nesta semana.`, custo: R14.entrada },
        { id: "seguranca", rot: "Deslocar seguranças para a entrada", desc: `Grátis: +${Math.round(R14.segEntradaCap * 100)}% de capacidade, mas menos ronda (satisfação ${Math.round(R14.segEntradaSat * 100)} pontos).` }] });
  if (r.sujAnt != null && r.sujAnt >= 0.3)
    cand.push({ tipo: "limpeza", area: "operacao", titulo: "Limpeza da praça", txt: `Sujeira média da semana passada: ${Math.round(r.sujAnt * 100)}%. As manchas no chão aparecem no cenário.`, dados: {},
      opcoes: [{ id: "manter", rot: "Manter a escala", desc: "Sem custo." }, { id: "mutirao", rot: `Mutirão no horário de pico (M ${R14.mutirao})`, desc: "Limpa tudo quando o pico começa e segura a sujeira durante ele.", custo: R14.mutirao },
        { id: "antes", rot: "Limpeza antes do pico", desc: "Grátis: menos sujeira no pico, um pouco mais fora dele." }] });
  cand.push({ tipo: "seguranca", area: "operacao", titulo: "Escala da segurança", txt: "Ocorrências leves (criança perdida, discussão na fila) acontecem de vez em quando. Com ronda reforçada, são resolvidas na hora.", dados: {},
    opcoes: [{ id: "normal", rot: "Ronda normal", desc: "Sem custo. Se houver ocorrência, você escolhe na hora (ou a ronda resolve devagar)." }, { id: "reforcada", rot: `Ronda reforçada (M ${R14.ronda})`, desc: "Ocorrências desta semana resolvidas na hora, sem queda de satisfação.", custo: R14.ronda }] });
  // um assunto de operação por semana, sem repetir o da semana anterior quando houver outro
  const d = cand.find(c => c.tipo !== r.ultOp) || cand[0]; r.ultOp = d.tipo; return d;
}
function decCalendario() {
  const s = sh(), ev = s.eventos[S.day] && EVENTOS.find(e => e.id === s.eventos[S.day]);
  if (ev) { const prev = ev.publico + Math.round(capacidade() * 0.6);
    return { tipo: "evento", area: "calendario", titulo: `Preparar: ${ev.nome}`, txt: `Previsão: cerca de ${prev} pessoas ao longo da semana no shopping, ${ev.publico} só do evento, para ${capacidade()} lugares ao mesmo tempo. O evento pede ${ev.seguranca} seguranças (você tem ${s.seguranca}).`, dados: { ev: ev.id },
      opcoes: [{ id: "nada", rot: "Sem preparação extra", desc: "Sem custo." }, { id: "reforco", rot: `Reforço temporário (M ${R14.reforcoPessoa * reforcoN() * 2})`, desc: `+${reforcoN()} na limpeza e +${reforcoN()} na segurança só nesta semana.`, custo: R14.reforcoPessoa * reforcoN() * 2 },
        { id: "fila", rot: `Fila organizada no átrio (M ${R14.fila})`, desc: "Metade do público do evento que seria recusado espera na fila e entra.", custo: R14.fila }] }; }
  for (const k of [0, 1]) { const dia = S.day + k, c = campanhaDa(semana(dia));
    if (c && !s.campanhas[dia] && (k > 0 || S.dayT < DAY_LEN * 0.5)) return { tipo: "campanha", area: "calendario", titulo: `Campanha: ${c.nome}`, txt: `Semana ${semana(dia)}: +${Math.round(c.fluxo * 100)}% de movimento e +${Math.round(c.gasto * 100)}% de gasto em ${c.cats.map(x => CAT_NOME[x].toLowerCase()).join(", ")}.`, dados: { dia },
      opcoes: [{ id: "nao", rot: "Não fazer", desc: "Sem custo." }, { id: "fazer", rot: `Fazer a campanha (M ${fmt(c.custo)})`, desc: "Agenda agora; vale na semana da data.", agora: true }] }; }
  if (!Object.keys(s.eventos).some(d => +d > S.day && +d <= S.day + 3))
    return { tipo: "agenda", area: "calendario", titulo: "Agenda da praça de eventos", txt: "Nenhum evento nas próximas 3 semanas. Eventos trazem público e receita de ingressos.", dados: { dia: S.day + 1 },
      opcoes: [{ id: "nao", rot: "Agora não", desc: "Sem custo." }, { id: "feira", rot: `Feira de artesanato na próxima semana (M ${fmt(EVENTOS[0].custo)})`, desc: "Público fiel, baixo custo.", agora: true }, { id: "parque", rot: `Parque infantil na próxima semana (M ${fmt(EVENTOS[1].custo)})`, desc: "Atrai famílias; pede 3 seguranças.", agora: true }] };
  return null;
}
function novaReuniao() {
  const r = r14(); r.sem = S.day; r.dec = [decContratos(), decOperacao(), decCalendario()].filter(Boolean).map(d => Object.assign(d, { esc: 0, conf: false, feito: null, efeito: "" }));
  r.ocorrSem = Math.random() < R14.ocorrChance ? (0.2 + Math.random() * 0.5) * DAY_LEN : null; r.ocorr = null; r.ocorrRes = null;
  r.dec.forEach(d => { if (r.pol[d.area]) aplicarPolitica(d); });
  const pend = r.dec.filter(d => !d.conf).length;
  if (pend) { banner(`🗂️ Reunião da semana: ${pend} decisão(ões)`, "#0f6e7a"); anunciar(`Reunião da semana ${semana()}: ${pend} decisão(ões). Abra a reunião no cartão do shopping ou siga o padrão.`); }
  lastSig = "";
}
// ---------- escolhas ----------
function escolher(tipo, idx, porPolitica) {
  const r = r14(), d = decisao(tipo); if (!d || d.conf || !d.opcoes[idx]) return false;
  const o = d.opcoes[idx];
  if (o.custo && !pagarContratacao(o.custo, o.rot.toLowerCase())) return false;
  d.esc = idx; d.conf = true; d.porPolitica = !!porPolitica;
  if (o.agora) executarAgora(d, o);
  if (o.id === "anunciar") r.anuncio = { cat: d.dados.cat, restam: 2, recebidas: 0 };
  if (idx !== 0 && !porPolitica) { r.manual[d.area]++; if (r.manual[d.area] === R14.deleg && decididas() >= R14_META) toast(`${AREA_NOME[d.area]}: agora dá para entregar esta área a uma política na reunião.`); }
  if (!porPolitica) anunciar(`${d.titulo}: ${o.rot}.`);
  save(); lastSig = ""; renderSheet(); return true;
}
function executarAgora(d, o) {
  const L = lojasSh();
  if (d.tipo === "negociar") { const p = L.propostas.find(x => x.id === d.dados.prop);
    if (!p) { d.feito = "A proposta já tinha expirado."; return; }
    if (o.id === "mais") { if (Math.random() < chanceDesistir()) { recusarProposta(L, p.id); d.feito = `${p.nome} não aceitou pagar mais e desistiu.`; banner(`🤝 ${p.nome} desistiu`, "#b7773b"); }
      else { p.aluguel = Math.round(p.aluguel * (1 + R14.negociarMais)); const ok = aceitarProposta(L, p.id); d.feito = ok ? `${p.nome} topou: M ${fmt(p.aluguel)} por semana.` : "A unidade já tinha sido ocupada."; if (ok) banner(`🤝 ${p.nome} assinou por M ${fmt(p.aluguel)}`, "#2e7a57"); } }
    else if (o.id === "carencia") { const ok = aceitarProposta(L, p.id), u = ok && L.unidades.find(x => x.id === p.unidade);
      if (u && u.ocup) { u.ocup.carencia = R14.carencia; d.feito = `${p.nome} assinou com ${R14.carencia} semanas de carência.`; banner(`🤝 ${p.nome} assinou com carência`, "#2e7a57"); } else d.feito = "A unidade já tinha sido ocupada."; }
  } else if (d.tipo === "campanha") d.feito = agendarCampanha(d.dados.dia) ? "Campanha agendada." : "Não deu para agendar (falta dinheiro ou já passou).";
  else if (d.tipo === "agenda") d.feito = agendarEvento(d.dados.dia, o.id) ? `${EVENTOS.find(e => e.id === o.id).nome} agendado.` : "Não deu para agendar (falta dinheiro).";
}
function seguirPadrao() { r14().dec.forEach(d => { if (!d.conf) { d.conf = true; d.esc = 0; } }); anunciar("Reunião: todas as decisões seguem o padrão."); save(); lastSig = ""; renderSheet(); }
function aplicarPolitica(d) {
  const ix = id => Math.max(0, d.opcoes.findIndex(o => o.id === id)), s = sh();
  let k = 0;
  if (d.tipo === "manutencao") k = ix("programada");
  else if (d.tipo === "lotacao") k = S.money > 2000 ? ix("entrada") : ix("seguranca");
  else if (d.tipo === "limpeza") k = ix("antes");
  else if (d.tipo === "evento") { const ev = EVENTOS.find(e => e.id === d.dados.ev); k = s.seguranca < ev.seguranca || ev.publico > capacidade() ? ix("reforco") : 0; }
  if (k && !escolher(d.tipo, k, true)) k = 0;
  if (!k) { d.conf = true; d.esc = 0; d.porPolitica = true; }
}
function alternarPolitica(area) { const r = r14(); if (r.manual[area] < R14.deleg || (r.decididas || 0) < R14_META) return; r.pol[area] = !r.pol[area]; toast(r.pol[area] ? POL_NOME[area] + "." : `${AREA_NOME[area]}: você volta a decidir.`); save(); lastSig = ""; renderSheet(); }
// ---------- ocorrência leve de segurança ----------
function resolverOcorrencia(atender) {
  const r = r14(), o = r.ocorr; if (!o || o.res) return;
  o.res = atender ? "atendida" : "ronda"; o.t = 0;
  if (atender) { toast(`${o.nome}: um segurança resolveu na hora.`); r.ocorrRes = "atendida na hora"; } else { r.ocorrRes = "a ronda resolveu devagar (satisfação caiu um pouco)"; }
  lastSig = ""; renderSheet();
}
const OCORR = [{ nome: "Criança perdida no corredor", ic: "🧒" }, { nome: "Discussão na fila da praça de alimentação", ic: "🗣️" }, { nome: "Carrinho de bebê preso na porta", ic: "🚼" }];
// ---------- efeitos ligados ao SH_MOD ----------
Object.assign(SH_MOD, {
  cap: () => escolha("lotacao") === "entrada" ? 1 + R14.entradaCap : escolha("lotacao") === "seguranca" ? 1 + R14.segEntradaCap : 1,
  extraLimpeza: () => escolha("evento") === "reforco" ? reforcoN() : 0,
  extraSeg: () => escolha("evento") === "reforco" ? reforcoN() : 0,
  sat: () => { if (!r14Ativo()) return 0; const r = r14(); let v = escolha("lotacao") === "seguranca" ? R14.segEntradaSat : 0; if (r.ocorr && r.ocorr.res !== "atendida" && (!r.ocorr.res || r.ocorr.t < R14.ocorrDur)) v += r.ocorr.res === "ronda" ? R14.ocorrSat : 0; return v; },
  sujeira: () => { if (!r14Ativo()) return 1; const e = escolha("limpeza"), pico = isRush(); return e === "mutirao" && pico ? 0.6 : e === "antes" ? (pico ? 0.7 : 1.25) : 1; },
  paneMult: () => r14Ativo() ? 0.4 + 1.2 * maxDesg() : 1,
  escolherPane: livres => { if (!r14Ativo()) return sorteio(livres); const r = r14(), tot = livres.reduce((a, q) => a + 0.1 + r.desg[q.id], 0); let x = Math.random() * tot; return livres.find(q => (x -= 0.1 + r.desg[q.id]) <= 0) || livres[0]; },
  deixarEntrar: evento => { if (!evento || escolha("evento") !== "fila") return false; const r = r14(); r.filaN = (r.filaN || 0) + 1; return r.filaN % 2 === 0; },
  tick(dt) {
    if (!r14Ativo()) return;
    const r = r14(), s = sh();
    if (r.sem !== S.day) novaReuniao();
    // desgaste dos equipamentos (o contrato completo também revisa à noite)
    const taxa = R14.desgaste[s.manut]; Object.keys(r.desg).forEach(k => { if (!s.panes.some(p => p.id === k)) r.desg[k] = Math.min(1, r.desg[k] + taxa * dt); });
    // mutirão: zera a sujeira quando o pico começa
    if (escolha("limpeza") === "mutirao" && isRush() && !r.mutiraoFeito) { r.mutiraoFeito = true; s.sujeira = 0; banner("🧹 Mutirão de limpeza na praça", "#2e7a57"); }
    r.sujSoma += Math.min(1, s.sujeira / 60) * dt; r.sujT += dt;
    // ocorrência leve
    if (r.ocorrSem != null && !r.ocorr && S.dayT >= r.ocorrSem) { const o = OCORR[Math.floor(Math.random() * OCORR.length)]; r.ocorr = Object.assign({ t: 0, res: null }, o);
      if (escolha("seguranca") === "reforcada" || r.pol.operacao) resolverOcorrencia(true);
      else { banner(`${o.ic} ${o.nome}`, "#b7773b"); anunciar(`${o.nome}. Atender agora com um segurança ou deixar a ronda resolver? Veja a reunião da semana.`); lastSig = ""; } }
    if (r.ocorr) { r.ocorr.t += dt; if (!r.ocorr.res && r.ocorr.t >= R14.ocorrEspera) resolverOcorrencia(false); }
    // política de locação: aceita sozinha bons pagadores de ramos em falta (a cada 3 s)
    if (r.pol.contratos) { r.tPol = (r.tPol || 0) + dt; if (r.tPol > 3) { r.tPol = 0; const L = lojasSh(), tem = categoriasAtivas(L);
      L.propostas.filter(p => !p.renovacao && p.risco < 0.035 && (!tem.includes(RAMOS[p.ramo].cat) || taxaOcupacao(L) < 0.8)).slice(0, 1).forEach(p => { if (aceitarProposta(L, p.id)) banner(`🤝 Política de locação: ${p.nome} assinou`, "#2e7a57"); }); } }
  },
  fechar() {
    if (!r14Ativo()) return;
    const r = r14(), d = decisao("manutencao");
    if (d && d.opcoes[d.esc].id === "programada") { r.desg[d.dados.eq] = 0; S.today.linhas = (S.today.linhas || []).concat([[`Manutenção programada: ${lay().equip.find(q => q.id === d.dados.eq).nome.toLowerCase()}`, "feita à noite"]]); }
    if (sh().manut === 2) Object.keys(r.desg).forEach(k => { if (r.desg[k] >= 0.5) r.desg[k] = 0.1; });
  },
  fimSemana(reg) {
    if (!r14Ativo()) return;
    const r = r14(), suj = r.sujT ? r.sujSoma / r.sujT : 0, linhas = [];
    r.dec.forEach(d => { const o = d.opcoes[d.esc]; let ef = d.feito || "";
      if (d.tipo === "lotacao") ef = `${reg.recusados} recusados (semana anterior: ${r.recAnt != null ? r.recAnt : "?"}); capacidade ${reg.cap}.`;
      else if (d.tipo === "limpeza") ef = `Sujeira média ${Math.round(suj * 100)}% (antes ${Math.round((r.sujAnt || 0) * 100)}%).`;
      else if (d.tipo === "manutencao") ef = o.id === "programada" ? "Desgaste zerado; risco de pane menor." : `Desgaste em ${Math.round((r.desg[d.dados.eq] || 0) * 100)}%.`;
      else if (d.tipo === "evento") ef = `Público do evento ${sh().hoje.evPublico}, recusados ${sh().hoje.evRecusados}, satisfação ${pctTxt(reg.sat)}.`;
      else if (d.tipo === "composicao") ef = o.id === "anunciar" ? `${r.anuncio ? r.anuncio.recebidas : 0} proposta(s) de ${CAT_NOME[d.dados.cat].toLowerCase()} recebida(s).` : "Propostas ao acaso.";
      else if (d.tipo === "seguranca") ef = r.ocorrRes ? `Ocorrência: ${r.ocorrRes}.` : "Nenhuma ocorrência.";
      linhas.push(`${d.titulo}: ${o.rot.toLowerCase()}${d.porPolitica ? " (política)" : d.conf ? "" : " (padrão)"}. ${ef}`.trim()); });
    if (!r.dec.some(d => d.tipo === "seguranca") && r.ocorrRes) linhas.push(`Ocorrência: ${r.ocorrRes}.`);
    const voce = r.dec.length && r.dec.every(d => d.conf && !d.porPolitica);
    if (voce) r.decididas = (r.decididas || 0) + 1;
    else linhas.push(r.dec.some(d => d.porPolitica) ? "Reunião com política: não conta para a meta de reuniões decididas por você." : "Reunião sem a sua decisão: valeu o padrão e a semana não contou para a meta.");
    r.hist.unshift({ semana: reg.semana, linhas }); r.hist.length = Math.min(r.hist.length, 4);
    r.recAnt = reg.recusados; r.sujAnt = suj; r.sujSoma = 0; r.sujT = 0; r.mutiraoFeito = false; r.filaN = 0;
    if (r.anuncio && r.anuncio.restam <= 0) r.anuncio = null;
    reg.reuniao = linhas;
  },
  desenhar() {
    if (!r14Ativo()) return;
    const r = r14(), Y = lay();
    Y.equip.forEach(q => { if (r.desg[q.id] >= 0.6 && !sh().panes.some(p => p.id === q.id)) { ctx.strokeStyle = "#e0a100"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 10, 0, 7); ctx.stroke(); } });
    const lo = escolha("lotacao"), fila = escolha("evento") === "fila";
    if (lo === "entrada") { rr(Y.entrada.x + 46, H - 8, 34, 8, 2, "#9ad0ec"); text("AUXILIAR", Y.entrada.x + 63, H + 12, 5.6, "#0f6e7a", "center", 800); }
    if (lo || fila) for (let i = 0; i < 4; i++) { const x = Y.entrada.x - 30 + i * 20, y = H - 16; ctx.fillStyle = "#f57c00"; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 4, y + 2); ctx.lineTo(x - 4, y + 2); ctx.fill(); }
    if (r.ocorr && !r.ocorr.res) emoji(r.ocorr.ic, Y.x0 + (Y.x1 - Y.x0) * 0.6, Y.corY + 12, 12);
    const comp = decisao("composicao"); if (comp && r14Ativo()) { const ic = CAT_IC[comp.dados.cat]; visitantes.forEach((v, i) => { if (i % 5 === 0 && v.estado !== "dentro") { rr(v.x - 7, v.y - 44, 14, 12, 6, "#fff"); emoji(ic, v.x, v.y - 38, 7); } }); }
  },
});
// anúncio de vaga: as próximas propostas comuns vêm do ramo anunciado, quando houver unidade vaga que caiba
{ const g0 = gerarProposta;
  gerarProposta = function (L, cfg, renovar) {
    const r = SH_ATIVO && S.shop && S.shop.r14;
    if (!renovar && r && r.anuncio && r.anuncio.restam > 0 && L === S.lojasSh) {
      const ramos = Object.keys(RAMOS).filter(k => RAMOS[k].cat === r.anuncio.cat);
      if (L.unidades.some(u => !u.ocup && !L.propostas.some(q => q.unidade === u.id) && TAMANHOS[u.tam].ramos.some(x => ramos.includes(x))))
        for (let i = 0; i < 12; i++) { const p = g0(L, Object.assign({}, cfg, { ramos }), renovar); if (p) { r.anuncio.restam--; r.anuncio.recebidas++; return p; } }
    }
    return g0(L, cfg, renovar);
  };
}
// conserto zera o desgaste daquele equipamento
{ const c0 = consertar; consertar = function (id) { const antes = sh().panes.length; c0(id); if (sh().panes.length < antes && S.shop.r14) S.shop.r14.desg[id] = 0; }; }
// ---------- painel da reunião ----------
function cartaoDecisao(d) {
  const c = el("div", "card", `<h3>${AREA_NOME[d.area]}: ${d.titulo}</h3><p class="note">${d.txt}</p>`);
  d.opcoes.forEach((o, i) => {
    const marcado = d.esc === i, b = el("button", marcado ? "btn mini" : "plain mini", `<span>${marcado ? "✓ " : ""}${o.rot}${i === 0 ? " (padrão)" : ""}</span>`);
    b.setAttribute("aria-pressed", String(marcado)); b.setAttribute("aria-label", `${o.rot}${i === 0 ? ", resposta padrão" : ""}. ${o.desc}`);
    if (d.conf) b.disabled = true; else b.onclick = () => escolher(d.tipo, i);
    c.appendChild(b); c.appendChild(el("p", "note", o.desc));
  });
  if (d.conf) c.appendChild(el("p", "note", `<span class="tag bom">${d.porPolitica ? "Decidido pela política" : "Decidido"}</span> ${d.feito || ""}`));
  return c;
}
function buildReuniao(body) {
  const r = r14();
  head("🗂️", "#dff0f1", `Reunião da semana ${semana()}`, () => { const n = r.dec.filter(d => !d.conf).length; return n ? `${n} decisão(ões) em aberto · sem a sua escolha vale o padrão e a semana não conta` : "Tudo decidido nesta semana"; });
  if (!r14Ativo()) { body.appendChild(el("p", "note", "A reunião começa quando o shopping estiver aberto.")); return; }
  if (r.ocorr && !r.ocorr.res) { const c = el("div", "card", `<h3>${r.ocorr.ic} Agora: ${r.ocorr.nome}</h3><p class="note">Se ninguém atender em ${Math.max(0, Math.ceil(R14.ocorrEspera - r.ocorr.t))} s, a ronda resolve devagar e a satisfação cai um pouco.</p>`);
    const g = el("div", "linha2"), a = el("button", "btn mini", "Atender agora"), d = el("button", "plain mini", "<span>Deixar a ronda</span>");
    a.onclick = () => resolverOcorrencia(true); d.onclick = () => resolverOcorrencia(false); g.appendChild(a); g.appendChild(d); c.appendChild(g); body.appendChild(c); }
  if (!r.dec.length) body.appendChild(el("p", "note", "Nenhuma decisão nesta semana."));
  r.dec.forEach(d => body.appendChild(cartaoDecisao(d)));
  body.appendChild(el("div", "sec-title", "Delegar"));
  Object.keys(AREA_NOME).forEach(a => { const lib = r.manual[a] >= R14.deleg && (r.decididas || 0) >= R14_META;
    const b = el("button", "plain toggle", `<span>${POL_NOME[a]}: <b>${lib ? (r.pol[a] ? "sim" : "não") : (r.decididas || 0) < R14_META ? `libera depois de ${R14_META} reuniões decididas por você (${r.decididas || 0})` : `libera depois de ${R14.deleg} decisões suas fora do padrão (${r.manual[a]})`}</b></span>`);
    b.setAttribute("aria-pressed", String(!!r.pol[a])); if (lib) b.onclick = () => alternarPolitica(a); else b.disabled = true; body.appendChild(b); });
  if (r.hist.length) { body.appendChild(el("div", "sec-title", "Efeito das decisões"));
    r.hist.slice(0, 2).forEach(h => body.appendChild(el("div", "card", `<h3>Semana ${h.semana}</h3>${h.linhas.map(l => `<p class="note">${l}</p>`).join("") || '<p class="note">Sem decisões.</p>'}`))); }
}
const pendentesReuniao = () => r14Ativo() ? r14().dec.filter(d => !d.conf).length : 0;
if (SH_ATIVO) {
  PAINEIS.reuniao = buildReuniao;
  const cs0 = cartaoShopping;
  cartaoShopping = function () { const c = cs0(); if (!r14Ativo()) return c;
    const b = el("button", "btn", "Reunião da semana"); const atual = () => { const n = pendentesReuniao(), oc = r14().ocorr && !r14().ocorr.res; b.textContent = oc ? "Reunião da semana: ocorrência agora" : n ? `Reunião da semana (${n} em aberto)` : "Reunião da semana: decidido"; };
    live(atual); b.onclick = () => openSheet("reuniao"); c.appendChild(b); return c; };
  const m0 = FASE_CFG.brisa.missao;
  FASE_CFG.brisa.missao = function () {
    const r = r14Ativo() ? r14() : null;
    if (r && r.ocorr && !r.ocorr.res) return { title: `${r.ocorr.ic} ${r.ocorr.nome}`, sub: "Atender agora ou deixar a ronda", p: 0, ring: "🛡️", go: () => openSheet("reuniao") };
    const m = m0.call(this); if (m) return m;
    const n = pendentesReuniao(); return n ? { title: `Reunião da semana: ${n} decisão(ões)`, sub: "Escolha cada uma: o padrão sozinho não conta", p: 0, ring: "🗂️", go: () => openSheet("reuniao") } : null;
  };
  const a0 = GANCHOS.assinatura;
  GANCHOS.assinatura = () => { const r = S.shop && S.shop.r14; return (a0 ? a0() : "") + (r ? `|r14${r.sem}${r.dec.map(d => d.tipo + d.esc + d.conf).join(",")}${r.ocorr ? r.ocorr.res || "o" : ""}${JSON.stringify(r.pol)}${r.hist.length}` : ""); };
  const ls0 = GANCHOS.listaShopping;
  GANCHOS.listaShopping = body => { ls0(body); body.appendChild(listaRow("🗂️", "#dff0f1", "Reunião da semana", () => { const r = r14(); return r14Ativo() ? `${pendentesReuniao()} em aberto${r.ocorr && !r.ocorr.res ? `; agora: ${r.ocorr.nome}` : ""}` : "começa com o shopping aberto"; }, { kind: "shReuniao" })); };
  gancho("painel", (sel, body) => { if (sel.kind === "shReuniao") { buildReuniao(body); return true; } return null; });
  gancho("bRect", sel => sel.kind === "shReuniao" ? { x: 0, y: 30, w: W, h: H - 26 } : null);
}
