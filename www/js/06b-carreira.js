"use strict";
// =====================================================================
// Carreira em Maricá: fases, requisitos, avaliação diária, transição e
// promoções do Centro. No Modo Livre nada daqui altera o jogo: as funções
// de gancho devolvem valores neutros e não sorteiam números.
// =====================================================================
const NA_CARREIRA = MODO === "carreira";
const XP_POR_NIVEL = 150;

// Promoção (só no Centro): preço da categoria cai 20%, a procura por ela dobra
// e o movimento geral sobe 15%. Custa um panfleto e dura até o fim do dia.
const PROMO = { desconto: 0.8, fluxo: 1.15, chance: 0.6, panfleto: 40, metaBase: 18 };

const FASE_CFG = {
  bairro: {
    capitulo: 1, titulo: "Mercadinho da Lagoa", lugar: "Itapeba",
    resumo: "Mercado de bairro: loja estreita, vizinhança residencial, vagas livres na frente e você cuidando de tudo.",
    essenciais: ["mercearia", "bebidas", "hortifruti"],
    dia: { vazioMax: 0.20, perdidosMax: 0.10, repMin: 3.5 },
    diasSeguidos: 3, lucroMedio: 60,
    estrutura: [
      { id: "essenciais", label: "Abrir Bebidas e Hortifrúti", como: "Toque nas gôndolas fechadas e abra cada setor quando tiver o dinheiro.",
        have: () => ["mercearia", "bebidas", "hortifruti"].filter(id => S.sec[id].open).length, need: 3 },
      { id: "prateleira", label: "Gôndola da Mercearia no nível 2", como: "Toque na Mercearia e use \"Prateleira maior\" duas vezes.", have: () => S.sec.mercearia.shelfLvl, need: 2 },
      { id: "deposito", label: "Depósito ampliado", como: "Toque no depósito (fachada) e amplie uma vez.", have: () => S.whLvl, need: 1 },
      { id: "caixa2", label: "Segundo caixa aberto", como: "Toque no caixa fechado e contrate um operador.", have: () => S.cashiers, need: 2 },
    ],
    inicio() { S.money = 40; S.gear.baskets = 10; },
    // reabrir uma loja concluída cujo estado não foi guardado (saves do formato 1): estrutura que cumpre as metas da fase
    reabrir(r) {
      ["bebidas", "hortifruti"].forEach(id => { const st = S.sec[id]; st.open = true; st.shelf = 4; st.wh = 4; });
      S.sec.mercearia.shelfLvl = 2; S.sec.mercearia.shelf = shelfCap(2); S.whLvl = 1; S.cashiers = 2; S.money = 150;
      reabrirComum(r);
    },
    reaberturaTxt: "Bebidas e Hortifrúti abertos, gôndola da Mercearia no nível 2, depósito ampliado, 2 caixas e M 150 em caixa",
  },
  centro: {
    capitulo: 2, titulo: "Empório Espiga", lugar: "Centro",
    resumo: "Mercado do Centro: loja larga com três fileiras, estacionamento com cancela, comércio e ônibus na porta.",
    essenciais: ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria"],
    dia: { vazioMax: 0.15, perdidosMax: 0.10, repMin: 3.8 },
    diasSeguidos: 3, lucroMedio: 150,
    promocoes: true, metaPromos: 3,
    convite: {
      responsabilidades: "promoções do dia, cinco setores essenciais, três caixas, estacionamento com cancela e metas maiores.",
      comeca: "orçamento de M 1.500, Mercearia, Bebidas e Hortifrúti abertos, 2 caixas, 1 carrinheiro e 1 atendente de cancela.",
    },
    estrutura: [
      { id: "setores", label: "Abrir Laticínios e Padaria", como: "As duas gôndolas fechadas do Empório. A Padaria custa mais: guarde dinheiro.",
        have: () => ["laticinios", "padaria"].filter(id => S.sec[id].open).length, need: 2 },
      { id: "caixas", label: "Três caixas abertos", como: "Toque no caixa fechado e contrate um operador.", have: () => S.cashiers, need: 3 },
      { id: "vagas", label: "Ampliar o estacionamento", como: "Toque no terreno à venda ao lado das vagas.", have: () => owns("park1") ? 1 : 0, need: 1 },
      { id: "promos", label: "3 promoções bem-sucedidas", como: "Na aba Carreira, escolha a promoção do dia e mantenha a gôndola cheia até a noite.",
        have: () => S.fase.promosOk, need: 3 },
    ],
    // estrutura, orçamento e equipe próprios do Empório (apresentados antes da transição)
    orcamento: 1500,
    inicio() {
      S.tier = 1; S.money = this.orcamento; S.whLvl = 1; S.cashiers = 2;
      ["mercearia", "bebidas", "hortifruti"].forEach(id => { const st = S.sec[id]; st.open = true; st.staff = 1; st.shelf = 6; st.wh = 6; });
      S.gear.baskets = 12; S.gear.carts = 4; S.gear.collectors = 1;
      S.park.staff = 1; S.park.everHired = true; S.park.intro.hire1 = true; S.park.price = 1;
      const r = CARREIRA && CARREIRA.repCarreira ? CARREIRA.repCarreira : 3;
      S.rep = Math.max(3, Math.min(3.5, 3 + (r - 3.5) * 0.5));          // a boa fama ajuda um pouco no começo
      ACH.forEach(a => { if (a.ok()) S.ach[a.id] = true; });          // conquistas já cumpridas pela estrutura recebida não dão prêmio
    },
    reabrir(r) {
      ["laticinios", "padaria"].forEach(id => { const st = S.sec[id]; st.open = true; st.staff = 1; st.shelf = 4; st.wh = 4; });
      S.cashiers = 3; S.park.lots.park1 = true;
      reabrirComum(r);
    },
    reaberturaTxt: "cinco setores abertos, 3 caixas, estacionamento ampliado e o orçamento inicial do Empório (M 1.500)",
  },
  // Capítulo 3: negociação com fornecedores (06c). O caminhão automático vira reposição de emergência,
  // mais cara e só até um mínimo por setor; o grosso do estoque vem de pedidos escolhidos pelo jogador.
  ipe: {
    capitulo: 3, titulo: "Supermercado Ipê", lugar: "Centro",
    resumo: "Supermercado do Centro: depósito grande, doca de recebimento e compras negociadas com fornecedores.",
    essenciais: ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria", "acougue"],
    dia: { vazioMax: 0.20, perdidosMax: 0.10, repMin: 3.8 },
    diasSeguidos: 4, lucroMedio: 300, margemMin: 0.55,
    promocoes: true, fornecedores: true,
    aberturas: { acougue: 2800 },          // o ponto já tem câmara fria: abrir o Açougue custa menos que os M 4.500 de costume
    convite: {
      responsabilidades: "negociar com fornecedores (lote pequeno e rápido ou lote grande com desconto), cuidar do depósito e da validade dos perecíveis, manter a margem e abrir o Açougue.",
      comeca: "orçamento de M 2.500, cinco setores abertos, depósito para 160 caixas, doca de recebimento, 2 caixas, 2 carrinheiros e estacionamento livre com 8 vagas.",
    },
    estrutura: [
      { id: "acougue", label: "Abrir o Açougue", como: "Toque na gôndola fechada do Açougue (M 2.800, a câmara fria já existe). Guarde dinheiro: pedidos pagos na hora também saem do caixa.",
        have: () => S.sec.acougue.open ? 1 : 0, need: 1 },
      { id: "ligeira", label: "Receber 3 pedidos da Distribuidora Ligeira", como: "Aba Carreira > Fornecedores. Lote pequeno e entrega no mesmo dia: bom para não faltar.",
        have: () => S.forn ? S.forn.recebidos.ligeira : 0, need: 3 },
      { id: "serra", label: "Receber 2 lotes do Atacado Serra", como: "Lote grande com 25% de desconto e entrega em 2 dias. Precisa de espaço livre no depósito.",
        have: () => S.forn ? S.forn.recebidos.serra : 0, need: 2 },
      { id: "deposito", label: "Depósito para 208 caixas", como: "Toque no depósito e amplie. Lotes grandes precisam de espaço reservado até chegarem.",
        have: () => whCap(S.whLvl), need: 208 },
    ],
    orcamento: 2500,
    inicio() {
      S.tier = 1; S.money = this.orcamento; S.whLvl = 5; S.cashiers = 2;
      ["mercearia", "bebidas", "hortifruti", "laticinios", "padaria"].forEach(id => { const st = S.sec[id]; st.open = true; st.staff = 1; st.shelf = shelfCap(st.shelfLvl); st.wh = 6; });
      S.gear.baskets = 14; S.gear.carts = 6; S.gear.collectors = 2;
      S.park.lots.logi = true; S.park.price = 0;
      S.forn = fornNovo();
      const r = CARREIRA && CARREIRA.repCarreira ? CARREIRA.repCarreira : 3;
      S.rep = Math.max(3, Math.min(3.5, 3 + (r - 3.5) * 0.5));
      ACH.forEach(a => { if (a.ok()) S.ach[a.id] = true; });
    },
    reabrir(r) {
      S.sec.acougue.open = true; S.sec.acougue.staff = 1; S.sec.acougue.shelf = 4; S.sec.acougue.wh = 4; S.whLvl = 7;
      S.forn.recebidos = { ligeira: 3, serra: 2 };
      reabrirComum(r);
    },
    reaberturaTxt: "seis setores abertos, depósito para 208 caixas e o orçamento inicial do Ipê (M 2.500)",
  },
};
// dados do registro de conclusão que ajudam a reabrir uma loja sem estado guardado
function reabrirComum(r) {
  r = r || {};
  S.day = Math.max(1, r.dia || 1); S.rep = Math.max(1, Math.min(5, r.rep || S.rep));
  S.served = r.atendidos || 0; S.earned = r.faturamento || 0;
  ACH.forEach(a => { if (a.ok()) S.ach[a.id] = true; });             // nada de prêmio repetido por conquistas já cumpridas
}
// capítulos 4 a 8 são declarados nos módulos 06d a 06i (carregados depois deste); por isso o início da
// sessão de carreira roda em iniciarCarreira(), chamado em 13-hud-loop antes de o jogo começar
let CFG = null;
const novaFase = () => ({ dia: { t: 0, vazio: 0, vs: {}, promoVazio: 0, vend: {} }, bons: 0, nets: [], margens: [], hist: [], concluida: false, promo: null, promosOk: 0, promosFeitas: 0 });
// estado dos fornecedores de uma loja (capítulo 3; regras em 06c)
function fornNovo() { return { pedidos: [], recebidos: { ligeira: 0, serra: 0 }, auto: true, seq: 1, hist: [], recusas: 0 }; }
function gravarCarreira() { try { localStorage.setItem(CHAVE_CARREIRA, JSON.stringify(CARREIRA)); } catch (e) {} }

// ---------- início da sessão de carreira ----------
// introFasePendente: loja nova do capítulo atual (mostra a introdução)
// lojaReaberta: loja concluída sem estado guardado (save do formato 1), reaberta com estrutura compatível
let introFasePendente = false, lojaReaberta = false;
function iniciarCarreira() {
  if (!NA_CARREIRA) return;
  CFG = FASE_CFG[FASE];
  if (!CARREIRA) CARREIRA = migrarCarreira({ versao: 2, fase: "bairro", ativa: "bairro", inicio: Date.now(), xp: 0, repCarreira: 0, conquistas: [], fases: {}, transicoes: 0, lojas: {}, convites: {} });
  if (!CARREIRA.lojas[FASE]) {                            // loja sem estado: nova (capítulo atual) ou reaberta (concluída)
    const rec = CARREIRA.fases[FASE];
    S = freshState(); S.seenIntro = true; CFG.inicio(); S.fase = novaFase();
    if (rec && rec.concluida) {
      if (!S.forn) S.forn = fornNovo();
      CFG.reabrir(rec); S.fase.concluida = true; S.fase.diaConclusao = rec.dia; S.reaberta = Date.now(); lojaReaberta = true;
    } else introFasePendente = true;
    S.lastSeen = Date.now();
    CARREIRA.lojas[FASE] = S; gravarCarreira();
  }
  if (!S.fase) S.fase = novaFase();
  S.fase = Object.assign(novaFase(), S.fase);
  if (CFG.carregar) CFG.carregar();            // campos novos de cada capítulo (partidas antigas recebem valores padrão)
  // 1.6: capítulos 4 e 5 ganharam os fornecedores; partida em andamento recebe o aviso uma vez
  if (CFG.fornecedores && !S.forn) { S.forn = fornNovo(); if (!introFasePendente) S.avisoForn16 = true; }
}

// ---------- ganchos chamados pelo motor (neutros fora da carreira) ----------
const promoAtiva = () => NA_CARREIRA && S.fase && S.fase.promo && S.fase.promo.dia === S.day ? S.fase.promo : null;
function promoFator(sec) { const p = promoAtiva(); return p && SECTORS[sec].id === p.sec ? PROMO.desconto : 1; }
function promoFluxo() { return promoAtiva() ? PROMO.fluxo : 1; }
function promoPlano(plan) {
  const p = promoAtiva(); if (!p) return;
  const i = SECTORS.findIndex(d => d.id === p.sec); if (!S.sec[p.sec].open) return;
  const it = plan.find(x => x.sec === i);
  if (it) it.want++;
  else if (Math.random() < PROMO.chance) { plan.push({ sec: i, want: 1 + (Math.random() < .5 ? 1 : 0), got: 0 }); plan.sort((a, b) => a.sec - b.sec); }
}
function vendaSetor(sec, n) { if (NA_CARREIRA && S.fase) { const v = S.fase.dia.vend, id = SECTORS[sec].id; v[id] = (v[id] || 0) + n; if (CFG.fornecedores) fornVenda(sec, n); } }
function faseTick(dt) {
  if (!NA_CARREIRA || !S.fase) return;
  const d = S.fase.dia; d.t += dt;
  // disponibilidade: média, entre os essenciais abertos, do tempo com a gôndola vazia
  const abertos = CFG.essenciais.filter(id => S.sec[id].open);
  if (abertos.length) { const vaz = abertos.filter(id => S.sec[id].shelf === 0).length; d.vazio += dt * vaz / abertos.length; d.vs = d.vs || {}; abertos.forEach(id => { if (S.sec[id].shelf === 0) d.vs[id] = (d.vs[id] || 0) + dt; }); }
  const p = promoAtiva(); if (p && S.sec[p.sec].shelf === 0) d.promoVazio += dt;
  if (CFG.fornecedores) fornTick();
  if (CFG.tick) CFG.tick(dt);
  if (!S.fase.concluida && faseCompleta()) concluirFase();
}

// ---------- avaliação de cada dia ----------
function avaliarDia() {
  const d = S.fase.dia, L = S.lastDay, tot = L.served + L.lost, c = CFG.dia;
  const vazio = d.t > 0 ? d.vazio / d.t : 0, perdidos = tot ? L.lost / tot : 0;
  const itens = [
    { ok: vazio <= c.vazioMax, txt: `Gôndolas essenciais vazias ${Math.round(vazio * 100)}% do tempo, em média (máx. ${Math.round(c.vazioMax * 100)}%)` },
    { ok: perdidos <= c.perdidosMax, txt: `Clientes perdidos ${Math.round(perdidos * 100)}% (máx. ${Math.round(c.perdidosMax * 100)}%)` },
    { ok: S.rep >= c.repMin - 1e-9, txt: `Reputação ${S.rep.toFixed(1).replace(".", ",")} (mín. ${String(c.repMin).replace(".", ",")})` },
    { ok: S.money >= 0, txt: S.money >= 0 ? "Contas pagas sem dívida" : "Dia fechado no vermelho" },
  ];
  if (CFG.avaliar) CFG.avaliar(itens, L, vazio, perdidos);        // critérios próprios do capítulo (fila, custo da equipe, entregas...)
  if (CFG.semGondolas) itens.splice(0, 2);                          // shopping: sem gôndolas nem fila de caixa
  return { ok: itens.every(i => i.ok), itens, vazio, perdidos };
}
function faseFimDoDia() {
  if (!NA_CARREIRA || !S.fase) return;
  const f = S.fase, av = avaliarDia(), L = S.lastDay;
  f.bons = av.ok ? f.bons + 1 : 0;
  f.nets.push(Math.round(L.net * 100) / 100); while (f.nets.length > 3) f.nets.shift();
  if (CFG.fimDoDia) CFG.fimDoDia(L, av);
  if (CFG.fornecedores) { fornFimDoDia(L); f.margens.push(Math.round(L.margem * 1000) / 1000); while (f.margens.length > 3) f.margens.shift(); f.vendOntem = Object.assign({}, f.dia.vend); }
  f.hist.push({ dia: L.day, ok: av.ok, itens: av.itens.map(i => ({ ok: i.ok, txt: i.txt })) }); while (f.hist.length > 7) f.hist.shift();
  // resultado da promoção do dia
  const p = f.promo;
  if (p && p.dia === L.day) {
    const vendas = f.dia.vend[p.sec] || 0, vaz = f.dia.t ? f.dia.promoVazio / f.dia.t : 0;
    p.vendas = vendas; p.ok = vendas >= p.meta && vaz <= 0.2 && L.net > 0;
    p.motivo = p.ok ? "Sucesso" : vendas < p.meta ? `Vendeu ${vendas} de ${p.meta}` : vaz > 0.2 ? "Gôndola ficou vazia por muito tempo" : "O dia fechou no prejuízo";
    if (p.ok) f.promosOk++;
    f.ultimaPromo = p; f.promo = null;
    setTimeout(() => banner(p.ok ? `📣 Promoção de ${nomeSetor(p.sec)}: sucesso!` : `📣 Promoção: ${p.motivo}`, p.ok ? "#2e7a57" : "#b7773b"), 1600);
  }
  f.dia = { t: 0, vazio: 0, vs: {}, promoVazio: 0, vend: {} };
  if (!av.ok && !f.concluida) setTimeout(() => toast(`Dia não contou para a meta: ${av.itens.filter(i => !i.ok).map(i => i.txt).join(" · ")}`), 2600);
}
const nomeSetor = id => SECTORS.find(d => d.id === id).name;

// ---------- requisitos ----------
function faseReqs() {
  if (!NA_CARREIRA) return [];
  const f = S.fase, med = f.nets.length ? f.nets.reduce((a, b) => a + b, 0) / 3 : 0;
  return [
    ...CFG.estrutura.map(r => ({ id: r.id, label: r.label, como: r.como, have: r.have(), need: r.need, tipo: "melhoria", painel: r.painel, money: r.money })),
    { id: "dias", label: `${CFG.diasSeguidos} dias bem administrados seguidos`, tipo: "gestao", have: f.bons, need: CFG.diasSeguidos,
      como: CFG.diaComo ? CFG.diaComo() : `Um dia conta quando: gôndolas essenciais vazias em média até ${Math.round(CFG.dia.vazioMax * 100)}% do tempo (contrate repositores e aumente as gôndolas), até ${Math.round(CFG.dia.perdidosMax * 100)}% de clientes perdidos, reputação de pelo menos ${String(CFG.dia.repMin).replace(".", ",")} e nenhuma dívida no fechamento. Se um dia falhar, a contagem recomeça.` },
    { id: "lucro", label: `Lucro médio de M ${fmt(CFG.lucroMedio)} por dia (últimos 3 dias)`, tipo: "gestao", have: Math.max(0, med), need: CFG.lucroMedio, money: true,
      como: "Some vendas e estacionamento, desconte mercadoria, aluguel e salários. Precisa de 3 dias fechados; dias ruins saem da média depois." },
    ...(CFG.margemMin ? [{ id: "margem", label: `Margem média de ${Math.round(CFG.margemMin * 100)}% (últimos 3 dias)`, tipo: "gestao", pct: true,
      have: f.margens.length ? f.margens.reduce((a, b) => a + b, 0) / 3 : 0, need: CFG.margemMin,
      como: "Margem = vendas menos o custo do que foi vendido e as perdas, dividido pelas vendas. A reposição automática custa 30% a mais; lotes do Atacado Serra custam 25% a menos. Perecíveis parados no depósito estragam." }] : []),
    ...(CFG.extras ? CFG.extras() : []),
  ];
}
const faseCompleta = () => NA_CARREIRA && faseReqs().every(r => r.have >= r.need - 1e-9);
const faseProgresso = () => { const r = faseReqs(); return r.length ? r.reduce((a, q) => a + Math.min(1, q.have / q.need), 0) / r.length : 0; };
const nivelGestao = () => 1 + Math.floor((CARREIRA ? CARREIRA.xp : 0) / XP_POR_NIVEL);

function concluirFase(forcar) {             // forcar: painel de trapaças (1.3)
  if (!NA_CARREIRA || S.fase.concluida || (CARREIRA.fases[FASE] && CARREIRA.fases[FASE].concluida) || (!forcar && !faseCompleta())) return;   // nunca duas vezes, nunca sem as metas
  const ach = ACH.filter(a => S.ach[a.id]).map(a => ({ fase: FASE, id: a.id, label: a.label || a.id }));
  const xp = 100 + 25 * CFG.estrutura.length;
  S.fase.concluida = true; S.fase.diaConclusao = S.day;
  CARREIRA.xp += xp;
  ach.forEach(a => { if (!CARREIRA.conquistas.some(c => c.fase === a.fase && c.id === a.id)) CARREIRA.conquistas.push(a); });
  CARREIRA.fases[FASE] = { concluida: true, dia: S.day, xp, rep: Math.round(S.rep * 10) / 10, atendidos: S.served, faturamento: Math.round(S.earned), conquistas: ach.length, em: Date.now() };
  const reps = Object.values(CARREIRA.fases).map(x => x.rep); CARREIRA.repCarreira = Math.round(reps.reduce((a, b) => a + b, 0) / reps.length * 10) / 10;
  save(); confetti(); banner(`🏆 Capítulo ${CFG.capitulo} concluído!`, "#2e7a57");
  setTimeout(() => mostrarConclusao(), 900);
}

// ---------- transição e troca de loja ----------
// Andamento (CARREIRA.fase) e loja aberta (FASE = CARREIRA.ativa) são separados. A próxima fase fica
// disponível quando o capítulo mais avançado foi concluído e ainda não tem loja; pode ser assumida de
// qualquer loja, a qualquer momento.
function proximaFase() { return FASES[FASE].proxima; }
function proximaDisponivel() {
  if (!CARREIRA) return null;
  const f = CARREIRA.fase, r = CARREIRA.fases[f], nx = FASES[f] && FASES[f].proxima;
  return r && r.concluida && nx && FASE_CFG[nx] && !CARREIRA.lojas[nx] ? nx : null;
}
const CHAVE_TROCA = "mercadinho-troca";
function irParaLoja(id, motivo) {                 // grava a loja atual, marca a de destino e recarrega
  save();
  CARREIRA.ativa = id; gravarCarreira();
  try { sessionStorage.setItem(CHAVE_TROCA, JSON.stringify({ de: FASE, para: id, motivo, t: Date.now() })); } catch (e) {}
  paused = true; location.reload();               // recarrega: limpa clientes, carros, filas e reservas da loja anterior
}
function assumirProxima() {
  const nx = proximaDisponivel();
  if (!NA_CARREIRA || !nx) return;                 // só uma vez: depois de assumida, a fase já tem loja
  save();
  CARREIRA.fase = nx; CARREIRA.transicoes = (CARREIRA.transicoes || 0) + 1; CARREIRA.convites[nx] = CARREIRA.convites[nx] || Date.now();
  irParaLoja(nx, "assumir");
}
function trocarLoja(id) {
  if (!NA_CARREIRA || id === FASE || !lojaPermitida(CARREIRA, id)) return false;
  irParaLoja(id, CARREIRA.lojas[id] ? "administrar" : "reabrir"); return true;
}
function previaCentroSvg() {
  // esquema do Empório (não é foto): loja larga, três fileiras, caixas à direita, estacionamento com cancela, comércio em frente
  return `<svg viewBox="0 0 220 120" class="previa" role="img" aria-label="Esquema do Empório Espiga">
    <rect x="0" y="0" width="220" height="120" rx="10" fill="#c9c6bb"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${6 + i * 43}" y="4" width="40" height="16" rx="2" fill="${["#d9822b", "#2e7a57", "#b5487a", "#f28c28", "#3f74b8"][i]}"/>`).join("")}
    <rect x="0" y="22" width="220" height="10" fill="#7f878c"/><rect x="150" y="23" width="34" height="8" rx="2" fill="#c62d28"/>
    <rect x="40" y="36" width="140" height="62" rx="4" fill="#f3f3ef" stroke="#1d3461" stroke-width="1.5"/>
    <rect x="46" y="38" width="62" height="10" rx="2" fill="#1d3461"/><rect x="132" y="38" width="44" height="10" rx="2" fill="#8e7350"/>
    ${[0, 1, 2].map(c => [0, 1].map(r => `<rect x="${46 + c * 45}" y="${54 + r * 14}" width="38" height="6" rx="1.5" fill="#b89a6c"/>`).join("")).join("")}
    ${[0, 1, 2].map(i => `<rect x="${118 + i * 20}" y="86" width="14" height="6" rx="1.5" fill="#4b5a62"/>`).join("")}
    <rect x="40" y="102" width="150" height="14" rx="3" fill="#9aa3a6"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${46 + i * 12}" y="104" width="1" height="10" fill="#fff"/>`).join("")}
    <rect x="190" y="104" width="8" height="2" fill="#c9513a"/><rect x="34" y="104" width="8" height="2" fill="#c9513a"/>
  </svg>`;
}
function previaIpeSvg() {
  // esquema do Ipê (não é foto): depósito grande e doca à esquerda, três fileiras, entrada à direita, vagas livres
  return `<svg viewBox="0 0 220 120" class="previa" role="img" aria-label="Esquema do Supermercado Ipê: depósito grande e doca de recebimento à esquerda, três fileiras de gôndolas, caixas no meio, entrada pela direita e estacionamento livre">
    <rect x="0" y="0" width="220" height="120" rx="10" fill="#c4c6b6"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${6 + i * 43}" y="4" width="40" height="16" rx="2" fill="${["#3f74b8", "#d9822b", "#2e7a57", "#b5487a", "#8a5cc2"][i]}"/>`).join("")}
    <rect x="0" y="22" width="220" height="10" fill="#7f878c"/>
    <rect x="4" y="36" width="30" height="30" rx="3" fill="#cbc9bb" stroke="#8e7350"/>${[0, 1, 2].map(i => `<rect x="${8 + i * 9}" y="44" width="7" height="7" rx="1" fill="#c99a5b"/>`).join("")}
    <rect x="40" y="36" width="150" height="66" rx="4" fill="#f3f3ef" stroke="#1f7a3a" stroke-width="1.5"/>
    <rect x="44" y="38" width="66" height="12" rx="2" fill="#8e7350"/><rect x="122" y="38" width="60" height="10" rx="2" fill="#1f7a3a"/><rect x="128" y="44" width="40" height="3" fill="#f4c430"/>
    ${[0, 1, 2].map(c => [0, 1].map(r => `<rect x="${46 + c * 48}" y="${56 + r * 14}" width="40" height="6" rx="1.5" fill="#b89a6c"/>`).join("")).join("")}
    ${[0, 1, 2].map(i => `<rect x="${62 + i * 28}" y="90" width="14" height="6" rx="1.5" fill="#4b5a62"/>`).join("")}
    <rect x="186" y="78" width="6" height="14" rx="1" fill="#1f7a3a"/>
    <rect x="40" y="104" width="150" height="13" rx="3" fill="#9aa3a6"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${46 + i * 12}" y="106" width="1" height="9" fill="#fff"/>`).join("")}
  </svg>`;
}
const previaSvg = id => id === "centro" ? previaCentroSvg() : id === "ipe" ? previaIpeSvg() : FASE_CFG[id] && FASE_CFG[id].previa ? FASE_CFG[id].previa() : "";
function mostrarConclusao() {
  const r = CARREIRA.fases[FASE]; if (!r) return;
  const nx = proximaDisponivel(), ncfg = nx && FASE_CFG[nx], fim = !FASES[FASE].proxima;
  const res = `<div class="stats" style="margin:8px 0">
      <div class="stat"><small>Dias</small><b>${r.dia}</b></div><div class="stat"><small>Clientes atendidos</small><b>${fmt(r.atendidos)}</b></div>
      <div class="stat"><small>Faturamento</small><b>M ${fmt(r.faturamento)}</b></div><div class="stat"><small>Reputação</small><b>${String(r.rep).replace(".", ",")} ★</b></div></div>
    <p>Experiência ganha: <b>+${r.xp} XP</b> (nível de gestão ${nivelGestao()}) · Conquistas da fase: <b>${r.conquistas}</b></p>`;
  const proxTxt = ncfg ? `<p><b>Convite:</b> os responsáveis pelo ${ncfg.titulo} (${ncfg.lugar}) querem que você assuma a administração. Veja no mapa o que muda e o que a loja recebe.</p>`
    : fim ? `<p><b>Você concluiu a carreira em Maricá.</b> A rede é sua: cada loja segue aberta para você administrar, melhorar e bater recordes pelo mapa.</p>` : "";
  showModal(`<h2>Capítulo ${CFG.capitulo} concluído!</h2>${res}${proxTxt}
    <p class="note">As lojas concluídas continuam suas: cada uma guarda o próprio caixa, estoque e equipe, e você pode voltar a administrá-las pelo mapa.</p>
    <button class="btn" id="go">Ver o mapa da carreira</button>
    <button class="plain" id="later" style="margin-top:8px;width:100%;justify-content:center"><span>Continuar no ${CFG.titulo}</span></button>`);
  document.getElementById("go").onclick = () => { hideModal(); abrirMapa(nx || FASE); };
  document.getElementById("later").onclick = () => { hideModal(); if (nx) toast(`Quando quiser, abra o mapa na aba Carreira para assumir o ${ncfg.titulo}.`); };
}
function mostrarLojaReaberta() {
  const r = CARREIRA.fases[FASE] || {};
  showModal(`<h2>${CFG.titulo} reaberto</h2>
    <p class="note" style="margin-top:-4px">Capítulo ${CFG.capitulo} · ${CFG.lugar} · concluído no dia ${r.dia || "?"}</p>
    <p>A versão anterior do jogo não guardava o estado desta loja depois que você saiu. Ela foi reaberta <b>com um estado compatível com a fase concluída</b>: ${CFG.reaberturaTxt}.</p>
    <p>A conclusão do capítulo, o XP e as conquistas continuam registrados e não são concedidos de novo. Daqui em diante, tudo o que você fizer aqui fica guardado.</p>
    <button class="btn" id="ok">Administrar a loja</button>`);
  document.getElementById("ok").onclick = () => { hideModal(); save(); };
}
function mostrarIntroFase() {
  const reqs = faseReqs();
  showModal(`<h2>Capítulo ${CFG.capitulo}: ${CFG.titulo}</h2>
    <p class="note" style="margin-top:-4px">${CFG.lugar}, Maricá · cenário inspirado, nomes fictícios</p>
    <p>${CFG.resumo}</p>
    <p>${FASE === "bairro" ? "Você assume a administração de um mercadinho de bairro. Arraste para explorar, toque em gôndolas, caixas e depósito para melhorar."
      : CFG.intro ? CFG.intro
      : FASE === "centro" ? "Agora há <b>promoções</b>: na aba Carreira, escolha uma categoria por dia. Ela vende mais e atrai gente, mas com margem menor e gôndola esvaziando rápido."
      : "Agora você <b>negocia com fornecedores</b>: a Distribuidora Ligeira entrega lotes pequenos no mesmo dia; o Atacado Serra dá desconto em lotes grandes que demoram 2 dias e ocupam o depósito. A reposição automática continua, mas só como emergência e mais cara. Perecíveis parados estragam. Comprou mal? Repasse o excedente, cancele um pedido ou faça uma promoção."}</p>
    <h3 style="margin:10px 0 4px">Para avançar</h3>
    <ul class="metas">${reqs.map(r => `<li>${r.label}</li>`).join("")}</ul>
    <p class="note">Tarefas do dia e conquistas são opcionais: dão dinheiro e ajudam, mas não são exigidas.</p>
    <button class="btn" id="go">Começar</button>`);
  document.getElementById("go").onclick = () => { hideModal(); save(); };
}

// ---------- promoções ----------
function metaPromo() { return PROMO.metaBase + 4 * S.cashiers; }   // mais caixas, mais vendas esperadas
function iniciarPromo(id) {
  if (!CFG || !CFG.promocoes || promoAtiva() || !S.sec[id] || !S.sec[id].open) return;
  if (S.money < PROMO.panfleto) { toast(`Falta dinheiro: o panfleto custa M ${PROMO.panfleto}.`); return; }
  S.money -= PROMO.panfleto; S.today.goods += PROMO.panfleto;
  S.fase.promo = { sec: id, dia: S.day, meta: metaPromo(id) }; S.fase.promosFeitas++;
  banner(`📣 Promoção: ${nomeSetor(id)} 20% mais barato hoje!`, "#1d3461"); save(); lastSig = ""; renderSheet();
}
function desenharPromo() {
  const p = promoAtiva(); if (!p) return;
  const i = SECTORS.findIndex(d => d.id === p.sec), sh = SHELVES[i]; if (!sh) return;
  const t = now(), y = sh.y - 16 + Math.sin(t * 3) * 1.5;
  rr(sh.x + sh.w - 52, y, 50, 13, 6, "#c9302c"); text("OFERTA −20%", sh.x + sh.w - 27, y + 9, 7, "#fff");
}

// ---------- painel e missão ----------
function buildCarreira(body) {
  const f = S.fase, reqs = faseReqs(), nx = proximaFase();
  head("🗺️", "#e4ece6", `Capítulo ${CFG.capitulo}: ${CFG.titulo}`, () => `${CFG.lugar} · ${reqs.filter(r => r.have >= r.need - 1e-9).length} de ${reqs.length} requisitos`);
  const bm = el("button", "plain", `${iconSvg("i-map")}<span>Mapa da carreira: lojas, distâncias e próximas etapas</span>`); bm.onclick = () => { closeSheet(); abrirMapa(); }; body.appendChild(bm);
  const disp = proximaDisponivel(), atual = CARREIRA.fase;
  if (f.concluida) {
    const outra = atual !== FASE && !disp;
    const card = el("div", "card", disp ? `<h3>Fase concluída</h3><p class="note">O ${FASE_CFG[disp].titulo} espera por você. Assuma quando quiser; aqui nada se perde.</p>`
      : outra ? `<h3>Loja concluída</h3><p class="note">Você está administrando o ${CFG.titulo}, que já cumpriu as metas. O capítulo em andamento é o ${FASE_CFG[atual].capitulo}: ${FASE_CFG[atual].titulo}.</p>`
      : `<h3>Carreira concluída</h3><p class="note">Todos os capítulos foram cumpridos. Continue administrando o ${CFG.titulo} e as outras lojas da sua rede.</p>`);
    if (disp) { const b = el("button", "btn", `Ver convite do ${FASE_CFG[disp].titulo}`); b.onclick = () => { closeSheet(); abrirMapa(disp); }; card.appendChild(b); }
    else if (outra) { const b = el("button", "btn", `Ir para o ${FASE_CFG[atual].titulo}`); b.onclick = () => { closeSheet(); abrirMapa(atual); }; card.appendChild(b); }
    body.appendChild(card);
  }
  if (CFG.fornecedores) body.appendChild(cartaoFornecedores());
  if (CFG.cartoes) CFG.cartoes().forEach(c => body.appendChild(c));
  if (CFG.promocoes) body.appendChild(cartaoPromo());
  body.appendChild(el("div", "sec-title", "Requisitos para avançar"));
  reqs.forEach(r => {
    const ok = r.have >= r.need - 1e-9, txt = r.mostra ? r.mostra() : r.money ? `M ${fmt(r.have)} / M ${fmt(r.need)}` : r.pct ? `${Math.round(r.have * 100)}% / ${Math.round(r.need * 100)}%` : `${Math.min(r.have, r.need) === r.have ? fmt(r.have) : fmt(r.need)}/${fmt(r.need)}`;
    const row = el("div", "card req-card" + (ok ? " ok" : ""), `<div class="req"><span>${ok ? "✅" : "⬜"} ${r.label}</span><b>${txt}</b></div><p class="note">${r.como}</p>`);
    body.appendChild(row);
  });
  // o dia de hoje, ao vivo
  const c = CFG.dia;
  body.appendChild(el("div", "sec-title", "Hoje (avaliado no fechamento)"));
  body.appendChild(statsBox([
    ["Gôndolas vazias (média)", () => `${Math.round((f.dia.t ? f.dia.vazio / f.dia.t : 0) * 100)}% (máx. ${Math.round(c.vazioMax * 100)}%)`],
    ["Clientes perdidos", () => { const t = S.today.served + S.today.lost; return `${t ? Math.round(S.today.lost / t * 100) : 0}% (máx. ${Math.round(c.perdidosMax * 100)}%)`; }],
    ["Reputação", () => `${S.rep.toFixed(1).replace(".", ",")} (mín. ${String(c.repMin).replace(".", ",")})`],
    ["Dias seguidos", () => `${f.bons} de ${CFG.diasSeguidos}`],
  ]));
  if (f.hist.length) {
    const h = f.hist[f.hist.length - 1];
    body.appendChild(el("div", "card", `<h3>Dia ${h.dia}: ${h.ok ? "contou ✅" : "não contou"}</h3>${h.itens.map(i => `<div class="req"><span>${i.ok ? "✅" : "❌"} ${i.txt}</span></div>`).join("")}`));
  }
  body.appendChild(el("div", "sec-title", "Opcional"));
  const op = el("button", "plain", `${iconSvg("i-tasks")}<span>Tarefas do dia e baú: dinheiro extra, não são exigidas</span>`); op.onclick = () => openSheet("tasks"); body.appendChild(op);
  const oa = el("button", "plain", `${iconSvg("i-medal")}<span>Conquistas: vão para o seu histórico de carreira</span>`); oa.onclick = () => openSheet("ach"); body.appendChild(oa);
  body.appendChild(el("div", "sec-title", "Sua carreira"));
  body.appendChild(statsBox([
    ["Nível de gestão", () => `${nivelGestao()} (${CARREIRA.xp} XP)`],
    ["Reputação da carreira", () => CARREIRA.repCarreira ? `${String(CARREIRA.repCarreira).replace(".", ",")} ★` : "—"],
    ["Conquistas", () => String(CARREIRA.conquistas.length)],
    ["Capítulos concluídos", () => String(Object.values(CARREIRA.fases).filter(x => x.concluida).length)],
  ]));
  body.appendChild(el("p", "note", "Inspirado em Maricá. Os estabelecimentos são fictícios; formatos, lotes e expansões são adaptações do jogo."));
}
function cartaoPromo() {
  const p = promoAtiva(), f = S.fase, card = el("div", "card");
  if (p) {
    card.innerHTML = `<h3>📣 Promoção de hoje: ${nomeSetor(p.sec)}</h3><p class="note">20% mais barato, procura em dobro e +15% de movimento até a noite. Meta: vender ${p.meta} unidades sem deixar a gôndola vazia por muito tempo e fechar o dia no lucro.</p><div class="req"><span>Vendidas hoje</span><b id="pVend"></b></div>`;
    live(() => { const e = card.querySelector("#pVend"); if (e) e.textContent = `${f.dia.vend[p.sec] || 0} / ${p.meta}`; });
    return card;
  }
  card.innerHTML = `<h3>📣 Promoção do dia</h3><p class="note">Escolha uma categoria: ela fica 20% mais barata e mais procurada, e o movimento geral sobe 15%. Custa M ${PROMO.panfleto} de panfleto. Dá certo se a gôndola não esvaziar e o dia fechar no lucro: pense em estoque, repositores e caixas antes de escolher.</p>
    <p class="note">Bem-sucedidas: <b>${f.promosOk}</b> de ${f.promosFeitas}${f.ultimaPromo ? ` · última: ${nomeSetor(f.ultimaPromo.sec)}, ${f.ultimaPromo.motivo.toLowerCase()}` : ""}</p>`;
  const g = el("div", "acts");
  SECTORS.filter((d, i) => i < slots() && S.sec[d.id].open).forEach(d => {
    const st = S.sec[d.id], b = el("button", "act", `<b>${d.ic} ${d.name}</b><span>Gôndola ${st.shelf}/${shelfCap(st.shelfLvl)} · depósito ${st.wh}</span><em>M ${PROMO.panfleto}</em>`);
    b.onclick = () => iniciarPromo(d.id); g.appendChild(b);
  });
  card.appendChild(g); return card;
}
function missaoCarreira() {
  if (!NA_CARREIRA) return null;
  const f = S.fase, disp = proximaDisponivel();
  if (f.concluida) {
    if (disp) return { title: `Assumir o ${FASE_CFG[disp].titulo}`, sub: "Convite no mapa da carreira", p: 1, ring: "Ir", done: true, go: () => abrirMapa(disp) };
    if (CARREIRA.fase !== FASE) return { title: `${CFG.titulo}: loja concluída`, sub: `Capítulo em andamento: ${FASE_CFG[CARREIRA.fase].titulo} · ver mapa`, p: 1, ring: "🗺️", done: true, go: () => abrirMapa(CARREIRA.fase) };
    return { title: "Carreira concluída", sub: "Sua rede em Maricá · ver mapa", p: 1, ring: "🏆", done: true, go: () => abrirMapa() };
  }
  if (CFG.metaPromos && !promoAtiva() && S.dayT < DAY_LEN * 0.5 && f.promosOk < CFG.metaPromos) return { title: "Escolher a promoção do dia", sub: `${f.promosOk} de ${CFG.metaPromos} bem-sucedidas · aba Carreira`, p: f.promosOk / CFG.metaPromos, ring: "📣", go: () => openSheet("expand") };
  if (CFG.fornecedores) { const m = missaoFornecedor(); if (m) return m; }
  if (CFG.missao) { const m = CFG.missao(); if (m) return m; }
  const r = faseReqs().find(q => q.have < q.need - 1e-9 && q.tipo === "melhoria");
  if (r) return { title: r.label, sub: r.como, p: r.have / r.need, ring: `${Math.round(faseProgresso() * 100)}%`, go: () => openSheet(r.painel || (CFG.fornecedores && (r.id === "ligeira" || r.id === "serra") ? "forn" : "expand")) };
  const d = faseReqs().find(q => q.id === "dias");
  if (d.have < d.need) return { title: `Dias bem administrados: ${d.have}/${d.need}`, sub: "Gôndolas cheias, filas curtas, reputação e contas em dia", p: d.have / d.need, ring: `${Math.round(faseProgresso() * 100)}%`, go: () => openSheet("expand") };
  const mg = faseReqs().find(q => q.id === "margem");
  if (mg && mg.have < mg.need) return { title: `Margem média: ${Math.round(mg.have * 100)}% de ${Math.round(mg.need * 100)}%`, sub: "Compre lotes com desconto e evite perdas por validade", p: mg.have / mg.need, ring: `${Math.round(faseProgresso() * 100)}%`, go: () => openSheet("forn") };
  const l = faseReqs().find(q => q.id === "lucro");
  return { title: `Lucro médio: M ${fmt(l.have)} de M ${fmt(l.need)}`, sub: "Média dos últimos 3 dias fechados", p: l.have / l.need, ring: `${Math.round(faseProgresso() * 100)}%`, go: () => openSheet("expand") };
}
