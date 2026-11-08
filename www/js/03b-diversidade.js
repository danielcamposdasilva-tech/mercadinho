"use strict";
// =====================================================================
// Clientes diversos, atendimento prioritário, ajuda da equipe e circulação acessível.
//
// Princípios (decisão do usuário, ver MEMORIA.md):
// - Todos os perfis fazem o ciclo completo: chegam (a pé ou de carro), pegam cesta, escolhem produtos,
//   entram na fila, pagam e saem. Mesma paciência, mesma lista de compras, nenhuma penalidade por perfil.
// - Cão-guia, cadeira, andador, bengala e carrinho de bebê fazem parte do próprio cliente (desenho e espaço);
//   nunca são entidades separadas e nunca ocupam lugar próprio na fila.
// - A prioridade vem de um dado do cliente (categorias), não da aparência: há pessoas idosas sem bengala,
//   pessoas de aparência mais velha sem direito à prioridade e prioridades que não aparecem (gestação,
//   lactação, autismo, deficiência não aparente). Quem tem direito escolhe se usa (autonomia).
//
// Regras de prioridade adotadas (fontes oficiais lidas em 04/11/2026 em planalto.gov.br):
// - Lei 10.048/2000, art. 1º (redação da Lei 14.626/2023): pessoas com deficiência, com TEA, pessoas idosas
//   (60+), gestantes, lactantes, pessoas com criança de colo, obesos, pessoas com mobilidade reduzida e
//   doadores de sangue. §3º: prioridade por caixa específico; §4º: sem caixa específico, atendimento logo
//   após a conclusão do atendimento em andamento (nunca interromper).
// - Lei 10.741/2003, art. 3º, §2º: entre as pessoas idosas, prioridade especial aos maiores de 80 anos,
//   "preferencialmente em relação às demais pessoas idosas" (só sobre as outras pessoas idosas).
// - Lei 13.146/2015, art. 9º: atendimento prioritário à pessoa com deficiência, extensivo ao acompanhante.
// - Lei 11.126/2005: pessoa com deficiência visual pode entrar e permanecer com o cão-guia.
// - Carrinho de bebê: nenhuma dessas leis o menciona; "criança de colo" não é definida. O jogo NÃO trata
//   carrinho de bebê como prioridade legal. A loja pode oferecer cortesia (opção no caixa, desligada de início),
//   que vem depois das prioridades legais.
// Simplificação do jogo: para ninguém ser esquecido, um cliente sem prioridade é ultrapassado no máximo
// MAX_ULTRAPASSAGENS vezes na mesma fila. Isto não é regra legal; está documentado na MEMORIA.md.
// =====================================================================
const PERFIS = {
  //            nome no painel                       velocidade  meia-largura  espaço na fila  pede ajuda
  padrao:  { nome: "Cliente",                        vel: 1,     larg: 9,      prof: 22,       ajuda: 0.03 },
  idoso:   { nome: "Pessoa idosa",                   vel: 0.92,  larg: 9,      prof: 22,       ajuda: 0.08 },
  cadeira: { nome: "Pessoa em cadeira de rodas",     vel: 1,     larg: 12,     prof: 28,       ajuda: 0.3 },
  caoguia: { nome: "Pessoa cega com cão-guia",       vel: 0.95,  larg: 10,     prof: 30,       ajuda: 0.5 },
  bengala: { nome: "Pessoa com bengala",             vel: 0.82,  larg: 10,     prof: 22,       ajuda: 0.15 },
  andador: { nome: "Pessoa com andador",             vel: 0.75,  larg: 11,     prof: 28,       ajuda: 0.25 },
  bebe:    { nome: "Pessoa com carrinho de bebê",    vel: 0.95,  larg: 10,     prof: 32,       ajuda: 0.1 },
};
// frequência de cada perfil entre os clientes (o restante é "padrao")
const SORTEIO_PERFIL = [["cadeira", 0.05], ["caoguia", 0.03], ["andador", 0.04], ["bengala", 0.05], ["bebe", 0.06], ["idoso", 0.08]];
const CATEGORIAS = {
  pcd:      "Pessoa com deficiência",
  idoso:    "Pessoa idosa (60 anos ou mais)",
  idoso80:  "Pessoa idosa com 80 anos ou mais",
  mobred:   "Pessoa com mobilidade reduzida",
  gestante: "Gestante",
  lactante: "Lactante",
  tea:      "Pessoa com transtorno do espectro autista",
};
const CABELO_BRANCO = ["#d9d9d9", "#c7c7c7", "#ecebe6", "#9ca3af", "#b9b4aa"];
const CAES = ["#d9a35b", "#2a2620", "#c8a26a", "#8a5a2b"];
const BEBES = ["#5b8fd6", "#b5487a", "#2f8a7a", "#8a5cc2", "#d18a2a"];
const MAX_ULTRAPASSAGENS = 3, AJUDA_ESPERA = 8, AJUDA_ACOMPANHA = 10, AJUDA_MAX = 30;

// ---------- estado salvo (campos novos com valor padrão; partidas antigas recebem isto ao abrir) ----------
const novoHojeAcess = () => ({ ajudas: 0, semAjuda: 0, prio: 0 });
function acess() {
  if (!S.acess) S.acess = {};
  const a = S.acess;
  if (!(a.caixaPrio >= 0)) a.caixaPrio = 0;
  if (typeof a.cortesiaBebe !== "boolean") a.cortesiaBebe = false;
  if (!a.hoje) a.hoje = novoHojeAcess();
  if (!a.total) a.total = { ajudas: 0, semAjuda: 0, prio: 0 };
  return a;
}
function fecharDiaAcess(L) {
  const a = acess(); if (L) L.acess = Object.assign({}, a.hoje);
  a.hoje = novoHojeAcess();
}

// ---------- perfil de cada cliente ----------
function perfilar(c) {
  c.perfil = "padrao"; c.cat = []; c.vel = 1;
  if (!DIV) return;
  let r = Math.random(), p = "padrao";
  for (const [id, f] of SORTEIO_PERFIL) { if (r < f) { p = id; break; } r -= f; }
  const u = Math.random();
  c.perfil = p; c.vel = PERFIS[p].vel; c.hx = 0; c.hy = 1;
  if (p === "cadeira" || p === "caoguia") c.cat = ["pcd"];
  else if (p === "bengala" || p === "andador") {
    // a maioria tem 60 anos ou mais; alguns são mais jovens e usam o apoio por mobilidade reduzida
    if (u < 0.68) { c.cat = ["idoso"]; c.idade = 60 + Math.floor(Math.random() * 20); }
    else if (u < 0.9) { c.cat = ["idoso", "idoso80"]; c.idade = 80 + Math.floor(Math.random() * 12); }
    else { c.cat = ["mobred"]; c.idade = 30 + Math.floor(Math.random() * 28); }
  } else if (p === "idoso") {
    // aparência mais velha não decide nada: há quem tenha menos de 60 anos
    if (u < 0.72) { c.cat = ["idoso"]; c.idade = 60 + Math.floor(Math.random() * 20); }
    else if (u < 0.87) { c.cat = ["idoso", "idoso80"]; c.idade = 80 + Math.floor(Math.random() * 12); }
    else c.idade = 54 + Math.floor(Math.random() * 6);
  } else if (p === "bebe") c.bebe = pick(BEBES);
  else if (u < 0.05) c.cat = [pick(["gestante", "lactante", "tea", "pcd"])];   // prioridades que não aparecem no desenho
  if (c.idade >= 60) c.hair = pick(CABELO_BRANCO);
  if (p === "caoguia") c.cao = pick(CAES);
  c.querPrio = Math.random() < 0.85;                 // quem tem direito escolhe se usa
  c.pedeAjuda = Math.random() < PERFIS[p].ajuda;     // pedir ajuda é escolha do cliente, de qualquer perfil
}
const perfilDe = c => PERFIS[(c && c.perfil) || "padrao"] || PERFIS.padrao;
const prioLegal = c => !!(c.cat && c.cat.length);
const prioCortesia = c => !!c.bebe && !prioLegal(c) && acess().cortesiaBebe;
const usaPrio = c => DIV && !!c.querPrio && (prioLegal(c) || prioCortesia(c));
const nivelPrio = c => !usaPrio(c) ? 0 : prioLegal(c) ? 2 : 1;            // legal antes da cortesia da loja
const tem80 = c => !!(c.cat && c.cat.includes("idoso80"));
const soIdoso60 = c => !!(c.cat && c.cat.length === 1 && c.cat[0] === "idoso");
function descreverPrio(c) {
  if (!usaPrio(c)) return "";
  if (prioLegal(c)) return c.cat.filter(k => k !== "idoso" || !tem80(c)).map(k => CATEGORIAS[k]).join(", ");
  return "Cortesia da loja: pessoa com bebê no carrinho";
}

// ---------- caixa prioritário e ordem da fila ----------
const caixaPrio = () => Math.max(0, Math.min(acess().caixaPrio, S.cashiers - 1));
// c passa à frente de o? Prioridade legal antes de cortesia, cortesia antes de quem não tem; entre pessoas idosas,
// quem tem 80+ passa à frente das outras pessoas idosas (e só delas). Ninguém passa à frente de quem já foi
// ultrapassado MAX_ULTRAPASSAGENS vezes (proteção do jogo contra cliente esquecido).
function passaNaFrente(c, o) {
  if ((o.ultr || 0) >= MAX_ULTRAPASSAGENS) return false;
  const a = nivelPrio(c), b = nivelPrio(o);
  if (a !== b) return a > b;
  return a === 2 && tem80(c) && soIdoso60(o);
}
// ordem de chegada à fila (quem anda mais devagar até o caixa não bloqueia quem já está na fila)
let qChegSeq = 0;
const porChegada = (a, b) => a.qAt - b.qAt, porFila = (a, b) => (a.qChegou || 0) - (b.qChegou || 0);
function filaOrdenada(l) {
  const sid = lanes[l] && lanes[l].servingId;
  const todos = customers.filter(c => c.lane === l && (c.state === "toLane" || c.state === "queue"));
  const atendendo = todos.find(c => c.id === sid) || null;                // nunca sai da frente
  const naFila = todos.filter(c => c !== atendendo && c.state === "queue").sort(porFila);
  const chegando = todos.filter(c => c !== atendendo && c.state !== "queue").sort(porChegada);   // só entra na ordem quando chega à fila
  let ord = naFila;
  if (l === caixaPrio()) {
    ord = [];
    for (const c of naFila) { let i = ord.length; while (i > 0 && passaNaFrente(c, ord[i - 1])) i--; ord.splice(i, 0, c); }
  }
  return (atendendo ? [atendendo] : []).concat(ord, chegando);
}
// quando um atendimento começa, conta quem chegou antes e ficou para trás (para a proteção acima)
function inicioAtendimento(l, head) {
  if (nivelPrio(head) > 0) { acess().hoje.prio++; acess().total.prio++; }
  for (const o of customers) if (o !== head && o.lane === l && o.state === "queue" && (o.qChegou || 0) < (head.qChegou || 0)) o.ultr = (o.ultr || 0) + 1;
}
// escolha do caixa: quem usa a prioridade vai ao caixa prioritário, salvo se outro caixa estiver vazio;
// os demais preferem os outros caixas quando há gente com prioridade esperando
function escolherCaixa(c) {
  const n = nCaixas(); if (n <= 1) return 0;
  const pr = caixaPrio();
  if (usaPrio(c)) { for (let l = 0; l < n; l++) if (l !== pr && laneQueue(l).length === 0) return l; return pr; }
  let best = 0, bn = Infinity;
  for (let l = 0; l < n; l++) {
    const q = laneQueue(l), k = q.length + (l === pr ? 0.5 + 2 * q.filter(o => nivelPrio(o) > 0).length : 0);
    if (k < bn) { bn = k; best = l; }
  }
  return best;
}
// posição na fila: o espaço de cada um depende do perfil (cadeira, andador, carrinho e cão ocupam mais)
function posFila(l, i, q) {
  if (!DIV) return queueSlot(l, i);
  const base = LANES[l].serve; let d = 0;
  for (let k = 0; k < i; k++) d += (perfilDe(q[k]).prof + perfilDe(q[k + 1]).prof) / 2;
  return d <= 66 ? { x: base.x, y: base.y - d } : { x: base.x + 12, y: base.y - 77 };
}

// ---------- ajuda opcional da equipe ----------
// O cliente pede (ou não). Um carrinheiro livre vai até ele e acompanha por um tempo; a compra continua
// normalmente o tempo todo, com ou sem ajuda. Há limites de tempo dos dois lados: ninguém fica preso.
function pedirAjuda(c) { if (c.pedeAjuda && !c.ajuda) c.ajuda = { estado: "pedindo", t: 0 }; }
function tickAjudaCliente(c, dt) {
  const a = c.ajuda; if (!a || a.estado !== "pedindo") return;
  a.t += dt;
  if (a.t > AJUDA_ESPERA || c.state === "toLane" || c.state === "queue" || c.state === "exit" || c.state === "angry") {
    a.estado = "sem"; acess().hoje.semAjuda++; acess().total.semAjuda++;          // segue sozinho, sem penalidade
    toastOnce("ajuda", "Um cliente pediu ajuda e ninguém estava livre. Carrinheiros livres acompanham quem pede.");
  }
}
// o carrinheiro só sai para ajudar se as cestas da entrada não estiverem acabando (senão a loja toda para)
const cestasFolga = () => station.b + station.c + station2.b + station2.c >= 4 || piles.every(p => p.b + p.c === 0);
function clientePedindo(w) {
  if (!cestasFolga()) return null;
  let best = null, bt = -1;
  for (const c of customers) if (c.ajuda && c.ajuda.estado === "pedindo" && !collectors.some(o => o !== w && o.cli === c.id) && c.ajuda.t > bt) { best = c; bt = c.ajuda.t; }
  return best;
}
function iniciarAjuda(w, c) { w.state = "ajuda"; w.cli = c.id; w.tAj = 0; w.tAc = 0; w.rt = 0; w.path = []; c.ajuda.estado = "indo"; }
function voltarDaAjuda(w) {
  const a = corredorPara(w.x, STATION.x + 36);
  w.state = "back"; w.cli = null; w.b = w.c = 0; w.target = null;
  w.path = [{ x: a, y: w.y }, { x: a, y: FZ + 56 }, { x: STATION.x + 36, y: FZ + 56 }];
}
function passoAjuda(w, sp, dt) {
  const c = customers.find(o => o.id === w.cli);
  w.tAj += dt;
  const fora = !c || c.state === "gone" || c.state === "outside";
  const terminou = fora || c.state === "toLane" || c.state === "queue" || c.state === "exit" || c.state === "angry";
  const faltaCesta = station.b + station.c === 0 && piles.some(p => p.b + p.c > 0);   // volta para recolher cestas
  if (terminou || faltaCesta || w.tAj > AJUDA_MAX || (w.state === "acompanha" && w.tAc > AJUDA_ACOMPANHA)) {
    if (c && c.ajuda && (c.ajuda.estado === "indo" || c.ajuda.estado === "acompanhado")) {
      if (c.ajuda.estado === "acompanhado") { c.ajuda.estado = "concluida"; acess().hoje.ajudas++; acess().total.ajudas++; changeRep(0.02, "ajuda"); }
      else { c.ajuda.estado = "sem"; acess().hoje.semAjuda++; acess().total.semAjuda++; }
    }
    voltarDaAjuda(w); return;
  }
  const hx = c.hx || 0, hy = c.hy == null ? 1 : c.hy;
  if (w.state === "ajuda") {
    w.rt -= dt;                                        // vai pelos corredores, recalculando a rota de vez em quando
    if (w.rt <= 0 || !w.path.length) { w.rt = 0.8; w.path = routeTo(w, c.x - hx * 20, c.y - hy * 20); }
    follow(w, sp, dt);
    if (Math.hypot(w.x - c.x, w.y - c.y) < 28) { w.state = "acompanha"; w.tAc = 0; c.ajuda.estado = "acompanhado"; float(c.x, c.y - 30, "🤝", "#2e7a57"); }
  } else {
    w.tAc += dt;                                       // acompanha logo atrás, sem cortar caminho pelas gôndolas
    moveTo(w, c.x - hx * 20 + hy * 4, c.y - hy * 20 - hx * 4, sp * 1.6, dt);
  }
}

// ---------- circulação acessível: dados comuns a desenho, movimento e verificação ----------
const AJ = { porta: 26, saida: 14, faixa: FZ => FZ - 7 };
// portas de saída na fachada de vidro, uma em frente a cada caixa (a rota de saída passa por elas)
const saidasCaixa = () => LANES.map(ln => ({ x: ln.serve.x, w: 2 * AJ.saida }));
// rampas e rebaixamentos: soleira da entrada e guias rebaixadas em frente a cada vaga
function rampasAcesso() {
  const r = [{ tipo: "porta", x: LOJA.espelho ? W : -AJ.porta, y: P.entrance.y - 14, w: AJ.porta, h: 36 }];
  if (ENT2) r.push({ tipo: "porta", x: LOJA.espelho ? -AJ.porta : W, y: P.entrance.y - 14, w: AJ.porta, h: 36 });
  STALLS.forEach(s => r.push({ tipo: "guia", x: s.x - 7, y: H + 12, w: 14, h: 6 }));
  return r;
}
// piso tátil direcional da calçada (em cima e no estacionamento) até a porta
function pisoTatil() {
  const y = pkY();
  const r = [[{ x: ENT.fora, y: 46 }, { x: ENT.fora, y: P.entrance.y }, { x: ENT.porta, y: P.entrance.y }], [{ x: ENT.fora, y: y.walk }, { x: ENT.fora, y: P.entrance.y }]];
  if (ENT2) r.push([{ x: ENT2.fora, y: 46 }, { x: ENT2.fora, y: P.entrance.y }, { x: ENT2.porta, y: P.entrance.y }], [{ x: ENT2.fora, y: y.walk }, { x: ENT2.fora, y: P.entrance.y }]);
  return r;
}
// partes do caixa: esteira e balcão, com o corredor do caixa entre eles (largura 24, por onde o cliente sai)
function partesCaixa(l) {
  const x = LANES[l].x, y0 = FZ + 82;
  return [{ x: x - 40, y: y0, w: 20, h: 22, nome: "esteira do caixa" }, { x: x + 4, y: y0, w: 16, h: 22, nome: "balcão do caixa" }, { x: x + 20, y: y0 + 2, w: 15, h: 18, nome: "operador" }];
}
function obstaculos() {
  const o = [];
  SHELVES.forEach((sh, i) => o.push({ x: sh.x - 4, y: sh.y - 5, w: sh.w + 8, h: sh.h + 11, nome: "gôndola " + (i + 1) }));
  LANES.forEach((_, l) => partesCaixa(l).forEach(p => o.push(Object.assign({}, p, { nome: p.nome + " " + (l + 1) }))));
  o.push({ x: STATION.x - 22, y: STATION.y - 16, w: 52, h: 30, nome: "cestas" });
  if (ENT2) o.push({ x: STATION2.x - 22, y: STATION2.y - 16, w: 52, h: 30, nome: "cestas da avenida" });
  o.push({ x: 0, y: 40, w: W, h: 78, nome: "fachada e depósito" });
  if (GANCHOS.obstaculos) GANCHOS.obstaculos().forEach(r => o.push(r));        // paletes do atacarejo (capítulo 6)
  // paredes laterais: a do lado da entrada tem o vão da porta (FZ-6 a FZ+38)
  const ladoPorta = LOJA.espelho ? W : -5, outro = LOJA.espelho ? -5 : W;
  if (ENT2) o.push({ x: outro, y: 118, w: 5, h: FZ - 6 - 118, nome: "parede" }, { x: outro, y: FZ + 38, w: 5, h: H - FZ - 38, nome: "parede" });
  else o.push({ x: outro, y: 118, w: 5, h: H - 118, nome: "parede" });
  o.push({ x: ladoPorta, y: 118, w: 5, h: FZ - 6 - 118, nome: "parede" }, { x: ladoPorta, y: FZ + 38, w: 5, h: H - FZ - 38, nome: "parede" });
  // fachada de vidro embaixo, com as portas de saída
  const vaos = saidasCaixa().map(s => [s.x - s.w / 2, s.x + s.w / 2]).sort((a, b) => a[0] - b[0]);
  let x0 = -5;
  for (const [a, b] of vaos) { if (a > x0) o.push({ x: x0, y: H, w: a - x0, h: 4, nome: "vidro da fachada" }); x0 = Math.max(x0, b); }
  if (x0 < W + 5) o.push({ x: x0, y: H, w: W + 5 - x0, h: 4, nome: "vidro da fachada" });
  return o;
}
// pegada de um perfil no ponto (x, y): faixa dos pés, com a meia-largura do perfil (cadeira, cão, carrinho...)
const pegada = (x, y, larg) => ({ x: x - larg, y: y + 2, w: 2 * larg, h: 8 });
const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// rotas que os clientes realmente usam, montadas pelas mesmas funções do movimento
function rotasDeTeste() {
  const R = [], y = pkY(), add = (nome, pts) => R.push({ nome, pts: pts.map(p => ({ x: p.x, y: p.y })) });
  const r0 = Math.random; Math.random = () => 0.2;  const pe1 = caminhoChegada(null, 0);   // calçada de cima
  Math.random = () => 0.8; const pe2 = caminhoChegada(null, 5); Math.random = r0;          // calçada de baixo
  add("a pé, calçada de cima", [pe1, ...pe1.path]); add("a pé, calçada de baixo", [pe2, ...pe2.path]);
  STALLS.forEach((s, i) => [-4, 5].forEach(side => { const c = caminhoChegada({ x: s.x, side }, i % 8); add(`do carro, vaga ${i + 1}`, [c, ...c.path]); }));
  const wp = caminhoChegada(null, 0).path.slice(-1)[0];
  SHELVES.forEach((sh, i) => { for (let k = 0; k < 4; k++) {
    const alvo = { x: sh.x + 16 + k * 27, y: sh.stand };
    add(`cestas → gôndola ${i + 1}`, [wp, ...routeTo(wp, alvo.x, alvo.y)]);
    LANES.forEach((ln, l) => { const c = { x: alvo.x, y: alvo.y }; add(`gôndola ${i + 1} → caixa ${l + 1}`, [c, ...caminhoCaixa(c, l), posFila(l, 3, []), ln.serve]); });
    const ang = { x: alvo.x, y: alvo.y, state: "shop" }; add(`gôndola ${i + 1} → saída (desistência)`, [ang, ...caminhoIrritado(ang)]);
    if (i + 1 < SHELVES.length) { const n = SHELVES[i + 1]; add(`gôndola ${i + 1} → ${i + 2}`, [alvo, ...routeTo(alvo, n.x + 16, n.stand)]); }
  } });
  LANES.forEach((ln, l) => {
    const c = { x: ln.serve.x, y: ln.serve.y }, ex = caminhoSaida(c)[0];
    add(`caixa ${l + 1} → porta de saída`, [c, ex]);
    const f = { x: ex.x, y: ex.y, car: null }; goOutside(f); add(`saída do caixa ${l + 1} → calçada`, [ex, ...f.path]);
    STALLS.forEach((s, i) => add(`saída do caixa ${l + 1} → vaga ${i + 1}`, [ex, { x: s.x + 5, y: y.walk }, { x: s.x + 5, y: y.door }]));
    const q = { x: ln.serve.x, y: ln.serve.y - 44, state: "queue" }; add(`fila do caixa ${l + 1} → saída (desistência)`, [q, ...caminhoIrritado(q)]);
  });
  const st = { x: wp.x, y: wp.y, state: "atStation" }; add("cestas → saída (sem cesta)", [st, ...caminhoIrritado(st)]);
  if (ENT2) {          // segunda entrada (avenida): chegada a pé, cestas → gôndolas, desistência pelas duas portas
    const pa = caminhoChegada(null, 0, 1); add("a pé, entrada da avenida", [pa, ...pa.path]);
    const pb = caminhoChegada(null, 6, 1); add("a pé, entrada da avenida (fila das cestas)", [pb, ...pb.path]);
    STALLS.slice(0, 3).forEach((s, i) => { const c = caminhoChegada({ x: s.x, side: 5 }, i, 1); add(`do carro pela avenida, vaga ${i + 1}`, [c, ...c.path]); });
    const w2 = pa.path.slice(-1)[0];
    SHELVES.forEach((sh, i) => add(`cestas da avenida → gôndola ${i + 1}`, [w2, ...routeTo(w2, sh.x + 16 + 27 * (i % 4), sh.stand)]));
    const s2 = { x: w2.x, y: w2.y, state: "atStation", ent: 1 }; add("cestas da avenida → saída (sem cesta)", [s2, ...caminhoIrritado(s2)]);
    SHELVES.forEach((sh, i) => { const g2 = { x: sh.x + 43, y: sh.stand, state: "shop", ent: 1 }; add(`gôndola ${i + 1} → saída da avenida (desistência)`, [g2, ...caminhoIrritado(g2)]); });
  }
  return R;
}
function verificarCirculacao(perfis) {
  const obs = obstaculos(), falhas = [], rotas = rotasDeTeste();
  for (const p of perfis || Object.keys(PERFIS)) {
    const larg = PERFIS[p].larg;
    for (const r of rotas) {
      let achou = null;
      for (let i = 1; i < r.pts.length && !achou; i++) {
        const a = r.pts[i - 1], b = r.pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
        for (let k = 0; k <= n && !achou; k++) { const pg = pegada(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n, larg); const o = obs.find(o => cruza(pg, o)); if (o) achou = { perfil: p, rota: r.nome, obstaculo: o.nome, x: Math.round(pg.x + larg), y: Math.round(pg.y - 2) }; }
      }
      if (achou) falhas.push(achou);
    }
  }
  // folga real dos corredores entre gôndolas (unidades do mundo) e a maior pegada
  const fr = SHELVES.map(sh => [sh.x - 4, sh.x + sh.w + 4]).filter((v, i, a) => a.findIndex(o => o[0] === v[0]) === i).sort((a, b) => a[0] - b[0]);
  const vaos = []; for (let i = 1; i < fr.length; i++) if (fr[i][0] > fr[i - 1][1]) vaos.push(fr[i][0] - fr[i - 1][1]);
  return { ok: !falhas.length, falhas, rotas: rotas.length, obstaculos: obs.length, menorCorredor: vaos.length ? Math.min(...vaos) : null, maiorPegada: 2 * Math.max(...Object.values(PERFIS).map(p => p.larg)) };
}
