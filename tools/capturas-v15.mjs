// Captura da 1.5: painel de um setor com a equipe individual. Uso: node tools/capturas-v15.mjs <pasta>
import { iniciar } from "./lib-cdp.mjs";
const pasta = process.argv[2] || "capturas/v1.5";
const t = await iniciar({ animar: true });
const { js, abrir, foto, send } = t;
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
try {
  await abrir("livre"); await js("hideModal()");
  await js(`(() => { const S = window.__game.S; S.money = 3000; S.sec.mercearia.staff = 3; equipeSync(); treinarPessoa("rep", "mercearia", 0, true); treinarPessoa("rep", "mercearia", 0, true); treinarPessoa("rep", "mercearia", 1, true);
    S.cashiers = 2; equipeSync(); treinarPessoa("caixa", null, 1, true); syncWorkers(); select({ kind: "shelf", i: 0 }); })()`);
  await new Promise(r => setTimeout(r, 900));
  await js(`document.querySelector("#shBody .equipe-ind").scrollIntoView()`); await new Promise(r => setTimeout(r, 400));
  await foto(`${pasta}/equipe-individual-setor.png`);
  await js(`closeSheet(); select({ kind: "lane", l: 1 })`); await new Promise(r => setTimeout(r, 900));
  await js(`document.querySelector("#shBody .equipe-ind").scrollIntoView()`); await new Promise(r => setTimeout(r, 400));
  await foto(`${pasta}/equipe-individual-caixas.png`);
  console.log("erros:", t.erros.length);
} finally { t.fim(); }
