// Capturas da 1.6 (bugs do relato): reputação explicada e ficha do contrato. Uso: node tools/capturas-v16b.mjs <pasta>
import { iniciar, carreiraEm } from "./lib-cdp.mjs";
const pasta = process.argv[2] || "capturas/v1.6";
const t = await iniciar({ animar: true });
const { js, abrir, foto, send, gravarCarreira } = t;
const esperar = ms => new Promise(r => setTimeout(r, ms));
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
try {
  await abrir("livre"); await js("hideModal()");
  await js(`(() => { const c = { x: 0, y: 0, path: [] }; for (let i = 0; i < 4; i++) leaveAngry(c, "😤 fila enorme"); for (let i = 0; i < 6; i++) changeRep(-0.04, "gondola"); for (let i = 0; i < 9; i++) changeRep(0.05, "rapido"); document.getElementById("repChip").click(); })()`);
  await esperar(700); await foto(`${pasta}/reputacao.png`); await js("hideModal()");
  await gravarCarreira(carreiraEm("brisa")); await abrir("carreira"); await js("hideModal()");
  await js(`(() => { const L = lojasSh(); const peq = L.unidades.find(u => u.tam === "pequena"); L.unidades.filter(u => u.tam === "alimento").forEach(u => u.ocup = null);
    peq.ocup = { nome: "Açaí da Orla", ramo: "acai", aluguel: 40, pct: 0.05, diasContrato: 10, resta: 6, risco: 0.05, divida: 120, atrasos: 2, desde: 3, vendas: 0, pagoTot: 380, ultPago: 0, ultVendas: 210 };
    abrirContrato(L, peq.id, SH_LOC()); })()`);
  await esperar(700); await foto(`${pasta}/contrato-shopping.png`);
  console.log("erros:", t.erros.length, t.erros.slice(0, 3));
} finally { t.fim(); }
