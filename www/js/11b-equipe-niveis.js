"use strict";
// =====================================================================
// 1.5: evolução individual da equipe. Cada repositor, operador de caixa, carrinheiro e atendente de
// cancela tem nome e nível próprios; o treino é pago por pessoa. Os campos antigos de nível da equipe
// (staffLvl, cashLvl, colLvl, park.train) viram o "piso": na migração cada pessoa começa nele, e se algum
// capítulo subir o piso (cenário inicial), quem está abaixo sobe junto. Contratados novos começam no nível 0.
// =====================================================================
const NV_CFG = { fatorCusto: 0.6 };
const NOMES_EQ = ["Ana", "Bruno", "Carla", "Davi", "Elisa", "Fábio", "Gabi", "Hugo", "Iara", "João", "Kátia", "Luan", "Marta", "Nilo", "Olga", "Paulo", "Quitéria", "Rafa",
  "Sônia", "Téo", "Úrsula", "Vítor", "Wanda", "Yuri", "Zélia", "Caio", "Dora", "Enzo", "Flora", "Gil", "Helô", "Igor", "Joana", "Lia", "Miro", "Nara", "Otto", "Pietra", "Ravi", "Saulo"];
function nomeLivre() {
  const usados = new Set(); const ver = a => (a || []).forEach(p => usados.add(p.n));
  SECTORS.forEach(d => ver(S.sec[d.id].eq)); ver(S.cashEq); ver(S.gear.colEq); ver(S.park.eq);
  const livres = NOMES_EQ.filter(n => !usados.has(n));
  if (livres.length) return livres[(usados.size * 7) % livres.length];       // sem sorteio: não mexe nas partidas
  return `${NOMES_EQ[usados.size % NOMES_EQ.length]} ${Math.floor(usados.size / NOMES_EQ.length) + 1}`;
}
// ajusta uma lista de pessoas ao tamanho da equipe e ao piso de nível
function ajustarEq(lista, n, piso, baseKey, dono) {
  if (!Array.isArray(dono[lista])) { dono[lista] = []; for (let k = 0; k < n; k++) dono[lista].push({ n: nomeLivre(), v: piso }); dono[baseKey] = piso; return dono[lista]; }
  const a = dono[lista];
  if ((dono[baseKey] || 0) < piso) { a.forEach(p => { if (p.v < piso) p.v = piso; }); dono[baseKey] = piso; }
  while (a.length < n) a.push({ n: nomeLivre(), v: 0 });
  if (a.length > n) a.length = n;
  return a;
}
const eqRep = id => { const st = S.sec[id]; return ajustarEq("eq", st.staff, st.staffLvl || 0, "eqBase", st); };
const eqCaixa = () => ajustarEq("cashEq", S.cashiers, S.cashLvl || 0, "cashEqBase", S);
const eqCol = () => ajustarEq("colEq", S.gear.collectors, S.gear.colLvl || 0, "colEqBase", S.gear);
const eqPark = () => ajustarEq("eq", S.park.staff, S.park.train || 0, "eqBase", S.park);
function equipeSync() { SECTORS.forEach(d => eqRep(d.id)); eqCaixa(); eqCol(); eqPark(); }
// nível de quem está trabalhando
const nvRep = (secIdx, k) => { const a = eqRep(SECTORS[secIdx].id); return a[k] ? a[k].v : (S.sec[SECTORS[secIdx].id].staffLvl || 0); };
const nvCaixa = l => { const a = eqCaixa(); return a[l] ? a[l].v : (S.cashLvl || 0); };      // caixa de volante (capítulo 4) usa o piso
const nvCol = k => { const a = eqCol(); return a[k] ? a[k].v : (S.gear.colLvl || 0); };
const nvPark = k => { const a = eqPark(); return a[k] ? a[k].v : (S.park.train || 0); };
// ---------- custo e treino de uma pessoa ----------
const TIPOS_EQ = {
  rep: { lista: ref => eqRep(ref), custo: (v, ref) => Math.ceil(SECTORS.find(d => d.id === ref).base * 1.5 * Math.pow(G, v) * NV_CFG.fatorCusto),
    efeito: v => `velocidade ${staffSpd(v)}, leva ${staffCarry(v)}`, prox: v => `leva ${staffCarry(v + 1)}, mais rápido`, papel: "repositor", max: () => false },
  caixa: { lista: () => eqCaixa(), custo: v => Math.ceil(10 * Math.pow(G, v) * NV_CFG.fatorCusto),
    efeito: v => `${cashTime(v).toFixed(2).replace(".", ",")} s por item`, prox: v => `${cashTime(v + 1).toFixed(2).replace(".", ",")} s por item`, papel: "operador de caixa", max: () => false },
  col: { lista: () => eqCol(), custo: v => Math.ceil(15 * Math.pow(G, v) * NV_CFG.fatorCusto),
    efeito: v => `velocidade ${colSpeed(v)}, leva ${colCarry(v)}`, prox: v => `leva ${colCarry(v + 1)} por vez, mais rápido`, papel: "carrinheiro", max: () => false },
  park: { lista: () => eqPark(), custo: v => Math.ceil(25 * Math.pow(1.45, v) * NV_CFG.fatorCusto),
    efeito: v => `${Math.round((1 - parkTrain(v)) * 100)}% mais rápido`, prox: v => `${Math.round((1 - parkTrain(v + 1)) * 100)}% mais rápido`, papel: "atendente", max: v => parkTrain(v) <= 0.35 + 1e-9 },
};
const menosTreinado = lista => lista.reduce((m, p, k) => (m < 0 || p.v < lista[m].v ? k : m), -1);
function treinarPessoa(tipo, ref, k, silencioso) {
  const T = TIPOS_EQ[tipo], a = T.lista(ref), p = a[k]; if (!p || T.max(p.v)) return false;
  const c = T.custo(p.v, ref); if (S.money < c || S.money < 0) { if (!silencioso) toast(`Falta dinheiro: treinar ${p.n} custa M ${fmt(c)}.`); return false; }
  S.money -= c; p.v++; taskProgress("upgrades", 1);
  if (!silencioso) { save(); lastSig = ""; renderSheet(); hud(); anunciar(`${p.n} (${T.papel}) treinou: nível ${p.v + 1}, ${T.efeito(p.v)}. Custou M ${fmt(c)}.`); }
  window.__lastPurchase = { key: `treino:${tipo}:${ref || ""}:${k}`, cost: c, after: S.money };
  return true;
}
// os botões de treino da equipe (teclas antigas, usadas também pelos robôs de teste) passam a treinar UMA pessoa:
// quem tem menos treino. No painel de cada setor/caixa dá para escolher outra pessoa.
{ const a0 = actions;
  actions = function () {
    const list = a0(), troca = (key, tipo, ref) => { const a = list.find(x => x.key === key); if (!a) return;
      const T = TIPOS_EQ[tipo], eq = T.lista(ref), k = menosTreinado(eq);
      if (k < 0) { a.title = "Treinar"; a.info = `Contrate um ${T.papel} primeiro`; a.locked = true; a.lockText = "Ninguém na equipe"; a.ok = false; return; }
      const p = eq[k]; a.title = `Treinar ${p.n} (nv ${p.v + 1} → ${p.v + 2})`; a.info = `${T.prox(p.v)}. Quem tem menos treino; no painel você escolhe outra pessoa.`;
      a.cost = T.custo(p.v, ref); a.maxed = T.max(p.v); a.locked = false;
      a.run = () => { p.v++; }; a.ok = !a.locked && !a.maxed && S.money >= a.cost && S.money >= 0; };
    SECTORS.forEach(d => troca(`train:${d.id}`, "rep", d.id));
    troca("cashtrain", "caixa"); troca("traincol", "col"); if (CANCELA) troca("parktrain", "park");
    return list;
  };
}
// cartão "Equipe": uma linha por pessoa, com o nível e o botão de treino individual
function cartaoEquipe(body, tipo, ref, rotulo) {
  const T = TIPOS_EQ[tipo], c = el("div", "card equipe-ind", `<h3>${rotulo || "Equipe"}</h3>`);
  const eq = T.lista(ref);
  if (!eq.length) { c.appendChild(el("p", "note", `Ninguém contratado ainda.`)); body.appendChild(c); return; }
  c.appendChild(el("p", "note", "Cada pessoa evolui separado: escolha quem treinar. Quem é contratado depois começa no nível 1."));
  eq.forEach((p, k) => {
    const lin = el("div", "req"), info = el("span", ""), b = el("button", "chipbtn");
    lin.appendChild(info); lin.appendChild(b);
    live(() => { const q = T.lista(ref)[k]; if (!q) return; const mx = T.max(q.v), cst = T.custo(q.v, ref);
      info.innerHTML = `<b>${q.n}</b> · nível ${q.v + 1} · ${T.efeito(q.v)}`;
      b.textContent = mx ? "Nível máximo" : `Treinar · M ${fmt(cst)}`; b.disabled = mx || S.money < cst;
      b.setAttribute("aria-label", mx ? `${q.n}: nível máximo` : `Treinar ${q.n}, ${T.papel}, do nível ${q.v + 1} para ${q.v + 2}, por M ${fmt(cst)}`); });
    b.onclick = () => treinarPessoa(tipo, ref, k);
    c.appendChild(lin);
  });
  body.appendChild(c);
}
const faixaNv = lista => { if (!lista.length) return "—"; const vs = lista.map(p => p.v + 1), a = Math.min(...vs), b = Math.max(...vs); return a === b ? `nv ${a}` : `nv ${a}–${b}`; };
const nvMin = (tipo, ref) => { const a = TIPOS_EQ[tipo].lista(ref); return a.length ? Math.min(...a.map(p => p.v)) : 0; };
