"use strict";
// =====================================================================
// Day cycle: no game over. Bills are paid every night; a negative balance pays interest.
// =====================================================================
function endDay() {
  if (GANCHOS.antesDoFechamento) GANCHOS.antesDoFechamento();        // capítulos 6+: aluguéis e custos da galeria/shopping entram no dia
  const t = S.today, b = bills();
  const interest = S.money < 0 ? -S.money * DEBT_INTEREST : 0;
  S.money -= b + interest;
  const pk = t.park || freshParkDay(), pw = parkWages();
  const net = t.sales + pk.fees + (t.outras || 0) - t.goods - (t.outrasDesp || 0) - b - interest;   // outras: aluguéis, entregas, eventos (capítulos 4+)
  S.avgNet = S.avgNet ? S.avgNet * 0.8 + net * 0.2 : net;
  S.lastDay = { day: S.day, sales: t.sales, goods: t.goods, bills: b, interest, net, served: t.served, lost: t.lost, rep: S.rep, park: Object.assign({ wages: pw }, pk) };
  if (t.outras || t.outrasDesp) { S.lastDay.outras = t.outras || 0; S.lastDay.outrasDesp = t.outrasDesp || 0; S.lastDay.linhas = t.linhas || null; }
  if (t.lost === 0 && t.served > 0) taskProgress("clean", 1);
  if (S.rep >= 4.95) taskProgress("stars", 1);
  banner(`${GANCHOS.nomeDia ? GANCHOS.nomeDia(S.day) : `Dia ${S.day}`}: ${net < 0 ? "-" : "+"}M ${fmt(Math.abs(net))}`, net < 0 ? "#c9513a" : "#2e7a57");
  if (S.money < 0) toastOnce("debt", "Você está no vermelho: o banco cobra 5% de juros por dia e as compras ficam bloqueadas.");
  if (DIV) fecharDiaAcess(S.lastDay);
  faseFimDoDia();
  S.day++; S.dayT = 0; S.today = { sales: 0, goods: 0, lost: 0, served: 0, park: freshParkDay() }; rushAnnounced = false;
  save();
}

// =====================================================================
// Daily tasks, streak and achievements
// =====================================================================
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); };
const TASK_TYPES = [
  { id: "serve",  label: n => `Atender ${fmt(n)} clientes`, target: t => 40 * (t + 1) },
  { id: "sell",   label: (n, s) => `Vender ${fmt(n)} itens de ${SECTORS[s].name}`, target: t => 25 * (t + 1), sector: true },
  { id: "sales",  label: n => `Faturar M ${fmt(n)} em vendas`, target: t => Math.round(400 * Math.pow(4, t)) },
  { id: "upgrades", label: n => `Comprar ${n} melhorias`, target: t => 5 + t },
  { id: "tapgear", label: n => `Devolver ${n} cestas tocando nelas no caixa`, target: () => 10 },
  { id: "hand",   label: n => `Repor ${n} itens à mão nas prateleiras`, target: () => 15 },
  { id: "clean",  label: n => `Fechar ${n} dias sem perder nenhum cliente`, target: () => 3 },
  { id: "stars",  label: () => `Fechar um dia com 5 estrelas`, target: () => 1 },
];
const taskReward = () => Math.round(50 * Math.pow(4, S.tier) * branchMult());
function seeded(seed) { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
function ensureTasks() {
  const key = dateKey();
  if (S.tasks && S.tasks.date === key) return;
  const rnd = seeded(key + ":" + S.tier), types = TASK_TYPES.filter(t => !GANCHOS.tarefaValida || GANCHOS.tarefaValida(t.id)), list = [];
  while (list.length < 3 && types.length) {
    const ty = types.splice(Math.floor(rnd() * types.length), 1)[0];
    const open = openSectors();
    list.push({ type: ty.id, target: ty.target(S.tier), progress: 0, claimed: false, sec: ty.sector ? SECTORS.indexOf(open[Math.floor(rnd() * open.length)]) : null });
  }
  S.tasks = { date: key, list, chest: false };
  if (S.streakDate && S.streakDate !== yesterdayKey() && S.streakDate !== key) S.streak = 0;
}
function taskProgress(type, n, sec) {
  if (!S.tasks) return;
  for (const t of S.tasks.list) if (t.type === type && (t.sec == null || t.sec === sec) && t.progress < t.target) t.progress = Math.min(t.target, t.progress + n);
}
const ACH = [
  { id: "c100",  label: "Atender 100 clientes",     ok: () => S.served >= 100,  reward: 60 },
  { id: "c1k",   label: "Atender 1.000 clientes",   ok: () => S.served >= 1000, reward: 600 },
  { id: "c10k",  label: "Atender 10.000 clientes",  ok: () => S.served >= 1e4,  reward: 8000 },
  { id: "c100k", label: "Atender 100.000 clientes", ok: () => S.served >= 1e5,  reward: 2e5 },
  { id: "s4",    label: "Abrir 4 setores",          ok: () => openSectors().length >= 4,  reward: 300 },
  { id: "s8",    label: "Abrir 8 setores",          ok: () => openSectors().length >= 8,  reward: 2e4 },
  { id: "s12",   label: "Abrir os 12 setores",      ok: () => openSectors().length >= 12, reward: 2e6 },
  { id: "t1",    label: "Virar Mercado Médio",      ok: () => S.tier >= 1, reward: 800 },
  { id: "t2",    label: "Virar Supermercado",       ok: () => S.tier >= 2, reward: 1e4 },
  { id: "t3",    label: "Virar Hipermercado",       ok: () => S.tier >= 3, reward: 1.5e5 },
  { id: "t4",    label: "Montar a Rede Regional",   ok: () => S.tier >= 4, reward: 2e6 },
  { id: "t5",    label: "Montar a Rede Nacional",   ok: () => S.tier >= 5, reward: 3e7 },
  { id: "f1",    label: "Abrir a primeira filial",  ok: () => S.branches >= 1, reward: 5e7 },
  { id: "st7",   label: "Sequência de 7 dias",      ok: () => S.streak >= 7,  reward: () => taskReward() * 5 },
  { id: "st30",  label: "Sequência de 30 dias",     ok: () => S.streak >= 30, reward: () => taskReward() * 20 },
  { id: "r5",    label: "Chegar a 5 estrelas",      ok: () => S.rep >= 4.95, reward: 200 },
];
const achReward = a => typeof a.reward === "function" ? a.reward() : a.reward;

// =====================================================================
// Coming back: life goes on while you are away
// =====================================================================
function offlineProgress() {
  const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
  if (away < 120) return null;
  const counted = Math.min(away, mgrHours(S.mgrLvl) * 3600);
  // while away the store runs at a calmer pace: 8 game days per real hour
  const days = Math.floor(counted / 3600 * 8);
  const perDay = Math.max(0, S.avgNet);
  const gain = Math.round(perDay * days * mgrEff(S.mgrLvl));
  S.money += gain; S.earned += Math.max(0, gain); S.day += days;
  // shelves and warehouse were used during the absence: start the day with stock topped up
  openSectors().forEach(d => { const st = S.sec[d.id]; st.shelf = shelfCap(st.shelfLvl); });
  S.lastSeen = Date.now();                               // esta ausência já foi processada: nunca conta duas vezes
  const pedidos = typeof fornAoVoltar === "function" ? fornAoVoltar() : [];   // capítulo 3: pedidos que chegaram enquanto estava fora
  const linhas = GANCHOS.aoVoltar ? GANCHOS.aoVoltar(days, away) : [];         // capítulos 4+: entregas, paletes, contratos e obras pendentes
  return { away, counted, days, gain, pedidos, linhas };
}
