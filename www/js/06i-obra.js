"use strict";
// =====================================================================
// Capítulo 8 (Maricá Grande Shopping): licenças, obra, preparação e inauguração; depois, a operação
// usa o motor do shopping (06h) num prédio maior, com três âncoras.
// Etapas:
//   1. Licenças: estudo de impacto, licença prévia, audiência pública (com compromissos), licença de
//      instalação e, no fim da obra, vistoria dos bombeiros e habite-se. Cada uma custa e leva dias.
//   2. Obra: turmas e guindaste aceleram; material é pago conforme a obra avança; chuva pode parar
//      (lona protege) e falta de drenagem pode embargar (compensação ambiental previne).
//   3. Preparação (a partir de 50%): pré-locação das lojas, equipe operacional e divulgação.
//   4. Inauguração: cerimônia com convidados (cargos genéricos e fictícios); relatório de público,
//      custos e satisfação. A partir daí o shopping opera e as metas finais valem.
// Nomes de pessoas e órgãos não são citados: só funções (prefeitura, associação comercial...).
// =====================================================================
const OB_CFG = {
  licencas: [
    { id: "estudo", nome: "Estudo de impacto de vizinhança", custo: 2000, dias: 1.5, req: [] },
    { id: "previa", nome: "Licença ambiental prévia", custo: 1500, dias: 1.5, req: ["estudo"] },
    { id: "audiencia", nome: "Audiência pública com a vizinhança", custo: 600, dias: 1, req: ["estudo"] },
    { id: "instalacao", nome: "Licença de instalação (libera a obra)", custo: 1500, dias: 1.5, req: ["previa", "audiencia"] },
    { id: "habite", nome: "Vistoria dos bombeiros e habite-se", custo: 1200, dias: 1, req: ["instalacao"], fimObra: true },
  ],
  compromissos: [
    { id: "onibus", nome: "Abrigo de ônibus e faixa de pedestres", custo: 1200, apoio: 0.25 },
    { id: "ciclovia", nome: "Trecho de ciclovia até a lagoa", custo: 1800, apoio: 0.3 },
    { id: "drenagem", nome: "Compensação ambiental e drenagem", custo: 2200, apoio: 0.25, previneEmbargo: true },
  ],
  turma: { contratar: 400, diaria: 140, max: 4, ritmo: 0.11 }, guindaste: { diaria: 180, mult: 1.45 }, lona: 900,
  materialPorPct: 210, chuva: 1 / 110, chuvaDur: 18, embargo: 1 / 260, embargoConserto: 2500,
  divulgacao: [900, 1400, 2000], cerimonia: 1500,
  convidados: [
    { id: "prefeitura", nome: "Representante da prefeitura", custo: 300, publico: 40, sat: 0.02 },
    { id: "turismo", nome: "Secretaria de turismo", custo: 200, publico: 25, sat: 0.01 },
    { id: "associacao", nome: "Associação comercial", custo: 150, publico: 20, sat: 0.02 },
    { id: "escola", nome: "Banda da escola municipal", custo: 250, publico: 35, sat: 0.04 },
  ],
  preLocacao: 0.6, equipe: 6,
  // 1.3: obra parada não paga diária (só a guarda do canteiro); chuva paga meia diária; cada contrato de
  // pré-locação assinado paga um sinal de uma semana de aluguel; resgate de partidas presas de versões anteriores
  guarda: 40, chuvaDiaria: 0.5, sinalSemanas: 1, resgateMargem: 0.1, resgateMin: 500,
};
const OB_ATIVO = NA_CARREIRA && FASE === "grande";
const novaObra = () => ({ fase: "licencas", lic: {}, compromissos: {}, apoio: 0.4, pct: 0, turmas: 1, guindaste: false, lona: false, chuva: 0, embargo: false, divulgacao: 0, convidados: {}, inauguracao: null, relInaug: null, gasto: 0, hoje: novoHojeOb(), pausada: false, usarReserva: false, sinais: 0, v13: true });
const novoHojeOb = () => ({ material: 0, tAtiva: 0, tChuva: 0, tParada: 0 });
function ob() { if (!S.obra) S.obra = novaObra(); const o = S.obra; o.lic = o.lic || {}; o.compromissos = o.compromissos || {}; o.convidados = o.convidados || {}; o.hoje = Object.assign(novoHojeOb(), o.hoje || {}); o.sinais = o.sinais || 0; return o; }
const operando = () => ob().fase === "operacao";
const licOk = id => ob().lic[id] && ob().lic[id].ok;
const licEmAndamento = id => ob().lic[id] && !ob().lic[id].ok;
const licencasOk = () => OB_CFG.licencas.filter(l => licOk(l.id)).length;
const obraLiberada = () => licOk("instalacao") && !ob().embargo;
const preLocada = () => taxaOcupacao(lojasSh());
const ancorasOk = () => ocupadas(lojasSh()).filter(u => u.tam === "ancora").length;
function etapaObra() { const p = ob().pct; return p < 25 ? "Fundação" : p < 60 ? "Estrutura" : p < 85 ? "Cobertura e fachada" : p < 100 ? "Acabamento" : "Obra concluída"; }

// ---------- 1.3: previsão de caixa, reserva para abrir, pausa e risco visível ----------
const diariaSemana = () => { const o = ob(); return o.turmas * OB_CFG.turma.diaria + (o.guindaste ? OB_CFG.guindaste.diaria : 0); };
const ritmoObra = () => { const o = ob(); return OB_CFG.turma.ritmo * o.turmas * (o.guindaste ? OB_CFG.guindaste.mult : 1); };      // % por segundo
const fatorChuva = () => ob().lona ? 1 : 1 + OB_CFG.chuvaDur * OB_CFG.chuva * OB_CFG.chuvaDiaria;      // diárias extras pagas na chuva, em média
const semanasObra = () => { const o = ob(); return o.pct >= 100 ? 0 : (100 - o.pct) / (ritmoObra() * DAY_LEN); };
function compromissoNecessario() {             // a audiência só aprova com 60% de apoio: o compromisso mais barato que falta
  const o = ob(); if (licOk("audiencia") || o.apoio >= 0.6) return 0;
  const c = OB_CFG.compromissos.filter(x => !o.compromissos[x.id]).map(x => x.custo); return c.length ? Math.min(...c) : 0;
}
function previsaoObra() {
  const o = ob(); if (o.fase === "operacao" || o.fase === "inauguracao") return null;
  const s = sh(), lic = OB_CFG.licencas.filter(L => !o.lic[L.id]).reduce((a, L) => a + L.custo, 0);
  const material = (100 - o.pct) * OB_CFG.materialPorPct;
  const faltaL = Math.max(0, OB_CFG.equipe - s.limpeza), faltaS = Math.max(0, OB_CFG.equipe - s.seguranca);
  const equipe = faltaL * SH_CFG.limpeza.contratar + faltaS * SH_CFG.seguranca.contratar;
  const semAbrir = semanasObra() * (o.lona ? 1 : 1 + OB_CFG.chuvaDur * OB_CFG.chuva) + (licOk("habite") ? 0 : 1) + 1;   // obra + vistoria + semana da festa
  const diarias = semanasObra() * diariaSemana() * fatorChuva();
  const salAtual = s.limpeza * SH_CFG.limpeza.salario + s.seguranca * SH_CFG.seguranca.salario + S.park.staff * (2 + S.tier);
  const salarios = salAtual * semAbrir + (faltaL * SH_CFG.limpeza.salario + faltaS * SH_CFG.seguranca.salario) * 2;
  const compromisso = compromissoNecessario(), convidados = OB_CFG.convidados.filter(c => o.convidados[c.id]).reduce((a, c) => a + c.custo, 0);
  const fixo = lic + equipe + salarios + OB_CFG.cerimonia + compromisso;
  const obrig = Math.round(fixo + material + diarias);
  return { lic, material: Math.round(material), equipe, diarias: Math.round(diarias), salarios: Math.round(salarios), cerimonia: OB_CFG.cerimonia, compromisso, convidados,
    fixo: Math.round(fixo), obrig, semanas: semAbrir, sobra: Math.round(S.money - obrig - convidados) };
}
// o que fica guardado para abrir: tudo menos o material (online também as diárias que faltam, pagas no fechamento)
function reservaAbertura(comDiarias = true) { const p = previsaoObra(); if (!p || ob().usarReserva) return 0; return p.fixo + p.convidados + (comDiarias ? p.diarias : 0); }
function motivoParada() {
  const o = ob();
  if (o.pausada) return "pausa";
  if (o.embargo) return "embargo";
  if (o.chuva > 0) return "chuva";
  if (S.money <= 0) return "dinheiro";
  if (S.money - reservaAbertura() <= 0) return "reserva";
  return null;
}
const MOTIVO_TXT = { pausa: "pausada por você", embargo: "embargada", chuva: "parada pela chuva", dinheiro: "parada sem dinheiro", reserva: "pausada para guardar o dinheiro da abertura" };
function alternarPausa() { const o = ob(); o.pausada = !o.pausada; toast(o.pausada ? `Obra pausada: sem diárias, só a guarda do canteiro (M ${OB_CFG.guarda} por semana).` : "Obra retomada."); save(); lastSig = ""; renderSheet(); }
function alternarReserva() { const o = ob(); o.usarReserva = !o.usarReserva; toast(o.usarReserva ? "A obra pode usar a reserva da abertura. Cuidado: pode faltar para licenças, equipe e cerimônia." : "A obra volta a guardar o dinheiro da abertura."); save(); lastSig = ""; renderSheet(); }
function riscoEmbargo() {                      // chance de embargo até o fim da obra, no ritmo atual (só sem drenagem)
  const o = ob(); if (o.compromissos.drenagem || o.embargo || o.pct >= 100) return 0;
  return 1 - Math.exp(-((100 - Math.max(15, o.pct)) / ritmoObra()) * OB_CFG.embargo);
}
function riscoTxt() {
  const o = ob(), out = [];
  if (o.pct < 100) {
    if (o.compromissos.drenagem) out.push("Embargo: sem risco, a drenagem está garantida.");
    else if (!o.embargo) { const p = riscoEmbargo(); out.push(`Risco de embargo por drenagem até o fim da obra: <b>${p >= 0.6 ? "alto" : p >= 0.3 ? "médio" : "baixo"}</b> (cerca de ${Math.round(p * 100)}% no ritmo atual). Embargo custa M ${fmt(OB_CFG.embargoConserto)}; a compensação ambiental elimina o risco.`); }
    out.push(o.lona ? "Chuva: a cobertura provisória mantém a obra andando." : `Chuva: em média uma parada de ${OB_CFG.chuvaDur} s a cada ${Math.round(1 / OB_CFG.chuva)} s de obra. Na chuva a obra paga meia diária; a cobertura provisória evita as paradas.`);
  }
  return out.join("<br>");
}
// compra opcional que deixaria a abertura sem dinheiro: pergunta antes (o robô de teste chama as funções direto)
function confirmarSeFaltar(custo, oque, fn) {
  const p = previsaoObra(); if (!p || p.sobra - custo >= 0) return fn();
  showModal(`<h2>Vai faltar dinheiro para abrir</h2><p>${oque} custa M ${fmt(custo)}. Depois dessa compra, a previsão de caixa mostra que vão faltar <b>M ${fmt(custo - p.sobra)}</b> para concluir a obra e inaugurar.</p>
    <p>Você pode comprar mesmo assim e cobrir a diferença com os sinais da pré-locação, ou deixar para depois.</p>
    <div class="linha2"><button class="btn" id="cfNao">Deixar para depois</button><button class="plain" id="cfSim"><span>Comprar mesmo assim</span></button></div>`);
  document.getElementById("cfNao").onclick = hideModal;
  document.getElementById("cfSim").onclick = () => { hideModal(); fn(); };
}
function previsaoTxt() {
  const p = previsaoObra(); if (!p) return "";
  const cor = p.sobra < 0 ? "ruim" : p.sobra < p.obrig * 0.08 ? "aviso" : "bom", est = p.sobra < 0 ? "vai faltar dinheiro" : p.sobra < p.obrig * 0.08 ? "apertado" : "dá para abrir";
  return `Saldo agora: <b>M ${fmt(S.money)}</b>. Obrigatório até abrir: <b>M ${fmt(p.obrig)}</b> (material M ${fmt(p.material)}, diárias M ${fmt(p.diarias)}, licenças M ${fmt(p.lic)}${p.compromisso ? `, compromisso para a audiência M ${fmt(p.compromisso)}` : ""}, equipe M ${fmt(p.equipe)}, salários M ${fmt(p.salarios)}, cerimônia M ${fmt(p.cerimonia)}).${p.convidados ? ` Convidados escolhidos: M ${fmt(p.convidados)}.` : ""}
    <br>Sobra prevista: <span class="tag ${cor}">${p.sobra < 0 ? "-" : ""}M ${fmt(Math.abs(p.sobra))} · ${est}</span> · cerca de ${Math.max(1, Math.round(p.semanas))} semana(s) até abrir.${ob().sinais ? ` Sinais de pré-locação recebidos: M ${fmt(ob().sinais)}.` : ""}${p.sobra < 0 ? "<br>Para fechar a conta: devolva turmas ou guindaste, dispense equipe além de 6, desmarque convidados ou peça o aporte da incorporadora (sem juros)." : ""}`;
}

// ---------- ações ----------
function iniciarLicenca(id) {
  const o = ob(), L = OB_CFG.licencas.find(x => x.id === id); if (!L || o.lic[id]) return false;
  if (L.req.some(r => !licOk(r))) { toast(`Antes: ${L.req.filter(r => !licOk(r)).map(r => OB_CFG.licencas.find(x => x.id === r).nome.toLowerCase()).join(" e ")}.`); return false; }
  if (L.fimObra && o.pct < 100) { toast("A vistoria só acontece com a obra concluída."); return false; }
  if (!pagarContratacao(L.custo, L.nome.toLowerCase())) return false;
  o.lic[id] = { ok: false, t: 0 }; anunciar(`${L.nome}: em andamento.`); save(); lastSig = ""; renderSheet(); return true;
}
function assumirCompromisso(id) {
  const o = ob(), c = OB_CFG.compromissos.find(x => x.id === id); if (!c || o.compromissos[id]) return;
  if (!pagarContratacao(c.custo, c.nome.toLowerCase())) return;
  o.compromissos[id] = true; o.apoio = Math.min(1, o.apoio + c.apoio); banner(`🤝 Compromisso: ${c.nome}`, "#6b3fa0"); save(); lastSig = ""; renderSheet();
}
function mudarTurmas(d) {
  const o = ob();
  if (d > 0) { if (o.turmas >= OB_CFG.turma.max) return; if (!pagarContratacao(OB_CFG.turma.contratar, "uma turma de obra")) return; o.turmas++; }
  else if (o.turmas > 1) o.turmas--;
  save(); lastSig = ""; renderSheet();
}
function alternarGuindaste() { const o = ob(); o.guindaste = !o.guindaste; toast(o.guindaste ? `Guindaste alugado: obra ${Math.round((OB_CFG.guindaste.mult - 1) * 100)}% mais rápida, M ${OB_CFG.guindaste.diaria} por dia.` : "Guindaste devolvido."); save(); lastSig = ""; renderSheet(); }
function comprarLona() { const o = ob(); if (o.lona) return; if (!pagarContratacao(OB_CFG.lona, "a cobertura provisória")) return; o.lona = true; toast("Cobertura provisória: a chuva não para mais a obra."); save(); lastSig = ""; renderSheet(); }
function resolverEmbargo() { const o = ob(); if (!o.embargo) return; if (!pagarContratacao(OB_CFG.embargoConserto, "a obra de drenagem exigida")) return; o.embargo = false; o.compromissos.drenagem = true; banner("✅ Embargo suspenso", "#2e7a57"); save(); lastSig = ""; renderSheet(); }
function divulgar() { const o = ob(), c = OB_CFG.divulgacao[o.divulgacao]; if (c == null) return; if (!pagarContratacao(c, "a campanha de divulgação")) return; o.divulgacao++; banner(`📣 Divulgação nível ${o.divulgacao}`, "#6b3fa0"); save(); lastSig = ""; renderSheet(); }
function alternarConvidado(id) { const o = ob(), c = OB_CFG.convidados.find(x => x.id === id); if (o.inauguracao != null) return; o.convidados[id] = !o.convidados[id]; save(); lastSig = ""; renderSheet(); }
function podeInaugurar() {
  const o = ob(), s = sh(), falta = [];
  if (!licOk("habite")) falta.push("habite-se");
  if (preLocada() < OB_CFG.preLocacao) falta.push(`${pctTxt(OB_CFG.preLocacao)} das lojas assinadas (agora ${pctTxt(preLocada())})`);
  if (ancorasOk() < 2) falta.push("pelo menos 2 âncoras assinadas");
  if (s.limpeza < OB_CFG.equipe || s.seguranca < OB_CFG.equipe) falta.push(`${OB_CFG.equipe} na limpeza e ${OB_CFG.equipe} na segurança`);
  return falta;
}
function marcarInauguracao() {
  const o = ob(), falta = podeInaugurar(); if (falta.length) { toast(`Falta: ${falta.join(", ")}.`); return; }
  const conv = OB_CFG.convidados.filter(c => o.convidados[c.id]), custo = OB_CFG.cerimonia + conv.reduce((a, c) => a + c.custo, 0);
  if (!pagarContratacao(custo, "a cerimônia de inauguração")) return;
  o.inauguracao = S.dayT < DAY_LEN * 0.3 ? S.day : S.day + 1; o.fase = "inauguracao"; o.custoInaug = custo;
  banner(`🎉 Inauguração marcada para a semana ${semana(o.inauguracao)}`, "#6b3fa0"); save(); lastSig = ""; renderSheet();
}

// ---------- tick ----------
const operarios = [];
function tickObra(dt) {
  const o = ob(), s = sh();
  // licenças andam no tempo
  OB_CFG.licencas.forEach(L => { const l = o.lic[L.id]; if (l && !l.ok) { l.t += dt;
    if (L.id === "audiencia" && l.t >= L.dias * DAY_LEN && !l.ok) { l.ok = true; l.apoio = o.apoio;
      if (o.apoio < 0.6) { l.ok = false; l.t = 0; banner("📢 Audiência pediu mais compromissos", "#b7773b"); toast("A vizinhança pediu contrapartidas. Assuma um compromisso e a audiência é refeita (sem novo custo)."); l.espera = true; }
      else banner("✅ Audiência pública aprovada", "#2e7a57"); lastSig = ""; }
    else if (L.id !== "audiencia" && l.t >= L.dias * DAY_LEN) { l.ok = true; banner(`✅ ${L.nome}`, "#2e7a57"); lastSig = ""; } } });
  const au = o.lic.audiencia; if (au && au.espera && o.apoio >= 0.6) au.espera = false;
  if (au && au.espera) au.t = 0;
  // obra
  if (o.fase === "licencas" && obraLiberada()) { o.fase = "obra"; banner("🏗️ Obra liberada!", "#6b3fa0"); }
  if ((o.fase === "obra" || o.fase === "preparacao") && o.pct < 100) {
    if (o.chuva > 0) o.chuva -= dt;
    else if (!o.lona && !o.pausada && !o.embargo && Math.random() < OB_CFG.chuva * dt) { o.chuva = OB_CFG.chuvaDur; banner("🌧️ Chuva forte: obra parada", "#4a6fa5"); }
    const motivo = motivoParada();
    // embargo só acontece com a obra andando (antes também na obra parada)
    if (!motivo && !o.compromissos.drenagem && o.pct > 15 && Math.random() < OB_CFG.embargo * dt) { o.embargo = true; banner("⛔ Obra embargada: drenagem", "#c9513a"); toast("Fiscalização embargou a obra por causa da drenagem. Faça a obra exigida no painel da obra para retomar."); lastSig = ""; }
    if (!motivo && !o.embargo) {
      // material: nunca abaixo da reserva da abertura (nem do zero com a reserva liberada)
      const quer = dt * ritmoObra(), livre = Math.max(0, S.money - reservaAbertura()), ganho = Math.min(quer, livre / OB_CFG.materialPorPct, 100 - o.pct), c = ganho * OB_CFG.materialPorPct;
      o.pct = Math.min(100, o.pct + ganho); S.money -= c; S.today.outrasDesp = (S.today.outrasDesp || 0) + c; o.gasto += c; o.hoje.material += c; o.hoje.tAtiva += dt;
      if (o.pct >= 100) { o.pct = 100; banner("🏁 Obra concluída! Falta a vistoria e o habite-se.", "#6b3fa0"); lastSig = ""; }
    } else if (motivo === "chuva") o.hoje.tChuva += dt;
    else o.hoje.tParada += dt;
    const m2 = motivoParada();
    if (m2 !== o.motivoAnt) {
      if (m2 === "reserva") { banner("⏸️ Obra pausada para guardar o dinheiro da abertura", "#b7773b"); anunciar("Obra pausada: o saldo restante está guardado para licenças, equipe, salários e cerimônia. Veja a previsão de caixa no painel da obra."); }
      else if (m2 === "dinheiro") { banner("⏸️ Sem dinheiro: obra parada, sem diárias", "#c9513a"); anunciar("Sem dinheiro para material: a obra parou e as turmas não recebem diária enquanto estiver parada."); }
      o.motivoAnt = m2; lastSig = "";
    }
  }
  if (o.fase === "obra" && o.pct >= 50) { o.fase = "preparacao"; banner("🏬 Pré-locação aberta: as primeiras propostas chegaram", "#6b3fa0"); lastSig = ""; }
  // na semana da festa o tickShopping já anda com a locação (antes rodava duas vezes e as propostas venciam no dobro da velocidade)
  if (o.fase === "preparacao" || (o.fase === "inauguracao" && S.day < o.inauguracao)) tickLocacao(lojasSh(), SH_LOC(), dt);
  // operários (só desenho)
  const quer = (o.fase === "obra" || o.fase === "preparacao") && o.pct < 100 ? o.turmas * 3 : 0;
  while (operarios.length < quer) operarios.push({ id: 9000 + operarios.length, x: 40 + Math.random() * (W - 80), y: 140 + Math.random() * (H - 200), path: [], skin: pick(SKIN), hair: pick(HAIR) });
  operarios.length = quer;
  operarios.forEach(p => { if (follow(p, 30, dt)) p.path = [{ x: 30 + Math.random() * (W - 60), y: 120 + Math.random() * (H - 170) }]; });
  // inauguração: o dia da festa
  if (o.fase === "inauguracao" && S.day >= o.inauguracao) tickShopping(dt);
}
function chegadaInaug() {        // público extra no dia da inauguração (divulgação e convidados)
  const o = ob(), conv = OB_CFG.convidados.filter(c => o.convidados[c.id]);
  return 140 + 90 * o.divulgacao + conv.reduce((a, c) => a + c.publico, 0);
}
let tInaug = 0;
function tickInauguracao(dt) {
  const o = ob(); if (o.fase !== "inauguracao" || S.day < o.inauguracao) return;
  tInaug += dt * chegadaInaug() / DAY_LEN; while (tInaug >= 1) { tInaug -= 1; novoVisitante(null, 0, false); }
}
function fechamentoObra() {
  const o = ob(), s = sh(), conv = OB_CFG.convidados.filter(c => o.convidados[c.id]);
  // diárias só pelo tempo de obra andando (chuva paga metade); obra parada paga só a guarda do canteiro, sem levar ao vermelho
  const h = o.hoje, diarias = Math.round(diariaSemana() * Math.min(1, (h.tAtiva + OB_CFG.chuvaDiaria * h.tChuva) / DAY_LEN));
  const guarda = Math.round(Math.min(Math.max(0, S.money - diarias), OB_CFG.guarda * Math.min(1, h.tParada / DAY_LEN)));
  if (diarias || guarda || h.material) {
    S.money -= diarias + guarda; S.today.outrasDesp = (S.today.outrasDesp || 0) + diarias + guarda;
    S.today.linhas = (S.today.linhas || []).concat([["Diárias da obra (turmas e guindaste)", `-M ${fmt(diarias)}`], ["Material da obra nesta semana (já descontado)", `-M ${fmt(h.material)}`]].concat(guarda ? [["Guarda do canteiro (obra parada)", `-M ${fmt(guarda)}`]] : []));
  }
  o.hoje = novoHojeOb();
  if (o.fase === "operacao") { const o0 = S.today.outras || 0; fecharSemanaShopping(); pagarAporte((S.today.outras || 0) - o0); }
  else if (o.fase === "inauguracao" && S.day >= o.inauguracao) {
    { const o0 = S.today.outras || 0; fecharSemanaShopping(); pagarAporte((S.today.outras || 0) - o0); }            // primeira semana de aluguéis
    const h = s.hoje, sat = h.satT ? h.satSoma / h.satT : s.satEMA, satF = Math.min(1, sat + conv.reduce((a, c) => a + c.sat, 0));
    o.relInaug = { semana: semana(), publico: h.visitas, recusados: h.recusados, custos: o.custoInaug, alugueis: (s.ultimoLoc || {}).receita || 0, vendas: Math.round(h.vendas), satisfacao: satF, convidados: conv.map(c => c.nome) };
    o.relInaug.resultado = o.relInaug.alugueis - o.custoInaug;
    s.satEMA = Math.max(s.satEMA, satF);
    o.fase = "operacao"; o.inaugurado = S.day;
    setTimeout(() => mostrarRelatorioInauguracao(o.relInaug), 3200);
  }
}
function mostrarRelatorioInauguracao(r) {
  if (!document.getElementById("modal").hidden) { filaModal.push(() => mostrarRelatorioInauguracao(r)); return; }
  confetti();
  showModal(`<h2>🎉 Inauguração do Maricá Grande Shopping</h2><p>Semana ${r.semana}. ${r.convidados.length ? `Presentes: ${r.convidados.join(", ").toLowerCase()}.` : "Cerimônia simples, sem convidados."}</p>
    <table><tr><td>Público na semana de abertura</td><td>${r.publico} pessoas</td></tr><tr><td>Não conseguiram entrar (lotado)</td><td>${r.recusados}</td></tr>
    <tr><td>Cerimônia e convidados</td><td class="neg">-M ${fmt(r.custos)}</td></tr><tr><td>Primeiros aluguéis e % das vendas</td><td class="pos">+M ${fmt(r.alugueis)}</td></tr>
    <tr><td>Vendas dos lojistas</td><td>M ${fmt(r.vendas)}</td></tr><tr><td><b>Satisfação</b></td><td><b>${pctTxt(r.satisfacao)}</b></td></tr></table>
    <p>Agora o shopping opera: cuide de contratos, operação e calendário para cumprir as metas finais do capítulo.</p><button class="btn" id="ok">Abrir o shopping</button>`);
  document.getElementById("ok").onclick = hideModal;
}

// ---------- desenho do canteiro ----------
function desenharObra() {
  const o = ob(); if (o.fase === "operacao" || (o.fase === "inauguracao" && S.day >= o.inauguracao)) return desenharShopping();
  drawBackground();
  // terreno e tapume
  rr(0, 40, W, H - 40, 8, "#cdb48a"); ctx.fillStyle = "rgba(120,90,50,.15)"; for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = 60 + (i * 53) % (H - 80); ctx.fillRect(x, y, 18, 6); }
  ctx.strokeStyle = "#6b3fa0"; ctx.lineWidth = 4; ctx.strokeRect(2, 42, W - 4, H - 44);
  for (let x = 10; x < W; x += 40) { rr(x, 38, 26, 8, 2, "#f4efe2"); }
  const p = o.pct, Y = lay();
  // fundação: estacas
  const nx = 16, ny = 8;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const k = (i * ny + j) / (nx * ny); if (k * 25 > p) continue; rr(24 + i * (W - 48) / (nx - 1) - 3, 70 + j * (H - 150) / (ny - 1) - 3, 6, 6, 1, "#7d7d7d"); }
  // estrutura: lajes aparecendo
  if (p > 25) { const f = Math.min(1, (p - 25) / 35); ctx.globalAlpha = 0.85; rr(16, 60, (W - 32) * f, H - 130, 4, "#b0b5b8"); ctx.globalAlpha = 1;
    for (let x = 16; x < 16 + (W - 32) * f; x += 40) { ctx.fillStyle = "#8d9396"; ctx.fillRect(x, 60, 3, H - 130); } }
  // cobertura e fachada: as lojas já aparecem em contorno
  if (p > 60) { const f = Math.min(1, (p - 60) / 25); ctx.globalAlpha = f; Y.unidades.forEach(u => { ctx.strokeStyle = "#6b3fa0"; ctx.lineWidth = 1; ctx.strokeRect(u.x, u.y, u.w, u.h); }); ctx.globalAlpha = 1; }
  if (p > 85) { const f = Math.min(1, (p - 85) / 15); ctx.globalAlpha = f * 0.8; ctx.fillStyle = "#fbf9f4"; ctx.fillRect(Y.x0 - 8, Y.corY, Y.x1 - Y.x0 + 16, Y.corH); ctx.globalAlpha = 1; }
  // guindastes
  if (o.guindaste && p < 100) { [[W * 0.3, 90], [W * 0.72, 120]].forEach(([gx, gy], k) => { rr(gx - 3, gy, 6, H - gy - 60, 1, "#f2b233"); const a = now() * 0.2 + k * 2;
    ctx.strokeStyle = "#f2b233"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(a) * 110, gy + Math.sin(a) * 30); ctx.stroke(); }); }
  // operários
  operarios.forEach(w => { person(w, { body: "#e8711a", cap: "#f2b233", moving: w.path.length > 0 }); });
  // placa da obra
  rr(W / 2 - 150, 52, 300, 54, 8, "#6b3fa0"); text("OBRA: MARICÁ GRANDE SHOPPING", W / 2, 70, 11, "#fff", "center", 800, "Baloo 2");
  text(`${etapaObra()} · ${p.toFixed(0)}% · licenças ${licencasOk()}/${OB_CFG.licencas.length}${o.embargo ? " · EMBARGADA" : o.chuva > 0 ? " · CHUVA" : ""}`, W / 2, 86, 8, "#f2b233", "center", 800);
  rr(W / 2 - 120, 92, 240 * p / 100, 8, 4, "#f2b233"); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - 120, 92, 240, 8);
  if (o.chuva > 0 && !REDUZ()) { ctx.strokeStyle = "rgba(90,120,170,.5)"; ctx.lineWidth = 1; for (let i = 0; i < 60; i++) { const x = (i * 61 + now() * 300) % W, y = 40 + (i * 37 + now() * 500) % (H - 40); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.stroke(); } }
  if (o.embargo) { rr(W / 2 - 70, H / 2 - 14, 140, 28, 8, "#c9513a"); text("⛔ OBRA EMBARGADA", W / 2, H / 2 + 4, 10, "#fff", "center", 800); }
  drawCidade(0); drawCars(); drawCidade(1); drawParking();
}

// ---------- painel ----------
function buildObra(body) {
  const o = ob();
  head("🏗️", "#ece4f4", "Obra e inauguração", () => `${etapaObra()} · ${o.pct.toFixed(0)}% · licenças ${licencasOk()}/${OB_CFG.licencas.length}`);
  body.appendChild(el("p", "note", "Licenças antes, obra depois, pré-locação e equipe a partir da metade da obra, e por fim a inauguração. Valores e prazos são do jogo, inspirados nas etapas reais de um empreendimento grande."));
  if (o.fase !== "operacao" && o.fase !== "inauguracao") {
    const pv = el("div", "card resumo", `<h3>Previsão de caixa até a abertura</h3><p class="note" id="obPrev"></p>`);
    live(() => { const q = pv.querySelector("#obPrev"); if (q) q.innerHTML = previsaoTxt(); });
    pv.appendChild(el("p", "note", "A obra só gasta material acima do que está guardado para licenças, equipe, salários e cerimônia. Cada loja assinada na pré-locação paga um sinal de uma semana de aluguel."));
    body.appendChild(pv);
  }
  // licenças
  body.appendChild(el("div", "sec-title", "1. Licenças"));
  OB_CFG.licencas.forEach(L => { const l = o.lic[L.id], ok = licOk(L.id), bloq = L.req.some(r => !licOk(r)) || (L.fimObra && o.pct < 100);
    const c = el("div", "card", `<div class="req"><span>${ok ? "✅" : l ? "⏳" : bloq ? "🔒" : "⬜"} ${L.nome}</span><b>${ok ? "ok" : l ? (l.espera ? "esperando compromissos" : `${Math.round(l.t / (L.dias * DAY_LEN) * 100)}%`) : `M ${fmt(L.custo)} · ${L.dias} sem.`}</b></div>`);
    if (!l && !bloq) { const b = el("button", "btn mini", `Iniciar (M ${fmt(L.custo)})`); b.setAttribute("aria-label", `Iniciar ${L.nome}`); b.onclick = () => iniciarLicenca(L.id); c.appendChild(b); }
    body.appendChild(c); });
  const cc = el("div", "card", `<h3>Compromissos com a vizinhança</h3><p class="note">A audiência aprova com apoio de 60% ou mais. Apoio agora: <b>${pctTxt(o.apoio)}</b>.</p>`);
  OB_CFG.compromissos.forEach(c => { const b = el("button", o.compromissos[c.id] ? "plain mini" : "btn mini", o.compromissos[c.id] ? `<span>✅ ${c.nome}</span>` : `${c.nome}: M ${fmt(c.custo)} (+${Math.round(c.apoio * 100)}% de apoio${c.previneEmbargo ? `, evita embargo (risco agora ${Math.round(riscoEmbargo() * 100)}%)` : ""})`);
    if (!o.compromissos[c.id]) b.onclick = () => confirmarSeFaltar(c.custo - compromissoNecessario(), c.nome, () => assumirCompromisso(c.id)); cc.appendChild(b); });
  body.appendChild(cc);
  // obra
  body.appendChild(el("div", "sec-title", "2. Obra"));
  const oc = el("div", "card", `<p class="note" id="obTxt"></p>`);
  live(() => { const q = oc.querySelector("#obTxt"); if (!q) return; const m = motivoParada();
    q.innerHTML = !obraLiberada() && !o.embargo ? "Aguardando a licença de instalação." : o.embargo ? '<span class="tag ruim">Embargada</span> por drenagem: sem diárias, só a guarda do canteiro.' : o.pct >= 100 ? "Obra concluída." : `${etapaObra()}: ${o.pct.toFixed(1)}%${m ? ` · <span class="tag ${m === "chuva" ? "aviso" : "ruim"}">${MOTIVO_TXT[m]}</span>` : ""} · material: M ${OB_CFG.materialPorPct} por 1%. Gasto até agora: M ${fmt(o.gasto)}.`; });
  if (o.pct < 100) {
    const rk = el("p", "note", riscoTxt()); oc.appendChild(rk);
    const bp = el("button", o.pausada ? "btn" : "plain toggle", o.pausada ? "Retomar a obra" : `<span>Pausar a obra (sem diárias; guarda do canteiro M ${OB_CFG.guarda}/semana)</span>`); bp.setAttribute("aria-pressed", String(!!o.pausada)); bp.onclick = alternarPausa; oc.appendChild(bp);
    if (precisaResgate()) { const bs = el("button", "btn", `Pedir aporte da incorporadora (M ${fmt(valorSocorro())}, sem juros)`); bs.onclick = confirmarSocorro; oc.appendChild(bs); }
    if (o.usarReserva || motivoParada() === "reserva") { const br = el("button", "plain toggle", `<span>Deixar a obra usar a reserva da abertura: <b>${o.usarReserva ? "sim" : "não"}</b></span>`); br.setAttribute("aria-pressed", String(!!o.usarReserva)); br.onclick = alternarReserva; oc.appendChild(br); }
  }
  oc.appendChild(passo("Turmas de obra", () => `${ob().turmas} (M ${OB_CFG.turma.diaria}/semana cada, só com a obra andando)`, () => mudarTurmas(-1), () => confirmarSeFaltar(OB_CFG.turma.contratar, "Uma turma de obra", () => mudarTurmas(1)), "turmas de obra"));
  const bg = el("button", "plain toggle", `<span>Guindaste alugado (M ${OB_CFG.guindaste.diaria}/semana, +${Math.round((OB_CFG.guindaste.mult - 1) * 100)}%): <b>${o.guindaste ? "sim" : "não"}</b></span>`); bg.setAttribute("aria-pressed", String(o.guindaste)); bg.onclick = alternarGuindaste; oc.appendChild(bg);
  if (!o.lona) { const b = el("button", "plain", `<span>Cobertura provisória contra chuva: M ${fmt(OB_CFG.lona)}</span>`); b.onclick = () => confirmarSeFaltar(OB_CFG.lona, "A cobertura provisória", comprarLona); oc.appendChild(b); } else oc.appendChild(el("p", "note", "✅ Cobertura provisória: a chuva não para a obra."));
  if (o.embargo) { const b = el("button", "btn", `Fazer a drenagem exigida (M ${fmt(OB_CFG.embargoConserto)})`); b.onclick = resolverEmbargo; oc.appendChild(b); }
  body.appendChild(oc);
  if (o.pct >= 100 && precisaResgate()) { const bs = el("button", "btn", `Pedir aporte da incorporadora (M ${fmt(valorSocorro())}, sem juros)`); bs.onclick = confirmarSocorro; oc.appendChild(bs); }
  if (o.divida > 0) oc.appendChild(el("p", "note", `Aporte a devolver à incorporadora: <b>M ${fmt(o.divida)}</b> (20% dos aluguéis de cada semana depois da inauguração, sem juros).`));
  // preparação
  body.appendChild(el("div", "sec-title", "3. Preparação"));
  const pc = el("div", "card", `<p class="note">${o.pct < 50 ? "A pré-locação abre com a obra em 50%." : `Lojas assinadas: <b>${ocupadas(lojasSh()).length} de ${lojasSh().unidades.length}</b> (${pctTxt(preLocada())}; meta ${pctTxt(OB_CFG.preLocacao)} com 2 âncoras). O aluguel começa na inauguração.`}</p>`);
  if (o.pct >= 50) { const b = el("button", "btn", "Pré-locação: propostas de lojistas"); b.onclick = () => openSheet("lojas"); pc.appendChild(b); }
  const maisEquipe = papel => sh()[papel] >= OB_CFG.equipe ? confirmarSeFaltar(SH_CFG[papel].contratar, papel === "limpeza" ? "Mais uma pessoa na limpeza" : "Mais um segurança", () => mudarEquipeSh(papel, 1)) : mudarEquipeSh(papel, 1);
  pc.appendChild(el("p", "note", "Dica: equipe contratada cedo recebe salário toda semana até a abertura."));
  pc.appendChild(passo("Limpeza", () => `${sh().limpeza} de ${OB_CFG.equipe}`, () => mudarEquipeSh("limpeza", -1), () => maisEquipe("limpeza"), "equipe de limpeza"));
  pc.appendChild(passo("Segurança", () => `${sh().seguranca} de ${OB_CFG.equipe}`, () => mudarEquipeSh("seguranca", -1), () => maisEquipe("seguranca"), "seguranças"));
  const cd = OB_CFG.divulgacao[o.divulgacao]; const bd = el("button", cd != null ? "plain" : "plain", `<span>Divulgação da inauguração: nível ${o.divulgacao}${cd != null ? ` → ${o.divulgacao + 1} por M ${fmt(cd)}` : " (máximo)"}</span>`); if (cd != null) bd.onclick = () => confirmarSeFaltar(cd, "A campanha de divulgação", divulgar); pc.appendChild(bd);
  body.appendChild(pc);
  // inauguração
  body.appendChild(el("div", "sec-title", "4. Inauguração"));
  const ic = el("div", "card");
  if (o.fase === "operacao") ic.innerHTML = `<p class="note">Inaugurado na semana ${semana(o.inaugurado)}. ${o.relInaug ? `Público ${o.relInaug.publico}, satisfação ${pctTxt(o.relInaug.satisfacao)}.` : ""}</p>`;
  else if (o.inauguracao != null) ic.innerHTML = `<p class="note">Marcada para a semana ${semana(o.inauguracao)}. Público esperado: cerca de ${chegadaInaug()} pessoas além do movimento normal.</p>`;
  else {
    ic.appendChild(el("p", "note", `Convidados (cargos, sem nomes): cada um traz público e custa um pouco. Cerimônia: M ${fmt(OB_CFG.cerimonia)}.`));
    OB_CFG.convidados.forEach(c => { const b = el("button", "plain mini toggle", `<span>${o.convidados[c.id] ? "✅" : "⬜"} ${c.nome} · M ${fmt(c.custo)} · +${c.publico} pessoas</span>`); b.setAttribute("aria-pressed", String(!!o.convidados[c.id])); b.onclick = () => alternarConvidado(c.id); ic.appendChild(b); });
    const falta = podeInaugurar(); ic.appendChild(el("p", "note", falta.length ? `Falta: ${falta.join(", ")}.` : "Tudo pronto."));
    const b = el("button", "btn", "Marcar a inauguração"); b.onclick = marcarInauguracao; if (falta.length) b.setAttribute("aria-disabled", "true"); ic.appendChild(b);
  }
  body.appendChild(ic);
}
function listaObra(body) {
  if (operando()) return listaShopping(body);
  const o = ob();
  const rs = el("div", "card resumo", `<h3>Agora no canteiro</h3><p class="note" id="lsResumo"></p>`);
  live(() => { const q = rs.querySelector("#lsResumo"); if (q) q.textContent = `${etapaObra()}, ${o.pct.toFixed(0)}%. Licenças ${licencasOk()} de ${OB_CFG.licencas.length}. ${o.embargo ? "Obra embargada. " : o.chuva > 0 ? "Chovendo, obra parada. " : ""}${o.pct >= 50 ? `Lojas assinadas: ${ocupadas(lojasSh()).length}.` : ""}`; });
  body.appendChild(rs);
  body.appendChild(listaRow("🏗️", "#ece4f4", "Obra, licenças e inauguração", () => `${etapaObra()} · ${o.pct.toFixed(0)}%`, { kind: "obra" }));
  if (o.pct >= 50) body.appendChild(listaRow("🏬", "#dff0f1", "Pré-locação", () => `${ocupadas(lojasSh()).length} de ${lojasSh().unidades.length} assinadas · ${lojasSh().propostas.length} proposta(s)`, { kind: "shLojas" }));
  body.appendChild(listaRow("🅿️", "#dfe8f4", "Estacionamento", () => `${STALLS.length} vagas prontas para a abertura`, { kind: "parking" }));
}
function melhorarObra(body, acts) {
  if (operando()) return melhorarShopping(body, acts);
  body.appendChild(storeRow("🏗️", "#ece4f4", "Obra, licenças e inauguração", () => `${etapaObra()} · ${ob().pct.toFixed(0)}%`, { kind: "obra" }, () => false));
  body.appendChild(storeRow("🅿️", "#dfe8f4", "Estacionamento", () => `${STALLS.length} vagas`, { kind: "parking" }, a => a.kind.startsWith("park")));
}
function cartaoObra() {
  if (operando()) return cartaoShopping();
  const c = el("div", "card"); c.innerHTML = `<h3>🏗️ Maricá Grande Shopping</h3><p class="note" id="obRes"></p>`;
  live(() => { const q = c.querySelector("#obRes"); if (!q) return; const o = ob(); q.innerHTML = `${etapaObra()} · ${o.pct.toFixed(0)}% · licenças ${licencasOk()}/${OB_CFG.licencas.length}${o.embargo ? ' · <span class="tag ruim">embargada</span>' : ""}${o.pct >= 50 ? ` · ${ocupadas(lojasSh()).length} lojas assinadas` : ""}`; });
  const b = el("button", "btn", "Abrir a obra"); b.onclick = () => openSheet("obra"); c.appendChild(b); return c;
}

// ---------- capítulo 8: configuração ----------
const OB_META = { ocupacao: 0.85, sat: 0.8, lucro: 1500 };
FASE_CFG.grande = cfgShopping({
  capitulo: 8, titulo: "Maricá Grande Shopping", lugar: "Orla (fictícia)",
  resumo: "O grande shopping da rede, construído do zero num terreno junto à rodovia: três âncoras, cinema, praça de alimentação maior e estacionamento amplo.",
  intro: "O último passo: <b>construir</b>. Tire as <b>licenças</b> (com audiência pública e compromissos com a vizinhança), toque a <b>obra</b> com turmas e guindaste, enfrente chuva e fiscalização, faça a <b>pré-locação</b>, contrate a equipe, divulgue e <b>inaugure</b>. Depois, administre o shopping até cumprir as metas finais.",
  diasSeguidos: 3, lucroMedio: OB_META.lucro,
  aluguel: 0, fluxo: 1,
  convite: {
    responsabilidades: "licenças e audiência pública, obra com turmas, guindaste, chuva e embargo, pré-locação, equipe, divulgação, inauguração com relatório e a operação do maior shopping da rede.",
    comeca: "orçamento de M 45.000 para licenças e obra, terreno com estacionamento previsto e nenhuma loja assinada.",
  },
  estrutura: [
    { id: "licencas", label: "Todas as licenças, até o habite-se", como: "Aba Carreira > Abrir a obra.", have: () => licencasOk(), need: OB_CFG.licencas.length, painel: "obra" },
    { id: "obra", label: "Obra concluída", como: "Turmas e guindaste aceleram; chuva e embargo param.", have: () => Math.floor(ob().pct), need: 100, painel: "obra" },
    { id: "inauguracao", label: "Inaugurar o shopping", como: `${pctTxt(OB_CFG.preLocacao)} das lojas assinadas com 2 âncoras, ${OB_CFG.equipe} na limpeza e ${OB_CFG.equipe} na segurança.`, have: () => operando() ? 1 : 0, need: 1, painel: "obra" },
  ],
  extras() { if (!operando()) return [{ id: "operacao", label: "Metas de operação (depois da inauguração)", tipo: "gestao", have: 0, need: 1, como: "Ocupação, satisfação, mix, evento e campanha, como no Brisa da Lagoa, numa escala maior." }];
    return extrasShopping().map(r => r.id === "ocupacao" ? Object.assign(r, { need: OB_META.ocupacao }) : r); },
  diaComo: () => operando() ? FASE_CFG.brisa.diaComo() : "As semanas começam a contar depois da inauguração.",
  avaliar(itens) { if (!operando()) { itens.push({ ok: false, txt: "Shopping ainda não inaugurado" }); return; } FASE_CFG.brisa.avaliar(itens); },
  fimDoDia(L) { if (operando() && ob().inaugurado < L.day) fimSemanaShopping(L); else if (operando()) { sh().hoje = novoHojeSh(); } },
  tick(dt) { tickObra(dt); if (operando()) tickShopping(dt); else tickInauguracao(dt); },
  cartoes() { return [cartaoObra()]; },
  missao() {
    const o = ob();
    if (operando()) return FASE_CFG.brisa.missao();
    if (o.embargo) return { title: "Obra embargada", sub: "Faça a drenagem exigida", p: o.pct / 100, ring: "⛔", go: () => openSheet("obra") };
    const mp = o.fase !== "licencas" && o.pct < 100 ? motivoParada() : null;
    if (mp === "reserva" || mp === "dinheiro") return { title: "Obra pausada", sub: mp === "reserva" ? "Dinheiro guardado para abrir: veja a previsão" : "Sem dinheiro para material", p: o.pct / 100, ring: "⏸️", go: () => openSheet("obra") };
    const prox = OB_CFG.licencas.find(L => !o.lic[L.id] && !L.req.some(r => !licOk(r)) && !(L.fimObra && o.pct < 100));
    if (prox) return { title: prox.nome, sub: `Iniciar por M ${fmt(prox.custo)}`, p: licencasOk() / OB_CFG.licencas.length, ring: "📋", go: () => openSheet("obra") };
    if (o.pct >= 50 && lojasSh().propostas.length && preLocada() < OB_CFG.preLocacao) return { title: "Pré-locação", sub: `${lojasSh().propostas.length} proposta(s) de lojistas`, p: preLocada(), ring: "🏬", go: () => openSheet("lojas") };
    return { title: `Obra: ${etapaObra()}`, sub: `${o.pct.toFixed(0)}%`, p: o.pct / 100, ring: "🏗️", go: () => openSheet("obra") };
  },
  orcamento: 45000,
  inicio() {
    iniciarShopping(this.orcamento, []);
    const L = lojasSh(); L.propostas = [];
    S.obra = novaObra(); S.shop.limpeza = 0; S.shop.seguranca = 0; S.park.staff = 1;
  },
  carregar() { ob(); sh(); lojasSh(); verificarResgate(); },
  reabrir(r) { const o = ob(); o.v13 = true; OB_CFG.licencas.forEach(L => o.lic[L.id] = { ok: true, t: 0 }); o.pct = 100; o.fase = "operacao"; o.inaugurado = 1; const s = sh(); s.limpeza = 6; s.seguranca = 6; reabrirComum(r); },
  reaberturaTxt: "shopping inaugurado, equipe de operação e o orçamento inicial do Grande (M 45.000)",
  previa: () => `<svg viewBox="0 0 220 120" class="previa" role="img" aria-label="Esquema do Maricá Grande Shopping: terreno grande junto à rodovia, prédio com três âncoras, corredor longo com quiosques, praça de alimentação e estacionamento amplo. Começa como canteiro de obras.">
    <rect width="220" height="120" rx="10" fill="#bfd08f"/><rect y="4" width="220" height="12" fill="#6f777c"/>
    <rect x="10" y="20" width="200" height="72" rx="6" fill="#cdb48a" stroke="#6b3fa0" stroke-width="2" stroke-dasharray="6 3"/>
    <rect x="14" y="26" width="30" height="44" rx="3" fill="#2e7d32" opacity=".8"/><rect x="176" y="26" width="30" height="44" rx="3" fill="#ad1457" opacity=".8"/><rect x="96" y="26" width="28" height="22" rx="3" fill="#1a237e" opacity=".8"/>
    <rect x="46" y="52" width="128" height="14" fill="#fbf9f4"/>${[0, 1, 2, 3, 4].map(i => `<rect x="${54 + i * 26}" y="56" width="7" height="5" rx="1" fill="#00838f"/>`).join("")}
    <line x1="70" y1="24" x2="70" y2="88" stroke="#f2b233" stroke-width="3"/><line x1="70" y1="26" x2="130" y2="34" stroke="#f2b233" stroke-width="3"/>
    <rect x="10" y="96" width="200" height="20" rx="3" fill="#9aa3a6"/></svg>`,
  rotuloProprio: () => operando() ? `Semana ${semana()}` : `Semana ${semana()} · obra`,
  desenharPropria: desenharObra,
  salariosProprios: () => { const s = sh(); return s.limpeza * SH_CFG.limpeza.salario + s.seguranca * SH_CFG.seguranca.salario; },
  fechamentoProprio: fechamentoObra,
  melhorarProprio: melhorarObra,
  listaPropria: listaObra,
  tocarProprio(x, y) {
    if (operando()) { const Y = lay(), inR = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (inR({ x: Y.palco.x - 6, y: Y.palco.y - 6, w: Y.palco.w + 12, h: Y.palco.h + 16 })) return { kind: "shCalendario" };
      for (const u of Y.unidades) if (inR(u)) return { kind: "shLojas" };
      return x > 0 && x < W && y > 40 && y < H ? { kind: "shOperacao" } : null; }
    return x > 0 && x < W && y > 30 && y < H ? { kind: "obra" } : null;
  },
  chegadaPropria(car) { if (!operando() && !(ob().fase === "inauguracao" && S.day >= ob().inauguracao)) { if (car) car.back++; return; } novoVisitante(car); },
  aoVoltarProprio(days) {
    const o = ob(), L = [];
    if (operando()) { const R = shoppingAoVoltar(days);     // o ganho offline vem da média do dia, que já desconta a devolução do aporte
      if (o.divida > 0 && o.pagUlt) { const v = Math.min(o.divida, o.pagUlt * days); o.divida -= v; R.push(["Devolução do aporte da incorporadora", `M ${fmt(v)}${o.divida ? ` (faltam M ${fmt(o.divida)})` : " (quitado)"}`]); }
      return R; }
    // licenças em andamento terminam; a obra anda no ritmo do gerente (com material cobrado uma vez)
    let fim = 0; OB_CFG.licencas.forEach(Li => { const l = o.lic[Li.id]; if (l && !l.ok && !l.espera) { l.t += days * DAY_LEN; if (l.t >= Li.dias * DAY_LEN) { l.ok = Li.id !== "audiencia" || o.apoio >= 0.6; if (!l.ok) { l.espera = true; l.t = 0; } else fim++; } } });
    if (fim) L.push(["Licenças concluídas enquanto você esteve fora", String(fim)]);
    // 1.3: fora do app vale a mesma conta de dentro: salários da equipe, material e diárias pelo que a obra andou,
    // sem passar da reserva da abertura e sem nunca deixar o saldo negativo
    const s = sh(), sal = Math.min(Math.max(0, S.money), (s.limpeza * SH_CFG.limpeza.salario + s.seguranca * SH_CFG.seguranca.salario) * days);
    if (sal > 0) { S.money -= sal; L.push(["Salários da equipe enquanto você esteve fora", `-M ${fmt(sal)}`]); }
    if (obraLiberada() && o.pct < 100 && !o.pausada) {
      const ritmo = ritmoObra() * DAY_LEN * 0.5 * mgrEff(S.mgrLvl), porPct = OB_CFG.materialPorPct + diariaSemana() / (ritmoObra() * DAY_LEN);
      const ganho = Math.min(100 - o.pct, ritmo * days, Math.max(0, S.money - reservaAbertura(false)) / porPct), mat = ganho * OB_CFG.materialPorPct, dia = ganho * (porPct - OB_CFG.materialPorPct);
      if (ganho > 0) { o.pct = Math.min(100, o.pct + ganho); S.money -= mat + dia; o.gasto += mat; L.push(["Obra avançou enquanto você esteve fora", `+${ganho.toFixed(0)}% (material M ${fmt(mat)}, diárias M ${fmt(dia)})`]); }
      if (ritmo * days > ganho + 0.01 && o.pct < 100) L.push(["Obra pausada para guardar o dinheiro da abertura", "veja a previsão de caixa"]); }
    o.chuva = 0;
    return L;
  },
});
// ---------- 1.3: resgate de partidas presas e sinal da pré-locação ----------
// Partidas de versões anteriores (sem a marca v13) que abrem com saldo negativo ou com a previsão de caixa
// negativa recebem, uma única vez, o saldo que falta para concluir e inaugurar, com margem, sem juros.
// Antes, uma cópia do save da carreira é guardada em chave separada.
const CHAVE_COPIA_RESGATE = "mercadinho-carreira-v1-copia-antes-resgate";
let resgateMostrar = null;
function precisaResgate() { const o = ob(); if (o.fase === "operacao" || o.fase === "inauguracao") return false; const p = previsaoObra(); return !!p && (S.money < 0 || p.sobra < 0); }
function aplicarResgate(origem) {
  const o = ob(), p = previsaoObra(); if (!p) return null;
  try { const atual = localStorage.getItem(CHAVE_CARREIRA); if (atual) localStorage.setItem(CHAVE_COPIA_RESGATE, atual); } catch (e) {}
  const alvo = Math.round(p.obrig + p.convidados + Math.max(OB_CFG.resgateMin, p.obrig * OB_CFG.resgateMargem));
  if (S.money >= alvo) return null;
  const r = { em: Date.now(), antes: Math.round(S.money), depois: alvo, origem };
  o.resgates = (o.resgates || []).concat([r]); o.resgate = true; o.usarReserva = false;
  S.money = alvo; o.motivoAnt = null; save(); return r;
}
function verificarResgate() {
  const o = ob(); if (o.v13) return;
  const r = precisaResgate() ? aplicarResgate("automatico") : null;
  o.v13 = true; save();
  if (r) { resgateMostrar = r; setTimeout(() => mostrarResgate(r), 1200); }
}
// Aporte da incorporadora (1.3): quando a partida da 1.3 fica sem caixa para terminar e abrir, o jogador pode
// pedir o mesmo valor do resgate; ele é devolvido sem juros com 20% dos aluguéis de cada semana após a inauguração.
function valorSocorro() { const p = previsaoObra(); return p ? Math.max(0, Math.round(p.obrig + p.convidados + Math.max(OB_CFG.resgateMin, p.obrig * OB_CFG.resgateMargem)) - Math.round(S.money)) : 0; }
function confirmarSocorro() {
  const v = valorSocorro(); if (!v) return;
  showModal(`<h2>🤝 Aporte da incorporadora</h2><p>A incorporadora adianta <b>M ${fmt(v)}</b> para terminar a obra e inaugurar: material, licenças, equipe, salários e cerimônia que faltam, com uma pequena folga.</p>
    <p>Não há juros. Depois da inauguração, 20% dos aluguéis de cada semana vão para a devolução até quitar.${ob().divida ? ` Já devido: M ${fmt(ob().divida)}.` : ""}</p>
    <div class="row"><button class="btn" id="sim">Aceitar o aporte</button><button class="plain" id="nao">Agora não</button></div>`);
  document.getElementById("sim").onclick = () => { hideModal(); pedirSocorro(); };
  document.getElementById("nao").onclick = hideModal;
}
function pedirSocorro() {
  const o = ob(); if (!precisaResgate()) return null;
  const r = aplicarResgate("aporte"); if (!r) return null;
  const v = r.depois - r.antes; o.divida = Math.round((o.divida || 0) + v);
  S.today.outras = (S.today.outras || 0) + v; S.today.linhas = (S.today.linhas || []).concat([["Aporte da incorporadora (a devolver sem juros)", `+M ${fmt(v)}`]]);
  banner(`🤝 Aporte de M ${fmt(v)}`, "#2e7a57"); lastSig = ""; renderSheet(); return r;
}
function pagarAporte(receita) {
  const o = ob(); if (!(o.divida > 0) || !(receita > 0)) return 0;
  const v = Math.min(o.divida, Math.round(receita * 0.2)); if (v <= 0) return 0;
  o.divida -= v; S.money -= v; S.today.outrasDesp = (S.today.outrasDesp || 0) + v; o.pagUlt = v;
  S.today.linhas = (S.today.linhas || []).concat([["Devolução do aporte da incorporadora", `-M ${fmt(v)}${o.divida ? ` (faltam M ${fmt(o.divida)})` : " (quitado)"}`]]);
  return v;
}
function mostrarResgate(r) {
  if (!document.getElementById("modal").hidden) { filaModal.push(() => mostrarResgate(r)); return; }
  showModal(`<h2>🏗️ Obra replanejada</h2><p>Nesta versão a obra do Maricá Grande Shopping ganhou previsão de caixa, pausa e reserva para a abertura. A sua partida tinha ficado sem dinheiro para terminar, então a incorporadora cobriu a diferença, sem juros.</p>
    <table><tr><td>Saldo antes</td><td class="${r.antes < 0 ? "neg" : ""}">${r.antes < 0 ? "-" : ""}M ${fmt(Math.abs(r.antes))}</td></tr><tr><td>Saldo agora</td><td class="pos">M ${fmt(r.depois)}</td></tr></table>
    <p>O valor cobre material, licenças, equipe, salários e cerimônia que faltam, com uma pequena folga. Acompanhe a previsão no painel da obra. Isso acontece uma única vez.</p><button class="btn" id="ok">Continuar a obra</button>`);
  document.getElementById("ok").onclick = hideModal;
}
if (OB_ATIVO) {
  const aceitar0 = aceitarProposta;
  aceitarProposta = (L, id) => {             // pré-locação: cada contrato novo assinado antes da inauguração paga um sinal
    const p = L.propostas.find(x => x.id === id), ok = aceitar0(L, id);
    if (ok && p && !p.renovacao && L === S.lojasSh && !operando() && ob().fase !== "inauguracao") {
      const v = Math.round(p.aluguel * OB_CFG.sinalSemanas); S.money += v; S.today.outras = (S.today.outras || 0) + v; ob().sinais += v;
      toast(`${p.nome} assinou e pagou M ${fmt(v)} de sinal.`);
    }
    return ok;
  };
}
FASE_CFG.grande.semCarros = () => !operando() && !(ob().fase === "inauguracao" && S.day >= ob().inauguracao);
if (OB_ATIVO) {
  GANCHOS.semCarros = () => FASE_CFG.grande.semCarros();
  gancho("bRect", sel => sel.kind === "obra" ? { x: 0, y: 30, w: W, h: H - 26 } : null);
  gancho("painel", (sel, body) => { if (sel.kind === "obra") { buildObra(body); return true; } return null; });
  const a0 = GANCHOS.assinatura;
  GANCHOS.assinatura = () => { const o = ob(); return (a0 ? a0() : "") + `|ob${o.fase}${JSON.stringify(o.lic).replace(/"t":[\d.]+/g, "")}${Object.keys(o.compromissos).join()}${o.turmas}${o.guindaste}${o.lona}${o.embargo}${o.divulgacao}${JSON.stringify(o.convidados)}${Math.floor(o.pct / 5)}${o.chuva > 0}${o.pausada}${o.usarReserva}${motivoParada()}`; };
  PAINEIS.obra = buildObra;
}
