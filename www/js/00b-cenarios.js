"use strict";
// =====================================================================
// Cenários. Cada estabelecimento descreve aqui a própria aparência e os
// próprios terrenos; o motor desenha a partir destes dados.
// O Modo Livre usa o cenário "esquina", idêntico ao jogo antes desta mudança.
// Cenários da carreira serão acrescentados aqui (referências implícitas a
// Maricá, sem nomes nem logotipos de empresas reais).
// =====================================================================
const CENARIOS = {
  esquina: {
    nome: "Mercadinho da Esquina",
    cores: {
      grama: "#b9d08f", gramaEscura: "rgba(80,130,50,.16)", gramaClara: "rgba(255,255,220,.22)",
      calcadaLonge: "#d6cfbd", meioFio: "#c9c2b2", calcadaPerto: "#cfc8b6", calcadaBaixo: "#d6cfbd",
      rua: "#7f878c", faixa: "rgba(255,255,255,.7)", faixaTopo: "rgba(255,255,255,.75)",
      passeio: "#ddd5c3", passeioJunta: "rgba(150,135,105,.25)",
      asfalto: "#9aa3a6", asfaltoClaro: "#a9b1b4",
      lote: "#d8d3c6", parede: "#e7dcc3",
      arvoreTronco: "#7a5634", arvoreEscura: "#4f8a3a", arvoreClara: "#6fae52",
      toldo: ["#d4553d", "#fffaf0"],      // listras alternadas, começando pela vermelha
      porta: "#2c5a1c", vidro: "#8fc7e8", entradaTexto: "#3d6e27",
    },
    letreiro: null,           // null = o letreiro acompanha o porte da loja (TIERS)
    // Geometria da loja (unidades do mundo; 1 unidade ≈ 0,2 m). Desenho, toque e rotas usam estes números.
    loja: {
      W: 360,                              // largura interna
      colunas: [22, 198], gondola: 140,    // x de cada coluna de gôndolas e largura de cada uma
      corredores: [180],                   // corredores verticais (o primeiro é o principal)
      espelho: false,                      // false: entrada e passeio à esquerda; true: à direita
      deposito: { x: 8, w: 140 },          // depósito na faixa da fachada (porta e caminhão saem daqui)
      letreiro: { x: 188, w: 164 },        // letreiro; relógio e toldo acompanham
      estacao: 82,                         // cestas e carrinhos perto da entrada
      caixas: 178,                         // centro do grupo de caixas
    },
    plot: true,                            // terreno de expansão de porte ao lado (só no Modo Livre)
    estacionamento: { cancela: true },
    // Terrenos com local e finalidade definidos (antes em LOTS, no estacionamento)
    lotes: [
      { id: "park0", kind: "park", name: "Estacionamento inicial", stalls: 4, x: 34, w: 88, cost: 0, tier: 0 },
      { id: "park1", kind: "park", name: "Ampliação do estacionamento I", stalls: 6, x: 122, w: 132, cost: 400, tier: 0, after: "park0" },
      { id: "park2", kind: "park", name: "Ampliação do estacionamento II", stalls: 6, x: 254, w: 132, cost: 3000, tier: 1, after: "park1" },
      { id: "park3", kind: "park", name: "Lote lateral do estacionamento", stalls: 6, x: 386, w: 132, cost: 20000, tier: 2, after: "park2" },
      { id: "market", kind: "market", name: "Terreno de ampliação do mercado", cost: 800, tier: 0 },
      { id: "logi", kind: "logi", name: "Pátio de logística", cost: 5000, tier: 1, after: "market" },
    ],
  },
};
const corEsquina = () => Object.assign({}, CENARIOS.esquina.cores);

// Fase 1 da carreira: mercado de bairro. Referência implícita a Itapeba: rua principal na frente,
// casas em volta, muros e portões, gente passando a pé. Paleta inspirada (vermelho e amarelo), sem marca.
// Adaptação de jogo (sem planta real disponível): loja estreita, entrada pela lateral direita,
// depósito pequeno à direita da fachada, estacionamento de 3 vagas sem cancela.
CENARIOS.bairro = {
  nome: "Mercadinho da Lagoa", bairro: "Itapeba",
  cores: Object.assign(corEsquina(), {
    grama: "#b4cc86", calcadaLonge: "#d9d1bd", passeio: "#ddd3bd",
    toldo: ["#c9302c", "#f4c430"], porta: "#8e1f1b", entradaTexto: "#a32620",
  }),
  letreiro: { sign: ["MERCADINHO", "DA LAGOA"], signColor: "#c9302c" },
  loja: { W: 276, colunas: [14, 154], gondola: 108, corredores: [138], espelho: true,
    deposito: { x: 188, w: 82 }, letreiro: { x: 40, w: 132 }, estacao: 176, caixas: 100 },
  plot: false,
  estacionamento: { cancela: false },      // vagas livres na frente: sem cabine, sem cobrança
  vizinhanca: "casas",
  margem: { topo: 78, esq: 150, dir: 150, baixo: 120 },
  pedestres: { taxa: 0.45, max: 9 },       // pessoas por segundo; a maioria só passa
  transito: 0.7,                            // menos carros que no Centro
  onibus: { cada: 26 },                     // rua principal: passa às vezes
  lotes: [
    { id: "park0", kind: "park", name: "Vagas em frente", stalls: 3, x: 34, w: 66, cost: 0, tier: 0 },
    { id: "park1", kind: "park", name: "Terreno baldio ao lado", stalls: 3, x: 100, w: 66, cost: 350, tier: 0, after: "park0" },
  ],
};

// Fase 2 da carreira: mercado no Centro. Lojas, academia, ponto de ônibus e movimento o dia todo.
// Paleta inspirada (azul-marinho e dourado), sem marca. Adaptação de jogo: loja larga com três
// fileiras de gôndolas, letreiro à esquerda, depósito e descarga à direita, caixas à direita,
// estacionamento com cancela e pátio de carga comprável.
CENARIOS.centro = {
  nome: "Empório Espiga", bairro: "Centro",
  cores: Object.assign(corEsquina(), {
    grama: "#c9c6bb", gramaEscura: "rgba(90,90,80,.10)", gramaClara: "rgba(255,255,255,.18)",
    calcadaLonge: "#dcd6c8", calcadaPerto: "#d3cdbf", calcadaBaixo: "#dcd6c8", passeio: "#e2dccd",
    lote: "#cfcabd", toldo: ["#1d3461", "#f5f1e6"], porta: "#1d3461", entradaTexto: "#1d3461",
  }),
  letreiro: { sign: ["EMPÓRIO", "ESPIGA"], signColor: "#1d3461" },
  // corredores de 34 unidades entre as fileiras (antes 21): cadeira de rodas, andador, carrinho de bebê
  // e cão-guia passam sem encostar nas gôndolas (conferido por verificarCirculacao, em 03b)
  loja: { W: 432, colunas: [16, 156, 296], gondola: 106, corredores: [139, 279], espelho: false,
    deposito: { x: 284, w: 140 }, letreiro: { x: 40, w: 190 }, estacao: 82, caixas: 290 },
  plot: false,
  estacionamento: { cancela: true },
  vizinhanca: "centro",
  margem: { topo: 92, esq: 150, dir: 150, baixo: 120 },
  pedestres: { taxa: 1.1, max: 16 },
  transito: 1.8,
  onibus: { cada: 13 },
  lotes: [
    { id: "park0", kind: "park", name: "Estacionamento do Empório", stalls: 6, x: 34, w: 132, cost: 0, tier: 0 },
    { id: "park1", kind: "park", name: "Ampliação do estacionamento", stalls: 6, x: 166, w: 132, cost: 1500, tier: 0, after: "park0" },
    { id: "park2", kind: "park", name: "Lote da esquina", stalls: 6, x: 298, w: 132, cost: 6000, tier: 0, after: "park1" },
    { id: "logi", kind: "logi", name: "Pátio de carga e descarga", cost: 4000, tier: 0 },
  ],
};

// Fase 3 da carreira: supermercado do Centro, vizinho de rua do Empório. Paleta inspirada (verde e
// amarelo de ipê, detalhes em vermelho), sem marca. Adaptação de jogo: loja larga com entrada pela
// direita, depósito grande à esquerda da fachada e doca de recebimento ao lado, onde param as
// carretas dos fornecedores. Estacionamento livre (sem cancela), com 8 vagas e ampliação.
// Corredores de 34 unidades, como no Empório: cadeira de rodas, andador, carrinho de bebê e cão-guia
// passam sem encostar nas gôndolas (conferido por verificarCirculacao, em 03b).
CENARIOS.ipe = {
  nome: "Supermercado Ipê", bairro: "Centro",
  cores: Object.assign(corEsquina(), {
    grama: "#c4c6b6", gramaEscura: "rgba(80,95,70,.10)", gramaClara: "rgba(255,255,255,.18)",
    calcadaLonge: "#d8d6c6", calcadaPerto: "#d0cebe", calcadaBaixo: "#d8d6c6", passeio: "#e0decf",
    lote: "#cbc9bb", toldo: ["#1f7a3a", "#f4c430"], porta: "#1f7a3a", entradaTexto: "#1f7a3a",
  }),
  letreiro: { sign: ["SUPERMERCADO", "IPÊ"], signColor: "#1f7a3a" },
  loja: { W: 448, colunas: [16, 166, 316], gondola: 116, corredores: [149, 299], espelho: true,
    deposito: { x: 8, w: 204 }, letreiro: { x: 254, w: 176 }, estacao: 348, caixas: 160 },
  plot: false,
  doca: true,                              // doca de recebimento à esquerda (sem casas desenhadas por baixo)
  depositoMult: 2,                         // depósito de supermercado: cabe o dobro por nível
  estacionamento: { cancela: false },
  vizinhanca: "centro", semente: 131,
  margem: { topo: 92, esq: 170, dir: 150, baixo: 120 },
  pedestres: { taxa: 1.0, max: 15 },
  transito: 1.6,
  onibus: { cada: 15 },
  lotes: [
    { id: "park0", kind: "park", name: "Estacionamento do Ipê", stalls: 8, x: 34, w: 176, cost: 0, tier: 0 },
    { id: "park1", kind: "park", name: "Ampliação do estacionamento", stalls: 8, x: 210, w: 176, cost: 3000, tier: 0, after: "park0" },
    { id: "logi", kind: "logi", name: "Doca de recebimento", cost: 0, tier: 0 },
  ],
};

// Capítulo 4: supermercado do Centro com DUAS entradas (estacionamento à esquerda, avenida à direita), cada
// uma com cestas próprias. Paleta inspirada (azul e cinza-claro), sem marca. Adaptação de jogo: quatro
// fileiras de gôndolas em duas linhas, quatro caixas no meio, depósito largo à direita da fachada.
CENARIOS.restinga = {
  nome: "Supermercado Restinga", bairro: "Centro",
  cores: Object.assign(corEsquina(), {
    grama: "#c3c7c6", gramaEscura: "rgba(70,80,90,.10)", gramaClara: "rgba(255,255,255,.18)",
    calcadaLonge: "#d8d8d2", calcadaPerto: "#cfd0ca", calcadaBaixo: "#d8d8d2", passeio: "#e1e1db",
    lote: "#c9cbc6", toldo: ["#1f5fa8", "#eef3f8"], porta: "#1f5fa8", entradaTexto: "#1f5fa8",
  }),
  letreiro: { sign: ["SUPERMERCADO", "RESTINGA"], signColor: "#1f5fa8" },
  loja: { W: 530, colunas: [16, 150, 284, 418], gondola: 96, corredores: [131, 265, 399], espelho: false,
    deposito: { x: 300, w: 222 }, letreiro: { x: 44, w: 196 }, estacao: 76, estacao2: 448, caixas: 265,
    slots: 8, caixasN: 4, entrada2: true },
  plot: false, depositoMult: 2,
  estacionamento: { cancela: false },
  vizinhanca: "centro", semente: 211,
  margem: { topo: 92, esq: 150, dir: 170, baixo: 120 },
  pedestres: { taxa: 1.2, max: 17 }, transito: 1.7, onibus: { cada: 12 },
  lotes: [
    { id: "park0", kind: "park", name: "Estacionamento do Restinga", stalls: 8, x: 34, w: 176, cost: 0, tier: 0 },
    { id: "park1", kind: "park", name: "Ampliação do estacionamento", stalls: 8, x: 210, w: 176, cost: 3500, tier: 0, after: "park0" },
  ],
};
// Capítulo 5: mercado do Centro com expedição de entregas na fachada (balcão, bolsas e motos na calçada).
// Paleta inspirada (verde, vermelho e branco), sem marca. Entrada pela direita, depósito à esquerda.
CENARIOS.pitanga = {
  nome: "Mercado Pitanga", bairro: "Centro",
  cores: Object.assign(corEsquina(), {
    grama: "#c6c8b8", gramaEscura: "rgba(70,90,60,.10)", gramaClara: "rgba(255,255,255,.18)",
    calcadaLonge: "#dad6c6", calcadaPerto: "#d1cdbd", calcadaBaixo: "#dad6c6", passeio: "#e2ddcd",
    lote: "#cdc9ba", toldo: ["#c62828", "#f5f5f0"], porta: "#2e7d32", entradaTexto: "#2e7d32",
  }),
  letreiro: { sign: ["MERCADO", "PITANGA"], signColor: "#2e7d32" },
  loja: { W: 432, colunas: [16, 156, 296], gondola: 106, corredores: [139, 279], espelho: true,
    deposito: { x: 8, w: 150 }, letreiro: { x: 186, w: 132 }, estacao: 332, caixas: 150, slots: 6, caixasN: 4 },
  plot: false, depositoMult: 2,
  estacionamento: { cancela: false },
  vizinhanca: "centro", semente: 307,
  margem: { topo: 92, esq: 150, dir: 150, baixo: 120 },
  pedestres: { taxa: 1.0, max: 15 }, transito: 1.6, onibus: { cada: 14 },
  lotes: [
    { id: "park0", kind: "park", name: "Vagas do Pitanga", stalls: 6, x: 34, w: 132, cost: 0, tier: 0 },
    { id: "park1", kind: "park", name: "Ampliação das vagas", stalls: 6, x: 166, w: 132, cost: 3000, tier: 0, after: "park0" },
  ],
};
// Capítulo 6: atacarejo à beira da rodovia (referência implícita ao entorno da RJ-106): galpão largo,
// docas de descarga à esquerda, estacionamento amplo e uma pequena galeria de lojas à direita.
// Paleta inspirada (laranja, verde e branco), sem marca.
CENARIOS.cajueiro = {
  nome: "Atacarejo Cajueiro", bairro: "RJ-106",
  cores: Object.assign(corEsquina(), {
    grama: "#bfcf94", calcadaLonge: "#d6cfbd", passeio: "#ddd5c3",
    lote: "#d0cbbb", toldo: ["#e8711a", "#2e7d32"], porta: "#2e7d32", entradaTexto: "#b8530c",
    rua: "#6f777c",
  }),
  letreiro: { sign: ["ATACAREJO", "CAJUEIRO"], signColor: "#e8711a" },
  loja: { W: 600, colunas: [16, 166, 316, 466], gondola: 112, corredores: [147, 297, 447], espelho: false,
    deposito: { x: 290, w: 300 }, letreiro: { x: 52, w: 200 }, estacao: 82, caixas: 320, slots: 8, caixasN: 4, faixaPaletes: 76 },
  plot: false, doca: true, depositoMult: 3, faixaDir: 200, galeria: true,
  estacionamento: { cancela: false },
  vizinhanca: "rodovia", semente: 419,
  margem: { topo: 78, esq: 190, dir: 230, baixo: 130 },
  pedestres: { taxa: 0.35, max: 7 }, transito: 2.4, onibus: { cada: 22 },
  lotes: [
    { id: "park0", kind: "park", name: "Estacionamento do atacarejo", stalls: 10, x: 34, w: 220, cost: 0, tier: 0 },
    { id: "park1", kind: "park", name: "Pátio lateral", stalls: 10, x: 254, w: 220, cost: 4000, tier: 0, after: "park0" },
    { id: "park2", kind: "park", name: "Vagas para utilitários", stalls: 6, x: 474, w: 132, cost: 7000, tier: 0, after: "park1" },
  ],
};
// Capítulos 7 e 8: shoppings. Não há gôndolas nem caixas de mercado: o desenho e a simulação são de 06h
// (lojas, corredor, praça de alimentação, visitantes). A "loja" abaixo só dá o tamanho do prédio.
const LOJA_SHOP = (W, H) => ({ W, H, colunas: [16], gondola: 100, corredores: [W / 2], espelho: false, deposito: { x: 20, w: 120 },
  letreiro: { x: W / 2 - 90, w: 180 }, estacao: 60, caixas: W / 2, slots: 1, caixasN: 1, semLoja: true });
CENARIOS.brisa = {
  nome: "Shopping Brisa da Lagoa", bairro: "Centro", tipo: "shopping",
  cores: Object.assign(corEsquina(), {
    grama: "#c4ccb4", calcadaLonge: "#dcd6c8", calcadaPerto: "#d3cdbf", calcadaBaixo: "#dcd6c8", passeio: "#e5e0d2",
    lote: "#cfcabd", toldo: ["#0f6e7a", "#f2efe6"], porta: "#0f6e7a", entradaTexto: "#0f6e7a",
  }),
  letreiro: { sign: ["SHOPPING", "BRISA DA LAGOA"], signColor: "#0f6e7a" },
  loja: LOJA_SHOP(640, 470),
  plot: false, vizinhanca: "centro", semente: 523,
  estacionamento: { cancela: true },
  margem: { topo: 92, esq: 150, dir: 150, baixo: 130 },
  pedestres: { taxa: 1.2, max: 16 }, transito: 1.8, onibus: { cada: 12 },
  lotes: [
    { id: "park0", kind: "park", name: "Estacionamento coberto", stalls: 12, x: 34, w: 264, cost: 0, tier: 0 },
    { id: "park1", kind: "park", name: "Estacionamento descoberto", stalls: 12, x: 298, w: 264, cost: 6000, tier: 0, after: "park0" },
    { id: "park2", kind: "park", name: "Edifício-garagem (térreo)", stalls: 6, x: 562, w: 132, cost: 12000, tier: 0, after: "park1" },
  ],
};
CENARIOS.grande = {
  nome: "Maricá Grande Shopping", bairro: "Região da orla (fictícia)", tipo: "shopping", obra: true,
  cores: Object.assign(corEsquina(), {
    grama: "#bfd08f", calcadaLonge: "#d6cfbd", passeio: "#ddd5c3", lote: "#d6c9a6",
    toldo: ["#6b3fa0", "#f4efe2"], porta: "#6b3fa0", entradaTexto: "#6b3fa0",
  }),
  letreiro: { sign: ["MARICÁ", "GRANDE SHOPPING"], signColor: "#6b3fa0" },
  loja: LOJA_SHOP(840, 520),
  plot: false, vizinhanca: "rodovia", semente: 631,
  estacionamento: { cancela: true },
  margem: { topo: 78, esq: 160, dir: 160, baixo: 130 },
  pedestres: { taxa: 0.5, max: 9 }, transito: 2.2, onibus: { cada: 16 },
  lotes: [
    { id: "park0", kind: "park", name: "Estacionamento principal", stalls: 14, x: 34, w: 308, cost: 0, tier: 0 },
    { id: "park1", kind: "park", name: "Estacionamento sul", stalls: 14, x: 342, w: 308, cost: 9000, tier: 0, after: "park0" },
    { id: "park2", kind: "park", name: "Estacionamento leste", stalls: 8, x: 650, w: 176, cost: 15000, tier: 0, after: "park1" },
  ],
};

// ---------------------------------------------------------------------
// Sessão: qual modo está aberto nesta aba. A escolha fica em sessionStorage
// e cada troca de modo ou de fase recarrega a página, o que limpa entidades,
// filas e reservas da partida anterior.
//   livre    → cenário "esquina", save "mercadinho-save-v4" (inalterado)
//   carreira → cenário da fase, save "mercadinho-carreira-v1"
//   previa   → ?cenario=bairro|centro, save "mercadinho-previa-<id>"
//   menu     → tela inicial; nada é salvo
// ---------------------------------------------------------------------
const CHAVE_LIVRE = "mercadinho-save-v4", CHAVE_CARREIRA = "mercadinho-carreira-v1", CHAVE_SESSAO = "mercadinho-sessao";
const FASES = {
  bairro: { ordem: 1, cenario: "bairro", proxima: "centro" },
  centro: { ordem: 2, cenario: "centro", proxima: "ipe" },
  ipe:    { ordem: 3, cenario: "ipe",    proxima: "restinga" },
  restinga: { ordem: 4, cenario: "restinga", proxima: "pitanga" },
  pitanga:  { ordem: 5, cenario: "pitanga",  proxima: "cajueiro" },
  cajueiro: { ordem: 6, cenario: "cajueiro", proxima: "brisa" },
  brisa:    { ordem: 7, cenario: "brisa",    proxima: "grande" },
  grande:   { ordem: 8, cenario: "grande",   proxima: null },
};
const lerJSON = (st, k) => { try { const r = st.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
const PREVIA = (() => { try { const id = new URLSearchParams(location.search).get("cenario"); return id && CENARIOS[id] ? id : null; } catch (e) { return null; } })();
const MODO = PREVIA ? "previa" : ((lerJSON(sessionStorage, CHAVE_SESSAO) || {}).modo || "menu");
// ---------------------------------------------------------------------
// Carreira, formato 2 (desde 05/11/2026). O andamento da carreira e a loja
// aberta na tela são coisas separadas:
//   fase   → capítulo mais avançado já assumido (andamento)
//   ativa  → loja aberta na tela (pode ser uma loja concluída)
//   lojas  → estado completo de cada loja: caixa, estoque, equipe, melhorias,
//            pedidos pendentes e lastSeen (data do último salvamento)
//   fases  → registro de conclusão de cada capítulo (XP concedido uma vez)
// Tudo continua numa chave só, gravada de uma vez: trocar de loja nunca deixa
// metade do progresso para trás nem duplica saldo.
// O formato 1 guardava só a loja do capítulo atual em "loja": ela passa para
// lojas[fase]. Lojas anteriores ao formato 2 não têm estado guardado; ficam só
// com o registro de conclusão e podem ser reabertas (06b, reabrirLoja).
// ---------------------------------------------------------------------
const CHAVE_CARREIRA_BACKUP = "mercadinho-carreira-v1-copia-formato-1";
function lojaPermitida(c, id) { return !!FASES[id] && (id === c.fase || !!(c.fases && c.fases[id] && c.fases[id].concluida)); }
function migrarCarreira(c, gravarCopia) {
  if (!c || typeof c !== "object") return null;
  if (!(c.versao >= 2)) {
    if (gravarCopia) { try { if (!localStorage.getItem(CHAVE_CARREIRA_BACKUP)) localStorage.setItem(CHAVE_CARREIRA_BACKUP, JSON.stringify(c)); } catch (e) {} }
    c.lojas = c.lojas || {};
    if (c.loja && FASES[c.fase] && !c.lojas[c.fase]) c.lojas[c.fase] = c.loja;
    delete c.loja;
    c.ativa = c.fase; c.versao = 2; c.migradoEm = Date.now();
  }
  c.fases = c.fases || {}; c.lojas = c.lojas || {}; c.conquistas = c.conquistas || []; c.convites = c.convites || {};
  if (!FASES[c.fase]) c.fase = "bairro";
  if (!c.ativa || !lojaPermitida(c, c.ativa)) c.ativa = c.fase;
  return c;
}
// partida de carreira salva (null = ainda não começou)
let CARREIRA = MODO === "carreira" ? migrarCarreira(lerJSON(localStorage, CHAVE_CARREIRA), true) : null;
// FASE = loja aberta na tela (não confundir com CARREIRA.fase, o andamento)
const FASE = MODO === "carreira" ? (CARREIRA ? CARREIRA.ativa : "bairro") : null;
const CENA_ID = PREVIA || (MODO === "carreira" ? FASES[FASE].cenario : MODO === "livre" ? "esquina" : "centro");
let SCENE = CENARIOS[CENA_ID];
const COR = () => SCENE.cores;
const MARGEM = Object.assign({ topo: 0, esq: 0, dir: 0, baixo: 0 }, SCENE.margem || {});
const LOJA = SCENE.loja;
// lado da entrada: porta, passeio externo e ponto logo depois da porta
const ENT = LOJA.espelho
  ? { porta: LOJA.W + 12, fora: LOJA.W + 28, dentro: LOJA.W - 28, sinal: -1 }
  : { porta: -12, fora: -28, dentro: 28, sinal: 1 };
const mx = x => LOJA.espelho ? LOJA.W - x : x;
// segunda entrada (capítulo 4): na parede oposta, com cestas próprias. ENT continua sendo a entrada 1 (estacionamento).
const ENT2 = LOJA.entrada2 ? (LOJA.espelho ? { porta: -12, fora: -28, dentro: 28, sinal: 1 } : { porta: LOJA.W + 12, fora: LOJA.W + 28, dentro: LOJA.W - 28, sinal: -1 }) : null;
const entDe = c => c && c.ent && ENT2 ? ENT2 : ENT;      // espelha um x do lado da entrada
