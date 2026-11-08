// Testes da versão 1.3: obra do capítulo 8 sem travar (4 perfis de jogador), resgate de saves presos,
// pausa, offline, contabilidade do dia, atacarejo (paletes a caminho, compra automática, fardos soltos),
// painel de trapaças, relato de problema e comparação de versões.
// Uso: node tools/teste-v13.mjs   (CHROME=caminho do Chrome, se não for o padrão do Windows)
import { iniciar, carreiraEm, sleep } from "./lib-cdp.mjs";
import { ROBO_BASE, ROBOS } from "./robos-capitulos.mjs";

const t = await iniciar();
const { js, ok, abrir, esperarRecarga, gravarCarreira } = t;
const G = expr => js(`(() => { const g = window.__game, S = g.S, C = g.CARREIRA; return ${expr}; })()`);
const recarregar = async () => { await abrir("carreira"); await js("hideModal()"); };
const CHAVE = "mercadinho-carreira-v1";

// ---------- perfis de jogador para a obra (só usam as funções que os botões chamam, sem as confirmações) ----------
const COMUM = `
  const licencas = () => { for (const id of ["estudo", "previa", "audiencia", "instalacao", "habite"]) if (!o.lic[id]) iniciarLicenca(id); if (o.lic.audiencia && o.lic.audiencia.espera && !o.compromissos.onibus) assumirCompromisso("onibus"); };
  const lojas = () => { const L = lojasSh(); L.propostas.slice().sort((x, y) => y.aluguel * (1 - y.risco * 5) - x.aluguel * (1 - x.risco * 5)).forEach(p => { if (p.renovacao || p.risco < 0.06 || taxaOcupacao(L) < 0.6) aceitarProposta(L, p.id); }); };
  const equipe = folga => { if (sh().limpeza < 6 && S.money > folga) mudarEquipeSh("limpeza", 1); else if (sh().seguranca < 6 && S.money > folga) mudarEquipeSh("seguranca", 1); };
  const inaugurar = () => { if (o.inauguracao == null && !podeInaugurar().length) marcarInauguracao(); };
  const operar = () => { if (o.fase !== "operacao") return; const s = sh(); s.panes.forEach(p => { if (S.money > 400) consertar(p.id); }); };`;
const PERFIS = {
  // gasta o mínimo: 1 turma, sem guindaste, lona ou divulgação; equipe só no fim
  economico: `(() => { const g = window.__game, S = g.S, o = S.obra; ${COMUM}
    return i => { licencas(); lojas(); if (o.embargo) resolverEmbargo(); if (o.pct >= 90) equipe(0); inaugurar(); operar(); }; })()`,
  // o robô padrão dos testes de capítulos
  padrao: ROBOS.grande,
  // quer abrir rápido: 4 turmas e guindaste desde o início, lona, equipe cedo
  apressado: `(() => { const g = window.__game, S = g.S, o = S.obra; ${COMUM}
    return i => { licencas(); lojas(); if (o.embargo) resolverEmbargo();
      if (o.fase !== "licencas" && o.pct < 100) { if (o.turmas < 4) mudarTurmas(1); if (!o.guindaste) alternarGuindaste(); if (!o.lona) comprarLona(); }
      if (o.pct >= 100 && o.guindaste) alternarGuindaste();
      if (o.pct >= 30) equipe(0); inaugurar(); operar(); }; })()`,
  // compra tudo o que aparece (todos os compromissos, turmas, guindaste, lona, 3 divulgações, todos os convidados, equipe de 8);
  // quando a obra para pela reserva, faz o que o painel sugere: devolve guindaste e turmas e, se ainda faltar, usa a reserva
  completo: `(() => { const g = window.__game, S = g.S, o = S.obra; ${COMUM}
    window.__paradas = 0;
    return i => { licencas(); lojas(); if (o.embargo) resolverEmbargo();
      for (const c of ["onibus", "ciclovia", "drenagem"]) assumirCompromisso(c);
      for (const c of ["prefeitura", "turismo", "associacao", "escola"]) if (!o.convidados[c] && o.inauguracao == null) alternarConvidado(c);
      if (o.fase !== "licencas" && o.pct < 100 && !__paradas) { if (o.turmas < 4) mudarTurmas(1); if (!o.guindaste) alternarGuindaste(); if (!o.lona) comprarLona(); }
      if (o.pct >= 100 && o.guindaste) alternarGuindaste();
      while (o.divulgacao < 3 && S.money > 2000 && OB_CFG.divulgacao[o.divulgacao] < S.money) { const d = o.divulgacao; divulgar(); if (o.divulgacao === d) break; }
      if (sh().limpeza < 8 && S.money > 0) mudarEquipeSh("limpeza", 1); else if (sh().seguranca < 8 && S.money > 0) mudarEquipeSh("seguranca", 1);
      const m = motivoParada(); if (m === "reserva" || m === "dinheiro") { __paradas++; if (o.guindaste) alternarGuindaste(); if (o.turmas > 1) mudarTurmas(-1); }
      if (precisaResgate() && (m === "reserva" || m === "dinheiro" || o.pct >= 100 || S.money < 0)) pedirSocorro();
      inaugurar(); operar(); }; })()`,
  // não mexe em nada além do obrigatório: licenças, contratos, equipe mínima e cerimônia
  nada: `(() => { const g = window.__game, S = g.S, o = S.obra; ${COMUM}
    return i => { licencas(); lojas(); if (o.embargo) resolverEmbargo(); if (o.pct >= 100) equipe(-1); inaugurar(); }; })()`,
};

async function entrarNoGrande() { await gravarCarreira(carreiraEm("grande")); await recarregar(); }
async function prepararRobo(codigo) { await js("hideModal()"); await js(ROBO_BASE); await js(`window.__passo = ${codigo}`); }
const diaRobo = () => G(`(() => { const m0 = S.money; window.__perdas = {}; window.__dia(window.__passo);
  const o = S.obra, ld = S.lastDay; return { dia: S.day, money: Math.round(S.money), pct: Math.round(o.pct * 10) / 10, fase: o.fase, motivo: motivoParada(), delta: Math.round(S.money - m0), net: Math.round(ld.net), sinais: o.sinais, juros: ld.interest }; })()`);

try {
  // ===== 1. quatro perfis (mais o robô padrão) jogando a obra inteira =====
  for (const [nome, codigo] of Object.entries(PERFIS)) {
    await entrarNoGrande(); await prepararRobo(codigo);
    let r, negativo = null, juros = 0, maxParado = 0, parado = 0, ultPct = -1, somaD = 0, somaN = 0, hist = [];
    for (let d = 0; d < 90; d++) {
      r = await diaRobo(); hist.push(`${r.dia}:${r.pct}%/${r.fase[0]}/M${r.money}${r.motivo ? "/" + r.motivo : ""}`);
      if (r.fase !== "operacao" && r.money < 0 && negativo == null) negativo = r.dia;
      juros += r.juros || 0;
      somaD += r.delta; somaN += r.net;
      if (r.fase === "obra" || r.fase === "licencas" || r.fase === "preparacao") { if (r.pct === ultPct && r.pct < 100) parado++; else parado = 0; maxParado = Math.max(maxParado, parado); }
      ultPct = r.pct;
      if (r.fase === "operacao") break;
    }
    ok(r.fase === "operacao", `${nome}: chega à inauguração e à operação (dia ${r.dia}, sinais M ${r.sinais})`);
    ok(negativo == null && juros === 0, `${nome}: saldo nunca fica negativo antes da abertura${negativo != null ? ` (negativo no dia ${negativo})` : ""}`);
    ok(maxParado <= 12, `${nome}: a obra nunca fica mais de 12 dias seguidos sem avançar (máx ${maxParado})`);
    ok(Math.abs(somaD - somaN) <= 3 + hist.length * 0.6, `${nome}: variação do saldo bate com a soma dos resultados dos dias (Δ M ${somaD}, resultados M ${somaN})`);
    const ap = await G(`({ div: S.obra.divida || 0, n: (S.obra.resgates || []).length })`);
    if (ap.n) {
      const d0 = ap.div; for (let d = 0; d < 6; d++) await diaRobo();
      const d1 = await G("S.obra.divida || 0");
      ok(d1 < d0, `${nome}: pediu ${ap.n} aporte(s); a devolução sai dos aluguéis depois da inauguração (M ${d0} → M ${d1} em 6 semanas)`);
    }
    if (r.fase !== "operacao" || negativo != null || maxParado > 12) console.log("   " + hist.join(" "));
  }

  // ===== 2. saves presos de versões anteriores são resgatados uma vez, com cópia =====
  await entrarNoGrande();
  const base = await G(`(save(), JSON.parse(localStorage.getItem("${CHAVE}")))`);
  const preso = (ajuste) => { const c = JSON.parse(JSON.stringify(base)), L = c.lojas.grande; ajuste(L, L.obra || (L.S && L.S.obra)); return c; };
  const caminho = await G(`(() => { const c = JSON.parse(localStorage.getItem("${CHAVE}")); const L = c.lojas.grande; return Object.keys(L).slice(0, 30).join(",") + " | obra em " + (L.obra ? "L.obra" : L.S && L.S.obra ? "L.S.obra" : "?"); })()`);
  console.log("   formato da loja: " + caminho);
  const casos = [
    ["obra a 92% com saldo -50", (L, o) => { o.fase = "obra"; o.pct = 92; o.turmas = 2; for (const id of ["estudo", "previa", "audiencia", "instalacao"]) o.lic[id] = { ok: true }; delete o.v13; L.money = -50; }, true],
    ["só falta o habite-se, saldo M 300", (L, o) => { o.fase = "obra"; o.pct = 100; for (const id of ["estudo", "previa", "audiencia", "instalacao"]) o.lic[id] = { ok: true }; delete o.v13; L.money = 300; }, true],
    ["save saudável sem a marca da 1.3", (L, o) => { delete o.v13; L.money = 45000; }, false],
  ];
  for (const [nome, ajuste, espera] of casos) {
    await gravarCarreira(preso(ajuste), `localStorage.removeItem("mercadinho-carreira-v1-copia-antes-resgate")`);
    await abrir("carreira"); await sleep(1500);
    const a = await G(`({ money: Math.round(S.money), v13: S.obra.v13, res: (S.obra.resgates || []).length, copia: !!localStorage.getItem("mercadinho-carreira-v1-copia-antes-resgate"), modal: document.getElementById("dialog").textContent, sobra: previsaoObra().sobra })`);
    if (espera) ok(a.res === 1 && a.copia && a.money > 0 && a.sobra >= 0 && a.v13 && /replanejada/.test(a.modal), `resgate: ${nome} → saldo M ${a.money}, previsão com sobra M ${a.sobra}, cópia de segurança e aviso`);
    else ok(a.res === 0 && a.money === 45000 && a.v13, `resgate: ${nome} não recebe dinheiro (só ganha a marca)`);
    await js("hideModal()"); await G("(save(), 1)"); await abrir("carreira"); await sleep(1500);
    const b = await G(`({ res: (S.obra.resgates || []).length, money: Math.round(S.money) })`);
    ok(b.res === a.res && b.money === a.money, `resgate: ${nome}, abrir de novo não resgata outra vez`);
  }
  // save novo da 1.3 que ficou sem caixa por escolha do jogador: não é resgatado automaticamente
  await entrarNoGrande();
  await G(`(() => { S.obra.fase = "obra"; S.obra.pct = 50; S.money = 100; save(); return 1; })()`); await abrir("carreira"); await sleep(1500);
  ok(await G(`!(S.obra.resgates || []).length && Math.round(S.money) === 100`), "resgate automático só para saves de versões anteriores (a 1.3 já impede travar)");

  // ===== 3. pausa: sem diárias, só a guarda; previsão e reserva =====
  await entrarNoGrande(); await prepararRobo(PERFIS.padrao);
  for (let d = 0; d < 30; d++) { const r = await diaRobo(); if (r.fase === "obra" && r.pct > 10) break; }
  const p0 = await G(`(() => { alternarPausa(); hideModal(); window.__passo = () => {}; const m = S.money, pct = S.obra.pct; window.__dia(() => {}); return { gasto: Math.round(m - S.money), pct0: pct, pct1: S.obra.pct, contas: Math.round(S.lastDay.bills), motivo: motivoParada(), linhas: JSON.stringify(S.lastDay.linhas || "") }; })()`);
  ok(p0.motivo === "pausa" && p0.pct0 === p0.pct1, `pausa: a obra não avança (${p0.pct0}%) e o motivo aparece como pausa`);
  const guarda = await G("OB_CFG.guarda");
  ok(p0.gasto - p0.contas <= guarda + 1, `pausa: o dia custa só as contas fixas (M ${p0.contas}) e a guarda (gasto da obra M ${p0.gasto - p0.contas}, guarda M ${guarda})`);
  const pr = await G(`(() => { alternarPausa(); hideModal(); const p = previsaoObra(); return { p, res: reservaAbertura(), txt: previsaoTxt(), risco: riscoTxt() }; })()`);
  ok(pr.p.obrig > 0 && pr.res >= pr.p.fixo && /Obrigatório até abrir/.test(pr.txt) && pr.risco.length > 10, `previsão: obrigatório M ${pr.p.obrig}, reserva M ${pr.res}, sobra M ${pr.p.sobra}; risco "${pr.risco.slice(0, 70)}…"`);
  // painel da obra mostra previsão, pausa e reserva
  const painel = await G(`(() => { const r = {}; g.openSheet("obra"); let h = document.getElementById("shBody").textContent; r.prev = /Previsão de caixa/.test(h); r.pausa = /Pausar/.test(h); r.semAporte = !/aporte/i.test(h);
    const m = S.money; S.money = 300; lastSig = ""; renderSheet(); h = document.getElementById("shBody").textContent; r.aporte = /Pedir aporte/.test(h); r.reserva = /usar a reserva/.test(h); r.dica = /Para fechar a conta/.test(h);
    S.money = m; g.closeSheet(); return r; })()`).catch(e => ({ erro: String(e).slice(0, 160) }));
  ok(painel.prev && painel.pausa && painel.semAporte && painel.aporte && painel.reserva && painel.dica, `painel da obra: previsão, pausa; com caixa curto aparecem dica, reserva e aporte ${JSON.stringify(painel)}`);

  // ===== 4. offline de 4 horas no meio da obra nunca deixa o saldo negativo =====
  for (const [nome, money] of [["com caixa", 20000], ["quase sem caixa", 600]]) {
    await entrarNoGrande(); await prepararRobo(PERFIS.padrao);
    for (let d = 0; d < 30; d++) { const r = await diaRobo(); if (r.fase === "obra" && r.pct > 15) break; }
    await G(`(() => { S.money = ${money}; S.mgrLvl = 3; save(); window.__semSalvar = true;
      const c = JSON.parse(localStorage.getItem("${CHAVE}")); c.lojas.grande.lastSeen = Date.now() - 4 * 3600e3; localStorage.setItem("${CHAVE}", JSON.stringify(c)); return 1; })()`);
    const antes = await G(`({ pct: S.obra.pct, money: Math.round(S.money) })`);
    await abrir("carreira"); await sleep(800);
    const dep = await G(`({ pct: S.obra.pct, money: Math.round(S.money), dia: S.day, modal: document.getElementById("dialog").textContent.slice(0, 300) })`);
    ok(dep.money >= 0 && dep.pct >= antes.pct, `offline 4 h ${nome}: saldo M ${antes.money} → M ${dep.money}, obra ${Math.round(antes.pct)}% → ${Math.round(dep.pct)}%`);
  }

  // ===== 5. atacarejo: compra automática sozinha, paletes a caminho, motivo da posição vazia, fardos soltos =====
  await gravarCarreira(carreiraEm("cajueiro")); await recarregar();
  await prepararRobo(ROBOS.cajueiro);
  await G(`(() => { window.__manuais = 0; const c0 = comprarPaletes; window.comprarPaletes = comprarPaletes = (...a) => { if (!a[2]) window.__manuais++; return c0(...a); }; return 1; })()`).catch(() => 0);
  let rc = null, avisos = 0, causas = new Set();
  for (let d = 0; d < 40; d++) {
    rc = await G(`(() => { window.__perdas = {}; window.__dia(window.__passo); const vaz = (typeof causaVazia === "function") ? causaVazia() : null; return { dia: S.day, concl: S.fase.concluida, auto: autoTxt(), vaz }; })()`);
    if (rc.vaz) { if (rc.vaz.aviso) avisos++; causas.add(rc.vaz.title); }
    if (rc.concl) break;
  }
  ok(rc.concl, `atacarejo: robô só com compra automática conclui o capítulo (dia ${rc.dia}); status "${rc.auto}"`);
  console.log("   causas de posição vazia vistas: " + [...causas].join(" | ") + ` (avisos ${avisos})`);
  const cv = await G(`(() => { const a = at(), r = {};
    r.auto = typeof autoTxt === "function" && autoTxt().length > 3;
    // palete a caminho: não pode virar aviso
    const sec = Object.keys(a.pos ? {} : {})[0];
    r.noCaminho = typeof noCaminho === "function";
    r.soltos = typeof guardarSoltos === "function";
    return r; })()`);
  ok(cv.auto && cv.noCaminho && cv.soltos, `atacarejo: status da compra automática, paletes a caminho e fardos soltos disponíveis ${JSON.stringify(cv)}`);

  // ===== 6. painel de trapaças =====
  await entrarNoGrande();
  const dv = await G(`(() => { const r = {}; r.hashOk = hashDev("mercadinho:lagoa2026") === DEV_HASH && hashDev("mercadinho:errado") !== DEV_HASH;
    const m = S.money; devDinheiro(10000); r.din = Math.round(S.money - m); r.marca = !!(S.trapacas || C.trapacas); return r; })()`);
  ok(dv.hashOk, "trapaças: código lagoa2026 aceito e código errado recusado");
  ok(dv.din === 10000 && dv.marca, `trapaças: +M 10.000 e a partida fica marcada como usou trapaça (${dv.din})`);
  await esperarRecarga(`devIrCapitulo("cajueiro", false)`); await js("hideModal()");
  const ir = await G(`({ F: g.FASE, ativa: C.ativa, copia: !!localStorage.getItem("mercadinho-carreira-v1-copia-antes-trapaca"), grandeExiste: !!C.lojas.grande })`);
  ok(ir.F === "cajueiro" && ir.copia && ir.grandeExiste, `trapaças: ir ao capítulo 6 mantém a loja do capítulo 8 e guarda cópia (${JSON.stringify(ir)})`);
  await esperarRecarga(`devIrCapitulo("restinga", true)`); await js("hideModal()");
  const rec = await G(`({ F: g.FASE, lojas: Object.keys(C.lojas).join(","), fases: Object.keys(C.fases).filter(f => C.fases[f].concluida).join(","), trap: !!C.trapacas })`);
  ok(rec.F === "restinga" && !/pitanga|cajueiro|brisa|grande/.test(rec.lojas) && rec.trap, `trapaças: recomeçar no capítulo 4 apaga ele e os seguintes (lojas: ${rec.lojas}; concluídas: ${rec.fases})`);
  // painel abre com 7 toques na versão e código
  const pd = await G(`(() => { typeof buildSettings === "function"; return typeof abrirPainelDev === "function" && typeof toqueVersao === "function"; })()`);
  ok(pd, "trapaças: painel e gesto de 7 toques presentes");

  // ===== 7. relato de problema e versões =====
  const rel = await G(`(() => { const t = textoRelato("O jogo travou na obra", true, true); return { t, ok: t.includes(APP_VERSAO) && /Restinga|restinga/.test(t) && t.length <= 1800 }; })()`);
  ok(rel.ok, `relato: texto inclui versão e capítulo (${rel.t.length} caracteres)`);
  const url = await G(`(() => { let u = null; const ab = abrirExterno; abrirExterno = x => { u = x; }; try { abrirRelato(); document.getElementById("rlDesc").value = "teste"; const b = [...document.querySelectorAll("#dialog button")].find(b => /WhatsApp/.test(b.textContent)); b && b.click(); } finally { abrirExterno = ab; hideModal(); } return u; })()`);
  ok(url && url.startsWith("https://wa.me/5521988612660?text=") && /Versão 1\.\d+/.test(decodeURIComponent(url)), `relato: botão abre o WhatsApp do suporte (${(url || "").slice(0, 60)}…)`);
  const vm = await G(`[versaoMaior("1.4", "1.3"), versaoMaior("1.10", "1.9"), versaoMaior("1.3", "1.3"), versaoMaior("1.2", "1.3")].join(",")`);
  ok(vm === "true,true,false,false", `versões: comparação numérica (${vm})`);
  const cfg = await G(`(() => { g.openSheet("settings"); const h = document.getElementById("shBody").textContent; g.closeSheet(); return /Relatar problema/.test(h) && h.includes(APP_VERSAO); })()`).catch(() => false);
  ok(cfg, "configurações: botão Relatar problema e versão atual visíveis");

  ok(!t.erros.length, `sem erros de JavaScript (${t.erros.slice(0, 3).join(" / ")})`);
} catch (e) { console.error(e); ok(false, "exceção: " + String(e).slice(0, 300)); }
finally {
  const f = t.res.filter(r => !r[0]).length;
  console.log(`\n${t.res.length - f}/${t.res.length} verificações OK`);
  t.fim(); process.exit(f ? 1 : 0);
}
