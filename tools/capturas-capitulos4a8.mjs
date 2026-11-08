// Capturas de tela das cenas dos capítulos 4 a 8 e do mapa (com animação ligada, como no jogo).
// Uso: node tools/capturas-capitulos4a8.mjs   → capturas/capitulos4a8/
import path from "node:path";
import { iniciar, carreiraEm, raiz, sleep } from "./lib-cdp.mjs";
import { ROBO_BASE, ROBOS } from "./robos-capitulos.mjs";

const DIR = path.join(raiz, "capturas", "capitulos4a8");
const t = await iniciar({ largura: 1000, altura: 760, animar: true });
const nitida = (w, h) => t.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
const limpar = () => t.js(`(() => { hideModal(); document.getElementById("toast").classList.remove("show"); bannerQ.length = 0; return 1; })()`);
async function abrirFase(fase, dias, ate) {
  await t.gravarCarreira(carreiraEm(fase)); await t.abrir("carreira"); await t.js("hideModal()");
  await t.js(ROBO_BASE); await t.js(`window.__passo = ${ROBOS[fase]}`);
  for (let d = 0; d < dias; d++) { await t.js(`(() => { window.__perdas = {}; window.__dia(window.__passo); return 1; })()`); if (ate && await t.js(ate)) break; }
  await t.js(`(() => { const g = window.__game; for (let i = 0; i < 300; i++) { if (i % 20 === 0) window.__passo(i); g.update(0.05); } recenter(); return 1; })()`);
  await sleep(3000); await limpar(); await sleep(300);
}
try {
  await nitida(1000, 760);
  await abrirFase("restinga", 3); await t.foto(path.join(DIR, "cena-4-restinga.png"));
  await abrirFase("pitanga", 3); await t.foto(path.join(DIR, "cena-5-pitanga.png"));
  await t.js(`openSheet("entregas")`); await sleep(600); await t.foto(path.join(DIR, "painel-5-entregas.png")); await t.js("closeSheet()");
  await abrirFase("cajueiro", 4); await t.foto(path.join(DIR, "cena-6-cajueiro.png"));
  await abrirFase("brisa", 4); await t.foto(path.join(DIR, "cena-7-brisa.png"));
  await t.js(`openSheet("calendario")`); await sleep(600); await t.foto(path.join(DIR, "painel-7-calendario.png")); await t.js("closeSheet()");
  await abrirFase("grande", 12, "window.__game.S.obra.pct >= 55"); await t.foto(path.join(DIR, "cena-8-grande-obra.png"));
  await t.js(`openSheet("obra")`); await sleep(600); await t.foto(path.join(DIR, "painel-8-obra.png")); await t.js("closeSheet()");
  await abrirFase("grande", 25, "window.__game.S.obra.fase === 'operacao'"); await t.foto(path.join(DIR, "cena-8-grande-inaugurado.png"));
  await t.js("window.__game.abrirMapa()"); await sleep(500); await t.foto(path.join(DIR, "mapa-carreira.png"));
  await t.js("hideModal()"); await nitida(360, 740); await t.js("window.__game.abrirMapa()"); await sleep(500); await t.foto(path.join(DIR, "mapa-360px.png"));
} catch (e) { console.log("ERRO", e.message); }
console.log("erros:", t.erros); t.fim();
