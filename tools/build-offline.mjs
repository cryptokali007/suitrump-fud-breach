import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(process.argv[2] || path.join(root, "dist-offline", "SuiTrump-FUD-Breach.html"));
const result = await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: "error",
  build: {
    write: false,
    modulePreload: false,
    assetsInlineLimit: Infinity,
    rollupOptions: { input: path.join(root, "src/game.js"), output: { inlineDynamicImports: true } },
  },
});
const [game] = result.output;
if (result.output.length !== 1 || game.type !== "chunk" || game.imports.length || game.dynamicImports.length || game.referencedFiles.length) {
  throw new Error("The offline game must bundle into a single module with no external assets.");
}

const readSource = (file) => readFile(path.join(root, file), "utf8");
const [template, css, bootstrap, license] = await Promise.all([
  readSource("index.html"),
  readSource("styles.css"),
  readSource("src/bootstrap.js"),
  readSource("node_modules/three/LICENSE"),
]);
const embeddedModule = `data:text/javascript;base64,${Buffer.from(game.code).toString("base64")}`;
const script = `\n${replaceOnce(bootstrap, '"./game.js"', JSON.stringify(embeddedModule)).replace(/\r\n/g, "\n")}\n`;
const hash = createHash("sha256").update(script).digest("base64");
const csp = [
  "default-src 'none'",
  `script-src 'sha256-${hash}' data:`,
  "style-src 'unsafe-inline'",
  "img-src data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

let html = replaceOnce(template, '<meta charset="utf-8" />',
  `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
html = replaceOnce(html, '<link rel="stylesheet" href="./styles.css" />', `<style>\n${css}\n</style>`);
html = replaceOnce(html, '<script type="module" src="./src/bootstrap.js"></script>', `<script type="module">${script}</script>`);
html += `\n<!-- Three.js license\n${license}\n-->\n`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html, "utf8");
console.log(`Offline game: ${output} (${Buffer.byteLength(html).toLocaleString()} bytes)`);

function replaceOnce(source, target, replacement) {
  const index = source.indexOf(target);
  if (index < 0 || source.indexOf(target, index + target.length) >= 0) {
    throw new Error(`Expected exactly one offline build placeholder: ${target}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + target.length);
}
