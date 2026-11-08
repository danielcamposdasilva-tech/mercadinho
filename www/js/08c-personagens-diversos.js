"use strict";
// =====================================================================
// Desenho dos clientes diversos, do caixa prioritário e da circulação acessível.
// Tudo é desenhado junto da pessoa: cadeira, andador, bengala, carrinho de bebê e cão-guia nunca
// são entidades separadas. Formas simples e leves (sem imagens), como o resto do jogo.
// =====================================================================

// direção para onde a pessoa está indo (suavizada); parada, mantém a última. Usada para pôr o cão,
// o carrinho e o andador à frente, e para decidir o que fica atrás ou na frente do corpo.
function atualizarRumo(c) {
  const dx = c.x - (c.px == null ? c.x : c.px), dy = c.y - (c.py == null ? c.y : c.py), d = Math.hypot(dx, dy);
  c.px = c.x; c.py = c.y;
  if (c.state === "queue" && d < 0.05) { c.hx += (0 - c.hx) * 0.2; c.hy += (1 - c.hy) * 0.2; }   // na fila, de frente para o caixa
  else if (d > 0.05) { c.hx += (dx / d - c.hx) * 0.35; c.hy += (dy / d - c.hy) * 0.35; }
  const n = Math.hypot(c.hx, c.hy) || 1; c.hx /= n; c.hy /= n;
}
function cabecaCliente(p, x, y, mood) {
  const t = now(), ink = "rgba(42,32,20,.55)";
  ctx.fillStyle = p.skin || "#f2cfa6"; ctx.beginPath(); ctx.arc(x, y, 7.8, 0, 7); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = .8; ctx.stroke();
  ctx.fillStyle = p.hair || "#3b2a1a"; ctx.beginPath(); ctx.arc(x, y - 2, 7.9, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  if (p.long) { rr(x - 8, y - 2, 3.5, 9, 2, p.hair); rr(x + 4.5, y - 2, 3.5, 9, 2, p.hair); }
  const blink = (!REDUZ() && Math.sin(t * 1.3 + (p.id || 0) * 3) > .985) ? .2 : 1.2;
  ctx.fillStyle = "#2a2620";
  ctx.beginPath(); ctx.ellipse(x - 2.8, y + 1, 1.1, blink, 0, 0, 7); ctx.ellipse(x + 2.8, y + 1, 1.1, blink, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(230,120,110,.35)"; ctx.beginPath(); ctx.arc(x - 4.8, y + 3.5, 1.6, 0, 7); ctx.arc(x + 4.8, y + 3.5, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = "#2a2620"; ctx.lineWidth = 1; ctx.beginPath();
  if (mood === "angry") ctx.arc(x, y + 6.5, 2.2, Math.PI * 1.15, Math.PI * 1.85);
  else if (mood === "happy") ctx.arc(x, y + 3.5, 2.4, Math.PI * .15, Math.PI * .85);
  else { ctx.moveTo(x - 1.5, y + 4.7); ctx.lineTo(x + 1.5, y + 4.7); }
  ctx.stroke();
}
function cestinha(x, y, itens) {           // cesta pequena (no colo, no andador ou no carrinho de bebê)
  ctx.strokeStyle = "#b23a2a"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x + 6, y, 5, Math.PI, 0); ctx.stroke();
  (itens || []).slice(-2).forEach((ch, i) => emoji(ch, x + 3 + i * 6, y + 1, 7));
  rrs(x, y + 2, 12, 6, 1.5, "#d9533f", "#9e2f22", .9);
}
// ---------- cadeira de rodas (pessoa sentada, rodas grandes, apoio de pés) ----------
function cadeiraDeRodas(c, o) {
  const x = c.x, y = c.y, t = now(), mov = o.moving && !REDUZ(), body = c.shirt;
  ctx.fillStyle = "rgba(40,30,15,.2)"; ctx.beginPath(); ctx.ellipse(x, y + 11, 13, 4, 0, 0, 7); ctx.fill();
  const costasAtras = c.hy >= -0.3;                  // indo para baixo ou de lado: encosto atrás do corpo
  if (costasAtras) rr(x - 8, y - 15, 16, 13, 3, "#33414d");
  // rodas grandes dos lados, com aro de impulsão e raio que gira ao andar
  [-1, 1].forEach(s => {
    const wx = x + s * 10.5, wy = y + 1;
    ctx.fillStyle = "#2a2620"; ctx.beginPath(); ctx.ellipse(wx, wy, 2.6, 9, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#9aa5ad"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(wx, wy, 1.4, 7.4, 0, 0, 7); ctx.stroke();
    const a = mov ? t * 9 : 0; ctx.beginPath(); ctx.moveTo(wx, wy - Math.cos(a) * 7); ctx.lineTo(wx, wy + Math.cos(a) * 7); ctx.stroke();
  });
  rr(x - 8, y - 3, 16, 9, 3, "#3c4a57");                         // assento
  rrPath(x - 7.5, y - 13, 15, 12, 5); ctx.fillStyle = grad(y - 13, y - 1, shade(body, 1.15), shade(body, .85)); ctx.fill();
  ctx.strokeStyle = "rgba(42,32,20,.55)"; ctx.lineWidth = .8; ctx.stroke();
  const imp = mov ? Math.sin(t * 9) * 1.5 : 0;                    // braços nos aros
  rr(x - 10.5, y - 9 + imp, 3.5, 8, 2, shade(body, .9)); rr(x + 7, y - 9 + imp, 3.5, 8, 2, shade(body, .9));
  rr(x - 6, y + 4, 12, 5, 2, "#3a3330");                          // pernas
  rr(x - 6.5, y + 9, 13, 2.5, 1, "#2a2620");                      // apoio dos pés
  ctx.fillStyle = "#2a2620"; ctx.beginPath(); ctx.arc(x - 6, y + 12.5, 1.6, 0, 7); ctx.arc(x + 6, y + 12.5, 1.6, 0, 7); ctx.fill();
  if (!costasAtras) rr(x - 8, y - 15, 16, 13, 3, "#33414d");
  cabecaCliente(c, x, y - 19, o.mood);
  if (o.basket || o.cart) cestinha(x - 6, y - 1, o.basket || o.cart);   // a cesta vai no colo
}
// ---------- cão-guia com guia rígida (alça) ----------
function caoGuia(c, dx, dy, mov) {
  const t = now(), col = c.cao || "#d9a35b", s = c.hx < -0.2 ? -1 : 1, pata = mov ? Math.sin(t * 14) * 1.6 : 0;
  ctx.fillStyle = "rgba(40,30,15,.18)"; ctx.beginPath(); ctx.ellipse(dx, dy + 5, 9, 2.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = shade(col, .8); [-5, -2, 2, 5].forEach((k, i) => ctx.fillRect(dx + k - .7, dy + 1 + (i % 2 ? pata : -pata) * .4, 1.6, 4));
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(dx, dy, 7.5, 4, 0, 0, 7); ctx.fill();          // corpo
  ctx.beginPath(); ctx.arc(dx + s * 7.5, dy - 2.5, 3.4, 0, 7); ctx.fill();                          // cabeça
  ctx.fillStyle = shade(col, .7); ctx.beginPath(); ctx.ellipse(dx + s * 6.4, dy - 3.6, 1.4, 2.4, 0, 0, 7); ctx.fill();   // orelha
  ctx.fillStyle = "#2a2620"; ctx.beginPath(); ctx.arc(dx + s * 10.6, dy - 2.2, .9, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(dx - s * 7, dy - 1); ctx.quadraticCurveTo(dx - s * 10, dy - 4, dx - s * 10.5, dy - 6 + (mov ? Math.sin(t * 10) : 0)); ctx.stroke();
  rr(dx - 3.5, dy - 4.5, 7, 3, 1, "#f4f1e6"); rr(dx - 3.5, dy - 3.4, 7, 1, 0, "#f2b233");           // peitoral com faixa refletiva
}
// ---------- carrinho de bebê ----------
function carrinhoBebe(c, bx, by, itens) {
  const col = c.bebe || "#5b8fd6";
  ctx.fillStyle = "rgba(40,30,15,.18)"; ctx.beginPath(); ctx.ellipse(bx, by + 8, 9, 2.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#2a2620"; [-6, 6].forEach(k => { ctx.beginPath(); ctx.arc(bx + k, by + 7, 2.2, 0, 7); ctx.fill(); });
  rr(bx - 7, by + 2, 14, 3, 1, "#5b6b73");                      // cestinho de baixo
  (itens || []).slice(-2).forEach((ch, i) => emoji(ch, bx - 3 + i * 6, by + 3, 6));
  rrs(bx - 8, by - 6, 16, 9, 4, col, shade(col, .7), .8);         // berço
  ctx.fillStyle = "#f2cfa6"; ctx.beginPath(); ctx.arc(bx + 2, by - 3, 2.6, 0, 7); ctx.fill();      // bebê
  ctx.fillStyle = shade(col, .75); ctx.beginPath(); ctx.moveTo(bx - 8, by - 2); ctx.quadraticCurveTo(bx - 8, by - 12, bx + 1, by - 11); ctx.lineTo(bx - 2, by - 2); ctx.closePath(); ctx.fill();   // capota
}
// ---------- andador ----------
function andador(c, ax, ay, itens) {
  ctx.strokeStyle = "#9aa5ad"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ax - 9, ay - 6); ctx.lineTo(ax - 9, ay + 6); ctx.moveTo(ax + 9, ay - 6); ctx.lineTo(ax + 9, ay + 6); ctx.moveTo(ax - 9, ay - 4); ctx.lineTo(ax + 9, ay - 4); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "#2a2620"; [-9, 9].forEach(k => { ctx.beginPath(); ctx.arc(ax + k, ay + 7, 1.8, 0, 7); ctx.fill(); });
  rr(ax - 10.5, ay - 7.5, 4, 3, 1.2, "#3a3330"); rr(ax + 6.5, ay - 7.5, 4, 3, 1.2, "#3a3330");      // manoplas
  if (itens) cestinha(ax - 6, ay - 3, itens);                     // cesta presa no andador
}
// ---------- quem desenha o quê ----------
function pessoaDiversa(c, o) {
  const mov = o.moving, hx = c.hx || 0, hy = c.hy == null ? 1 : c.hy;
  if (c.perfil === "cadeira") return cadeiraDeRodas(c, o);
  if (c.perfil === "caoguia") {
    // o cão vai um pouco à frente e ao lado esquerdo do sentido de marcha, preso pela alça
    const dx = c.x + hx * 13 + hy * 6, dy = c.y + 4 + hy * 9 - hx * 3, tras = dy < c.y + 2;
    const alca = () => { ctx.strokeStyle = "#6b4423"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(c.x + (dx > c.x ? 7 : -7), c.y - 1); ctx.lineTo(dx, dy - 4); ctx.stroke(); };
    if (tras) { caoGuia(c, dx, dy, mov); alca(); person(c, o); }
    else { person(c, o); alca(); caoGuia(c, dx, dy, mov); }
    return;
  }
  if (c.perfil === "bebe") {
    const bx = c.x + hx * 15, by = c.y + 2 + hy * 12, tras = by < c.y;
    const itens = o.basket || o.cart, alca = () => { ctx.strokeStyle = "#5b6b73"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(c.x + hx * 5, c.y - 2); ctx.lineTo(bx - hx * 7, by - 5); ctx.stroke(); };
    const sem = Object.assign({}, o, { basket: null, cart: null });   // as compras vão no cestinho do carrinho
    if (tras) { carrinhoBebe(c, bx, by, itens); alca(); person(c, sem); } else { person(c, sem); alca(); carrinhoBebe(c, bx, by, itens); }
    return;
  }
  if (c.perfil === "andador") {
    const ax = c.x + hx * 7, ay = c.y + 3 + hy * 7, tras = ay < c.y + 2, itens = o.basket || o.cart;
    const sem = Object.assign({}, o, { basket: null, cart: null });
    if (tras) { andador(c, ax, ay, itens); person(c, sem); } else { person(c, sem); andador(c, ax, ay, itens); }
    return;
  }
  person(c, o);
  if (c.perfil === "bengala") {
    const t = now(), passo = mov && !REDUZ() ? Math.sin(t * 13 + (c.id || 0) * 1.7) * 2 : 0;
    ctx.strokeStyle = "#5b4636"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(c.x - 10, c.y - 1); ctx.lineTo(c.x - 13 + passo, c.y + 11); ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x - 8.5, c.y - 1.5, 1.8, Math.PI, Math.PI * 1.9); ctx.stroke(); ctx.lineCap = "butt";
  }
}
// marcas sobre a pessoa: pedido de ajuda e uso do atendimento prioritário (dado declarado, não aparência)
function marcasCliente(c) {
  if (c.ajuda && c.ajuda.estado === "pedindo") bubble(c.x + 10, c.y - 34, "🙋", "#e4f0fb", .85);
  if ((c.state === "queue" || c.state === "toLane") && nivelPrio(c) > 0 && c.lane === caixaPrio()) {
    const x = c.x + 7, y = c.y - (c.perfil === "cadeira" ? 30 : 26);       // etiqueta pequena no ombro
    rr(x, y, 19, 7, 3.5, nivelPrio(c) === 2 ? "#1f5fa8" : "#5b6b73"); text("PRIOR.", x + 9.5, y + 5.3, 4.6, "#fff", "center", 800);
  }
}

// ---------- chão: rampas, guias rebaixadas, piso tátil e portas de saída (pintados uma vez) ----------
function pintarAcessibilidade(g, rrg) {
  // piso tátil direcional (amarelo com frisos) da calçada e do estacionamento até a porta
  pisoTatil().forEach(linha => {
    g.strokeStyle = "#e9b52b"; g.lineWidth = 4; g.lineCap = "butt"; g.beginPath(); linha.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
    g.strokeStyle = "rgba(120,80,0,.35)"; g.lineWidth = 0.6; g.setLineDash([1.2, 2]); g.beginPath(); linha.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.setLineDash([]);
  });
  const ent = pisoTatil()[0].slice(-1)[0];          // piso de alerta junto à porta
  g.fillStyle = "#e9b52b"; g.fillRect(ent.x - 6, ent.y - 6, 12, 12);
  g.fillStyle = "rgba(120,80,0,.4)"; for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(ent.x - 4 + i * 4, ent.y - 4 + k * 4, .8, 0, 7); g.fill(); }
  // rampas: soleira da porta e guias rebaixadas (faixas claras com setas de rampa)
  rampasAcesso().forEach(r => {
    g.fillStyle = r.tipo === "porta" ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.7)"; rrg(r.x, r.y, r.w, r.h, 2); g.fill();
    g.strokeStyle = "rgba(90,80,60,.35)"; g.lineWidth = .8;
    if (r.tipo === "porta") { for (let yy = r.y + 4; yy < r.y + r.h - 2; yy += 6) { g.beginPath(); g.moveTo(r.x + 4, yy); g.lineTo(r.x + r.w - 4, yy); g.stroke(); } }
    else { g.beginPath(); g.moveTo(r.x + 2, r.y + r.h); g.lineTo(r.x + r.w / 2, r.y + 1); g.lineTo(r.x + r.w - 2, r.y + r.h); g.stroke(); }
  });
  // portas de saída: vãos na fachada de vidro, um em frente a cada caixa
  g.font = '800 5.5px "Nunito", system-ui, sans-serif'; g.textAlign = "center";
  saidasCaixa().forEach(s => { g.fillStyle = "#cfe4cf"; g.fillRect(s.x - s.w / 2, H - 1, s.w, 6); g.fillStyle = "#2e7a57"; g.fillText("SAÍDA", s.x, H + 12.5); });
}
// fachada de vidro com os vãos das portas de saída
function vidroComSaidas(g) {
  g.fillStyle = "rgba(170,210,232,.85)";
  const vaos = saidasCaixa().map(s => [s.x - s.w / 2, s.x + s.w / 2]).sort((a, b) => a[0] - b[0]);
  let x0 = 20;
  for (const [a, b] of vaos) { if (a > x0) g.fillRect(x0, H, a - x0, 3); x0 = Math.max(x0, b); }
  if (x0 < W - 20) g.fillRect(x0, H, W - 20 - x0, 3);
}

// ---------- caixas com corredor de passagem e caixa prioritário sinalizado ----------
function drawLanesAcess() {
  const t = now(), y0 = FZ + 82, pr = caixaPrio(), um = S.cashiers <= 1;
  LANES.forEach((ln, l) => {
    const open = l < nCaixas(), x = ln.x, st = lanes[l], busy = open && st.servingId, prio = open && l === pr;
    ctx.globalAlpha = open ? 1 : .35;
    ctx.fillStyle = "rgba(40,30,15,.18)"; ctx.beginPath(); ctx.ellipse(x - 8, y0 + 24, 34, 4, 0, 0, 7); ctx.fill();
    // corredor do caixa (por onde o cliente passa ao pagar)
    rr(x - 20, y0 - 2, 24, 26, 3, prio ? "rgba(31,95,168,.16)" : "rgba(40,30,15,.06)");
    if (prio) { ctx.strokeStyle = "rgba(31,95,168,.55)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(x - 19.5, y0 - 1.5, 23, 25); ctx.setLineDash([]); }
    // esteira
    rrs(x - 40, y0, 20, 22, 5, grad(y0, y0 + 22, "#6b7c85", "#4b5a62"), "rgba(0,0,0,.25)");
    rr(x - 38, y0 + 3, 16, 15, 3, "#262f33");
    ctx.save(); rrPath(x - 38, y0 + 3, 16, 15, 3); ctx.clip(); ctx.fillStyle = "rgba(255,255,255,.08)";
    const off = busy && !REDUZ() ? (t * 20) % 6 : 0; for (let k = -6; k < 18; k += 6) ctx.fillRect(x - 38 + k + off, y0 + 3, 2, 15); ctx.restore();
    // balcão com leitor e tela
    rrs(x + 4, y0, 16, 22, 4, grad(y0, y0 + 22, "#6b7c85", "#4b5a62"), "rgba(0,0,0,.25)");
    rrs(x + 6, y0 + 2, 12, 10, 3, "#dfe5e8", "rgba(0,0,0,.25)", .8);
    rr(x + 8, y0 + 4, 8, 4, 1.5, busy ? "#7cc49a" : "#a8b5ba");
    ctx.globalAlpha = 1;
    if (open) person({ x: x + 27, y: y0 + 14, shirt: "#2e7a57", skin: SKIN[l % SKIN.length], hair: HAIR[(l + 2) % HAIR.length], id: l + 50 }, { cap: "#1f4d3a", mood: busy ? "happy" : null });
    if (busy) { const p = 1 - Math.max(0, st.timer) / st.total; rr(x - 40, y0 - 6, 60, 4, 2, "rgba(0,0,0,.15)"); rr(x - 40, y0 - 6, 60 * p, 4, 2, "#2e7a57"); }
    // placa do atendimento prioritário: texto na própria etiqueta do caixa (não só cor)
    if (prio) {
      const rot = `CAIXA ${l + 1} · ${um ? "PRIORIDADE" : "PRIORITÁRIO"}`;
      ctx.font = '800 7.2px "Nunito", system-ui, sans-serif'; const tw = ctx.measureText(rot).width + 12;
      rr(x - 8 - tw / 2, y0 + 28, tw, 13, 6.5, "#1f5fa8"); text(rot, x - 8, y0 + 37, 7.2, "#fff", "center", 800);
    } else text(open ? `CAIXA ${l + 1}` : "FECHADO", x - 8, y0 + 37, 8.5, open ? "#4a3b22" : "#9a8d6f");
  });
}
