// Aplica icono, pantalla de arranque, versión y firma al proyecto Android generado por Capacitor.
// Se ejecuta solo (hook "capacitor:sync:after" de package.json) y también desde el workflow. Es idempotente.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.env.CAPACITOR_ROOT_DIR || process.cwd();
const res = path.join(root, 'android/app/src/main/res');
const tag = '[docmaster]';

if (!fs.existsSync(res)) { console.log(tag, 'No hay proyecto android todavía; nada que aplicar.'); process.exit(0); }

const walk = (d, fn) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, fn) : fn(p);
  }
};

// 1. Quitar iconos y splash de la plantilla de Capacitor
let removed = 0;
walk(res, p => {
  const n = path.basename(p);
  if (n === 'splash.png' || n.startsWith('ic_launcher')) { fs.rmSync(p); removed++; }
});

// 2. Copiar los recursos de DocMaster (iconos, splash con logo)
fs.cpSync(path.join(root, 'resources/android/res'), res, { recursive: true });

// 3. Comprobar que quedaron los nuestros
const same = (a, b) => fs.readFileSync(a).equals(fs.readFileSync(b));
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const f of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png', 'ic_launcher_bg.png']) {
    const a = path.join(root, 'resources/android/res', 'mipmap-' + d, f), b = path.join(res, 'mipmap-' + d, f);
    if (!fs.existsSync(b) || !same(a, b)) throw new Error(tag + ' El icono no se aplicó: ' + b);
  }
}
const xml = path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml');
if (!fs.readFileSync(xml, 'utf8').includes('ic_launcher_bg')) throw new Error(tag + ' El icono adaptable no es el de DocMaster');

// 4. Versión (versionName desde package.json, versionCode = nº de ejecución de Actions)
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const gradle = path.join(root, 'android/app/build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
const code = process.env.GITHUB_RUN_NUMBER || '1';
g = g.replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + pkg.version + '"');
fs.writeFileSync(gradle, g);

// 5. Firma fija para que las actualizaciones se instalen encima (solo en CI)
const ks = path.join(root, 'resources/debug.keystore');
if (process.env.CI && fs.existsSync(ks)) {
  const dir = path.join(os.homedir(), '.android');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(ks, path.join(dir, 'debug.keystore'));
}

console.log(tag, 'Icono de DocMaster aplicado (' + removed + ' archivos de plantilla reemplazados). Versión ' + pkg.version + ', compilación ' + code + '.');
