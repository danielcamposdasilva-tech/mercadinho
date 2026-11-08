// Junta www/index.html, css/ e js/ num único HTML (para o artefato e para enviar como arquivo).
// Uso: node tools/arquivo-unico.mjs [saida.html]   (padrão: dist/mercadinho-da-esquina.html)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const www = path.join(raiz, "www");
const saida = path.resolve(process.argv[2] || path.join(raiz, "dist", "mercadinho-da-esquina.html"));
let html = fs.readFileSync(path.join(www, "index.html"), "utf8");
const ler = rel => fs.readFileSync(path.join(www, rel), "utf8");
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => `<style>\n${ler(f)}</style>`);
// cada módulo vira um <script> próprio, na mesma ordem: o escopo global é o mesmo da versão em arquivos
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => `<script>\n${ler(f).replace(/<\/script/gi, "<\\/script")}</script>`);
if (/src="js\//.test(html) || /href="css\//.test(html)) throw new Error("sobrou referência a arquivo local");
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, html);
console.log(`ok: ${saida} (${(html.length / 1024).toFixed(0)} KB)`);
