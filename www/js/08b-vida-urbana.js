"use strict";
// =====================================================================
// Vida urbana dos cenários da carreira: vizinhança desenhada no chão
// (pré-desenhada uma vez, custo zero por quadro), pedestres que passam,
// entram e saem de casas e lojas, e ônibus que para no ponto.
// No Modo Livre (cenário "esquina") nada daqui roda nem sorteia números.
// =====================================================================
const CALC_TOPO = -22;            // a calçada do outro lado da rua principal vai de -22 a 0
const PONTO_X = LOJA.letreiro.x + LOJA.letreiro.w / 2 - 8;   // ponto de ônibus, do outro lado da rua, em frente ao letreiro
const PORTAS = [];                // portas e portões do outro lado da rua (preenchido ao desenhar)

const PASTEIS = ["#f3d9a4", "#cfe3c1", "#f2c4b0", "#bcd7e8", "#f6e7c8", "#e8c6d9", "#fff1d0", "#d9e7d0", "#f4cfa0"];
const TELHAS = ["#b5533c", "#a8472f", "#c06446", "#8f8a84"];
const LOJAS = [
  { nome: "LANCHES", cor: "#d9822b" }, { nome: "MODAS", cor: "#b5487a" }, { nome: "FARMÁCIA", cor: "#2e7a57", cruz: true },
  { nome: "SALÃO", cor: "#8a5cc2" }, { nome: "ÓTICA", cor: "#3f74b8" }, { nome: "CELULARES", cor: "#4b5563" },
  { nome: "PET", cor: "#8a6a4a" }, { nome: "CALÇADOS", cor: "#c9513a" }, { nome: "PAPELARIA", cor: "#2f8a7a" },
];

// ---------- vizinhança pré-desenhada ----------
function pintarVizinhanca(g, rrg, wb, ww) {
  let seed = SCENE.semente || (SCENE.vizinhanca === "centro" ? 97 : 53);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pickR = a => a[Math.floor(rnd() * a.length)];
  const fonte = (px, peso = 800) => { g.font = `${peso} ${px}px "Nunito", system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; };
  PORTAS.length = 0;

  // calçada larga do outro lado da rua principal, com juntas
  g.fillStyle = COR().calcadaLonge; g.fillRect(wb.x0, CALC_TOPO, ww, -CALC_TOPO);
  g.fillStyle = "rgba(120,110,90,.16)"; for (let x = wb.x0; x < wb.x1; x += 16) g.fillRect(x, CALC_TOPO, 1, -CALC_TOPO);
  g.fillStyle = "rgba(0,0,0,.10)"; g.fillRect(wb.x0, -2, ww, 2);

  const base = CALC_TOPO, topo = wb.y0 + 6;
  if (SCENE.vizinhanca === "casas") {
    for (let x = wb.x0 + 4; x < wb.x1 - 40;) {
      const w = 64 + Math.floor(rnd() * 34);
      casaFrente(g, rrg, x, w, base, topo, rnd, pickR);
      x += w + 4 + Math.floor(rnd() * 8);
    }
  } else if (SCENE.vizinhanca === "rodovia") {
    // beira de rodovia: canteiro, galpões, um posto de serviço genérico e vegetação de restinga (sem marcas)
    g.fillStyle = "#a9bf7f"; g.fillRect(wb.x0, wb.y0, ww, base - wb.y0);
    for (let x = wb.x0 + 6; x < wb.x1 - 60;) {
      const w = 110 + Math.floor(rnd() * 70), h = 30 + Math.floor(rnd() * 16), cor = pickR(["#d9d4c7", "#c9cfd4", "#e2d8c0", "#cfd6c8"]);
      if (rnd() < .3) { for (let k = 0; k < 4; k++) tree(g, x + 14 + k * 24, base - 18 - rnd() * 14, 8 + rnd() * 4); x += w; continue; }
      g.fillStyle = "rgba(40,30,15,.2)"; g.fillRect(x + 3, base - h - 2, w, h);
      g.fillStyle = cor; g.fillRect(x, base - h - 5, w, h);
      g.fillStyle = shade(cor, .82); for (let k = 0; k < w; k += 10) g.fillRect(x + k, base - h - 5, 1.5, h);
      g.fillStyle = shade(cor, .7); g.fillRect(x, base - h - 5, w, 4);
      g.fillStyle = "#6b7378"; g.fillRect(x + w / 2 - 12, base - 19, 24, 14);
      x += w + 18 + Math.floor(rnd() * 20);
    }
  } else {
    g.fillStyle = "#a9a49a"; g.fillRect(wb.x0, wb.y0, ww, base - wb.y0);          // fundos dos prédios
    let academia = false;
    for (let x = wb.x0 + 2; x < wb.x1 - 40;) {
      const gym = !academia && x > 380;
      const w = gym ? 118 : 60 + Math.floor(rnd() * 34);
      predioLoja(g, rrg, x, w, base, topo, rnd, pickR, gym);
      if (gym) academia = true;
      x += w + 2;
    }
  }
  pontoOnibus(g, rrg, PONTO_X, base, fonte);
  // árvores na calçada (copas pequenas, longe do ponto)
  for (let x = wb.x0 + 40; x < wb.x1; x += SCENE.vizinhanca === "centro" ? 150 : 110) {
    if (Math.abs(x - PONTO_X) < 40) continue;
    g.fillStyle = "#8a7a5c"; g.fillRect(x - 5, -9, 10, 4);
    tree(g, x, -14, 7.5);
  }

  // laterais e fundos: vista de cima (telhados, quintais, lajes)
  const quadras = [
    [wb.x0, wb.y0, (SCENE.doca ? -170 : -72) - wb.x0, (H + 62) - wb.y0],   // esquerda (com doca, termina antes dela)
    [W + (SCENE.plot ? 192 : SCENE.faixaDir || 76), wb.y0, wb.x1 - (W + (SCENE.plot ? 192 : SCENE.faixaDir || 76)), (H + 62) - wb.y0],   // direita (galeria do atacarejo: mais afastada)
    [wb.x0, H + 126, ww, wb.y1 - (H + 126)],                        // fundos, depois da rua de baixo
  ];
  quadras.forEach(([qx, qy, qw, qh], qi) => {
    if (qw < 30 || qh < 30) return;
    const y0 = qi < 2 ? Math.max(qy, 2) + 40 : qy + 4;              // nas laterais, começa abaixo da rua principal
    for (let y = y0; y < qy + qh - 30; y += 66) for (let x = qx + 4; x < qx + qw - 30; x += 74)
      telhado(g, rrg, x, y, Math.min(68, qx + qw - x - 4), Math.min(60, qy + qh - y - 4), rnd, pickR);
  });
}

function casaFrente(g, rrg, x, w, base, topo, rnd, pickR) {
  const parede = pickR(PASTEIS), alt = 30 + Math.floor(rnd() * 10), muroH = 13;
  const yCasa = base - muroH - alt + 4;
  // quintal visto por cima do muro
  g.fillStyle = "#a9c47c"; g.fillRect(x, topo, w, base - topo);
  if (rnd() < .55) tree(g, x + 10 + rnd() * (w - 20), topo + 12 + rnd() * 10, 8 + rnd() * 4);   // árvore no fundo do quintal
  // corpo da casa
  g.fillStyle = "rgba(40,30,15,.18)"; g.fillRect(x + 7, yCasa + 3, w - 10, alt);
  g.fillStyle = parede; g.fillRect(x + 5, yCasa, w - 10, alt);
  // telhado: duas águas de telha, ou laje com caixa d'água
  if (rnd() < .62) {
    const tc = pickR(TELHAS);
    g.fillStyle = tc; g.beginPath(); g.moveTo(x + 1, yCasa + 2); g.lineTo(x + w / 2, yCasa - 16); g.lineTo(x + w - 1, yCasa + 2); g.closePath(); g.fill();
    g.strokeStyle = shade(tc, .75); g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x + 1 + k * 3, yCasa + 2 - k * 3.4); g.lineTo(x + w - 1 - k * 3, yCasa + 2 - k * 3.4); g.stroke(); }
  } else {
    g.fillStyle = "#b9b4aa"; g.fillRect(x + 3, yCasa - 4, w - 6, 5);
    const cx = x + 12 + rnd() * (w - 34);
    g.fillStyle = "#3f74b8"; rrg(cx, yCasa - 15, 14, 11, 3); g.fill(); g.fillStyle = "#5b8fd0"; g.fillRect(cx + 2, yCasa - 14, 10, 2);
  }
  // janelas com grade
  const nj = w > 80 ? 2 : 1;
  for (let k = 0; k < nj; k++) {
    const jx = x + (nj === 1 ? w / 2 + 6 : 14 + k * (w - 40)), jy = yCasa + 6;
    g.fillStyle = "#7fa9c4"; g.fillRect(jx, jy, 14, 11); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(jx + 1, jy + 1, 5, 9);
    g.fillStyle = "rgba(60,50,40,.7)"; for (let b = 3; b < 14; b += 3.5) g.fillRect(jx + b, jy, .8, 11);
  }
  // muro e portão (o portão vira porta para os pedestres que moram ali)
  const muro = rnd() < .5 ? "#f2eee4" : shade(parede, .92);
  g.fillStyle = muro; g.fillRect(x, base - muroH, w, muroH);
  g.fillStyle = "rgba(0,0,0,.10)"; g.fillRect(x, base - muroH, w, 2); g.fillRect(x, base - 2, w, 2);
  const px = x + 8 + Math.floor(rnd() * (w - 34)), pc = pickR(["#2f5d3a", "#4b5563", "#7a3b2a", "#1d3461"]);
  g.fillStyle = pc; g.fillRect(px, base - muroH - 3, 20, muroH + 3);
  g.fillStyle = shade(pc, 1.35); for (let b = 2; b < 20; b += 3) g.fillRect(px + b, base - muroH - 1, 1, muroH);
  if (rnd() < .45) { g.fillStyle = "#5a9a3c"; g.beginPath(); g.arc(x + w - 9, base - muroH - 2, 6, 0, 7); g.fill(); }
  PORTAS.push({ x: px + 10, tipo: "casa" });
}

function predioLoja(g, rrg, x, w, base, topo, rnd, pickR, gym) {
  // prédios ocupam a faixa toda: sem "céu" vazio que parece calçada; só a platibanda varia
  const andar = 26, terreo = 30, h = base - topo - (gym ? 0 : Math.floor(rnd() * 3) * 6);
  const yTopo = base - h, parede = gym ? "#2a2a2e" : pickR(["#efe6d2", "#e6ddd0", "#d9d2c3", "#f1e2c6", "#dfe6e8", "#efd9cf"]);
  g.fillStyle = "rgba(40,30,15,.2)"; g.fillRect(x + 2, yTopo + 3, w, h);
  g.fillStyle = parede; g.fillRect(x, yTopo, w, h);
  g.fillStyle = shade(parede, .85); g.fillRect(x, yTopo, w, 4);
  // andares de cima: janelas
  for (let y = yTopo + 8; y < base - terreo - 6; y += andar) {
    const n = Math.max(2, Math.floor(w / 24));
    for (let k = 0; k < n; k++) {
      const jx = x + 6 + k * ((w - 12) / n), jw = (w - 12) / n - 6;
      g.fillStyle = gym ? "#f28c28" : "#88aec4"; g.fillRect(jx, y, jw, 13);
      if (gym) { g.fillStyle = "#2a2a2e"; g.fillRect(jx + 3, y + 8, jw - 6, 2); g.fillRect(jx + jw / 2 - 1, y + 4, 2, 6); }  // esteiras vistas pela janela
      else { g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(jx + 1, y + 1, jw / 3, 11); }
      g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(jx - 1, y + 13, jw + 2, 2);
      if (!gym && rnd() < .25) { g.fillStyle = "#5a5f63"; g.fillRect(jx + jw - 7, y + 9, 7, 5); }   // ar-condicionado
    }
  }
  // térreo: vitrine, toldo e placa
  const loja = gym ? { nome: "ACADEMIA", cor: "#f28c28" } : pickR(LOJAS);
  const yT = base - terreo;
  g.fillStyle = gym ? "#141416" : shade(loja.cor, .55); g.fillRect(x + 2, yT, w - 4, 9);
  g.font = `800 ${gym ? 8 : 7}px "Nunito", system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = gym ? "#f28c28" : "#fff"; g.fillText(loja.nome, x + w / 2 + (gym || loja.cruz ? 6 : 0), yT + 4.8);
  if (gym) {                                                     // halter
    const hx = x + w / 2 - 30, hy = yT + 4.5; g.fillStyle = "#f28c28"; g.fillRect(hx - 7, hy - .8, 14, 1.6); g.fillRect(hx - 8, hy - 3, 3, 6); g.fillRect(hx + 5, hy - 3, 3, 6);
  }
  if (loja.cruz) { const cx = x + w / 2 - 24, cy = yT + 4.5; g.fillStyle = "#fff"; g.fillRect(cx - 1.5, cy - 4, 3, 8); g.fillRect(cx - 4, cy - 1.5, 8, 3); }
  // toldo listrado
  for (let k = 0, n = Math.floor((w - 4) / 8); k < n; k++) { g.fillStyle = k % 2 ? "#fffaf0" : loja.cor; g.fillRect(x + 2 + k * (w - 4) / n, yT + 9, (w - 4) / n, 5); }
  // vitrine e porta
  g.fillStyle = gym ? "#3a3f45" : "#9cc2d6"; g.fillRect(x + 5, yT + 14, w - 10, terreo - 14);
  g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(x + 7, yT + 15, (w - 14) * .3, terreo - 17);
  const porta = x + w / 2 - 7;
  g.fillStyle = gym ? "#1b1d20" : "#6b8796"; g.fillRect(porta, yT + 14, 14, terreo - 14);
  g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(porta + 6.5, yT + 15, 1, terreo - 16);
  if (gym) { g.fillStyle = "#f28c28"; for (let k = 0; k < 3; k++) g.fillRect(x + 12 + k * 14, base - 8, 9, 2); }   // aparelhos à mostra
  PORTAS.push({ x: x + w / 2, tipo: gym ? "academia" : "loja" });
}

function pontoOnibus(g, rrg, x, base, fonte) {
  g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(x - 22, -6, 46, 4);
  g.fillStyle = "#5b6b73"; g.fillRect(x - 20, base - 8, 2, 20); g.fillRect(x + 18, base - 8, 2, 20);
  g.fillStyle = "rgba(170,210,232,.65)"; g.fillRect(x - 20, base - 8, 40, 14);
  g.fillStyle = "#c9302c"; rrg(x - 23, base - 12, 46, 5, 2); g.fill();
  g.fillStyle = "#7a5634"; g.fillRect(x - 14, base + 7, 28, 3);                 // banco
  g.fillStyle = "#4b5563"; g.fillRect(x + 27, base - 14, 2, 22);                 // placa com pictograma genérico de ônibus
  rrg(x + 21, base - 22, 14, 10, 2); g.fill();
  g.fillStyle = "#fff"; g.fillRect(x + 23.5, base - 20, 9, 5); g.fillStyle = "#4b5563"; g.fillRect(x + 25, base - 19, 6, 2);
}

function telhado(g, rrg, x, y, w, h, rnd, pickR) {
  if (w < 26 || h < 26) return;
  const centro = SCENE.vizinhanca === "centro";
  if (centro && rnd() < .14) {                                      // pracinha com bancos e árvores
    g.fillStyle = "#a9c47c"; rrg(x, y, w, h, 6); g.fill();
    g.fillStyle = "#e2dccd"; g.fillRect(x, y + h / 2 - 3, w, 6); g.fillRect(x + w / 2 - 3, y, 6, h);
    g.fillStyle = "#7a5634"; g.fillRect(x + 6, y + h / 2 - 9, 12, 3); g.fillRect(x + w - 18, y + h / 2 + 6, 12, 3);
    tree(g, x + 12, y + 14, 7); tree(g, x + w - 12, y + h - 10, 7);
    return;
  }
  g.fillStyle = centro ? "#cfcabd" : "#a9c47c"; g.fillRect(x, y, w, h);                        // quintal ou piso
  g.strokeStyle = centro ? "rgba(90,85,75,.35)" : "#f2eee4"; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);   // muro
  const rw = w * (.55 + rnd() * .25), rh = h * (.5 + rnd() * .25), rx = x + 4 + rnd() * (w - rw - 8), ry = y + 4 + rnd() * (h - rh - 8);
  g.fillStyle = "rgba(40,30,15,.22)"; g.fillRect(rx + 3, ry + 3, rw, rh);
  if (!centro && rnd() < .7) {
    const tc = pickR(TELHAS); g.fillStyle = tc; g.fillRect(rx, ry, rw, rh);
    g.fillStyle = shade(tc, .82); g.fillRect(rx, ry, rw, rh / 2);
    g.fillStyle = shade(tc, 1.15); g.fillRect(rx, ry + rh / 2 - 1, rw, 2);
  } else if (centro && rnd() < .3) {
    const tc = pickR(TELHAS); g.fillStyle = tc; g.fillRect(rx, ry, rw, rh); g.fillStyle = shade(tc, .82); g.fillRect(rx, ry, rw, rh / 2);
  } else {
    g.fillStyle = centro ? pickR(["#b9b4aa", "#a7a39a", "#c4bfb3"]) : "#bdb8ad"; g.fillRect(rx, ry, rw, rh);
    g.fillStyle = "#3f74b8"; rrg(rx + rw - 13, ry + 3, 10, 10, 2); g.fill(); g.fillStyle = "#5b8fd0"; g.fillRect(rx + rw - 11, ry + 5, 6, 2);
    if (centro && rnd() < .5) { g.fillStyle = "#6b7378"; g.fillRect(rx + 4, ry + rh - 10, 9, 6); }
  }
  if (!centro && rnd() < .5) tree(g, x + (rnd() < .5 ? 8 : w - 8), y + h - 9, 6);
  if (!centro && rnd() < .08) { g.fillStyle = "#5bb3d9"; rrg(x + 5, y + h - 16, 18, 11, 3); g.fill(); }   // piscina
}

// ---------- pedestres e ônibus ----------
const pedestres = [], esperando = [];
let pedT = 0, pedId = 5000, cidadePronta = false;
const onibus = { x: 0, v: 0, estado: "longe", t: 6 };
const LADOS = { longe: -12, perto: 37 };          // calçada de lá (-22..0) e meio-fio do lado do mercado

function novoPedestre(o) {
  const p = Object.assign({ id: pedId++, shirt: pick(SHIRTS), skin: pick(SKIN), hair: pick(HAIR), long: Math.random() < .4, a: 1, fase: "anda", v: 0 }, o);
  if (!p.v) p.v = (Math.random() < .5 ? -1 : 1) * (22 + Math.random() * 14);
  if (SCENE.vizinhanca === "casas" && Math.random() < .12) p.cao = pick(["#8a6a4a", "#d9b27a", "#3b2a1a", "#f2f0ea"]);
  if (Math.random() < .3) p.sacola = Math.random() < .5 ? "#fffaf0" : "#f2b233";
  return p;
}
function iniciarCidade() {
  cidadePronta = true;
  const n = Math.round(SCENE.pedestres.max * .6);                     // a rua já começa com gente
  for (let i = 0; i < n; i++) {
    const lado = Math.random() < .55 ? "longe" : "perto";
    pedestres.push(novoPedestre({ lado, x: WORLD.x0 + Math.random() * (WORLD.x1 - WORLD.x0), y: LADOS[lado] + (Math.random() - .5) * 4 }));
  }
  if (SCENE.vizinhanca === "centro") for (let i = 0; i < 2; i++) esperando.push(novoPedestre({ lado: "longe", x: PONTO_X - 12 + i * 12, y: -13, fase: "espera", v: 1 }));
}
function updateCidade(dt) {
  if (!SCENE.pedestres) return;
  if (!cidadePronta) iniciarCidade();
  const cfg = SCENE.pedestres;
  pedT -= dt * cfg.taxa * (isRush() ? 1.4 : 1);
  if (pedT <= 0) {
    pedT += 1;
    if (pedestres.length < cfg.max) {
      const sai = PORTAS.length && Math.random() < .3;
      if (sai) {                                                          // alguém sai de casa ou da loja
        const d = pick(PORTAS);
        pedestres.push(novoPedestre({ lado: "longe", x: d.x, y: CALC_TOPO - 4, a: 0, fase: "sai", alvoY: -12 + (Math.random() - .5) * 4, academia: d.tipo === "academia" }));
      } else {
        const lado = Math.random() < .55 ? "longe" : "perto", dir = Math.random() < .5 ? 1 : -1;
        const p = novoPedestre({ lado, v: dir * (22 + Math.random() * 14), y: LADOS[lado] + (Math.random() - .5) * 4 });
        p.x = dir > 0 ? WORLD.x0 - 20 : WORLD.x1 + 20;
        if (lado === "longe" && PORTAS.length && Math.random() < .3) { const d = pick(PORTAS); if ((d.x - p.x) * dir > 0) { p.alvo = d.x; p.academia = d.tipo === "academia"; } }
        pedestres.push(p);
      }
    }
  }
  for (let i = pedestres.length - 1; i >= 0; i--) {
    const p = pedestres[i];
    if (p.fase === "sai") { p.a = Math.min(1, p.a + dt * 2.5); p.y += 22 * dt; if (p.y >= p.alvoY) { p.y = p.alvoY; p.fase = "anda"; } continue; }
    if (p.fase === "entra") { p.a -= dt * 2.5; p.y -= 20 * dt; if (p.a <= 0) pedestres.splice(i, 1); continue; }
    p.x += p.v * dt;
    if (p.alvo != null && Math.abs(p.x - p.alvo) < 2) { p.x = p.alvo; p.fase = "entra"; continue; }
    if (p.x < WORLD.x0 - 40 || p.x > WORLD.x1 + 40) pedestres.splice(i, 1);
  }
  atualizarOnibus(dt);
}
function atualizarOnibus(dt) {
  if (!SCENE.onibus) return;
  const b = onibus, cheio = 60;
  if (b.estado === "longe") {
    b.t -= dt; if (b.t > 0) return;
    b.estado = "chega"; b.x = WORLD.x1 + 50; b.v = -cheio;
  } else if (b.estado === "chega") {
    const falta = b.x - PONTO_X; b.v = -Math.max(10, Math.min(cheio, falta * 1.3)); b.x += b.v * dt;
    if (falta < 1) { b.x = PONTO_X; b.v = 0; b.estado = "parado"; b.t = 3; embarque(); }
  } else if (b.estado === "parado") {
    b.t -= dt; if (b.t <= 0) b.estado = "sai";
  } else if (b.estado === "sai") {
    b.v = Math.max(-cheio, b.v - 40 * dt); b.x += b.v * dt;
    if (b.x < WORLD.x0 - 80) { b.estado = "longe"; b.t = SCENE.onibus.cada * (.7 + Math.random() * .6); }
  }
  // carros na mesma faixa formam fila atrás do ônibus (e uns atrás dos outros enquanto ele está ali)
  if (b.estado !== "longe") {
    let frente = b.x + 34;
    cars.filter(c => c.v < 0 && c.x > b.x).sort((p, q) => p.x - q.x).forEach(c => { const min = frente + 18; if (c.x < min) c.x = min; frente = c.x + 15; });
  }
}
function embarque() {
  esperando.forEach(p => { p.fase = "embarca"; });
  esperando.length = 0;
  const descem = Math.floor(Math.random() * 3);
  for (let i = 0; i < descem && pedestres.length < SCENE.pedestres.max + 3; i++)
    pedestres.push(novoPedestre({ lado: "longe", x: PONTO_X - 18 + i * 10, y: -12, a: 0, fase: "sai", alvoY: -12 }));
  if (Math.random() < .7) esperando.push(novoPedestre({ lado: "longe", x: PONTO_X - 8, y: -13, fase: "espera", v: 1 }));
}

function cao(p) {
  const d = Math.sign(p.v) || 1, x = p.x + d * 16, y = p.y + 8, t = now(), pe = Math.sin(t * 16 + p.id) * 1.2;
  ctx.strokeStyle = "rgba(60,40,30,.6)"; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(p.x + d * 9, p.y); ctx.lineTo(x, y - 2); ctx.stroke();
  ctx.fillStyle = "rgba(40,30,15,.18)"; ctx.beginPath(); ctx.ellipse(x, y + 4, 6, 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#3a3330"; ctx.fillRect(x - 4 + pe, y + 1, 1.5, 3); ctx.fillRect(x + 3 - pe, y + 1, 1.5, 3);
  rr(x - 5, y - 3, 10, 5, 2.5, p.cao); ctx.fillStyle = p.cao; ctx.beginPath(); ctx.arc(x + d * 5, y - 4, 3, 0, 7); ctx.fill();
  ctx.fillStyle = "#2a2620"; ctx.beginPath(); ctx.arc(x + d * 6.5, y - 4.5, .7, 0, 7); ctx.fill();
}
// área visível do mundo (com folga), para não desenhar quem está fora da tela
function vistaMundo() { const a = toWorld(-30, -40), b = toWorld(VW + 30, VH + 40); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; }
let VISTA = null;
function pessoaSimples(p) {                       // de longe: silhueta sem rosto nem degradê
  ctx.fillStyle = "rgba(40,30,15,.18)"; ctx.beginPath(); ctx.ellipse(p.x, p.y + 10, 8, 3, 0, 0, 7); ctx.fill();
  rr(p.x - 7, p.y - 6, 14, 15, 5, p.academia ? "#f28c28" : p.shirt);
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 7, 0, 7); ctx.fill();
  ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(p.x, p.y - 14, 7, Math.PI, 0); ctx.fill();
}
function pessoaRua(p) {
  if (VISTA && !window.__semOtimizar && (p.x < VISTA.x0 || p.x > VISTA.x1 || p.y < VISTA.y0 || p.y > VISTA.y1)) return;
  if (cam.s * DPR < 1.1 && !window.__semOtimizar) { if (p.a < 1) ctx.globalAlpha = Math.max(0, p.a); pessoaSimples(p); ctx.globalAlpha = 1; return; }
  const mover = p.fase !== "espera";
  if (p.a < 1) ctx.globalAlpha = Math.max(0, p.a);
  if (p.cao) cao(p);
  person(p, { moving: mover, body: p.academia ? "#f28c28" : undefined });
  if (p.sacola) { const d = Math.sign(p.v) || 1; rrs(p.x + d * 10 - 4, p.y - 1, 8, 9, 1.5, p.sacola, "rgba(0,0,0,.25)", .7); }
  ctx.globalAlpha = 1;
}
function desenharOnibus() {
  const b = onibus; if (b.estado === "longe") return;
  const x = b.x, y = 8, L = 70, A = 17;
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(x - L / 2 + 2, y + A / 2 - 1, L, 4);
  rr(x - L / 2, y - A / 2, L, A, 4, "#c62d28");
  rr(x - L / 2 + 6, y - A / 2 + 2, L - 10, A - 4, 3, "#d8413a");                      // teto
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(x - L / 2, y + A / 2 - 4, L, 1.8);   // faixa branca
  rr(x - L / 2 + 1, y - A / 2 + 2, 6, A - 4, 2, "rgba(190,220,240,.95)");               // para-brisa (frente à esquerda)
  rr(x - 4, y - 4, 16, 8, 2, "#eeeeea"); ctx.fillStyle = "#c9c9c4"; ctx.fillRect(x - 2, y - 2, 12, 1); ctx.fillRect(x - 2, y + 1, 12, 1);   // ar-condicionado
  ctx.fillStyle = "#fff6c8"; ctx.fillRect(x - L / 2 - 1, y - A / 2 + 1, 2, 3); ctx.fillRect(x - L / 2 - 1, y + A / 2 - 4, 2, 3);
  if (b.estado === "parado") { ctx.fillStyle = "#f2b233"; ctx.fillRect(x - L / 2 + 14, y - A / 2 - 1, 8, 1.5); }   // porta aberta
}
// camada 0: calçada de lá e ônibus (atrás dos carros); camada 1: meio-fio do lado do mercado (na frente)
function drawCidade(camada) {
  if (!SCENE.pedestres) return;
  VISTA = vistaMundo();
  if (!camada) {
    pedestres.filter(p => p.lado === "longe").concat(esperando).sort((a, b) => a.y - b.y).forEach(pessoaRua);
    desenharOnibus();
  } else {
    pedestres.filter(p => p.lado === "perto").sort((a, b) => a.y - b.y).forEach(pessoaRua);
  }
}
