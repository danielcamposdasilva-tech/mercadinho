// Capturas da versão 1.4: aviso de diagnóstico no menu, crédito, reunião da semana e estoque no alto.
// Uso: node tools/capturas-v14.mjs <pasta>
import { iniciar, carreiraEm, sleep } from "./lib-cdp.mjs";
import { ROBO_BASE, ROBOS } from "./robos-capitulos.mjs";
const pasta = process.argv[2] || "capturas/v1.4";
const t = await iniciar({ animar: true });
const { js, abrir, gravarCarreira, foto, send } = t;
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const G = expr => js(`(() => { const g = window.__game, S = g.S; return ${expr}; })()`);
const robo = async c => { await js("hideModal()"); await js(ROBO_BASE); await js(`window.__passo = ${c}`); };
const dia = () => G(`(() => { window.__perdas = {}; window.__dia(window.__passo); return S.day; })()`);
try {
  await abrir(null); await js("localStorage.removeItem('mercadinho-diag')"); await abrir(null); await sleep(1200);
  await foto(`${pasta}/1-aviso-diagnostico-menu.png`);
  await abrir("livre"); await js("hideModal()"); await robo("() => {}"); for (let d = 0; d < 5; d++) await dia();
  await G(`(() => { g.openSheet("credito"); })()`); await sleep(700); await foto(`${pasta}/2-credito-livre.png`);
  await gravarCarreira(carreiraEm("brisa")); await abrir("carreira"); await robo(ROBOS.brisa); for (let d = 0; d < 3; d++) await dia();
  await G(`(() => { g.closeSheet && g.closeSheet(); g.openSheet("reuniao"); })()`); await sleep(700); await foto(`${pasta}/3-reuniao-semana.png`);
  await gravarCarreira(carreiraEm("cajueiro")); await abrir("carreira"); await robo(ROBOS.cajueiro); for (let d = 0; d < 12; d++) await dia();
  await G(`(() => { S.money += 5000; const a = at(); Object.keys(a.pos || {}).slice(0, 3).forEach(k => { try { instalarNivel(k); } catch (e) {} }); g.openSheet("atacado"); })()`); await sleep(700);
  await G(`(() => { const b = document.getElementById("shBody"); const h = [...b.querySelectorAll("h3,h4,strong,div")].find(x => /Estoque no alto/.test(x.textContent) && x.children.length < 3); if (h) h.scrollIntoView(); })()`); await sleep(400);
  await foto(`${pasta}/4-estoque-alto-painel.png`);
  await G(`(() => { g.closeSheet(); })()`); await sleep(1500); await foto(`${pasta}/5-atacarejo-cena.png`);
  console.log("erros:", t.erros.length, t.erros.slice(0, 3).join(" | "));
} finally { t.fim(); }
