// Capturas da 1.6: fornecedores no capítulo 4, distribuidoras do atacarejo e backup. Uso: node tools/capturas-v16.mjs <pasta>
import { iniciar, carreiraEm } from "./lib-cdp.mjs";
const pasta = process.argv[2] || "capturas/v1.6";
const t = await iniciar({ animar: true });
const { js, abrir, foto, send, gravarCarreira } = t;
const esperar = ms => new Promise(r => setTimeout(r, ms));
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
try {
  await gravarCarreira(carreiraEm("restinga")); await abrir("carreira"); await js("hideModal()");
  await js(`(() => { const S = window.__game.S; S.money = 2400; openSheet("forn"); })()`); await esperar(900);
  await foto(`${pasta}/fornecedores-restinga.png`);
  await js(`closeSheet(); delete window.__game.S.forn; save()`); await abrir("carreira"); await esperar(700);
  await foto(`${pasta}/aviso-fornecedores.png`);
  await js("hideModal()");
  await gravarCarreira(carreiraEm("cajueiro")); await abrir("carreira"); await js("hideModal()");
  await js(`(() => { window.__game.S.money = 3000; ui.atForn = "serra"; openSheet("atacado"); })()`); await esperar(900);
  await js(`[...document.querySelectorAll("#shBody .sec-title")].find(x => /Comprar paletes/.test(x.textContent)).scrollIntoView()`); await esperar(400);
  await foto(`${pasta}/distribuidoras-atacarejo.png`);
  await js(`closeSheet()`); await abrir(null); await js(`[...document.querySelectorAll("#menu button")].find(x => /Backup/.test(x.textContent)).click()`); await esperar(700);
  await foto(`${pasta}/backup.png`);
  console.log("erros:", t.erros.length, t.erros.slice(0, 3));
} finally { t.fim(); }
