"use strict";
// =====================================================================
// Capítulo 7 (Shopping Brisa da Lagoa) e operação do capítulo 8 depois da inauguração.
// Outra escala de gestão: não há gôndolas nem caixas. O jogador administra:
//   · contratos de locação (aluguel fixo + % das vendas) e o mix de lojas (06g);
//   · operação: limpeza, segurança e manutenção, que junto com o estacionamento limitam quantos
//     visitantes cabem ao mesmo tempo;
//   · calendário: 1 dia de jogo = 1 semana; campanhas sazonais e eventos temporários na praça;
//   · relatório de cada evento: público, custos, receitas, resultado e satisfação.
// Visitantes vêm dos carros (estacionamento com cancela, 05) e a pé. Cada visita gera vendas para os
// lojistas; o shopping recebe o aluguel e a porcentagem no fechamento da semana.
// =====================================================================
const SH_CFG = {
  limpeza: { contratar: 200, salario: 20, cap: 12, max: 10 },
  seguranca: { contratar: 260, salario: 26, cap: 14, max: 10 },
  manutencao: [{ nome: "Mínima", custo: 60, pane: 1 / 70 }, { nome: "Preventiva", custo: 160, pane: 1 / 160 }, { nome: "Completa", custo: 320, pane: 1 / 420 }],
  conserto: 180, condominio: 300, semanaInicial: 15,
  maxGrande: 16,                                                           // 1.4: o Grande comporta equipes maiores
  equip: { limpeza: { nome: "Lavadora de piso", custo: 2500, mult: 1.3, ic: "🧽" }, seguranca: { nome: "Central de câmeras", custo: 3000, mult: 1.3, ic: "📹" } },
  satMin: 0.7, recusaMax: 0.1,
};
const SH_ATIVO = NA_CARREIRA && (FASE === "brisa" || FASE === "grande");
// 1.4: pontos de extensão usados pela reunião da semana (06j); sem a reunião, tudo fica neutro
const SH_MOD = { cap: () => 1, extraLimpeza: () => 0, extraSeg: () => 0, sat: () => 0, sujeira: () => 1, paneMult: () => 1, escolherPane: null, deixarEntrar: () => false, tick: () => {}, fechar: () => {}, fimSemana: () => {}, desenhar: () => {} };
// layout do shopping a partir do tamanho do prédio. spec: quantas unidades de cada tipo.
function layoutShopping(spec) {
  const u = [], cx = W / 2, an = 124, top = 56, corY = 200, corH = 58, baseY = corY + corH + 8, bot = H - 70;
  // âncoras nas pontas (e uma no alto, no centro, no Grande)
  u.push({ id: "a1", tam: "ancora", nome: "Âncora oeste", x: 8, y: top, w: an - 8, h: corY + corH - top, porta: { x: an, y: corY + corH / 2 } });
  u.push({ id: "a2", tam: "ancora", nome: "Âncora leste", x: W - an, y: top, w: an - 8, h: corY + corH - top, porta: { x: W - an, y: corY + corH / 2 } });
  const x0 = an + 8, x1 = W - an - 8, larg = x1 - x0;
  // fileira de cima: lojas médias (e o cinema âncora no meio, no Grande)
  const nTop = spec.topo, wt = (larg - (nTop - 1) * 6) / nTop;
  for (let i = 0; i < nTop; i++) { const x = x0 + i * (wt + 6), meio = spec.ancoraCentro && i === Math.floor(nTop / 2);
    u.push({ id: meio ? "a3" : "m" + (i + 1), tam: meio ? "ancora" : "media", nome: meio ? "Âncora central" : `Loja ${i + 1}`, x, y: top, w: wt, h: corY - top - 6, porta: { x: x + wt / 2, y: corY } }); }
  // fileira de baixo: pequenas à esquerda, átrio (entrada e praça de eventos) no centro, praça de alimentação à direita
  const atrio = { x: cx - 64, w: 128 }, esqW = atrio.x - x0 - 6, nPeq = spec.pequenas, wp = (esqW - (nPeq - 1) * 6) / nPeq;
  for (let i = 0; i < nPeq; i++) { const x = x0 + i * (wp + 6); u.push({ id: "p" + (i + 1), tam: "pequena", nome: `Loja ${nTop + i + 1}`, x, y: baseY, w: wp, h: 70, porta: { x: x + wp / 2, y: corY + corH } }); }
  const fx0 = atrio.x + atrio.w + 6, fw = x1 - fx0, nAl = spec.alimentacao, wa = (fw - (nAl - 1) * 4) / nAl;
  for (let i = 0; i < nAl; i++) { const x = fx0 + i * (wa + 4); u.push({ id: "f" + (i + 1), tam: "alimento", nome: `Box ${i + 1} da praça`, x, y: baseY, w: wa, h: 34, porta: { x: x + wa / 2, y: baseY + 40 } }); }
  // quiosques no corredor
  for (let i = 0; i < spec.quiosques; i++) { const x = x0 + 30 + i * ((larg - 60) / Math.max(1, spec.quiosques - 1 || 1)) - 14;
    u.push({ id: "q" + (i + 1), tam: "quiosque", nome: `Quiosque ${i + 1}`, x: Math.min(x1 - 30, x), y: corY + 18, w: 28, h: 20, porta: { x: Math.min(x1 - 30, x) + 14, y: corY + 44 } }); }
  return { unidades: u, corY, corH, x0, x1, atrio: { x: atrio.x, w: atrio.w, y: corY + corH, h: H - corY - corH }, praca: { x: fx0, y: baseY + 44, w: fw, h: bot - baseY - 44 }, entrada: { x: cx, y: H - 4 },
    palco: { x: atrio.x + 8, y: baseY + 26, w: 46, h: 30 }, equip: [
      { id: "escada", nome: "Escada rolante", ic: "🛗", x: cx + 34, y: baseY + 40 }, { id: "ar", nome: "Ar-condicionado", ic: "❄️", x: x0 + 12, y: top + 8 },
      { id: "banheiro", nome: "Banheiros", ic: "🚻", x: x1 - 12, y: baseY + 4 }, { id: "luz", nome: "Iluminação do corredor", ic: "💡", x: cx, y: corY + 6 }] };
}
let LAY = null;
const shSpec = () => FASE === "grande" ? { topo: 7, pequenas: 4, alimentacao: 5, quiosques: 5, ancoraCentro: true } : { topo: 4, pequenas: 2, alimentacao: 3, quiosques: 3 };
function lay() { if (!LAY) LAY = layoutShopping(shSpec()); return LAY; }

// ---------- estado ----------
const novoShop = () => ({ limpeza: 3, seguranca: 2, manut: 1, sujeira: 0, panes: [], campanhas: {}, eventos: {}, relatorios: [], hoje: novoHojeSh(), dias: [], satEMA: 0.7, totVisitas: 0, eventosOk: 0, campanhasOk: 0 });
const novoHojeSh = () => ({ visitas: 0, recusados: 0, satSoma: 0, satT: 0, vendas: 0, evPublico: 0, evReceita: 0, evVendas: 0, evRecusados: 0, picoDentro: 0 });
function sh() {
  if (!S.shop) S.shop = novoShop();
  const s = S.shop; s.panes = s.panes || []; s.campanhas = s.campanhas || {}; s.eventos = s.eventos || {}; s.relatorios = s.relatorios || []; s.dias = s.dias || []; s.hoje = Object.assign(novoHojeSh(), s.hoje || {});
  return s;
}
function lojasSh() {
  if (!S.lojasSh) { S.lojasSh = novoConjunto(lay().unidades.map(u => ({ id: u.id, tam: u.tam, nome: u.nome }))); }
  return S.lojasSh;
}
const SH_LOC = () => ({ cadaProposta: FASE === "grande" ? 30 : 42, validade: 60, maxPropostas: 3, custoFixo: 0, custoVaga: 14, custoOcupada: 0, pctVendas: [0.04, 0.08], fatorAluguel: FASE === "grande" ? 1.25 : 1 });
const semana = (dia = S.day) => ((SH_CFG.semanaInicial + dia - 2) % 52 + 52) % 52 + 1;
// ---------- calendário: campanhas sazonais (por semana do ano) e eventos temporários ----------
const CAMPANHAS = [
  { id: "maes", nome: "Dia das Mães", semanas: [18, 19], custo: 700, fluxo: 0.25, gasto: 0.2, cats: ["moda", "servicos", "alimentacao"] },
  { id: "namorados", nome: "Dia dos Namorados", semanas: [23, 24], custo: 600, fluxo: 0.15, gasto: 0.25, cats: ["moda", "alimentacao", "lazer"] },
  { id: "ferias", nome: "Férias de julho", semanas: [28, 29, 30], custo: 650, fluxo: 0.2, gasto: 0.1, cats: ["lazer", "alimentacao"] },
  { id: "pais", nome: "Dia dos Pais", semanas: [31, 32], custo: 650, fluxo: 0.2, gasto: 0.2, cats: ["eletronicos", "moda"] },
  { id: "criancas", nome: "Dia das Crianças", semanas: [40, 41], custo: 750, fluxo: 0.3, gasto: 0.2, cats: ["lazer", "alimentacao"] },
  { id: "black", nome: "Semana de ofertas de novembro", semanas: [47], custo: 900, fluxo: 0.4, gasto: 0.3, cats: ["eletronicos", "moda"] },
  { id: "natal", nome: "Natal", semanas: [50, 51, 52], custo: 1200, fluxo: 0.45, gasto: 0.35, cats: ["moda", "lazer", "eletronicos", "alimentacao"] },
  { id: "aulas", nome: "Volta às aulas", semanas: [5, 6], custo: 500, fluxo: 0.15, gasto: 0.15, cats: ["lazer", "moda"] },
  { id: "carnaval", nome: "Carnaval na praça", semanas: [7, 8], custo: 600, fluxo: 0.2, gasto: 0.1, cats: ["alimentacao"] },
  { id: "pascoa", nome: "Páscoa", semanas: [13, 14], custo: 550, fluxo: 0.2, gasto: 0.2, cats: ["alimentacao", "lazer"] },
];
const EVENTOS = [
  { id: "feira", nome: "Feira de artesanato local", ic: "🧺", custo: 600, publico: 45, ingresso: 13, sujeira: 1.2, seguranca: 2, desc: "Barracas de artesãos da cidade. Público fiel, baixo custo." },
  { id: "parque", nome: "Parque infantil", ic: "🎠", custo: 900, publico: 60, ingresso: 15, sujeira: 1.4, seguranca: 3, desc: "Brinquedos no átrio. Atrai famílias; precisa de segurança." },
  { id: "circo", nome: "Circo no estacionamento", ic: "🎪", custo: 1500, publico: 80, ingresso: 19, sujeira: 1.5, seguranca: 4, desc: "Lona no estacionamento: ingressos rendem bem, mas o estacionamento enche." },
  { id: "show", nome: "Show na praça de eventos", ic: "🎤", custo: 2200, publico: 120, ingresso: 17, sujeira: 2, seguranca: 5, desc: "Muita gente de uma vez: limpeza e segurança dobram de importância." },
];
const campanhaDa = sem => CAMPANHAS.find(c => c.semanas.includes(sem));
const campanhaAtiva = () => { const c = campanhaDa(semana()); return c && sh().campanhas[S.day] === c.id ? c : null; };
const eventoAtivo = () => { const id = sh().eventos[S.day]; return id ? EVENTOS.find(e => e.id === id) : null; };

// ---------- capacidade e satisfação ----------
const maxEquipeSh = papel => FASE === "grande" ? SH_CFG.maxGrande : SH_CFG[papel].max;
const multEquip = papel => sh().equip && sh().equip[papel] ? SH_CFG.equip[papel].mult : 1;
const capLimpeza = () => Math.round((sh().limpeza + SH_MOD.extraLimpeza()) * SH_CFG.limpeza.cap * multEquip("limpeza"));
const capSeguranca = () => Math.round((sh().seguranca + SH_MOD.extraSeg()) * SH_CFG.seguranca.cap * multEquip("seguranca"));
const capacidade = () => Math.max(4, Math.round(Math.min(capLimpeza(), capSeguranca()) * (sh().panes.some(p => p.id === "ar") ? 0.8 : 1) * SH_MOD.cap()));
const dicaLotacao = () => { const p = gargalo() === "limpeza" ? "limpeza" : "seguranca", s = sh();
  return s[p] < maxEquipeSh(p) ? "Contrate mais equipe em Operação." : !(s.equip && s.equip[p]) ? `Equipe no máximo: compre ${SH_CFG.equip[p].nome.toLowerCase()} em Operação.` : "Em semana de evento, use o reforço temporário na reunião da semana."; };
const gargalo = () => capLimpeza() <= capSeguranca() ? "limpeza" : "segurança";
const dentro = () => visitantes.filter(v => v.estado !== "fora").length;
// 1.6: cada parcela da satisfação, com nome e dica (tocar nas estrelas mostra esta lista)
function fatoresSatisfacao() {
  const s = sh(), L = lojasSh(), cats = categoriasAtivas(L).filter(c => c !== "ancora").length;
  const lot = dentro() / Math.max(1, capacidade()), suj = Math.min(1, s.sujeira / 60), ev = eventoAtivo(), ocup = taxaOcupacao(L), anc = ocupadas(L).some(u => u.tam === "ancora");
  return [
    { id: "variedade", nome: `Variedade: ${cats} categoria(s) de loja`, v: Math.min(0.16, cats * 0.03), max: 0.16, dica: "Assine lojas de categorias diferentes (até 6 categorias contam)." },
    { id: "limpeza", nome: `Limpeza: ${Math.round((1 - suj) * 100)}% limpo`, v: (1 - suj) * 0.16, max: 0.16, dica: "Contrate limpeza ou compre a lavadora de piso em Operação." },
    { id: "lotacao", nome: `Lotação: ${Math.round(lot * 100)}% da capacidade`, v: -Math.max(0, lot - 0.85) * 0.8, max: 0, dica: `Acima de 85% incomoda. A ${gargalo()} limita a capacidade: ${dicaLotacao()}` },
    { id: "panes", nome: s.panes.length ? `${s.panes.length} equipamento(s) com defeito` : "Equipamentos funcionando", v: -s.panes.length * 0.07, max: 0, dica: "Mande consertar no painel de Operação, ou contrate a manutenção completa." },
    { id: "vagas", nome: `Lojas ocupadas: ${Math.round(ocup * 100)}%`, v: -(1 - ocup) * 0.12, max: 0, dica: "Loja vaga deixa o corredor sem graça: aceite propostas para as salas vazias." },
    { id: "campanha", nome: campanhaAtiva() ? "Campanha de marketing ativa" : "Sem campanha de marketing", v: campanhaAtiva() ? 0.04 : 0, max: 0.04, dica: "Uma campanha anima os visitantes enquanto dura." },
    { id: "evento", nome: ev ? (s.seguranca >= ev.seguranca ? "Evento com segurança suficiente" : `Evento com pouca segurança (precisa de ${ev.seguranca})`) : "Sem evento agora", v: ev ? (s.seguranca >= ev.seguranca ? 0.04 : -0.1) : 0, max: ev ? 0.04 : 0, dica: "Em evento, tenha a segurança pedida (contrate, compre câmeras ou use o reforço da reunião)." },
    { id: "ancora", nome: anc ? "Loja âncora aberta" : "Nenhuma loja âncora", v: anc ? 0.05 : 0, max: 0.05, dica: "Uma âncora (grande loja) atrai e agrada os visitantes." },
    { id: "extra", nome: "Outros efeitos do capítulo", v: SH_MOD.sat(), max: 0, dica: "" },
  ];
}
function satisfacaoAgora() {
  const v = fatoresSatisfacao().reduce((a, f) => a + f.v, 0.5);
  return Math.max(0, Math.min(1, v));
}
// ---------- visitantes ----------
const visitantes = []; let tPe = 0, tEv = 0;
function novoVisitante(car, idx, evento) {
  const L = lojasSh(), abertas = ocupadas(L); if (!abertas.length) { if (car) car.back++; return; }
  const s = sh(), Y = lay(), ev = eventoAtivo();
  if (dentro() >= capacidade() && !SH_MOD.deixarEntrar(evento)) { s.hoje.recusados++; if (evento) s.hoje.evRecusados++; S.today.lost++; changeRep(-0.01, "lotacao"); if (car) car.back++; if (!s.avisoLotado) { s.avisoLotado = true; toastOnce("lotadoSh", `Shopping lotado: a ${gargalo()} limita a capacidade a ${capacidade()} pessoas. ${dicaLotacao()}`); } return; }
  // roteiro: 1 a 3 lojas, puxado pelo movimento que cada ramo traz
  const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.25 ? 1 : 0), roteiro = [];
  for (let k = 0; k < n; k++) { const tot = abertas.reduce((a, u) => a + RAMOS[u.ocup.ramo].fluxo, 0); let r = Math.random() * tot; const u = abertas.find(x => (r -= RAMOS[x.ocup.ramo].fluxo) <= 0) || abertas[0]; if (!roteiro.includes(u.id)) roteiro.push(u.id); }
  const sp = car && stallByKey(car.stall), Pk = pkY(), x0 = sp ? sp.x + (idx ? 5 : -4) : (Math.random() < 0.5 ? -20 : W + 20);
  const v = { id: 5000 + Math.floor(Math.random() * 1e7), x: x0, y: car ? Pk.stall : Pk.walk, cx: x0, path: [], roteiro, passo: 0, estado: "chegando", t: 0, car: car ? car.id : null, ev: false,
    shirt: pick(SHIRTS), hair: pick(HAIR), skin: pick(SKIN), long: Math.random() < .4, sacolas: 0 };
  v.path = [{ x: v.x, y: Pk.walk }, { x: Y.entrada.x + (Math.random() - 0.5) * 30, y: Pk.walk }, { x: Y.entrada.x + (Math.random() - 0.5) * 30, y: H - 10 }];
  if (DIV) perfilarVisitante(v);
  visitantes.push(v); s.hoje.visitas++; s.totVisitas++; S.today.served++; S.served++; taskProgress("serve", 1);
  if (ev && evento) { v.ev = true; s.hoje.evPublico++; const r = ev.ingresso; S.money += r; S.today.outras = (S.today.outras || 0) + r; s.hoje.evReceita += r; }
}
function perfilarVisitante(v) { const r = Math.random(); v.perfil = r < 0.05 ? "cadeira" : r < 0.09 ? "bebe" : r < 0.12 ? "bengala" : "padrao"; }
function rumo(v) {          // próximo destino do roteiro
  const Y = lay(), L = lojasSh();
  if (v.passo >= v.roteiro.length) { v.estado = "saindo"; v.path = [{ x: Y.entrada.x, y: Y.corY + Y.corH / 2 }, { x: Y.entrada.x + (Math.random() - 0.5) * 30, y: H - 10 }, { x: Y.entrada.x, y: pkY().walk }, { x: v.cx, y: pkY().walk }, ...(v.car ? [{ x: v.cx, y: pkY().stall }] : [])]; return; }
  const u = Y.unidades.find(x => x.id === v.roteiro[v.passo]), lo = L.unidades.find(x => x.id === u.id);
  if (!lo || !lo.ocup) { v.passo++; return rumo(v); }
  const yc = Y.corY + Y.corH / 2 + (Math.random() - 0.5) * 20;
  v.path = [{ x: v.x, y: Math.min(v.y, yc) === v.y && v.y < Y.corY ? v.y : yc }, { x: u.porta.x, y: yc }, { x: u.porta.x, y: u.porta.y }];
  if (u.tam === "alimento") v.path.push({ x: Y.praca.x + 10 + Math.random() * (Y.praca.w - 20), y: Y.praca.y + 12 + Math.random() * (Y.praca.h - 24) });
  v.estado = "indo"; v.alvo = u.id;
}
function tickVisitantes(dt) {
  const s = sh(), L = lojasSh(), camp = campanhaAtiva(), ev = eventoAtivo();
  // a pé: ônibus, calçada, bairro
  const fluxo = (0.2 + 0.03 * S.rep) * (1 + fluxoInquilinos(L)) * (isRush() ? 1.4 : 1) * (camp ? 1 + camp.fluxo : 1) * (FASE === "grande" ? 1.35 : 1);
  tPe += dt * fluxo; while (tPe >= 1) { tPe -= 1; novoVisitante(null); }
  if (ev) { tEv += dt * ev.publico / DAY_LEN * (isRush() ? 1.3 : 0.92); while (tEv >= 1) { tEv -= 1; novoVisitante(null, 0, true); } }   // público do evento: chega a pé e de ônibus
  for (let i = visitantes.length - 1; i >= 0; i--) {
    const v = visitantes[i], chegou = follow(v, 58, dt);
    s.sujeira += dt * 0.012 * (ev ? ev.sujeira : 1) * SH_MOD.sujeira();
    if (v.estado === "chegando" && chegou) rumo(v);
    else if (v.estado === "indo" && chegou) { v.estado = "dentro"; v.t = 4 + Math.random() * 5; }
    else if (v.estado === "dentro") { v.t -= dt; if (v.t <= 0) {
      const lo = L.unidades.find(x => x.id === v.alvo); if (lo && lo.ocup) { const R = RAMOS[lo.ocup.ramo], gasto = R.base * 0.55 * (0.6 + Math.random() * 0.8) * (camp && camp.cats.includes(R.cat) ? 1 + camp.gasto : 1);
        lo.ocup.vendas += gasto; s.hoje.vendas += gasto; if (v.ev) s.hoje.evVendas += gasto * (lo.ocup.pct || 0); v.sacolas++; taskProgress("sales", gasto); }
      v.passo++; rumo(v); } }
    else if (v.estado === "saindo" && chegou) { if (v.car) { const car = pcars.find(k => k.id === v.car); if (car) car.back++; } visitantes.splice(i, 1); }
  }
  s.hoje.picoDentro = Math.max(s.hoje.picoDentro, dentro());
}
// ---------- equipe de limpeza e segurança (desenho e efeito) ----------
const equipeSh = [];
function syncEquipeSh() {
  const s = sh(), Y = lay(), quer = [...Array(s.limpeza).fill("limpeza"), ...Array(s.seguranca).fill("seguranca")];
  while (equipeSh.length > quer.length) equipeSh.pop();
  quer.forEach((papel, i) => { if (!equipeSh[i] || equipeSh[i].papel !== papel) equipeSh[i] = { id: 8000 + i, papel, x: Y.x0 + 20 + (i * 47) % (Y.x1 - Y.x0 - 40), y: Y.corY + Y.corH / 2, path: [], skin: SKIN[i % SKIN.length], hair: HAIR[(i + 2) % HAIR.length] }; });
}
let sujeiras = [];
function tickEquipeSh(dt) {
  const s = sh(), Y = lay();
  syncEquipeSh();
  s.sujeira = Math.max(0, s.sujeira - dt * s.limpeza * 0.11);
  // manchas no chão acompanham o nível de sujeira
  const alvo = Math.min(14, Math.floor(s.sujeira / 4));
  while (sujeiras.length < alvo) sujeiras.push({ x: Y.x0 + 10 + Math.random() * (Y.x1 - Y.x0 - 20), y: Y.corY + 8 + Math.random() * (Y.corH - 16) });
  while (sujeiras.length > alvo) sujeiras.shift();
  equipeSh.forEach(e => {
    if (follow(e, 46, dt)) {
      if (e.papel === "limpeza") { const m = sujeiras[Math.floor(Math.random() * Math.max(1, sujeiras.length))]; e.path = [m ? { x: m.x, y: m.y } : { x: Y.x0 + 20 + Math.random() * (Y.x1 - Y.x0 - 40), y: Y.corY + 12 + Math.random() * (Y.corH - 24) }]; }
      else e.path = [{ x: Y.x0 + 30 + Math.random() * (Y.x1 - Y.x0 - 60), y: Math.random() < 0.3 ? H - 30 : Y.corY + 10 + Math.random() * (Y.corH - 20) }];
    }
  });
}
// ---------- manutenção: panes ----------
function tickManutencao(dt) {
  const s = sh(), Y = lay(), M = SH_CFG.manutencao[s.manut];
  if (Math.random() < M.pane * dt * SH_MOD.paneMult()) { const livres = Y.equip.filter(q => !s.panes.some(p => p.id === q.id)); if (livres.length) { const q = SH_MOD.escolherPane ? SH_MOD.escolherPane(livres) : sorteio(livres); s.panes.push({ id: q.id, t: 0 }); banner(`⚠️ ${q.nome} com defeito`, "#b7773b"); anunciar(`${q.nome} com defeito. Mande consertar no painel de operação.`); lastSig = ""; } }
  s.panes.forEach(p => p.t += dt);
  if (s.manut === 2) s.panes = s.panes.filter(p => p.t < 12);                  // contrato completo conserta sozinho
}
function consertar(id) {
  const s = sh(), k = s.panes.findIndex(p => p.id === id); if (k < 0) return;
  if (!pagarContratacao(SH_CFG.conserto, "o conserto")) return;
  s.panes.splice(k, 1); toast("Conserto feito."); save(); lastSig = ""; renderSheet();
}
// ---------- tick geral ----------
function tickShopping(dt) {
  const s = sh();
  tickVisitantes(dt); tickEquipeSh(dt); tickManutencao(dt);
  tickLocacao(lojasSh(), SH_LOC(), dt); SH_MOD.tick(dt);
  const sat = satisfacaoAgora(); s.hoje.satSoma += sat * dt; s.hoje.satT += dt;
  s.satEMA += (sat - s.satEMA) * Math.min(1, dt / 20);
  S.rep = Math.round((1 + 4 * s.satEMA) * 100) / 100;          // estrelas = satisfação dos visitantes
}
function fecharSemanaShopping() {         // antes do fechamento: aluguéis, % das vendas, condomínio vago e manutenção
  const s = sh(), d = diaLocacao(lojasSh(), SH_LOC()), M = SH_CFG.manutencao[s.manut];
  S.money += d.receita - d.despesas - M.custo; S.today.outras = (S.today.outras || 0) + d.receita; S.today.outrasDesp = (S.today.outrasDesp || 0) + d.despesas + M.custo;
  S.today.sales = (S.today.sales || 0);      // vendas do mercado: não há
  S.today.linhas = (S.today.linhas || []).concat([["Aluguéis e % das vendas", `M ${fmt(d.receita)}`], ["Condomínio de lojas vagas", `-M ${fmt(d.despesas)}`], [`Manutenção (${M.nome.toLowerCase()})`, `-M ${fmt(M.custo)}`]]);
  s.ultimoLoc = d; SH_MOD.fechar();
}
function fimSemanaShopping(L) {
  const s = sh(), h = s.hoje, sat = h.satT ? h.satSoma / h.satT : s.satEMA, ev = eventoAtivo(), camp = campanhaAtiva(), d = s.ultimoLoc || {};
  const tot = h.visitas + h.recusados;
  const reg = { dia: L.day, semana: semana(L.day), visitas: h.visitas, recusados: h.recusados, recusa: tot ? h.recusados / tot : 0, sat, vendas: Math.round(h.vendas), ocupacao: taxaOcupacao(lojasSh()), receitaLoc: d.receita || 0, net: Math.round(L.net), cats: categoriasAtivas(lojasSh()).length, picoDentro: h.picoDentro, cap: capacidade() };
  s.dias.unshift(reg); s.dias.length = Math.min(s.dias.length, 7); L.shopping = reg;
  if (ev) {         // relatório do evento
    // a % das vendas do público do evento já entrou nos aluguéis da semana: aqui só é mostrada (nada é cobrado duas vezes)
    const custoTotal = ev.custo, receita = Math.round(h.evReceita), extra = Math.round(h.evVendas), res = receita + extra - custoTotal;
    const rel = { tipo: "evento", id: ev.id, nome: ev.nome, dia: L.day, semana: reg.semana, publico: h.evPublico, recusados: h.evRecusados, custos: custoTotal, receitas: receita, alugueisExtra: extra, resultado: res, satisfacao: sat, seguranca: s.seguranca >= ev.seguranca };
    s.relatorios.unshift(rel); s.relatorios.length = Math.min(s.relatorios.length, 8); if (res > 0) s.eventosOk++;
    setTimeout(() => mostrarRelatorioEvento(rel), 3200);
  }
  if (camp) { s.campanhasOk++; s.relatorios.unshift({ tipo: "campanha", id: camp.id, nome: camp.nome, dia: L.day, semana: reg.semana, publico: h.visitas, custos: camp.custo, satisfacao: sat, vendas: reg.vendas }); s.relatorios.length = Math.min(s.relatorios.length, 8); }
  SH_MOD.fimSemana(reg, L); s.hoje = novoHojeSh(); s.avisoLotado = false;
}
function mostrarRelatorioEvento(r) {
  if (!document.getElementById("modal").hidden) { filaModal.push(() => mostrarRelatorioEvento(r)); return; }
  showModal(`<h2>${EVENTOS.find(e => e.id === r.id).ic} ${r.nome}: relatório</h2><p>Semana ${r.semana} (dia ${r.dia} de jogo).</p>
    <table><tr><td>Público do evento</td><td>${r.publico} pessoas</td></tr><tr><td>Custos (produção e divulgação)</td><td class="neg">-M ${fmt(r.custos)}</td></tr>
    <tr><td>Receitas (ingressos e estandes)</td><td class="pos">+M ${fmt(r.receitas)}</td></tr><tr><td>% das vendas do público do evento (já nos aluguéis)</td><td class="pos">+M ${fmt(r.alugueisExtra)}</td></tr>
    <tr><td><b>Resultado</b></td><td class="${r.resultado >= 0 ? "pos" : "neg"}"><b>${r.resultado >= 0 ? "+" : "-"}M ${fmt(Math.abs(r.resultado))}</b></td></tr>
    <tr><td>Satisfação da semana</td><td>${pctTxt(r.satisfacao)}</td></tr></table>
    ${r.recusados ? `<div class="warn">${r.recusados} pessoas do evento não entraram: o shopping estava lotado. Mais limpeza e segurança aumentam a capacidade.</div>` : ""}${r.seguranca ? "" : `<div class="warn">Faltou segurança para o tamanho do evento: a satisfação caiu.</div>`}<button class="btn" id="ok">Fechar</button>`);
  document.getElementById("ok").onclick = hideModal;
}

// ---------- ações ----------
function mudarEquipeSh(papel, d) {
  const s = sh(), C = SH_CFG[papel];
  if (d > 0) { if (s[papel] >= maxEquipeSh(papel)) { const q = SH_CFG.equip[papel]; toast(`No máximo ${maxEquipeSh(papel)}. ${s.equip && s.equip[papel] ? "Para eventos grandes, use o reforço temporário na reunião da semana." : `Para caber mais gente, compre: ${q.nome.toLowerCase()} em Operação.`}`); return; } if (!pagarContratacao(C.contratar, papel === "limpeza" ? "uma pessoa da limpeza" : "um segurança")) return; s[papel]++; taskProgress("upgrades", 1); }
  else if (s[papel] > (FASE === "grande" && S.obra && S.obra.fase !== "operacao" ? 0 : 1)) s[papel]--;     // antes de abrir o Grande dá para dispensar todos
  anunciar(`Capacidade agora: ${capacidade()} pessoas.`); save(); lastSig = ""; renderSheet();
}
function comprarEquipSh(papel) {
  const s = sh(), q = SH_CFG.equip[papel]; s.equip = s.equip || {};
  if (s.equip[papel]) return; if (S.money < q.custo) { toast(`Falta dinheiro: ${q.nome.toLowerCase()} custa M ${fmt(q.custo)}.`); return; }
  if (!pagarContratacao(q.custo, q.nome.toLowerCase())) return;
  s.equip[papel] = true;
  banner(`${q.ic} ${q.nome} instalada`, "#2e7a57"); anunciar(`${q.nome}: cada pessoa da ${papel === "limpeza" ? "limpeza" : "segurança"} comporta mais ${Math.round((q.mult - 1) * 100)}%. Capacidade agora: ${capacidade()} pessoas.`); save(); lastSig = ""; renderSheet();
}
function mudarManut(d) { const s = sh(); s.manut = Math.max(0, Math.min(2, s.manut + d)); anunciar(`Manutenção ${SH_CFG.manutencao[s.manut].nome.toLowerCase()}: M ${SH_CFG.manutencao[s.manut].custo} por semana.`); save(); lastSig = ""; renderSheet(); }
function agendarCampanha(dia) {
  const s = sh(), c = campanhaDa(semana(dia)); if (!c || s.campanhas[dia]) return false;
  if (dia < S.day) return false;
  if (!pagarContratacao(c.custo, `a campanha de ${c.nome}`)) return false;
  s.campanhas[dia] = c.id; banner(`📣 Campanha de ${c.nome} agendada`, "#0f6e7a"); save(); lastSig = ""; renderSheet(); return true;
}
function agendarEvento(dia, id) {
  const s = sh(), e = EVENTOS.find(x => x.id === id); if (!e || s.eventos[dia] || dia < S.day) return false;
  if (dia === S.day && S.dayT > DAY_LEN * 0.3) { toast("Esta semana já começou: agende para a próxima."); return false; }
  if (!pagarContratacao(e.custo, e.nome.toLowerCase())) return false;
  s.eventos[dia] = id; banner(`${e.ic} ${e.nome} agendado para a semana ${semana(dia)}`, "#0f6e7a"); save(); lastSig = ""; renderSheet(); return true;
}

// ---------- desenho ----------
function desenharShopping() {
  drawBackground();
  const Y = lay(), L = lojasSh(), s = sh(), cor = SCENE.letreiro.signColor;
  // prédio
  rr(0, 40, W, H - 40, 10, "#efe9dc"); rr(4, 44, W - 8, H - 48, 8, grad(44, H, "#f7f3ea", "#ece4d4"));
  // corredor e átrio com piso brilhante
  ctx.fillStyle = "#fbf9f4"; ctx.fillRect(Y.x0 - 8, Y.corY, Y.x1 - Y.x0 + 16, Y.corH); ctx.fillRect(Y.atrio.x, Y.atrio.y, Y.atrio.w, Y.atrio.h);
  ctx.fillStyle = "rgba(15,110,122,.06)"; for (let x = Y.x0; x < Y.x1; x += 24) ctx.fillRect(x, Y.corY, 12, Y.corH);
  // praça de alimentação: mesas
  for (let i = 0; i < 12; i++) { const tx = Y.praca.x + 14 + (i % 4) * (Y.praca.w - 28) / 3, ty = Y.praca.y + 14 + Math.floor(i / 4) * ((Y.praca.h - 28) / 2); ctx.fillStyle = "#d7c9ad"; ctx.beginPath(); ctx.arc(tx, ty, 6, 0, 7); ctx.fill(); }
  text("PRAÇA DE ALIMENTAÇÃO", Y.praca.x + Y.praca.w / 2, Y.praca.y + Y.praca.h - 2, 6.5, "#8e7350", "center", 800);
  // lojas
  Y.unidades.forEach(u => { const lo = L.unidades.find(x => x.id === u.id), o = lo && lo.ocup, R = o && RAMOS[o.ramo];
    rr(u.x, u.y, u.w, u.h, 6, o ? "#fff" : "#e6dfd0"); ctx.strokeStyle = o ? shade(R.cor, .8) : "rgba(120,100,70,.4)"; ctx.lineWidth = 1.2; ctx.strokeRect(u.x + .5, u.y + .5, u.w - 1, u.h - 1);
    const fy = u.tam === "quiosque" ? u.y : u.porta.y < u.y + u.h / 2 ? u.y : u.y + u.h - 12;
    if (o) { rr(u.x + 2, fy + (fy === u.y ? 2 : 0), u.w - 4, 10, 3, R.cor); emoji(R.ic, u.x + u.w / 2, u.y + u.h / 2 + 2, u.tam === "quiosque" ? 8 : 12);
      if (u.tam !== "quiosque" && u.tam !== "alimento") text(o.nome.length * 3.6 > u.w ? o.nome.split(" ")[0] : o.nome, u.x + u.w / 2, fy + (fy === u.y ? 9.5 : 7.5), 6, "#fff", "center", 800);
      if (o.atrasos) text("⚠", u.x + u.w - 7, u.y + 20, 8, "#c9513a"); }
    else if (u.tam === "alimento") text("vago", u.x + u.w / 2, u.y + u.h / 2 + 3, 6.5, "#b07a2a", "center", 800);
    else { text(u.tam === "quiosque" ? "vago" : "ALUGA-SE", u.x + u.w / 2, u.y + u.h / 2 + 3, u.tam === "quiosque" ? 6 : 8, "#b07a2a", "center", 800); if (u.tam !== "quiosque") text(TAMANHOS[u.tam].nome, u.x + u.w / 2, u.y + u.h / 2 + 14, 6, "#8e7350"); }
    if (L.propostas.some(p => p.unidade === u.id)) { rr(u.x + u.w - 14, u.y - 4, 14, 12, 6, "#c9302c"); text("!", u.x + u.w - 7, u.y + 5, 8, "#fff"); }
  });
  // palco / praça de eventos
  const ev = eventoAtivo(), pc = Y.palco;
  rr(pc.x, pc.y, pc.w, pc.h, 5, ev ? "#0f6e7a" : "#d8d2c4"); text(ev ? ev.ic : "🎪", pc.x + pc.w / 2, pc.y + 17, 12); text(ev ? "EVENTO" : "PRAÇA DE EVENTOS", pc.x + pc.w / 2, pc.y + pc.h + 8, 5.8, ev ? "#0f6e7a" : "#8e7350", "center", 800);
  // manchas e panes
  sujeiras.forEach(m => { ctx.fillStyle = "rgba(120,95,60,.22)"; ctx.beginPath(); ctx.ellipse(m.x, m.y, 6, 3, 0, 0, 7); ctx.fill(); });
  Y.equip.forEach(q => { const p = s.panes.find(x => x.id === q.id); if (p) { rr(q.x - 11, q.y - 11, 22, 22, 11, "#c9513a"); emoji("⚠️", q.x, q.y + 1, 10); } else emoji(q.ic, q.x, q.y, 8); });
  // fachada, letreiro e portas de vidro
  rr(W / 2 - 110, 30, 220, 26, 8, shade(cor, .75)); rr(W / 2 - 108, 32, 216, 22, 7, grad(32, 54, shade(cor, 1.25), cor));
  text(`${SCENE.letreiro.sign[0]} ${SCENE.letreiro.sign[1]}`, W / 2, 47, 11, "#fff", "center", 800, "Baloo 2");
  rr(Y.entrada.x - 40, H - 6, 80, 8, 2, "#9ad0ec"); text("ENTRADA", Y.entrada.x, H + 12, 7, cor, "center", 800);
  // campanha
  const camp = campanhaAtiva(); if (camp) { rr(Y.x0, Y.corY - 14, 140, 12, 6, "#c62828"); text(`📣 ${camp.nome}`, Y.x0 + 70, Y.corY - 5.5, 6.5, "#fff", "center", 800); }
  // lotação
  const cap = capacidade(), n = dentro(); rr(Y.x1 - 104, Y.corY - 14, 104, 12, 6, n >= cap ? "#c9513a" : "#0f6e7a"); text(`👥 ${n}/${cap} · ${Math.round(sh().satEMA * 100)}% satisfeitos`, Y.x1 - 52, Y.corY - 5.5, 6.2, "#fff", "center", 800);
  // cidade, carros e estacionamento
  drawCidade(0); drawCars(); drawCidade(1); drawParking();
  SH_MOD.desenhar();
  // pessoas
  const ents = [...visitantes.filter(v => v.estado !== "dentro"), ...equipeSh].sort((a, b) => a.y - b.y);
  ents.forEach(p => { if (p.papel === "limpeza") { person(p, { body: "#4aa3a3", cap: "#2e7a57", moving: p.path.length > 0 }); rr(p.x + 7, p.y - 2, 3, 14, 1, "#8e7350"); }
    else if (p.papel === "seguranca") { person(p, { body: "#263238", cap: "#263238", moving: p.path.length > 0 }); rr(p.x - 11, p.y - 36, 22, 8, 4, "#263238"); text("SEG.", p.x, p.y - 30, 5.6, "#fff"); }
    else if (DIV && p.perfil && p.perfil !== "padrao") { atualizarRumo(p); pessoaDiversa(p, { moving: p.path.length > 0 }); }
    else person(p, { moving: p.path.length > 0, basket: null }); if (p.sacolas) emoji("🛍️", p.x + 9, p.y + 2, 7); });
}

// ---------- painéis ----------
function cartaoShopping() {
  const c = el("div", "card"); c.innerHTML = `<h3>🏬 Administração do shopping</h3><p class="note" id="shRes"></p>`;
  live(() => { const q = c.querySelector("#shRes"); if (!q) return; const L = lojasSh(), s = sh();
    q.innerHTML = `Semana ${semana()} · ocupação ${pctTxt(taxaOcupacao(L))} · ${dentro()}/${capacidade()} pessoas · satisfação ${pctTxt(s.satEMA)}${L.propostas.length ? ` · <b>${L.propostas.length} proposta(s)</b>` : ""}${s.panes.length ? ` · <span class="tag ruim">${s.panes.length} pane(s)</span>` : ""}`; });
  const g = el("div", "linha2");
  [["Lojas e contratos", "lojas"], ["Operação", "operacao"], ["Calendário e eventos", "calendario"]].forEach(([t, k]) => { const b = el("button", "btn", t); b.onclick = () => openSheet(k); g.appendChild(b); });
  c.appendChild(g); return c;
}
function buildLojasSh(body) {
  const L = lojasSh();
  head("🏬", "#dff0f1", "Lojas e contratos", () => `${ocupadas(L).length} de ${L.unidades.length} ocupadas · ${categoriasAtivas(L).length} categorias`);
  body.appendChild(el("p", "note", "Cada contrato tem aluguel fixo por semana e uma porcentagem das vendas da loja. Âncoras (supermercado, departamentos, cinema) trazem muita gente; o mix de categorias aumenta a satisfação. Vagas custam condomínio."));
  const mix = el("div", "card"); mix.appendChild(el("h3", "", "Mix de lojas"));
  const cats = Object.keys(CAT_NOME).map(k => { const n = ocupadas(L).filter(u => RAMOS[u.ocup.ramo].cat === k).length; return `<span class="tag${n ? " bom" : ""}">${CAT_NOME[k]}: ${n}</span>`; }).join(" ");
  mix.appendChild(el("p", "note", cats)); body.appendChild(mix);
  painelLocacao(body, L, SH_LOC());
}
function buildOperacao(body) {
  const s = sh();
  head("🧹", "#dff0f1", "Operação", () => `Capacidade ${capacidade()} pessoas · gargalo: ${gargalo()} · ${occupied()}/${STALLS.length} vagas`);
  body.appendChild(el("p", "note", "Quantas pessoas cabem ao mesmo tempo depende da limpeza e da segurança; quantas chegam de carro depende do estacionamento. Shopping lotado recusa gente e a satisfação cai."));
  body.appendChild(statsBox([
    ["Pessoas agora", () => `${dentro()} de ${capacidade()}`],
    ["Satisfação", () => `${pctTxt(satisfacaoAgora())} agora · ${pctTxt(sh().satEMA)} média`],
    ["Sujeira", () => `${Math.round(Math.min(1, sh().sujeira / 60) * 100)}%`],
    ["Recusados nesta semana", () => `${sh().hoje.recusados} de ${sh().hoje.visitas + sh().hoje.recusados}`],
  ]));
  const ec = el("div", "card", `<h3>Equipe</h3><p class="note">Limpeza: M ${SH_CFG.limpeza.salario} por semana cada, comporta ${SH_CFG.limpeza.cap} pessoas. Segurança: M ${SH_CFG.seguranca.salario}, comporta ${SH_CFG.seguranca.cap}. Contratação: M ${SH_CFG.limpeza.contratar} / M ${SH_CFG.seguranca.contratar}.</p>`);
  ec.appendChild(passo("Limpeza", () => `${sh().limpeza} (cabem ${capLimpeza()})`, () => mudarEquipeSh("limpeza", -1), () => mudarEquipeSh("limpeza", 1), "equipe de limpeza"));
  ec.appendChild(passo("Segurança", () => `${sh().seguranca} (cabem ${capSeguranca()})`, () => mudarEquipeSh("seguranca", -1), () => mudarEquipeSh("seguranca", 1), "seguranças"));
  ec.appendChild(el("p", "note", `Equipe máxima: ${maxEquipeSh("limpeza")} de cada.`));
  ["limpeza", "seguranca"].forEach(papel => { const q = SH_CFG.equip[papel];
    if (s.equip && s.equip[papel]) ec.appendChild(el("p", "note", `<span class="tag bom">${q.ic} ${q.nome}</span> cada pessoa comporta +${Math.round((q.mult - 1) * 100)}%.`));
    else { const b = el("button", "btn", `${q.ic} ${q.nome}: +${Math.round((q.mult - 1) * 100)}% por pessoa (M ${fmt(q.custo)})`); b.onclick = () => comprarEquipSh(papel); ec.appendChild(b); } });
  body.appendChild(ec);
  const mc = el("div", "card", `<h3>Manutenção</h3><p class="note">Contrato de manutenção por semana. Quanto melhor, menos panes; o completo conserta sozinho em poucos segundos. Pane parada derruba a satisfação (ar-condicionado parado também reduz a capacidade).</p>`);
  mc.appendChild(passo("Contrato", () => `${SH_CFG.manutencao[sh().manut].nome} · M ${SH_CFG.manutencao[sh().manut].custo}`, () => mudarManut(-1), () => mudarManut(1), "contrato de manutenção"));
  s.panes.forEach(p => { const q = lay().equip.find(x => x.id === p.id); const b = el("button", "btn", `Consertar ${q.nome.toLowerCase()} (M ${SH_CFG.conserto})`); b.onclick = () => consertar(p.id); mc.appendChild(b); });
  if (!s.panes.length) mc.appendChild(el("p", "note", "Tudo funcionando."));
  body.appendChild(mc);
  const pk = el("button", "plain", `<span>Estacionamento: ${STALLS.length} vagas, cancela e atendentes</span>`); pk.onclick = () => select({ kind: "parking" }); body.appendChild(pk);
  if (s.dias.length) { body.appendChild(el("div", "sec-title", "Semanas anteriores"));
    s.dias.slice(0, 4).forEach(d => body.appendChild(el("div", "req", `<span>Semana ${d.semana}: ${d.visitas} visitas, ${d.recusados} recusados, satisfação ${pctTxt(d.sat)}</span><b>${d.net < 0 ? "-" : "+"}M ${fmt(Math.abs(d.net))}</b>`))); }
}
function buildCalendario(body) {
  const s = sh();
  head("📅", "#dff0f1", "Calendário e eventos", () => `Semana ${semana()} · ${campanhaAtiva() ? "campanha ativa" : "sem campanha"} · ${eventoAtivo() ? eventoAtivo().nome : "sem evento"}`);
  body.appendChild(el("p", "note", "Cada dia de jogo é uma semana. Campanhas sazonais só podem ser feitas nas semanas da data; eventos podem ser marcados em qualquer semana que ainda não começou (ou nos primeiros 30% da atual). O custo é pago ao agendar."));
  const cal = el("div", "cal-sh");
  for (let k = 0; k < 6; k++) { const dia = S.day + k, sem = semana(dia), c = campanhaDa(sem), ev = s.eventos[dia] && EVENTOS.find(e => e.id === s.eventos[dia]), agendada = s.campanhas[dia];
    const card = el("div", "card", `<div class="req"><span><b>Semana ${sem}</b>${k === 0 ? " (atual)" : ""}</span><b>${ev ? `${ev.ic} ${ev.nome}` : ""}</b></div>${c ? `<p class="note">📣 ${c.nome}: +${Math.round(c.fluxo * 100)}% de movimento, +${Math.round(c.gasto * 100)}% de gasto em ${c.cats.map(x => CAT_NOME[x].toLowerCase()).join(", ")}. Custo M ${fmt(c.custo)}.</p>` : ""}`);
    const g = el("div", "linha2");
    if (c && !agendada) { const b = el("button", "btn mini", `Fazer campanha (M ${fmt(c.custo)})`); b.setAttribute("aria-label", `Fazer a campanha de ${c.nome} na semana ${sem}`); b.onclick = () => agendarCampanha(dia); g.appendChild(b); }
    else if (agendada) card.appendChild(el("p", "note", `<span class="tag bom">Campanha agendada</span>`));
    if (!ev) EVENTOS.forEach(e => { const b = el("button", "plain mini", `<span>${e.ic} ${e.nome.split(" ")[0]} ${e.nome.split(" ").slice(1, 3).join(" ")} · M ${fmt(e.custo)}</span>`); b.setAttribute("aria-label", `Agendar ${e.nome} na semana ${sem} por M ${fmt(e.custo)}`); b.onclick = () => agendarEvento(dia, e.id); g.appendChild(b); });
    if (g.children.length) card.appendChild(g);
    cal.appendChild(card); }
  body.appendChild(cal);
  body.appendChild(el("div", "sec-title", "Eventos"));
  EVENTOS.forEach(e => body.appendChild(el("div", "card", `<h3>${e.ic} ${e.nome}</h3><p class="note">${e.desc} Custo M ${fmt(e.custo)} · cerca de ${e.publico} pessoas na semana · ingresso/estande M ${fmt(e.ingresso)} por pessoa · pede ${e.seguranca} seguranças.</p>`)));
  if (s.relatorios.length) { body.appendChild(el("div", "sec-title", "Relatórios"));
    s.relatorios.slice(0, 5).forEach(r => body.appendChild(el("div", "card", r.tipo === "evento"
      ? `<div class="req"><span>Semana ${r.semana}: ${r.nome}</span><b class="${r.resultado >= 0 ? "pos" : "neg"}">${r.resultado >= 0 ? "+" : "-"}M ${fmt(Math.abs(r.resultado))}</b></div><p class="note">Público ${r.publico} · custos M ${fmt(r.custos)} · receitas M ${fmt(r.receitas)} + aluguel extra M ${fmt(r.alugueisExtra)} · satisfação ${pctTxt(r.satisfacao)}</p>`
      : `<div class="req"><span>Semana ${r.semana}: campanha de ${r.nome}</span><b>M ${fmt(r.custos)}</b></div><p class="note">${r.publico} visitas · vendas dos lojistas M ${fmt(r.vendas)} · satisfação ${pctTxt(r.satisfacao)}</p>`))); }
}
function melhorarShopping(body, acts) {
  body.appendChild(storeRow("🏬", "#dff0f1", "Lojas e contratos", () => `${ocupadas(lojasSh()).length} de ${lojasSh().unidades.length} ocupadas · ${lojasSh().propostas.length} proposta(s)`, { kind: "shLojas" }, () => false));
  body.appendChild(storeRow("🧹", "#dff0f1", "Operação: limpeza, segurança e manutenção", () => `Capacidade ${capacidade()} · ${sh().panes.length} pane(s)`, { kind: "shOperacao" }, () => false));
  body.appendChild(storeRow("📅", "#dff0f1", "Calendário e eventos", () => `Semana ${semana()}`, { kind: "shCalendario" }, () => false));
  body.appendChild(storeRow("🅿️", "#dfe8f4", "Estacionamento", () => `${occupied()}/${STALLS.length} vagas · ${S.park.staff} atendente${S.park.staff === 1 ? "" : "s"} · ${S.park.price ? "M " + fmt(S.park.price) : "grátis"}`, { kind: "parking" }, a => a.kind.startsWith("park")));
  body.appendChild(storeRow("📣", "#f6e3c4", "Divulgação e gerência", () => `Propaganda nv ${S.adsLvl} · gerente ${S.mgrLvl ? "nv " + S.mgrLvl : "—"}`, { kind: "sign" }, a => a.kind === "ads" || a.kind === "mgr"));
}
function listaShopping(body) {
  const rs = el("div", "card resumo", `<h3>Agora no shopping</h3><p class="note" id="lsResumo"></p>`);
  live(() => { const q = rs.querySelector("#lsResumo"); if (q) q.textContent = `Semana ${semana()}. ${dentro()} pessoas dentro, capacidade ${capacidade()} (gargalo: ${gargalo()}). Satisfação ${pctTxt(sh().satEMA)}. ${sh().panes.length ? `${sh().panes.length} equipamento(s) com defeito.` : "Equipamentos funcionando."} Vagas ocupadas: ${occupied()} de ${STALLS.length}.`; });
  body.appendChild(rs);
  body.appendChild(el("div", "sec-title", "Administração"));
  body.appendChild(listaRow("🏬", "#dff0f1", "Lojas e contratos", () => `${ocupadas(lojasSh()).length} de ${lojasSh().unidades.length} ocupadas · ${lojasSh().propostas.length} proposta(s)`, { kind: "shLojas" }));
  body.appendChild(listaRow("🧹", "#dff0f1", "Operação", () => `Limpeza ${sh().limpeza}, segurança ${sh().seguranca}, manutenção ${SH_CFG.manutencao[sh().manut].nome.toLowerCase()}`, { kind: "shOperacao" }));
  body.appendChild(listaRow("📅", "#dff0f1", "Calendário e eventos", () => `${campanhaAtiva() ? `Campanha: ${campanhaAtiva().nome}. ` : ""}${eventoAtivo() ? `Evento: ${eventoAtivo().nome}` : "Nenhum evento nesta semana"}`, { kind: "shCalendario" }));
  body.appendChild(el("div", "sec-title", "Lojas"));
  const L = lojasSh();
  lay().unidades.forEach(u => body.appendChild(listaRow(u.tam === "ancora" ? "⭐" : u.tam === "alimento" ? "🍽️" : u.tam === "quiosque" ? "🛍️" : "🏪", "#f3efe6", u.nome,
    () => { const lo = L.unidades.find(x => x.id === u.id); return lo.ocup ? `${lo.ocup.nome} (${RAMOS[lo.ocup.ramo].nome}), M ${fmt(lo.ocup.aluguel)} por semana, contrato ${lo.ocup.resta > 0 ? `por mais ${lo.ocup.resta}` : "vencido"}` : `${TAMANHOS[u.tam].nome}, vaga${L.propostas.some(p => p.unidade === u.id) ? ", com proposta" : ""}`; },
    { kind: "shLojas" }, () => L.unidades.find(x => x.id === u.id).ocup ? "Ocupada" : "Vaga")));
  body.appendChild(el("div", "sec-title", "Serviços"));
  body.appendChild(listaRow("🅿️", "#dfe8f4", "Estacionamento", () => `${occupied()} de ${STALLS.length} vagas ocupadas · ${inQ.length} aguardando`, { kind: "parking" }));
  body.appendChild(listaRow("📣", "#f6e3c4", "Divulgação e gerência", () => `Propaganda nível ${S.adsLvl} · gerente ${S.mgrLvl ? "nível " + S.mgrLvl : "nenhum"}`, { kind: "sign" }));
  body.appendChild(el("p", "note", "Atalhos de teclado: setas movem o cenário, + e − mudam o zoom, 0 recentraliza, L abre esta lista e Esc fecha o painel."));
}

// ---------- capítulo 7: configuração ----------
const SH_META = { ocupacao: 0.85, sat: 0.8, cats: 5, lucro: 900 };
function extrasShopping() {
  const s = sh(), L = lojasSh(), ds = s.dias.slice(0, 3), satMed = ds.length ? ds.reduce((a, d) => a + d.sat, 0) / ds.length : 0;
  return [
    { id: "ocupacao", label: `Ocupação de ${pctTxt(SH_META.ocupacao)} das lojas`, tipo: "gestao", pct: true, have: taxaOcupacao(L), need: SH_META.ocupacao, como: "Aceite propostas; prefira bons pagadores e categorias que ainda faltam." },
    { id: "satisfacao", label: `Satisfação média de ${pctTxt(SH_META.sat)} (3 semanas)`, tipo: "gestao", have: ds.length >= 3 && satMed >= SH_META.sat ? 1 : 0, need: 1, mostra: () => ds.length ? `${pctTxt(satMed)} (${ds.length} de 3)` : "sem semanas fechadas",
      como: "Limpeza, lotação abaixo da capacidade, equipamentos funcionando, mix de lojas e âncoras ocupadas." },
    { id: "mix", label: `${SH_META.cats} categorias de lojas abertas`, tipo: "gestao", have: categoriasAtivas(L).filter(c => c !== "ancora").length, need: SH_META.cats, como: "Serviços, alimentação, eletrônicos, moda, lazer e quiosques contam (âncora não conta)." },
    { id: "evento", label: "Um evento com resultado positivo", tipo: "gestao", have: Math.min(1, s.eventosOk), need: 1, como: "Aba Carreira > Calendário e eventos. Veja o relatório no fim da semana." },
    { id: "campanha", label: "Uma campanha sazonal", tipo: "gestao", have: Math.min(1, s.campanhasOk), need: 1, como: "As datas aparecem no calendário; só valem nas semanas delas." },
  ].concat(typeof R14_META === "number" ? [{ id: "reunioes", label: `${R14_META} reuniões da semana decididas por você`, tipo: "gestao", have: Math.min(R14_META, decididas()), need: R14_META,
    como: "Abra a reunião da semana e escolha cada decisão (pode ser a opção padrão). Semana sem a sua escolha, ou entregue a uma política, não conta." }] : []);
}
function cfgShopping(base) {
  return Object.assign({
    essenciais: [], semGondolas: true,
    dia: { vazioMax: 1, perdidosMax: 1, repMin: 1 },
    diaComo: () => `Uma semana conta quando: satisfação média de pelo menos ${pctTxt(SH_CFG.satMin)}, até ${pctTxt(SH_CFG.recusaMax)} dos visitantes recusados por lotação, nenhum equipamento com defeito no fechamento e nenhuma dívida.`,
    avaliar(itens) { const s = sh(), h = s.hoje, sat = h.satT ? h.satSoma / h.satT : s.satEMA, tot = h.visitas + h.recusados, rec = tot ? h.recusados / tot : 0;
      itens.push({ ok: sat >= SH_CFG.satMin, txt: `Satisfação ${pctTxt(sat)} (mín. ${pctTxt(SH_CFG.satMin)})` });
      itens.push({ ok: rec <= SH_CFG.recusaMax, txt: `Recusados por lotação ${pctTxt(rec)} (máx. ${pctTxt(SH_CFG.recusaMax)})` });
      itens.push({ ok: !s.panes.length, txt: s.panes.length ? `${s.panes.length} equipamento(s) com defeito` : "Equipamentos funcionando" }); },
    fimDoDia(L) { fimSemanaShopping(L); },
    cartoes() { return [cartaoShopping()]; },
    missao() { const L = lojasSh(), s = sh();
      if (s.panes.length) return { title: `${s.panes.length} equipamento(s) com defeito`, sub: "Mande consertar em Operação", p: 0, ring: "⚠️", go: () => openSheet("operacao") };
      if (L.propostas.length) return { title: `${L.propostas.length} proposta(s) de lojistas`, sub: "Escolha quem ocupa as lojas vagas", p: taxaOcupacao(L), ring: "🏬", go: () => openSheet("lojas") };
      if (!s.eventosOk && !Object.keys(s.eventos).some(d => +d >= S.day)) return { title: "Organizar um evento", sub: "Calendário e eventos", p: 0, ring: "🎪", go: () => openSheet("calendario") };
      return null; },
  }, base);
}
FASE_CFG.brisa = cfgShopping({
  capitulo: 7, titulo: "Shopping Brisa da Lagoa", lugar: "Centro",
  resumo: "Shopping de bairro perto da lagoa: duas âncoras, lojas médias e pequenas, praça de alimentação, quiosques, praça de eventos e estacionamento com cancela.",
  intro: "Nova escala: você não vende, <b>administra</b>. Escolha lojistas pelas <b>propostas</b> (aluguel + % das vendas), equilibre o <b>mix</b>, cuide de <b>limpeza, segurança e manutenção</b> (elas e o estacionamento limitam quantas pessoas cabem) e use o <b>calendário</b>: cada dia é uma semana, com datas comemorativas e eventos na praça. No fim de cada evento, um relatório mostra público, custos e resultado.",
  diasSeguidos: 3, lucroMedio: SH_META.lucro,
  aluguel: SH_CFG.condominio, fluxo: 1,
  convite: {
    responsabilidades: "contratos de locação, mix de lojas, limpeza, segurança e manutenção limitando a lotação, campanhas sazonais e eventos com relatório de público, custos e resultado.",
    comeca: "orçamento de M 8.000, 6 das 16 lojas ocupadas (incluindo um supermercado âncora), 3 na limpeza, 2 seguranças, manutenção preventiva e 12 vagas com cancela.",
  },
  estrutura: [
    { id: "limpeza", label: "Equipe de limpeza com 4 pessoas", como: "Aba Carreira > Operação.", have: () => sh().limpeza, need: 4, painel: "operacao" },
    { id: "seguranca", label: "Equipe de segurança com 4 pessoas", como: "Segurança também é exigida pelos eventos maiores.", have: () => sh().seguranca, need: 4, painel: "operacao" },
    { id: "estacionamento", label: "Abrir o estacionamento descoberto", como: "Toque no terreno à venda ao lado do estacionamento.", have: () => owns("park1") ? 1 : 0, need: 1 },
  ],
  extras: extrasShopping,
  tick(dt) { tickShopping(dt); },
  orcamento: 8000,
  inicio() { iniciarShopping(this.orcamento, ["a1:mercado", "m1:moda", "m3:eletro", "f1:lanchonete", "q1:quiosque", "p1:otica"]); },
  carregar() { sh(); lojasSh(); },
  reabrir(r) { const s = sh(); s.limpeza = 4; s.seguranca = 4; s.eventosOk = 1; s.campanhasOk = 1; S.park.lots.park1 = true; reabrirComum(r); },
  reaberturaTxt: "equipes de limpeza e segurança, estacionamento ampliado e o orçamento inicial do Brisa (M 8.000)",
  previa: () => `<svg viewBox="0 0 220 120" class="previa" role="img" aria-label="Esquema do Shopping Brisa da Lagoa: duas lojas âncora nas pontas, corredor com quiosques, lojas em cima e embaixo, átrio com praça de eventos, praça de alimentação e estacionamento com cancela">
    <rect width="220" height="120" rx="10" fill="#c4ccb4"/><rect x="14" y="10" width="192" height="80" rx="6" fill="#f7f3ea" stroke="#0f6e7a" stroke-width="1.5"/>
    <rect x="18" y="14" width="34" height="50" rx="3" fill="#2e7d32"/><rect x="168" y="14" width="34" height="50" rx="3" fill="#ad1457"/>
    ${[0, 1, 2, 3].map(i => `<rect x="${56 + i * 28}" y="14" width="24" height="24" rx="2" fill="${["#c2185b", "#ece6d8", "#37474f", "#ece6d8"][i]}"/>`).join("")}
    <rect x="52" y="42" width="116" height="16" fill="#fbf9f4"/>${[0, 1, 2].map(i => `<rect x="${64 + i * 40}" y="46" width="8" height="6" rx="1" fill="#00838f"/>`).join("")}
    <rect x="56" y="62" width="22" height="20" rx="2" fill="#4a6fa5"/><rect x="82" y="62" width="22" height="20" rx="2" fill="#ece6d8"/><rect x="108" y="62" width="20" height="26" fill="#fbf9f4"/><rect x="110" y="66" width="10" height="8" rx="2" fill="#0f6e7a"/>
    <rect x="132" y="62" width="34" height="10" rx="2" fill="#d9822b"/>${[0, 1, 2].map(i => `<circle cx="${138 + i * 12}" cy="80" r="3" fill="#d7c9ad"/>`).join("")}
    <rect x="14" y="96" width="192" height="18" rx="3" fill="#9aa3a6"/><rect x="100" y="92" width="20" height="4" fill="#9ad0ec"/></svg>`,
});
function iniciarShopping(orc, inicio) {
  S.tier = 1; S.money = orc; S.whLvl = 0; S.cashiers = 0; S.gear.collectors = 0; S.gear.baskets = 0; S.gear.carts = 0;
  SECTORS.forEach(d => { const st = S.sec[d.id]; st.open = false; st.staff = 0; st.shelf = 0; st.wh = 0; });
  S.park.price = 2; S.park.staff = 1;
  S.shop = novoShop(); S.lojasSh = null; LAY = null;
  const L = lojasSh();
  inicio.forEach(par => { const [uid, ramo] = par.split(":"), u = L.unidades.find(x => x.id === uid), R = RAMOS[ramo], T = TAMANHOS[u.tam];
    u.ocup = { nome: R.nomes[0], ramo, aluguel: Math.round(R.base * T.mult * SH_LOC().fatorAluguel), pct: 0.05, diasContrato: 12, resta: 6 + Math.floor(Math.random() * 8), risco: R.risco, divida: 0, atrasos: 0, desde: S.day, vendas: 0 }; });
  gerarProposta(L, SH_LOC()); gerarProposta(L, SH_LOC());
  const r = CARREIRA && CARREIRA.repCarreira ? CARREIRA.repCarreira : 3.5; S.shop.satEMA = 0.62; S.rep = 1 + 4 * 0.62;
  ACH.forEach(x => { if (x.ok()) S.ach[x.id] = true; });
}

if (SH_ATIVO) {
  GANCHOS.simulacao = dt => { if (CFG && CFG.simulacaoPropria) CFG.simulacaoPropria(dt); };
  GANCHOS.chegada = (car, idx) => { if (CFG && CFG.chegadaPropria) return CFG.chegadaPropria(car, idx); novoVisitante(car, idx); };
  GANCHOS.desenharCena = () => { if (CFG && CFG.desenharPropria) CFG.desenharPropria(); else desenharShopping(); };
  GANCHOS.aluguel = () => CFG && CFG.aluguel != null ? CFG.aluguel : SH_CFG.condominio;
  GANCHOS.salarios = () => { const s = sh(); return CFG && CFG.salariosProprios ? CFG.salariosProprios() : s.limpeza * SH_CFG.limpeza.salario + s.seguranca * SH_CFG.seguranca.salario; };
  GANCHOS.antesDoFechamento = () => { if (CFG && CFG.fechamentoProprio) CFG.fechamentoProprio(); else fecharSemanaShopping(); };
  GANCHOS.nomeDia = d => `Semana ${semana(d)}`;          // fechamento do dia no shopping = fechamento da semana
  GANCHOS.rotuloDia = () => CFG && CFG.rotuloProprio ? CFG.rotuloProprio() : `Semana ${semana()}`;
  GANCHOS.filtrarAcoes = list => list.filter(a => a.kind === "ads" || a.kind === "mgr" || a.kind === "chest" || (a.kind || "").startsWith("park") || (a.key || "").startsWith("lot:") || a.kind === "lot");
  GANCHOS.tarefaValida = id => ["serve", "sales", "upgrades", "clean", "stars"].includes(id);
  GANCHOS.melhorar = (body, acts) => { if (CFG && CFG.melhorarProprio) CFG.melhorarProprio(body, acts); else melhorarShopping(body, acts); };
  GANCHOS.listaShopping = body => { if (CFG && CFG.listaPropria) CFG.listaPropria(body); else listaShopping(body); };
  gancho("tocar", (x, y) => {
    if (CFG && CFG.tocarProprio) return CFG.tocarProprio(x, y);
    const Y = lay(), inR = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (inR({ x: Y.palco.x - 6, y: Y.palco.y - 6, w: Y.palco.w + 12, h: Y.palco.h + 16 })) return { kind: "shCalendario" };
    for (const q of Y.equip) if (Math.hypot(x - q.x, y - q.y) < 14) return { kind: "shOperacao" };
    for (const u of Y.unidades) if (inR(u)) return { kind: "shLojas" };
    if (x > 0 && x < W && y > 40 && y < H) return { kind: "shOperacao" };
    return null;
  });
  gancho("bRect", sel => sel.kind === "shLojas" || sel.kind === "shOperacao" || sel.kind === "shCalendario" ? { x: 0, y: 30, w: W, h: H - 26 } : null);
  gancho("painel", (sel, body) => { if (sel.kind === "shLojas") { buildLojasSh(body); return true; } if (sel.kind === "shOperacao") { buildOperacao(body); return true; } if (sel.kind === "shCalendario") { buildCalendario(body); return true; } return null; });
  const a0 = GANCHOS.assinatura;
  GANCHOS.assinatura = () => { const s = sh(); return (a0 ? a0() : "") + `|sh${s.limpeza}${s.seguranca}${s.manut}${s.panes.map(p => p.id).join(",")}${JSON.stringify(s.eventos)}${JSON.stringify(s.campanhas)}${s.relatorios.length}${s.dias.length}|${sigLocacao(lojasSh())}`; };
  GANCHOS.aoVoltar = (days) => {
    if (days <= 0) return [];
    if (CFG && CFG.aoVoltarProprio) return CFG.aoVoltarProprio(days);
    return shoppingAoVoltar(days);
  };
  PAINEIS.lojas = buildLojasSh; PAINEIS.operacao = buildOperacao; PAINEIS.calendario = buildCalendario;
}
// fora do app: contratos andam, panes são consertadas pelo contrato (cobradas no lucro médio), eventos e
// campanhas que caíram nas semanas passadas acontecem uma vez, com resultado padrão (sem receita dobrada)
function shoppingAoVoltar(days) {
  const s = sh(), L = [], ini = S.day - days;
  const saiu = locacaoAoVoltar(lojasSh(), SH_LOC(), days);
  let evs = 0, rec = 0;
  Object.keys(s.eventos).forEach(d => { d = +d; if (d >= ini && d < S.day) { const e = EVENTOS.find(x => x.id === s.eventos[d]); const r = Math.round(e.custo * 0.9 * mgrEff(S.mgrLvl));
    S.money += r; rec += r; evs++; s.relatorios.unshift({ tipo: "evento", id: e.id, nome: e.nome + " (enquanto você esteve fora)", dia: d, semana: semana(d), publico: 0, custos: e.custo, receitas: r, alugueisExtra: 0, resultado: r - e.custo, satisfacao: s.satEMA, seguranca: true }); } });
  Object.keys(s.eventos).forEach(d => { if (+d < S.day) delete s.eventos[d]; });
  Object.keys(s.campanhas).forEach(d => { if (+d < S.day) delete s.campanhas[d]; });
  s.relatorios.length = Math.min(s.relatorios.length, 8);
  s.panes = []; s.sujeira = 0; s.hoje = novoHojeSh();
  if (saiu) L.push(["Contratos encerrados", `${saiu} loja(s) vaga(s)`]);
  if (evs) L.push(["Eventos realizados enquanto você esteve fora", `${evs} (receita M ${fmt(rec)}, sem bônus de público)`]);
  const ren = lojasSh().propostas.filter(p => p.renovacao).length; if (ren) L.push(["Renovações esperando resposta", String(ren)]);
  return L;
}
