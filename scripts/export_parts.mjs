import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dumps');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'target', '.git', '.turbo', 'coverage', 'dumps', '.scannerwork', 'dist-package'].includes(entry.name)) {
        continue;
      }
      walk(fullPath, fileList);
    } else {
      fileList.push(fullPath.split(path.sep).join('/'));
    }
  }
  return fileList;
}

const isBinaryOrMedia = p => /\.(png|jpg|jpeg|gif|ico|icns|webp|woff|woff2|ttf|eot|mp4|zip|jar|exe|dll|dylib|so|key|pub)$/i.test(p);
const isTest = p => /(__tests__|\.test\.|\.spec\.)/i.test(p);
const isTauriBoilerplate = p => {
  return p.includes('src-tauri/icons') ||
         p.includes('src-tauri/assets') ||
         p.endsWith('src-tauri/build.rs') ||
         p.includes('src-tauri/capabilities/default.json');
};
const isLockOrMeta = p => {
  return /lock\.yaml$|lock\.json$|Cargo\.lock$|\.log$|\.env/i.test(p);
};

const allFiles = walk(ROOT_DIR);

const groups = {
  '01_backend_rust': {
    title: 'PARTE 1: Backend Rust & Core Tauri',
    desc: 'Lógica nativa, managers de Minecraft (Java, proceso, NBT, crash doctor, delta patch, sync de mods, hardware, RPC y arquitectura de sistema)',
    files: []
  },
  '02_frontend_logic': {
    title: 'PARTE 2: Frontend State, Services & Logic',
    desc: 'Servicios IPC de Tauri, Zustand Store global, registro de módulos dinámicos, tipos TypeScript y utilidades de render/colisión',
    files: []
  },
  '03_frontend_views_layout': {
    title: 'PARTE 3: Frontend Views, Layout & Overlays',
    desc: 'Layout principal (HomeDock, BottomBar, Login, Splash, WindowHeader), overlays de HUD/juego, componentes comunes e inspectores',
    files: []
  },
  '04_frontend_modals': {
    title: 'PARTE 4: Frontend Modales Interactivos',
    desc: 'Todos los modales y ventanas secundarias (Instancias, Crear/Importar, Ajustes, Cuentas, Crash Report, Visor de Logs, etc.)',
    files: []
  }
};

let skippedCount = 0;

for (const fullPath of allFiles) {
  const rel = path.relative(ROOT_DIR, fullPath).split(path.sep).join('/');

  if (isBinaryOrMedia(rel) || isLockOrMeta(rel) || isTest(rel) || isTauriBoilerplate(rel)) {
    skippedCount++;
    continue;
  }

  if (rel.startsWith('src-tauri/')) {
    if (rel.endsWith('.rs') || rel.endsWith('Cargo.toml')) {
      groups['01_backend_rust'].files.push(rel);
    } else {
      skippedCount++;
    }
  } else if (
    rel.startsWith('src/services/') ||
    rel.startsWith('src/store/') ||
    rel.startsWith('src/modules/') ||
    rel.startsWith('src/utils/') ||
    rel.startsWith('src/i18n/') ||
    rel === 'src/vite-env.d.ts' ||
    rel === 'package.json' ||
    rel === 'tsconfig.json' ||
    rel === 'vite.config.ts'
  ) {
    groups['02_frontend_logic'].files.push(rel);
  } else if (rel.startsWith('src/components/modals/')) {
    groups['04_frontend_modals'].files.push(rel);
  } else if (
    rel.startsWith('src/components/') ||
    rel === 'src/App.tsx' ||
    rel === 'src/main.tsx' ||
    rel === 'src/index.css' ||
    rel === 'index.html'
  ) {
    groups['03_frontend_views_layout'].files.push(rel);
  } else {
    skippedCount++;
  }
}

// Ordenar archivos alfabéticamente dentro de cada grupo para consistencia
for (const key of Object.keys(groups)) {
  groups[key].files.sort();
}

const globalIndex = [
  '# CrystalTides Launcher Lite — Índice de Reporte Modular para LLM / Gemini',
  `Generado: ${new Date().toISOString()}`,
  `Total de archivos de código exportados: ${Object.values(groups).reduce((acc, g) => acc + g.files.length, 0)}`,
  `Archivos omitidos (tests, binarios, lockfiles, boilerplate Tauri): ${skippedCount}`,
  '',
  '## Partes Generadas:',
  ''
];

console.log('\n🚀 Generando reportes modulares en:', OUTPUT_DIR);
console.log('='.repeat(70));

for (const [key, group] of Object.entries(groups)) {
  const filename = `${key}.txt`;
  const outPath = path.join(OUTPUT_DIR, filename);

  const fileData = [];
  let totalLines = 0;

  for (const rel of group.files) {
    const abs = path.join(ROOT_DIR, rel);
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split('\n').length;
    totalLines += lines;
    fileData.push({ rel, lines, content });
  }

  const header = [
    '='.repeat(80),
    `  ${group.title}`,
    `  ${group.desc}`,
    `  Archivos: ${group.files.length} | Líneas totales: ${totalLines.toLocaleString()}`,
    '='.repeat(80),
    '',
    'ÍNDICE DE ARCHIVOS EN ESTA PARTE:',
    ...fileData.map((f, i) => `  ${(i + 1).toString().padStart(2, '0')}. ${f.rel} (${f.lines} líneas)`),
    '',
    '='.repeat(80),
    ''
  ].join('\r\n');

  const body = fileData.map(f => {
    return [
      `=== ARCHIVO: ${f.rel} ===`,
      f.content,
      `=== FIN ARCHIVO: ${f.rel} ===`,
      ''
    ].join('\r\n');
  }).join('\r\n');

  const fullContent = header + body;
  fs.writeFileSync(outPath, fullContent, 'utf8');

  const sizeKb = (Buffer.byteLength(fullContent, 'utf8') / 1024).toFixed(1);
  const approxTokens = Math.round(Buffer.byteLength(fullContent, 'utf8') / 4).toLocaleString();

  console.log(`✅ [${filename}]`);
  console.log(`   📂 ${group.files.length} archivos | 📝 ${totalLines.toLocaleString()} líneas | 💾 ${sizeKb} KB | ⚡ ~${approxTokens} tokens`);

  globalIndex.push(`### [${filename}](file:///${outPath.split(path.sep).join('/')})`);
  globalIndex.push(`- **Descripción**: ${group.desc}`);
  globalIndex.push(`- **Archivos**: ${group.files.length} | **Líneas**: ${totalLines.toLocaleString()} | **Peso**: ${sizeKb} KB (~${approxTokens} tokens)`);
  globalIndex.push('');
}

// Generación de Volúmenes Consolidados de ~25k líneas para Gemini Argon
console.log('\n🌟 Generando Volúmenes Consolidados (~25k líneas) para Gemini Argon...');
console.log('='.repeat(70));

const argonVolumes = {
  'informe_argon_vol1_core_backend_logica': {
    title: 'GEMINI ARGON - VOLUMEN 1: Core Nativo Rust & Lógica de Negocio / Estado Frontend',
    desc: 'Arquitectura completa del backend Tauri (Rust managers, IPC, Game Bridge, NBT, DB, parches delta, hardware) + Servicios frontend, Zustand store, módulos y tipos',
    groupKeys: ['01_backend_rust', '02_frontend_logic']
  },
  'informe_argon_vol2_vistas_layout_modales': {
    title: 'GEMINI ARGON - VOLUMEN 2: Interfaz de Usuario, Vistas, Layout, Overlays & Modales',
    desc: 'Todos los componentes visuales del launcher (Dock, BottomBar, HUD, SplashScreen, Login, inspectores) + Todas las ventanas modales (Ajustes, Instancias, Visor de Logs, etc.)',
    groupKeys: ['03_frontend_views_layout', '04_frontend_modals']
  }
};

globalIndex.push('## Volúmenes Consolidados para Gemini Argon (~20k - 25k líneas c/u):');
globalIndex.push('');

for (const [volKey, volConfig] of Object.entries(argonVolumes)) {
  const filename = `${volKey}.txt`;
  const outPath = path.join(OUTPUT_DIR, filename);

  const combinedFiles = [];
  for (const gk of volConfig.groupKeys) {
    combinedFiles.push(...groups[gk].files);
  }
  combinedFiles.sort();

  const fileData = [];
  let totalLines = 0;

  for (const rel of combinedFiles) {
    const abs = path.join(ROOT_DIR, rel);
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split('\n').length;
    totalLines += lines;
    fileData.push({ rel, lines, content });
  }

  const header = [
    '='.repeat(80),
    `  ${volConfig.title}`,
    `  ${volConfig.desc}`,
    `  Archivos incluidos: ${combinedFiles.length} | Líneas totales: ${totalLines.toLocaleString()}`,
    '='.repeat(80),
    '',
    'ÍNDICE DE ARCHIVOS EN ESTE VOLUMEN:',
    ...fileData.map((f, i) => `  ${(i + 1).toString().padStart(2, '0')}. ${f.rel} (${f.lines} líneas)`),
    '',
    '='.repeat(80),
    ''
  ].join('\r\n');

  const body = fileData.map(f => {
    return [
      `=== ARCHIVO: ${f.rel} ===`,
      f.content,
      `=== FIN ARCHIVO: ${f.rel} ===`,
      ''
    ].join('\r\n');
  }).join('\r\n');

  const fullContent = header + body;
  fs.writeFileSync(outPath, fullContent, 'utf8');

  const sizeKb = (Buffer.byteLength(fullContent, 'utf8') / 1024).toFixed(1);
  const approxTokens = Math.round(Buffer.byteLength(fullContent, 'utf8') / 4).toLocaleString();

  console.log(`✅ [${filename}]`);
  console.log(`   📂 ${combinedFiles.length} archivos | 📝 ${totalLines.toLocaleString()} líneas | 💾 ${sizeKb} KB | ⚡ ~${approxTokens} tokens`);

  globalIndex.push(`### [${filename}](file:///${outPath.split(path.sep).join('/')})`);
  globalIndex.push(`- **Enfoque**: ${volConfig.desc}`);
  globalIndex.push(`- **Archivos**: ${combinedFiles.length} | **Líneas**: ${totalLines.toLocaleString()} | **Peso**: ${sizeKb} KB (~${approxTokens} tokens)`);
  globalIndex.push('');
}

// Guardar índice global
const indexPath = path.join(OUTPUT_DIR, '00_INDICE_GLOBAL.txt');
fs.writeFileSync(indexPath, globalIndex.join('\r\n'), 'utf8');

console.log('='.repeat(70));
console.log(`📋 Índice global guardado en: dumps/00_INDICE_GLOBAL.txt`);
console.log(`🎯 Listo para alimentar a Gemini Argon sin saturar contexto!\n`);
