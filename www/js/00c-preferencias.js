"use strict";
// =====================================================================
// Preferências de quem joga (valem para o aparelho, não para uma partida):
// reduzir movimento decorativo e texto maior. Ficam numa chave própria e
// nunca tocam nos saves dos modos ("mercadinho-save-v4" e "mercadinho-carreira-v1").
// Reduzir movimento não muda a velocidade da simulação: só tira balanços,
// piscadas, confetes, brilhos e deslizes de câmera.
// =====================================================================
const CHAVE_PREFS = "mercadinho-prefs";
const PREFS = (() => {
  let p = null; try { p = JSON.parse(localStorage.getItem(CHAVE_PREFS) || "null"); } catch (e) {}
  let sistema = false; try { sistema = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
  return Object.assign({ movReduzido: sistema, textoGrande: false }, p || {});
})();
function salvarPrefs() { try { localStorage.setItem(CHAVE_PREFS, JSON.stringify(PREFS)); } catch (e) {} aplicarPrefs(); }
function aplicarPrefs() {
  document.documentElement.classList.toggle("mov-reduzido", !!PREFS.movReduzido);
  document.documentElement.classList.toggle("texto-grande", !!PREFS.textoGrande);
}
const REDUZ = () => !!PREFS.movReduzido;
// oscilação decorativa: com movimento reduzido fica parada no valor médio
const pulso = (t, k, base, amp) => REDUZ() ? base : base + Math.sin(t * k) * amp;
aplicarPrefs();
// Clientes diversos, caixa prioritário, ajuda da equipe e rotas acessíveis (03b). Só os testes de regressão
// desligam isto (window.__semDiversidade = true) para comparar o restante do jogo com a versão anterior.
const DIV = !window.__semDiversidade;
