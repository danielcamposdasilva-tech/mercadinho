"use strict";
var canvasOK = false;
"use strict";
// =====================================================================
// Balance. Every number here is original to this prototype.
// =====================================================================
const DAY_LEN = 90, RUSH = [0.45, 0.65], RUSH_MULT = 1.8;
const SHELF_PATIENCE = 7, QUEUE_PATIENCE = 15, GEAR_PATIENCE = 6, BASKET_CAP = 3;
const truckEvery = () => (S.park && S.park.lots.logi ? 6 : 8);
const MAX_STAFF = 3, MAX_COLLECTORS = 3, DEBT_INTEREST = 0.05;
const MAX_PRATELEIRA = 7;          // 1.6: nível máximo da prateleira (índice 7 = nível 8, 25 itens); saves acima disso ficam como estão

const SECTORS = [
  { id: "mercearia",    name: "Mercearia",    ic: "🥫", color: "#d9822b", price: 2,   base: 8,    open: 0 },
  { id: "bebidas",      name: "Bebidas",      ic: "🧃", color: "#3f74b8", price: 3,   base: 14,   open: 60 },
  { id: "hortifruti",   name: "Hortifrúti",   ic: "🍎", color: "#5a9a3c", price: 3.5, base: 25,   open: 180 },
  { id: "laticinios",   name: "Laticínios",   ic: "🧀", color: "#e0b43a", price: 5,   base: 45,   open: 450 },
  { id: "padaria",      name: "Padaria",      ic: "🥖", color: "#b7773b", price: 7,   base: 90,   open: 1800 },
  { id: "acougue",      name: "Açougue",      ic: "🥩", color: "#b8433f", price: 11,  base: 160,  open: 4500 },
  { id: "frios",        name: "Frios",        ic: "🧈", color: "#d8a7b1", price: 16,  base: 320,  open: 16000 },
  { id: "limpeza",      name: "Limpeza",      ic: "🧴", color: "#4aa3a3", price: 12,  base: 420,  open: 30000 },
  { id: "pet",          name: "Pet Shop",     ic: "🦴", color: "#8a6a4a", price: 22,  base: 900,  open: 160000 },
  { id: "utilidades",   name: "Utilidades",   ic: "🔦", color: "#5b6b73", price: 35,  base: 1500, open: 320000 },
  { id: "farmacia",     name: "Farmácia",     ic: "💊", color: "#2e7a57", price: 50,  base: 4000, open: 1.6e6 },
  { id: "floricultura", name: "Floricultura", ic: "🌻", color: "#c9513a", price: 70,  base: 7000, open: 3.2e6 },
];
const TIERS = [
  { name: "Mercadinho de Bairro", sign: ["MERCADINHO", "DA ESQUINA"], slots: 4,  lanes: 2, mult: 1,   rent: 6,     cost: 0,     req: null,
    floor: ["#f4ead1", "#ece0c2"], signColor: "#1f4d3a" },
  { name: "Mercado Médio",        sign: ["MERCADO", "DA ESQUINA"],    slots: 6,  lanes: 3, mult: 1.3, rent: 40,    cost: 2500,  req: { earned: 6000, sectors: 4, rep: 3 },
    floor: ["#eef0e6", "#e0e5d2"], signColor: "#2a4f7a" },
  { name: "Supermercado",         sign: ["SUPERMERCADO", "ESQUINA"],  slots: 8,  lanes: 4, mult: 1.7, rent: 260,   cost: 30000, req: { earned: 90000, sectors: 6, rep: 3.5 },
    floor: ["#f3f3ef", "#e3e6e8"], signColor: "#b8433f" },
  { name: "Hipermercado",         sign: ["HIPER", "ESQUINA"],         slots: 10, lanes: 4, mult: 2.3, rent: 1500,  cost: 4e5,   req: { earned: 1.2e6, sectors: 8, rep: 4 },
    floor: ["#f5f3ee", "#e8e2d6"], signColor: "#6b3fa0" },
  { name: "Rede Regional",        sign: ["REDE ESQUINA", "REGIONAL"], slots: 12, lanes: 4, mult: 3.1, rent: 9000,  cost: 6e6,   req: { earned: 1.8e7, sectors: 10, rep: 4.2 },
    floor: ["#f1efe9", "#e3ddcf"], signColor: "#1f3a5a" },
  { name: "Rede Nacional",        sign: ["REDE ESQUINA", "BRASIL"],   slots: 12, lanes: 4, mult: 4.2, rent: 40000, cost: 9e7,   req: { earned: 2.5e8, sectors: 12, rep: 4.5 },
    floor: ["#f6f4ef", "#e7e2d9"], signColor: "#0f5132" },
];
const tierNow = () => TIERS[S.tier];
// Ganchos dos capítulos 4 em diante (06d a 06i). Vazios no Modo Livre e nos capítulos 1 a 3: tudo abaixo
// devolve exatamente o mesmo valor de antes quando nenhum gancho está registrado.
const GANCHOS = {};
const PAINEIS = {};          // painéis dos capítulos 4+ (equipe, entregas, atacado, galeria, shopping, obra)
// encadeia um gancho: o novo roda primeiro; se não devolver nada, o anterior também roda (painel, toque, desenho)
function gancho(nome, fn) { const old = GANCHOS[nome]; GANCHOS[nome] = old ? (...a) => { const r = fn(...a); return r != null && r !== false ? r : old(...a); } : fn; }
const slots = () => (SCENE.loja && SCENE.loja.slots) || tierNow().slots;
const nCaixas = () => Math.min(LANES.length, S.cashiers + (GANCHOS.caixasExtra ? GANCHOS.caixasExtra() : 0));   // caixas abertos agora (fixos + volantes)
const aluguelBase = () => GANCHOS.aluguel ? GANCHOS.aluguel() : tierNow().rent;
const demand    = () => tierNow().mult;
const shelfCap  = l => 4 + 3 * l;
const secPrice  = (s, l) => Math.round(s.price * Math.pow(1.25, l) * 100) / 100;
const boxCost   = (s, l) => Math.round(secPrice(s, l) * 0.4 * 100) / 100;
const staffSpd  = l => 75 + 14 * l;
const staffCarry = l => 3 + Math.floor(l / 2);
const cashTime  = l => Math.max(0.1, 0.9 * Math.pow(0.86, l));
const whCap     = l => (20 + 12 * l) * (SCENE.depositoMult || 1);   // o Ipê (capítulo 3) tem depósito de supermercado: o dobro
const truckLoad = l => 8 + 5 * l + (S.park && S.park.lots.logi ? 4 : 0);
const spawnGap  = l => Math.max(0.35, 3.0 * Math.pow(0.86, l));
const colSpeed  = l => 60 + 14 * l, colCarry = l => 2 + l;
const mgrEff    = l => Math.min(0.7, 0.2 + 0.1 * l);       // share of normal profit earned while away
const mgrHours  = l => Math.min(14, 2 + 2 * l);            // hours of absence that count
const branchMult = () => 1 + 0.35 * S.branches;
const streakMult = () => 1 + Math.min(0.3, 0.03 * S.streak);
const G = 1.4;
// custo para abrir um setor; um capítulo da carreira pode ter preço próprio (ex.: o Ipê já tem câmara fria para o Açougue)
function custoAbrir(d) { return (MODO === "carreira" && FASE_CFG[FASE] && FASE_CFG[FASE].aberturas && FASE_CFG[FASE].aberturas[d.id]) || d.open; }
function staffCount() { return SECTORS.reduce((a, d) => a + (S.sec[d.id].open ? S.sec[d.id].staff : 0), 0); }
function wages() { const t = S.tier; return staffCount() * (1 + t) + S.cashiers * (2 + t) + S.gear.collectors * (1 + t) + S.park.staff * (2 + t) + (GANCHOS.salarios ? GANCHOS.salarios() : 0); }
function bills() { return aluguelBase() * (1 + 0.1 * S.branches) + wages(); }
