// Robôs que jogam os capítulos 4 a 8 de forma simples (usados pelos testes e pela calibragem).
export const ROBO_BASE = `(() => {
  const g = window.__game;
  window.__recolher = () => { const l = g.piles.findIndex((p, k) => k < g.LANES.length && p.b + p.c > 0); if (l >= 0) { const p = g.piles[l]; if (p.c > 0) { p.c--; g.station.c++; } else { p.b--; g.station.b++; } } };
  window.__comprar = (ordem, folga) => { for (const k of ordem) { const a = g.actions().find(x => x.key === k); if (a && a.ok && g.S.money - a.cost > g.bills() + (folga || 30)) { g.doAction(k); return k; } } return null; };
  window.__pior = () => { const vs = (g.S.fase && g.S.fase.dia.vs) || {}; return Object.keys(vs).sort((a, b) => vs[b] - vs[a])[0]; };
  window.__dia = (porPasso, cada) => { const S = g.S, d0 = S.day; for (let i = 0; i < 20 * 95 && S.day === d0; i++) { if (i % 40 === 0) __recolher(); if (i % (cada || 20) === 0) porPasso(i); g.update(0.05); } };
})()`;

// Um passo de decisão por capítulo: chamado várias vezes por dia pelo __dia(). Joga de forma simples, sem trapaça
// (só usa as mesmas funções que os botões da interface chamam).
const BASICO = `const pd = window.__perdas || {}, cesta = Object.keys(pd).filter(k => k.includes("cesta")).reduce((x, k) => x + pd[k], 0);`;
export const ROBOS = {
  restinga: `(() => { const g = window.__game, S = g.S, e = S.equipe; window.__perdas = {};
    return i => {
      if (!e.encarregado && S.money > 900) nomear("encarregado");
      else if (e.volantes < 2 && S.money > 500) mudarVolantes(1);
      else if (e.volantes >= 2 && !e.planoDefinido) mudarPlano("pico", 1);
      else if (!e.fiscal && S.money > 900) nomear("fiscal");
      else if (nLideres() < 2 && S.money > 600) { const p = __pior() || "hortifruti"; nomear("lider", e.lideres[p] ? ["hortifruti", "padaria", "laticinios", "acougue"].find(x => !e.lideres[x]) : p); }
      else if (e.fiscal && !e.auto && S.day >= 4) alternarAutoFiscal();
      else { ${BASICO} if (cesta > 2) __comprar(["traincol", "buybasket", "hirecol"], 200); if (S.whLvl < 6 && Object.values(S.sec).some(s => s.open && s.wh === 0)) __comprar(["storage"], 250); const p = __pior(); if (p) __comprar(S.sec[p].staff < 2 ? ["hire:" + p] : S.sec[p].shelfLvl < 3 ? ["shelf:" + p] : ["train:" + p], 250); }
    }; })()`,
  pitanga: `(() => { const g = window.__game, S = g.S, e = S.entregas, q = S.equipe; window.__perdas = {};
    return i => {
      if (!e.auto) alternarAceite(); if (!e.autoParcial) alternarParcial();
      if (!e.turnosDefinidos) mudarTurno("manha", "sep", 0);
      if (e.motoboys < 2 && S.money > 700) contratarMotoboy(1);
      else if (e.motoboys >= 2 && (e.turnos.manha.mot < 2 || e.turnos.tarde.mot < 2)) { mudarTurno("manha", "mot", 1); mudarTurno("tarde", "mot", 1); }
      else if (!e.balcao && S.money > 1000) melhorarBalcao();
      else if (e.cap < 4 && e.balcao) mudarCapacidade(1);
      else if (q.volantes < 3 && S.money > 600 && S.day >= 2) mudarVolantes(1);
      else if (q.volantes >= 3 && e.turnos.manha.sep < 2) { mudarTurno("manha", "sep", 1); mudarTurno("tarde", "sep", 1); }
      else if (S.cashiers < 3 && S.money > 600) __comprar(["cashhire"], 150);
      else if (S.cashiers >= 3 && S.lastDay && S.lastDay.filaMedia > 6 && window.__cxDia !== S.day) { window.__cxDia = S.day; __comprar(S.cashiers < 4 ? ["cashhire"] : ["cashtrain"], 300); }
      else if (window.__setorDia !== S.day && S.dayT > 60) { window.__setorDia = S.day; ${BASICO} if (cesta > 2) __comprar(["traincol", "buybasket", "hirecol"], 600);
        if (S.whLvl < 8 && Object.values(S.sec).some(s => s.open && s.wh === 0)) __comprar(["storage"], 600); const p = __pior(); if (p) __comprar(S.sec[p].staff < 2 ? ["hire:" + p] : S.sec[p].shelfLvl < 3 ? ["shelf:" + p] : ["train:" + p], 600); }
    }; })()`,
  cajueiro: `(() => { const g = window.__game, S = g.S, a = S.atac, G = S.galeria; window.__perdas = {};
    return i => {
      if (!a.auto) alternarAutoPal();
      const quer = ["mercearia", "bebidas", "mercearia", "laticinios", "bebidas", "acougue", "padaria", "hortifruti", "laticinios"];
      for (let k = 0; k < a.nPos; k++) if (!a.pos[k].sec) a.pos[k].sec = quer[k];
      G.propostas.slice().sort((x, y) => y.aluguel * (1 - y.risco * 5) - x.aluguel * (1 - x.risco * 5)).forEach(p => { if (p.renovacao || p.risco < 0.06 || ocupadas(G).length < 2) aceitarProposta(G, p.id); });
      if (a.ops < 3 && S.money > 1500) mudarOps(1);
      else if (a.docas < 2 && S.money > 5000) ampliar("doca");
      else if (a.nPos < 9 && S.money > 3800) ampliar("pos");
      else if (a.balcao < 2 && S.money > 1200 && S.day >= 3) mudarBalcao(1);
      else if (a.depLvl < 1 && S.money > 3000 && S.day >= 5) ampliar("dep");
      else if (S.cashiers < 4 && S.money > 1500) __comprar(["cashhire"], 500);
      else if (S.day > 5 && nvMin("caixa") < 3 && S.money > 2000) __comprar(["cashtrain"], 800);
      else { ${BASICO} if (cesta > 2) __comprar(["traincol", "buybasket", "hirecol"], 400); const p = __pior(); if (p && S.money > 1500) __comprar(S.sec[p].staff < 2 ? ["hire:" + p] : S.sec[p].shelfLvl < 3 ? ["shelf:" + p] : ["train:" + p], 600); }
      a.opsDoca = a.carretas.length > 0 ? Math.max(1, Math.ceil(a.ops / 2)) : 1;
    }; })()`,
  brisa: `(() => { const g = window.__game, S = g.S, s = S.shop;
    return i => { const L = lojasSh();
      L.propostas.slice().sort((x, y) => y.aluguel * (1 - y.risco * 5) - x.aluguel * (1 - x.risco * 5)).forEach(p => { if (p.renovacao || p.risco < 0.06 || taxaOcupacao(L) < 0.6) aceitarProposta(L, p.id); });
      s.panes.forEach(p => { if (S.money > 400) consertar(p.id); });
      if (s.manut < 1) mudarManut(1);
      if (dentro() > capacidade() * 0.8 || s.hoje.recusados > 0) { if (capLimpeza() <= capSeguranca()) { if (S.money > 600) mudarEquipeSh("limpeza", 1); } else if (S.money > 600) mudarEquipeSh("seguranca", 1); }
      if (s.limpeza < 4 && S.money > 1500) mudarEquipeSh("limpeza", 1);
      else if (s.seguranca < 4 && S.money > 1500) mudarEquipeSh("seguranca", 1);
      else if (!g.building.park1 && !S.park.lots.park1 && S.money > 7500) __comprar(["lot:park1"], 400);
      const camp = campanhaDa(semana(S.day)); if (camp && !s.campanhas[S.day] && S.money > camp.custo + 800) agendarCampanha(S.day);
      if (S.dayT < 20 && !s.eventos[S.day] && S.money > 2500 && S.day % 3 === 0) agendarEvento(S.day, s.seguranca >= 4 ? "parque" : "feira");
      if (typeof r14Ativo === "function" && r14Ativo() && !window.__semReuniao) r14().dec.forEach(d => { if (!d.conf) escolher(d.tipo, 0); });
    }; })()`,
  grande: `(() => { const g = window.__game, S = g.S, o = S.obra;
    return i => {
      for (const id of ["estudo", "previa", "audiencia", "instalacao", "habite"]) if (!o.lic[id]) iniciarLicenca(id);
      if (!o.compromissos.drenagem && S.money > 5000) assumirCompromisso("drenagem");
      if (o.lic.audiencia && o.lic.audiencia.espera && !o.compromissos.onibus) assumirCompromisso("onibus");
      if (o.fase !== "licencas" && o.pct < 100) { if (o.turmas < 3 && S.money > 8000) mudarTurmas(1); if (!o.guindaste && o.turmas >= 2) alternarGuindaste(); if (!o.lona && S.money > 6000) comprarLona(); }
      if (o.pct >= 100 && o.guindaste) alternarGuindaste();
      if (o.embargo) resolverEmbargo();
      const L = lojasSh(); L.propostas.slice().sort((x, y) => y.aluguel * (1 - y.risco * 5) - x.aluguel * (1 - x.risco * 5)).forEach(p => { if (p.renovacao || p.risco < 0.06 || taxaOcupacao(L) < 0.6) aceitarProposta(L, p.id); });
      if (o.pct >= 50 && S.money > 3000) { if (sh().limpeza < 6) mudarEquipeSh("limpeza", 1); else if (sh().seguranca < 6) mudarEquipeSh("seguranca", 1); else if (o.divulgacao < 2) divulgar(); }
      if (o.inauguracao == null && !podeInaugurar().length) { o.convidados.prefeitura = true; o.convidados.escola = true; marcarInauguracao(); }
      if (o.fase === "operacao") { const s = sh();
        s.panes.forEach(p => { if (S.money > 400) consertar(p.id); });
        if (dentro() > capacidade() * 0.8 || s.hoje.recusados > 0) { if (capLimpeza() <= capSeguranca()) { if (S.money > 600) mudarEquipeSh("limpeza", 1); } else if (S.money > 600) mudarEquipeSh("seguranca", 1); }
        const camp = campanhaDa(semana(S.day)); if (camp && !s.campanhas[S.day] && S.money > camp.custo + 800) agendarCampanha(S.day);
        if (S.dayT < 20 && !s.eventos[S.day] && S.money > 3000 && S.day % 3 === 0) agendarEvento(S.day, "parque"); if (typeof r14Ativo === "function" && r14Ativo() && !window.__semReuniao) r14().dec.forEach(d => { if (!d.conf) escolher(d.tipo, 0); }); }
    }; })()`,
};
